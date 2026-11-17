import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,statSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {MAX_FILE_BYTES,validateUpload,CLOUDMERSIVE_QUARANTINE_MESSAGE} from '../server/block1/uploads.mjs';
import {openLocalDatabase,seedLocalActors,L} from '../server/block1/database.mjs';
import {createLocalApp} from '../server/block1/http.mjs';
import {mockCloudmersive} from './fixtures/cloudmersive-mock.mjs';
const fixtures=Object.fromEntries(['pdf','docx','jpg','png'].map(ext=>[ext,readFileSync(new URL('./fixtures/block15/synthetic.'+ext,import.meta.url))]));
const types={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',jpg:'image/jpeg',png:'image/png'};
const hash=data=>createHash('sha256').update(data).digest('hex');

test('Block 1.5 bounded file validation uses actual document/image fixtures',async t=>{
 for(const ext of Object.keys(fixtures))await t.test(ext+' canonical MIME and content hash',()=>assert.deepEqual(validateUpload(fixtures[ext],'sample.'+ext,types[ext]),{mime:types[ext],sha256:hash(fixtures[ext]),size:fixtures[ext].length}));
 await t.test('JPEG extension alias and generic upload MIME',()=>{assert.equal(validateUpload(fixtures.jpg,'sample.JPEG','application/octet-stream').mime,'image/jpeg');});
 await t.test('10 MB exact boundary allowed, larger and empty files rejected',()=>{
  assert.equal(validateUpload(Buffer.alloc(MAX_FILE_BYTES,65),'large.txt','text/plain').size,MAX_FILE_BYTES);
  for(const bytes of [Buffer.alloc(MAX_FILE_BYTES+1,65),Buffer.alloc(0)])assert.throws(()=>validateUpload(bytes,'sample.txt','text/plain'),/FILE_SIZE_LIMIT/);
 });
 await t.test('unsupported extensions, traversal, double extensions, claimed MIME mismatch rejected',()=>{
  for(const name of ['../sample.pdf','..\\sample.pdf','sample.pdf.exe','sample.svg','sample.pdf\r\n'])assert.throws(()=>validateUpload(fixtures.pdf,name,'application/pdf'));
  assert.throws(()=>validateUpload(fixtures.png,'sample.pdf','application/pdf'),/INVALID_PDF/);
  assert.throws(()=>validateUpload(fixtures.pdf,'sample.pdf','image/png'),/FILE_TYPE_MISMATCH/);
 });
 await t.test('truncated image/PDF and arbitrary ZIP renamed DOCX rejected',()=>{
  assert.throws(()=>validateUpload(fixtures.png.subarray(0,-1),'sample.png',types.png),/INVALID_PNG/);
  assert.throws(()=>validateUpload(fixtures.jpg.subarray(0,-1),'sample.jpg',types.jpg),/INVALID_JPEG/);
  assert.throws(()=>validateUpload(Buffer.from('%PDF-1.7'),'sample.pdf',types.pdf),/INVALID_PDF/);
  assert.throws(()=>validateUpload(Buffer.from('PK\x03\x04not a DOCX'),'sample.docx',types.docx),/INVALID_DOCX/);
 });
 await t.test('DOCX traversal, encrypted archive, dishonest expansion and XML CRC mismatch rejected',()=>{
  const traversal=Buffer.from(fixtures.docx.toString('latin1').replaceAll('word/document.xml','../x/document.xml'),'latin1');
  assert.throws(()=>validateUpload(traversal,'bad.docx',types.docx),/UNSAFE_DOCX/);
  const central=fixtures.docx.indexOf(Buffer.from('504b0102','hex'));
  const encrypted=Buffer.from(fixtures.docx);encrypted.writeUInt16LE(1,central+8);assert.throws(()=>validateUpload(encrypted,'bad.docx',types.docx),/UNSAFE_DOCX/);
  const bomb=Buffer.from(fixtures.docx);bomb.writeUInt32LE(50_000_001,central+24);assert.throws(()=>validateUpload(bomb,'bad.docx',types.docx),/UNSAFE_DOCX/);
  const crc=Buffer.from(fixtures.docx);crc.writeUInt32LE(0,central+16);assert.throws(()=>validateUpload(crc,'bad.docx',types.docx),/INVALID_DOCX/);
 });
});

async function rig(scanner){
 const dir=mkdtempSync(join(tmpdir(),'marocora-block15-'));let db,app;
 try{db=openLocalDatabase(dir,{enableLocalFlow:true});const actors=seedLocalActors(db);app=createLocalApp(db,actors,scanner?{scanner}:{});const origin=await app.listen();
  const sessions={};for(const role of ['customer','staff','provider','otherStaff','outsider']){
   const response=await fetch(origin+'/api/local-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({ticket:app.logins[role]})});assert.equal(response.status,200);
   const cookie=response.headers.get('set-cookie').split(';')[0];const me=await (await fetch(origin+'/api/me',{headers:{Cookie:cookie}})).json();sessions[role]={cookie,csrf:me.csrf,me};
  }
  async function call(role,path,body){const session=sessions[role];const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{Cookie:session.cookie,Origin:origin,'x-csrf-token':session.csrf,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};}
  async function capture(){const id=randomUUID();assert.equal((await call('customer','/api/requests',{requestId:id,fields:{name:'Synthetic format customer',service:'Document Translation',source:'English',target:'French',description:'Local format test only'}})).status,200);return id;}
  async function upload(requestId,ext,bytes=fixtures[ext],fileId=randomUUID(),extra={}){
   const session=sessions.customer,r=await fetch(origin+'/api/requests/'+requestId+'/files/'+fileId,{method:'POST',headers:{Cookie:session.cookie,Origin:origin,'x-csrf-token':session.csrf,'Content-Type':types[ext]||'text/plain','x-file-name':encodeURIComponent('sample.'+ext),...extra},body:bytes});return {status:r.status,body:await r.json(),id:fileId};
  }
  async function download(role,id){const r=await fetch(origin+'/api/files/'+id,{headers:{Cookie:sessions[role].cookie}});return {status:r.status,bytes:Buffer.from(await r.arrayBuffer()),headers:r.headers};}
  async function command(role,requestId,action,payload){const q=await call(role,'/api/requests/'+requestId);return call(role,'/api/command',{commandId:randomUUID(),targetId:requestId,expectedRevision:q.body.revision,action,payload});}
  async function assign(requestId){assert.equal((await command('staff',requestId,'invite_provider',{readinessId:actors.readiness})).status,200);const q=(await call('provider','/api/requests/'+requestId)).body;assert.equal((await command('provider',requestId,'respond_assignment',{assignmentId:q.invitation.id,response:'accepted'})).status,200);}
  async function quote(requestId){const q=(await call('staff','/api/requests/'+requestId)).body,policy=(await call('staff','/api/options')).body.policy;return command('staff',requestId,'issue_offer',{assignmentId:q.assignment.id,content:{scope:'Synthetic uploaded formats',exclusions:'No additional work',total:{minor:12000,currency:'MAD'},turnaround:'After a separate start agreement',revisions:1,expiresAt:new Date(Date.now()+3600000).toISOString(),policyVersion:policy.version,policyDigest:policy.digest,taxTreatment:'Synthetic inclusive total',chargesIncluded:true}});}
  async function accept(requestId){const q=(await call('customer','/api/requests/'+requestId)).body,o=q.offers.at(-1),c=o.content;return command('customer',requestId,'accept_offer',{offerId:o.id,offerDigest:o.digest,policyVersion:c.policyVersion,policyDigest:c.policyDigest,language:'en'});}
  return {db,app,dir,actors,origin,sessions,call,capture,upload,download,command,assign,quote,accept,async close(){await app.close();db.stop();rmSync(dir,{recursive:true,force:true});}};
 }catch(e){if(app)await app.close();if(db)db.stop();rmSync(dir,{recursive:true,force:true});throw e;}
}

test('Block 1.6 mocked Cloudmersive API error remains quarantined over HTTP/DB',{timeout:45000},async t=>{
 const mocked=mockCloudmersive({value:'error'});
 const r=await rig(mocked.scanner);try{
  const request=await r.capture(),files=[];
  for(const ext of Object.keys(fixtures))await t.test(ext+' upload stored privately and quarantined on mocked API error',async()=>{
   const f=await r.upload(request,ext);assert.equal(f.status,202);assert.equal(f.body.scanStatus,'error');assert.equal(f.body.message,CLOUDMERSIVE_QUARANTINE_MESSAGE);assert.equal(f.body.mediaType,types[ext]);files.push(f);
   assert.deepEqual(readFileSync(join(r.dir,'documents',f.id)),fixtures[ext]);assert.equal(statSync(join(r.dir,'documents',f.id)).mode&0o777,0o600);
   for(const role of ['staff','customer','provider','otherStaff','outsider'])assert.equal((await r.download(role,f.id)).status,403);
  });
  await t.test('staff sees quarantine reason; no client may assert clean or release bytes',async()=>{
   const q=(await r.call('staff','/api/requests/'+request)).body;assert.equal(q.documentsHold,true);assert.equal(q.files.length,4);assert.ok(q.files.every(f=>f.scanReason==='API_ERROR'));
   assert.equal((await r.call('customer','/api/requests/'+request)).body.files,undefined);
   assert.equal((await r.call('staff','/api/files/'+files[0].id+'/release',{status:'clean'})).status,404);
   assert.throws(()=>r.db.as(r.actors.staff,`select public.block15_record_scan(${L(files[0].id)},${L(hash(fixtures.pdf))},'clean','forged','forged',${L(r.actors.staff)})`),e=>String(e.stderr).includes('permission denied'));
  });
  await t.test('quarantine persists on retry/rescan; unauthorized rescan denied',async()=>{
   const count=r.db.sql('select count(*) from public.block15_scan_events');
   const replay=await r.upload(request,'pdf',fixtures.pdf,files[0].id,{'x-scan-status':'clean'});assert.equal(replay.body.scanStatus,'error');assert.equal(r.db.sql('select count(*) from public.block15_scan_events'),count);
   for(const role of ['customer','provider','otherStaff'])assert.equal((await r.call(role,'/api/files/'+files[0].id+'/rescan',{})).status,403);
   assert.equal((await r.call('staff','/api/files/'+files[0].id+'/rescan',{})).body.scanStatus,'error');
   await r.assign(request);assert.equal((await r.download('provider',files[0].id)).status,403);
   assert.equal((await r.quote(request)).body.error,'DOCUMENTS_QUARANTINED');
  });
  await t.test('10 MB upload allowed; 10 MB plus one rejected without a blob',async()=>{
   const fresh=await r.capture(),before=readdirSync(join(r.dir,'documents')).length;
   assert.equal((await r.upload(fresh,'txt',Buffer.alloc(MAX_FILE_BYTES+1,65))).status,413);assert.equal(readdirSync(join(r.dir,'documents')).length,before);
   assert.equal((await r.upload(fresh,'txt',Buffer.alloc(MAX_FILE_BYTES,65))).status,202);
   const full=r.db.sql('select count(*) from public.block1_files');assert.equal(full,'5');
  });
  await t.test('quarantine creates no transport attempts; status evidence is immutable',()=>{
   assert.deepEqual(r.app.stats,{emailsSent:0,externalRequests:0});assert.equal(r.db.sql("select count(*) from public.quote_deliveries where state in ('sending','accepted','uncertain')"),'0');
   assert.throws(()=>r.db.sql("update public.block15_scan_events set status='clean'"),e=>String(e.stderr).includes('QUOTE_IMMUTABLE_HISTORY'));
  });
 }finally{await r.close();}
});

test('Block 1.5 injected scanner outcomes exercise full download/quote/acceptance boundaries',{timeout:45000},async t=>{
 const state={value:'clean'},mocked=mockCloudmersive(state);
 const r=await rig(mocked.scanner);try{
  const request=await r.capture(),files=[];
  for(const ext of Object.keys(fixtures))await t.test(ext+' clean adapter outcome allows only authorized exact binary download',async()=>{
   const f=await r.upload(request,ext);assert.equal(f.status,200);assert.equal(f.body.scanStatus,'clean');files.push(f);
   const got=await r.download('staff',f.id);assert.equal(got.status,200);assert.deepEqual(got.bytes,fixtures[ext]);assert.equal(got.headers.get('content-type'),types[ext]);assert.match(got.headers.get('content-disposition'),/^attachment;/);assert.equal(got.headers.get('x-content-type-options'),'nosniff');
   for(const role of ['customer','provider','otherStaff','outsider'])assert.equal((await r.download(role,f.id)).status,403);
  });
  await t.test('accepted assigned translator receives each clean format; quote binds all hashes',async()=>{
   await r.assign(request);for(let i=0;i<files.length;i++)assert.deepEqual((await r.download('provider',files[i].id)).bytes,fixtures[Object.keys(fixtures)[i]]);
   assert.equal((await r.quote(request)).status,200);const q=(await r.call('customer','/api/requests/'+request)).body;assert.equal(q.offers[0].content.documents.length,4);
   for(const file of q.offers[0].content.documents)assert.equal(file.sha256,hash(readFileSync(join(r.dir,'documents',file.id))));
  });
  await t.test('infected result before acceptance blocks bytes, a replacement quote and acceptance',async()=>{
   state.value='infected';assert.equal((await r.call('staff','/api/files/'+files[1].id+'/rescan',{})).body.scanStatus,'infected');
   assert.equal((await r.download('staff',files[1].id)).status,403);assert.equal((await r.download('provider',files[1].id)).status,403);
   assert.equal((await r.quote(request)).body.error,'DOCUMENTS_QUARANTINED');assert.equal((await r.accept(request)).body.error,'DOCUMENTS_QUARANTINED');
   assert.equal(r.db.sql('select count(*) from public.quote_acceptances'),'0');assert.equal(r.db.sql('select count(*) from public.quote_offers'),'1');
   state.value='clean';assert.equal((await r.call('staff','/api/files/'+files[1].id+'/rescan',{})).body.scanStatus,'clean');
  });
  await t.test('scanner error after issuance blocks bytes and acceptance; later clean scan permits exact acceptance',async()=>{
   state.value='throw';assert.equal((await r.call('staff','/api/files/'+files[0].id+'/rescan',{})).body.scanStatus,'error');assert.equal((await r.download('provider',files[0].id)).status,403);
   assert.equal((await r.accept(request)).body.error,'DOCUMENTS_QUARANTINED');assert.equal(r.db.sql('select count(*) from public.quote_acceptances'),'0');
   state.value='clean';assert.equal((await r.call('staff','/api/files/'+files[0].id+'/rescan',{})).body.scanStatus,'clean');assert.equal((await r.accept(request)).status,200);assert.equal(r.db.sql('select count(*) from public.quote_acceptances'),'1');
  });
  await t.test('infected rescan denies old URLs while preserving immutable acceptance evidence',async()=>{
   const acceptance=r.db.sql('select to_jsonb(a) from public.quote_acceptances a');state.value='infected';assert.equal((await r.call('staff','/api/files/'+files[1].id+'/rescan',{})).body.scanStatus,'infected');assert.equal((await r.download('staff',files[1].id)).status,403);assert.equal((await r.download('provider',files[1].id)).status,403);assert.equal(r.db.sql('select to_jsonb(a) from public.quote_acceptances a'),acceptance);assert.equal((await r.call('customer','/api/requests/'+request)).body.documentsHold,true);
  });
  await t.test('malformed/forged files fail before storage and clean cannot override revoked assignment',async()=>{
   const fresh=await r.capture(),count=r.db.sql('select count(*) from public.block1_files');assert.equal((await r.upload(fresh,'pdf',fixtures.png)).status,400);assert.equal(r.db.sql('select count(*) from public.block1_files'),count);
   state.value='clean';await r.call('staff','/api/files/'+files[1].id+'/rescan',{});r.db.sql(`insert into public.translation_exclusions(user_id,reason) values(${L(r.actors.provider)},'Synthetic Block 1.5 revocation')`);assert.equal((await r.download('provider',files[1].id)).status,403);
  });
  console.log('SCANNER_EVIDENCE: clean/infected/error outcomes above used an injected TEST ONLY adapter; no real antivirus detection is claimed.');
 }finally{await r.close();}
});
