import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,readdirSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openLocalDatabase,seedLocalActors,L,J} from '../server/block1/database.mjs';
import {createLocalApp} from '../server/block1/http.mjs';
import {validateDOB,SWORN_SERVICE,IN_PERSON,GUARANTEE,USB_WARNING,SHIPPING_WARNING,USB_COST_WARNING} from '../server/block1/ui/block2-contracts.mjs';
import {mockCloudmersive} from './fixtures/cloudmersive-mock.mjs';
const png=readFileSync(new URL('./fixtures/block15/synthetic.png',import.meta.url)),pdf=readFileSync(new URL('./fixtures/block15/synthetic.pdf',import.meta.url));

test('Block 2 DOB requires canonical spelled-out month and a real past calendar date',()=>{
 for(const v of ['August 1 1960','February 29 2000','December 31 1999'])assert.equal(validateDOB(v),v);
 for(const v of ['08/01/1960','01/08/1960','1960-08-01','08011960','8 1 1960','Aug 1 1960','august 1 1960','August 01 1960','February 29 1900','April 31 1960','August 1 9999',' August 1 1960','August 1 1960\n',null])assert.throws(()=>validateDOB(v),undefined,String(v));
});

test('Block 2 mock-scanned local credentials, Morocco-only orders, immutable fulfillment and submission lock',{timeout:60000},async t=>{
 const dir=mkdtempSync(join(tmpdir(),'marocora-block2-')),state={value:'clean'},mock=mockCloudmersive(state);let db,app;
 try{
  db=openLocalDatabase(dir,{block2:true,enableLocalFlow:true});const actors=seedLocalActors(db);
  assert.throws(()=>createLocalApp(db,actors,{scanner:{available:true,scan(){throw Error('must not run');}}}),/BLOCK2_MOCK_SCANNER_REQUIRED/);
  app=createLocalApp(db,actors,{scanner:mock.scanner});const origin=await app.listen(),sessions={};
  for(const role of ['customer','staff','provider','otherStaff','outsider']){
   const response=await fetch(origin+'/api/local-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({ticket:app.logins[role]})});assert.equal(response.status,200);
   const cookie=response.headers.get('set-cookie').split(';')[0],me=await(await fetch(origin+'/api/me',{headers:{Cookie:cookie}})).json();sessions[role]={cookie,csrf:me.csrf};
  }
  async function call(role,path,body){const x=sessions[role],r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{Cookie:x.cookie,Origin:origin,'x-csrf-token':x.csrf,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};}
  const regular={name:'Synthetic customer',service:'Document Translation',source:'English',target:'French',description:'Synthetic local order'};
  const sworn={...regular,service:SWORN_SERVICE,certified:{country:'Morocco',jurisdiction:'Morocco',receivingAuthority:'Synthetic Moroccan authority',requirements:'No instructions supplied',missingInstructions:true}};
  async function capture(fields=regular,draft=false){const id=randomUUID(),r=await call('customer','/api/requests',{requestId:id,fields,draft});assert.equal(r.status,200,JSON.stringify(r.body));return id;}
  async function upload(requestId,bytes=pdf,name='original.pdf'){
   const x=sessions.customer,r=await fetch(origin+'/api/requests/'+requestId+'/files/'+randomUUID(),{method:'POST',headers:{Cookie:x.cookie,Origin:origin,'x-csrf-token':x.csrf,'Content-Type':name.endsWith('.png')?'image/png':name.endsWith('.txt')?'text/plain':'application/pdf','x-file-name':name},body:bytes});return {status:r.status,body:await r.json()};
  }
  async function credential(role='provider',dob='August 1 1960',bytes=png,name='credential.png'){
   const x=sessions[role],r=await fetch(origin+'/api/credentials',{method:'POST',headers:{Cookie:x.cookie,Origin:origin,'x-csrf-token':x.csrf,'Content-Type':name.endsWith('.png')?'image/png':'application/pdf','x-file-name':name,'x-credential-fields':encodeURIComponent(JSON.stringify({legalName:'Synthetic Moroccan Translator',dob,credentialNumber:'SYNTHETIC-MOJ-001'}))},body:bytes});return {status:r.status,body:await r.json()};
  }
  async function command(role,id,action,payload){const q=(await call(role,'/api/requests/'+id)).body;return call(role,'/api/command',{commandId:randomUUID(),targetId:id,expectedRevision:q.revision,action,payload});}
  async function assign(id){let r=await command('staff',id,'invite_provider',{readinessId:actors.readiness});assert.equal(r.status,200,JSON.stringify(r.body));const q=(await call('provider','/api/requests/'+id)).body;r=await command('provider',id,'respond_assignment',{assignmentId:q.invitation.id,response:'accepted'});assert.equal(r.status,200,JSON.stringify(r.body));}
  const policy=(await call('staff','/api/options')).body.policy;
  async function quote(id){const q=(await call('staff','/api/requests/'+id)).body;return command('staff',id,'issue_offer',{assignmentId:q.assignment.id,content:{scope:'Synthetic exact translation',exclusions:'No extra services',total:{minor:12000,currency:'MAD'},turnaround:'After separate work authorization',revisions:1,expiresAt:new Date(Date.now()+3600000).toISOString(),policyVersion:policy.version,policyDigest:policy.digest,taxTreatment:'Synthetic translation total',chargesIncluded:true}});}
  async function acceptance(id,fulfillment){const q=(await call('customer','/api/requests/'+id)).body,o=q.offers.at(-1);return command('customer',id,'accept_offer',{offerId:o.id,offerDigest:o.digest,policyVersion:policy.version,policyDigest:policy.digest,language:'en',fulfillment});}
  let cid,swornId;
  async function review(decision,role='staff'){const c=(await call('staff','/api/credentials')).body.find(c=>c.id===cid);return call(role,'/api/credentials/'+cid+'/review',{reviewId:randomUUID(),expectedRevision:c.revision,decision,reason:'Synthetic manual staff review'});}

  await t.test('numeric DOB, impossible DOB, missing/nonimage/malformed/oversize image and forged role fail before scanner',async()=>{
   const count=mock.calls.length;
   for(const dob of ['08/01/1960','01/08/1960','1960-08-01','February 30 1960'])assert.equal((await credential('provider',dob)).status,400);
   assert.equal((await credential('customer')).status,403);
   assert.equal((await credential('provider','August 1 1960',Buffer.alloc(0))).status,413);
   assert.equal((await credential('provider','August 1 1960',pdf,'credential.pdf')).status,415);
   assert.equal((await credential('provider','August 1 1960',pdf)).status,400);
   assert.equal((await credential('provider','August 1 1960',Buffer.alloc(10000001))).status,413);
   assert.equal(mock.calls.length,count);assert.equal(db.sql('select count(*) from public.block2_credentials'),'0');
   for(const dob of ['08/01/1960','01/08/1960','February 30 1960'])assert.throws(()=>db.sql('select public.block2_dob('+L(dob)+')'));
  });
  await t.test('infected and error credential images leave no retained image or approvable profile',async()=>{
   for(const outcome of ['infected','error']){state.value=outcome;const r=await credential();assert.equal(r.status,202);assert.equal(r.body.scanStatus,outcome);assert.equal(r.body.reviewState,'not_submitted');assert.equal(readdirSync(join(dir,'credentials')).length,0);}
   assert.equal(db.sql('select count(*) from public.block2_credentials'),'0');assert.equal(db.sql('select count(*) from public.block2_credential_scans'),'2');state.value='clean';
  });
  await t.test('clean credential saved privately pending staff approval; DOB/number/image hidden from others',async()=>{
   const r=await credential();assert.equal(r.status,201,JSON.stringify(r.body));assert.equal(r.body.reviewState,'pending');cid=r.body.id;
   assert.equal(statSync(join(dir,'credentials')).mode&0o777,0o700);assert.equal(statSync(join(dir,'credentials',cid)).mode&0o777,0o600);
   for(const role of ['customer','otherStaff','outsider']){assert.deepEqual((await call(role,'/api/credentials')).body,[]);assert.equal((await fetch(origin+'/api/credentials/'+cid+'/file',{headers:{Cookie:sessions[role].cookie}})).status,403);}
   for(const role of ['staff','provider']){const r=await fetch(origin+'/api/credentials/'+cid+'/file',{headers:{Cookie:sessions[role].cookie}});assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),png);}
   assert.throws(()=>db.as(actors.provider,`select public.block2_record_credential(${L(randomUUID())},${L(actors.provider)},'{}','{}','{}')`),e=>String(e.stderr).includes('permission denied'));
  });
  await t.test('Morocco is required in HTTP and SQL; interpretation and legacy unscoped sworn label remain rejected',async()=>{
   for(const country of ['France','MA','morocco','']){const fields={...sworn,certified:{...sworn.certified,country}};assert.equal((await call('customer','/api/requests',{requestId:randomUUID(),fields,draft:true})).status,400);assert.throws(()=>db.as(actors.customer,`select public.block2_capture(${L(randomUUID())},${J({service:fields.service,source:fields.source,target:fields.target,description:fields.description,certified:fields.certified})},'{"name":"Synthetic"}',true)`));}
   for(const service of ['Interpretation','Certified / Sworn Translation'])assert.equal((await call('customer','/api/requests',{requestId:randomUUID(),fields:{...regular,service},draft:true})).status,400);
  });
  await t.test('missing instructions allowed; original PDF/image required before submitting; submitted request locks immediately',async()=>{
   swornId=await capture(sworn,true);assert.equal((await call('customer','/api/requests/'+swornId+'/submit',{})).body.error,'ORIGINAL_SCAN_REQUIRED');
   assert.equal((await upload(swornId,Buffer.from('Not a scan'),'note.txt')).status,200);
   assert.equal((await call('customer','/api/requests/'+swornId+'/submit',{})).body.error,'ORIGINAL_SCAN_REQUIRED');
   assert.equal((await upload(swornId)).body.scanStatus,'clean');assert.equal((await call('customer','/api/requests/'+swornId+'/submit',{})).status,200);
   const q=(await call('customer','/api/requests/'+swornId)).body;assert.equal(q.scope.certified.missingInstructions,true);assert.equal(q.scope.certified.country,'Morocco');assert.equal(q.submitted,true);
   const count=mock.calls.length;assert.equal((await upload(swornId)).status,409);assert.equal(mock.calls.length,count);
  });
  await t.test('clean credential is not approval; provider and unrelated staff cannot approve',async()=>{
   assert.equal((await command('staff',swornId,'invite_provider',{readinessId:actors.readiness})).body.error,'SWORN_CREDENTIAL_REQUIRED');
   assert.equal((await review('approved','provider')).status,403);assert.equal((await review('approved','otherStaff')).status,403);
   assert.equal((await review('approved')).status,200);await assign(swornId);assert.equal((await quote(swornId)).status,200);
   const q=(await call('customer','/api/requests/'+swornId)).body;assert.equal(q.offers[0].content.fulfillmentTerms.inPerson,IN_PERSON);assert.equal(q.offers[0].content.fulfillmentTerms.guarantee,GUARANTEE);
  });
  await t.test('credential revocation immediately blocks provider bytes and acceptance without editing quote history',async()=>{
   const q=(await call('staff','/api/requests/'+swornId)).body,file=q.files.find(f=>f.mediaType==='application/pdf');
   assert.equal((await review('revoked')).status,200);assert.equal((await fetch(origin+'/api/files/'+file.id,{headers:{Cookie:sessions.provider.cookie}})).status,403);
   assert.equal((await acceptance(swornId,{method:'in_person',originalCheckAccepted:true,guaranteeAccepted:true})).body.error,'SWORN_CREDENTIAL_REQUIRED');
   assert.equal(db.sql('select count(*) from public.quote_acceptances'),'0');assert.equal((await review('approved')).status,200);
  });
  await t.test('sworn originals remain quarantined on mocked error/infected responses; clean scan gate cannot be replaced by approval',async()=>{
   for(const outcome of ['error','infected']){
    const id=await capture(sworn,true);state.value=outcome;const uploaded=await upload(id);assert.equal(uploaded.body.scanStatus,outcome);await call('customer','/api/requests/'+id+'/submit',{});await assign(id);
    assert.equal((await quote(id)).body.error,'DOCUMENTS_QUARANTINED');
    for(const role of ['staff','provider'])assert.equal((await fetch(origin+'/api/files/'+uploaded.body.id,{headers:{Cookie:sessions[role].cookie}})).status,403);
   }
   state.value='clean';
  });
  await t.test('sworn acceptance requires physical original/guarantee acknowledgements and remains no-work/no-payment',async()=>{
   assert.throws(()=>db.command(actors.outsider,{commandId:randomUUID(),action:'accept_offer',targetId:swornId,expectedRevision:1,payload:{fulfillment:{method:'email'}}}),e=>String(e.stderr).includes('UNAVAILABLE'));
   assert.equal((await acceptance(swornId,{method:'email'})).body.error,'IN_PERSON_REQUIRED');
   assert.equal((await acceptance(swornId,{method:'in_person',originalCheckAccepted:false,guaranteeAccepted:true})).body.error,'IN_PERSON_REQUIRED');
   assert.equal((await acceptance(swornId,{method:'in_person',originalCheckAccepted:true,guaranteeAccepted:true})).status,200);
   const q=(await call('staff','/api/requests/'+swornId)).body;assert.equal(q.state,'accepted_pending_activation');assert.equal(q.fulfillment.method,'in_person');assert.equal(q.fulfillment.terms.guarantee,GUARANTEE);
   assert.equal((await upload(swornId)).status,409);
  });
  await t.test('regular Email/Shipping/Encrypted USB choices and exact warnings persist and are staff-visible',async()=>{
   for(const method of ['email','shipping','usb']){
    const id=await capture();assert.equal((await upload(id)).body.error,'REQUEST_SUBMITTED');await assign(id);assert.equal((await quote(id)).status,200);
    if(method!=='email')assert.equal((await acceptance(id,{method})).body.error,'EXTRA_COSTS_ACK_REQUIRED');
    if(method==='usb')assert.equal((await acceptance(id,{method,extraCostsAccepted:true})).body.error,'ENCRYPTION_ACK_REQUIRED');
    const choice={method,...(method!=='email'?{extraCostsAccepted:true}:{}),...(method==='usb'?{encryptionAccepted:true}:{})};assert.equal((await acceptance(id,choice)).status,200);
    const q=(await call('staff','/api/requests/'+id)).body;assert.equal(q.fulfillment.method,method);assert.equal(q.fulfillment.terms.shipping,SHIPPING_WARNING);assert.equal(q.fulfillment.terms.usbCosts,USB_COST_WARNING);assert.equal(q.fulfillment.terms.usbSecurity,USB_WARNING);
    assert.equal((await upload(id)).status,409);
    const row=db.sql(`select to_jsonb(m) from public.block2_mock_mail m where request_id=${L(id)}`);
    if(method==='shipping')assert.equal(row,'');else{const mail=JSON.parse(row);assert.equal(mail.destination,'customer@block1.invalid');assert.equal(mail.content.sent,false);assert.equal(mail.content.fileAttached,false);assert.equal(mail.content.passwordGenerated,false);assert.equal(mail.state,method==='email'?'waiting_for_final_file':'waiting_for_encrypted_usb_preparation');}
   }
  });
  await t.test('drafts cannot be quoted and acceptance replay does not duplicate fulfillment or mock email',async()=>{
   const draft=await capture(regular,true);await assign(draft);assert.equal((await quote(draft)).body.error,'REQUEST_NOT_SUBMITTED');
   assert.equal((await call('customer','/api/requests/'+draft+'/submit',{})).status,200);assert.equal((await quote(draft)).status,200);
   const q=(await call('customer','/api/requests/'+draft)).body,o=q.offers[0],c={commandId:randomUUID(),action:'accept_offer',targetId:draft,expectedRevision:q.revision,payload:{offerId:o.id,offerDigest:o.digest,policyVersion:policy.version,policyDigest:policy.digest,language:'en',fulfillment:{method:'email'}}};
   const first=await call('customer','/api/command',c);assert.equal(first.status,200);assert.deepEqual((await call('customer','/api/command',c)).body,first.body);
   assert.equal(db.sql(`select count(*) from public.block2_mock_mail where request_id=${L(draft)}`),'1');
   assert.equal((await call('customer','/api/command',{...c,payload:{...c.payload,fulfillment:{method:'usb',extraCostsAccepted:true,encryptionAccepted:true}}})).body.error,'COMMAND_CONFLICT');
  });
  await t.test('new pending credential removes sworn approval; regular service remains available; immutable review/fulfillment history',async()=>{
   assert.equal((await credential()).status,201);assert.equal(db.sql(`select public.block2_credential_approved(${L(actors.provider)})`),'f');
   const id=await capture(sworn,true);await upload(id);await call('customer','/api/requests/'+id+'/submit',{});assert.equal((await command('staff',id,'invite_provider',{readinessId:actors.readiness})).body.error,'SWORN_CREDENTIAL_REQUIRED');
   const regularId=await capture();await assign(regularId);assert.equal((await quote(regularId)).status,200);
   for(const table of ['block2_credentials','block2_credential_reviews','block2_fulfillments','block2_mock_mail'])assert.throws(()=>db.sql(`delete from public.${table}`),e=>String(e.stderr).includes('QUOTE_IMMUTABLE_HISTORY'));
   assert.deepEqual(app.stats,{emailsSent:0,externalRequests:0});assert.equal(db.sql("select count(*) from public.quote_deliveries where state in ('sending','accepted','uncertain')"),'0');
  });
  await t.test('new UI contains strict onboarding fields, all warnings and missing-page new-order link',()=>{
   const credentialUI=readFileSync(new URL('../server/block1/ui/block2-credentials.html',import.meta.url),'utf8');for(const label of ['Full Legal Name','Date of Birth','Ministry of Justice Credential Number','type="file"','required'])assert.ok(credentialUI.includes(label));
   assert.ok(readFileSync(new URL('../server/block1/ui/block1-workspace.mjs',import.meta.url),'utf8').includes('Missing a page? Start a new order.'));
  });
  await t.test('restart preserves approvals/acceptances/mock queue once and defaults every gate OFF',async()=>{
   const count=db.sql('select count(*) from public.block2_mock_mail');await app.close();app=null;db.stop();db=null;db=openLocalDatabase(dir,{block2:true});
   assert.equal(db.sql('select count(*) from public.block2_mock_mail'),count);const settings=JSON.parse(db.sql('select to_jsonb(s) from public.quote_settings s'));for(const key of ['capture_enabled','commands_enabled','notifications_enabled'])assert.equal(settings[key],false);
   assert.equal(db.sql('select count(*) from public.block2_fulfillments'),'5');
  });
 }finally{if(app)await app.close();if(db)db.stop();rmSync(dir,{recursive:true,force:true});}
});
