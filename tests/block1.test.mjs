import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {openLocalDatabase,seedLocalActors,L} from '../server/block1/database.mjs';
import {createLocalApp} from '../server/block1/http.mjs';

test('Block 1 real local HTTP / native PostgreSQL / private file lifecycle',{timeout:45000},async t=>{
 const dir=mkdtempSync(join(tmpdir(),'marocora-block1-'));let db,app;
 const checks=[];const check=async(name,fn)=>{await t.test(name,fn);checks.push(name);};
 try{
  // Injected deterministic clean scanner tests authorization; not real AV proof.
  const scanner={available:true,engine:'TEST ONLY clean scanner',scan:()=>({status:'clean',engine:'TEST ONLY clean scanner',reason:'SYNTHETIC_CLEAN'})};
  db=openLocalDatabase(dir,{enableLocalFlow:true});const actors=seedLocalActors(db);app=createLocalApp(db,actors,{scanner});let origin=await app.listen();
  async function login(role){
   const r=await fetch(origin+'/api/local-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({ticket:app.logins[role]})});assert.equal(r.status,200);
   const cookie=r.headers.get('set-cookie').split(';')[0];const me=await (await fetch(origin+'/api/me',{headers:{Cookie:cookie}})).json();return {cookie,csrf:me.csrf};
  }
  const customer=await login('customer'),staff=await login('staff'),provider=await login('provider'),outsider=await login('outsider'),otherStaff=await login('otherStaff');
  const call=async(session,path,body,extra={})=>{
   const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{Cookie:session.cookie,Origin:origin,'x-csrf-token':session.csrf,...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
   return {status:r.status,body:await r.json(),headers:r.headers};
  };
  const fields={name:'Synthetic customer <script>not executable</script>',phone:'local only',service:'Document Translation',source:'English',target:'French',description:'Translate the attached synthetic text; no live customer data.'};
  const requestId=randomUUID(),fileId=randomUUID();const data=Buffer.from('Synthetic regular translation document.\nNo real customer data.');
  const upload=async(session,bytes=data,name='document.txt',file=fileId,type='text/plain')=>fetch(origin+'/api/requests/'+requestId+'/files/'+file,{method:'POST',headers:{Cookie:session.cookie,Origin:origin,'x-csrf-token':session.csrf,'Content-Type':type,'x-file-name':encodeURIComponent(name)},body:bytes});
  const detail=session=>call(session,'/api/requests/'+requestId);
  async function command(session,action,payload={},overrides={}){
   const q=(await detail(session)).body;return call(session,'/api/command',{commandId:randomUUID(),action,targetId:requestId,expectedRevision:q.revision,payload,...overrides});
  }
  await check('all three local switches ON; draft guards and public production remain untouched',async()=>{
   const me=(await call(customer,'/api/me')).body;for(const k of ['capture_enabled','commands_enabled','notifications_enabled'])assert.equal(me.switches[k],true);
   assert.match(readFileSync(new URL('../supabase/quote_workflow.draft.sql',import.meta.url),'utf8'),/rollback;\s*$/);
   assert.equal(db.sql("select count(*) from pg_namespace where nspname='quote_fixture'"),'0');
  });
  await check('anonymous, foreign host/origin, CSRF and consumed login tickets denied',async()=>{
   assert.equal((await fetch(origin+'/api/requests')).status,401);
   assert.equal((await call(customer,'/api/requests',{requestId,fields},{Origin:'https://evil.invalid'})).status,403);
   assert.equal((await call(customer,'/api/requests',{requestId,fields},{'x-csrf-token':'wrong'})).status,403);
   const r=await fetch(origin+'/api/local-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({ticket:app.logins.customer})});assert.equal(r.status,401);
   const hostStatus=await new Promise((resolve,reject)=>{const request=httpRequest(origin+'/api/me',{headers:{Cookie:customer.cookie,Host:'evil.invalid'}},response=>{response.resume();resolve(response.statusCode);});request.on('error',reject);request.end();});assert.equal(hostStatus,403);
  });
  await check('regular-only canonical intake; forbidden fields and special services rejected',async()=>{
   for(const service of ['Interpretation','Certified / Sworn Translation'])assert.equal((await call(customer,'/api/requests',{requestId:randomUUID(),fields:{...fields,service}})).status,400);
   assert.equal((await call(customer,'/api/requests',{requestId,fields,actor:actors.staff})).status,400);
   assert.equal((await call(customer,'/api/requests',{requestId,fields:{...fields,source:'Other'}})).status,400);
   const r=await call(customer,'/api/requests',{requestId,fields});assert.equal(r.status,200);assert.equal(r.body.id,requestId);
   assert.equal(JSON.parse(db.sql(`select fields->'quote_scope_v1' from public.service_intakes where id=${L(requestId)}`)).description,fields.description);
   assert.equal(db.sql(`select is_test from public.quote_requests where id=${L(requestId)}`),'t');
  });
  await check('intake replay is exact and atomic; customer/staff ownership projections separated',async()=>{
   assert.equal((await call(customer,'/api/requests',{requestId,fields})).status,200);
   assert.equal((await call(customer,'/api/requests',{requestId,fields:{...fields,description:'changed'}})).status,409);
   assert.equal((await detail(outsider)).status,403);assert.equal((await detail(otherStaff)).status,403);
   assert.equal((await detail(staff)).body.customer.email,'customer@block1.invalid');
   assert.equal((await detail(customer)).body.customer,undefined);
   assert.equal(db.sql('select count(*) from public.quote_requests'),'1');
  });
  await check('bounded UTF-8 TXT upload, private disk permissions, content hash and retry',async()=>{
   assert.equal((await upload(customer,Buffer.from('%PDF-1.7'),'sample.pdf',randomUUID(),'application/pdf')).status,400);
   assert.equal((await upload(customer,Buffer.from([255,0]),'bad.txt',randomUUID())).status,400);
   assert.equal((await upload(customer,Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'),'bad.txt',randomUUID())).status,400);
   assert.equal((await upload(customer,Buffer.alloc(10000001,65),'big.txt',randomUUID())).status,413);
   assert.equal((await upload(customer,data,'../escape.txt',randomUUID())).status,400);
   assert.equal((await upload(customer)).status,200);assert.equal((await upload(customer)).status,200);
   assert.equal((await upload(customer,Buffer.from('changed'))).status,409);
   assert.equal(statSync(join(dir,'documents')).mode&0o777,0o700);assert.equal(statSync(join(dir,'documents',fileId)).mode&0o777,0o600);
   assert.deepEqual(readFileSync(join(dir,'documents',fileId)),data);
  });
  await check('only staff owner can read before assignment; customer and other staff cannot download',async()=>{
   for(const session of [customer,provider,outsider,otherStaff])assert.equal((await call(session,'/api/files/'+fileId)).status,403);
   const r=await fetch(origin+'/api/files/'+fileId,{headers:{Cookie:staff.cookie}});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'text/plain; charset=utf-8');assert.match(r.headers.get('content-disposition'),/^attachment;/);assert.deepEqual(Buffer.from(await r.arrayBuffer()),data);
   assert.equal((await fetch(origin+'/tmp/block1-private/documents/'+fileId)).status,404);
   assert.equal((await fetch(origin+'/server/block1/local.sql')).status,404);
  });
  await check('invited provider sees no document/customer identity; accepted assignment unlocks document',async()=>{
   assert.equal((await command(staff,'invite_provider',{readinessId:actors.readiness})).status,200);
   const q=(await detail(provider)).body;assert.ok(q.invitation);assert.equal(q.files,undefined);assert.equal(q.customer,undefined);
   assert.equal((await call(provider,'/api/files/'+fileId)).status,403);
   assert.equal((await command(provider,'respond_assignment',{assignmentId:q.invitation.id,response:'accepted'})).status,200);
   const r=await fetch(origin+'/api/files/'+fileId,{headers:{Cookie:provider.cookie}});assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),data);
  });
  const policy=(await call(staff,'/api/options')).body.policy;
  const content={scope:'Synthetic exact scope',exclusions:'No additional services',total:{minor:12000,currency:'MAD'},turnaround:'Three days after a separate start agreement',revisions:1,expiresAt:new Date(Date.now()+3600000).toISOString(),policyVersion:policy.version,policyDigest:policy.digest,taxTreatment:'Local synthetic treatment; all provider charges included',chargesIncluded:true};
  let offer;
  await check('staff-owned quote uses actual staff issuer, assigned provider and frozen document manifest',async()=>{
   const q=(await detail(staff)).body;const payload={assignmentId:q.assignment.id,content};
   assert.equal((await command(provider,'issue_offer',payload)).status,403);
   assert.equal((await command(staff,'issue_offer',payload)).status,200);
   const o=JSON.parse(db.sql('select to_jsonb(o) from public.quote_offers o'));
   assert.equal(o.issued_by,actors.staff);assert.equal(o.provider_id,actors.provider);
   assert.equal(o.content.documents[0].sha256,createHash('sha256').update(data).digest('hex'));
   offer=(await detail(customer)).body.offers[0];assert.equal(offer.content.total.minor,12000);
   assert.equal((await upload(customer,data,'more.txt',randomUUID())).status,409);
  });
  await check('stale/forged acceptance denied; exact acceptance and retry persist once without work/payment',async()=>{
   const payload={offerId:offer.id,offerDigest:offer.digest,policyVersion:policy.version,policyDigest:policy.digest,language:'en'};
   assert.equal((await command(customer,'accept_offer',{...payload,offerDigest:'0'.repeat(64)})).status,400);
   assert.equal((await command(customer,'accept_offer',payload,{expectedRevision:1})).status,409);
   const q=(await detail(customer)).body;const c={commandId:randomUUID(),action:'accept_offer',targetId:requestId,expectedRevision:q.revision,payload};
   const first=await call(customer,'/api/command',c);assert.equal(first.status,200);assert.deepEqual((await call(customer,'/api/command',c)).body,first.body);
   assert.equal(db.sql('select count(*) from public.quote_acceptances'),'1');
   assert.equal((await detail(customer)).body.state,'accepted_pending_activation');
   assert.equal((await detail(customer)).body.acceptance.offerDigest,offer.digest);
   assert.equal((await command(staff,'pay',{})).status,400);
   assert.equal((await command(staff,'start_work',{})).status,400);
  });
  await check('queued frozen notifications only; no sender, transport or real email',async()=>{
   assert.ok(Number(db.sql("select count(*) from public.quote_deliveries where state='pending'"))>0);
   assert.equal(db.sql("select count(*) from public.quote_deliveries where state in ('sending','accepted','uncertain')"),'0');
   assert.equal(db.sql("select count(*) from public.quote_deliveries where state='pending' and (destination is null or content_digest is null or content is null)"),'0');
   assert.deepEqual(app.stats,{emailsSent:0,externalRequests:0});
  });
  await check('database and documents survive local restart; acceptance and queue are not duplicated',async()=>{
   const count=db.sql('select count(*) from public.quote_deliveries');await app.close();app=null;db.stop();db=openLocalDatabase(dir,{enableLocalFlow:true});
   assert.deepEqual(seedLocalActors(db),actors);assert.equal(db.sql('select count(*) from public.quote_acceptances'),'1');assert.equal(db.sql('select count(*) from public.quote_deliveries'),count);
   assert.deepEqual(readFileSync(join(dir,'documents',fileId)),data);app=createLocalApp(db,actors,{scanner});origin=await app.listen();
  });
  const newStaff=await login('staff'),newProvider=await login('provider'),newCustomer=await login('customer');
  await check('revocation/eligibility loss denies file immediately, including old URLs',async()=>{
   db.sql(`insert into public.translation_exclusions(user_id,reason) values(${L(actors.provider)},'Synthetic exclusion after acceptance')`);
   assert.equal((await call(newProvider,'/api/files/'+fileId)).status,403);
   assert.equal((await detail(newCustomer)).body.eligibilityHold,true);
   assert.equal((await fetch(origin+'/api/files/'+fileId,{headers:{Cookie:newStaff.cookie}})).status,200);
  });
  await check('capture/command OFF is enforced; all three restored ON for local final state',async()=>{
   db.sql('update public.quote_settings set capture_enabled=false,commands_enabled=false,notifications_enabled=false');
   assert.equal((await call(newCustomer,'/api/requests',{requestId:randomUUID(),fields})).body.error,'CAPTURE_DISABLED');
   const q=(await detail(newCustomer)).body;assert.equal((await call(newCustomer,'/api/command',{commandId:randomUUID(),action:'cancel_request',targetId:requestId,expectedRevision:q.revision,payload:{reason:'synthetic'}})).body.error,'COMMANDS_DISABLED');
   db.sql('update public.quote_settings set capture_enabled=true,commands_enabled=true,notifications_enabled=true');
  });
  console.log(JSON.stringify({block1Checks:checks.length,scope:'Synthetic local HTTP/PostgreSQL/files only',switches:{capture:true,commands:true,notifications:true},notifications:'pending database queue only',emailsSent:0,productionConnections:0}));
 }finally{if(app)await app.close();if(db)db.stop();rmSync(dir,{recursive:true,force:true});}
});
