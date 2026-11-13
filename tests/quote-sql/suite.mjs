import assert from 'node:assert/strict';
import {scope as validateScope,capabilities as validateCapabilities} from '../../server/quote/contracts.mjs';
export async function runTests(api) {
 const {sql,query,value,command,commandSQL,parallel,restart,literal:L,json:J,as,randomUUID:uuid,digest}=api;
 const passed=[];
 async function test(name,fn){await fn();passed.push(name);console.log('PASS '+name);}
 const scope={service:'Document Translation',source:'English',target:'French',description:'Synthetic SQL fixture only'};
 const caps={services:['Document Translation'],directions:[{source:'English',target:'French'}],currencies:['MAD','JPY','KWD'],availability:'Synthetic availability',specialAssessment:'No certified or interpretation capability'};
 const participationHash=digest('Synthetic participation'),acceptanceHash=digest('Synthetic acceptance');
 const fail=(fn,pattern)=>assert.throws(fn,e=>pattern.test((e.stderr||e.message).toString()));
 function seed(classification='production') {
  sql('truncate auth.users cascade');
  const f=Object.fromEntries(['customer','provider','staff','outsider','replacement','unverified','application','approval','intake','request','readiness','participation','acceptance'].map(k=>[k,uuid()]));
  f.users=['customer','provider','staff','outsider','replacement','unverified'];
  sql(`insert into auth.users(id,email,email_confirmed_at) values ${f.users.map(k=>`(${L(f[k])},${L(k+'@fixture.invalid')},${k==='unverified'?'null':'clock_timestamp()'})`).join(',')};
   insert into public.learning_review_staff(user_id) values(${L(f.staff)});
   insert into public.vendor_applications(id,source,source_key,user_id,email,name,category,fields,revision,status) values(${L(f.application)},'translator',${L('fixture:'+f.application)},${L(f.provider)},'provider@fixture.invalid','Synthetic provider','translation','{}',3,'approved');
   insert into public.vendor_application_events(id,application_id,actor_id,kind,delivery) values(${L(f.approval)},${L(f.application)},${L(f.staff)},'approved','external');
   insert into public.service_intakes(id,user_id,email,email_verified_at,kind,fields,request_hash) values(${L(f.intake)},${L(f.customer)},'customer@fixture.invalid',clock_timestamp(),'translation',${J({quote_scope_v1:scope})},${L('0'.repeat(64))});
   insert into public.quote_intake_classifications(intake_id,classification,source,reason,actor_id) values(${L(f.intake)},${L(classification)},'staff','Synthetic local fixture',${L(f.staff)});
   insert into public.quote_policies(id,kind,version,digest,wording,approved_at,approved_by) values
    (${L(f.participation)},'participation','fixture-participation',${L(participationHash)},'{"en":"Synthetic","fr":"Synthetic","ar":"Synthetic","es":"Synthetic"}',clock_timestamp(),${L(f.staff)}),
    (${L(f.acceptance)},'acceptance','fixture-acceptance',${L(acceptanceHash)},'{"en":"Synthetic","fr":"Synthetic","ar":"Synthetic","es":"Synthetic"}',clock_timestamp(),${L(f.staff)});`);
  send(f,'staff','enroll_request',{intakeId:f.intake},f.request,0);
  return f;
 }
 const req=f=>value(`select to_jsonb(q) from public.quote_requests q where id=${L(f.request)}`);
 const revision=(target,table)=>Number(sql(`select revision from public.${table} where id=${L(target)}`).trim());
 function make(f,action,payload={},target=f.request,expected) {return {commandId:uuid(),action,targetId:target,expectedRevision:expected??revision(target,target===f.readiness?'quote_provider_readiness':'quote_requests'),payload};}
 function send(f,actor,action,payload={},target=f.request,expected) {return command(f[actor],make(f,action,payload,target,expected));}
 function ready(f) {
  send(f,'staff','propose_readiness',{applicationId:f.application,capabilities:caps,policyVersion:'fixture-participation',policyDigest:participationHash},f.readiness,0);
  const r=value(`select to_jsonb(r) from public.quote_provider_readiness r where id=${L(f.readiness)}`);
  send(f,'provider','acknowledge_participation',{capabilityDigest:r.capability_digest,policyVersion:'fixture-participation',policyDigest:participationHash,language:'en'},f.readiness);
  send(f,'staff','enable_readiness',{},f.readiness);
 }
 const assignment=f=>value(`select to_jsonb(a) from public.quote_assignments a where request_id=${L(f.request)} and state in ('invited','accepted')`);
 function assigned(f) {ready(f);send(f,'staff','claim_request');send(f,'staff','invite_provider',{readinessId:f.readiness});send(f,'provider','respond_assignment',{assignmentId:assignment(f).id,response:'accepted'});}
 function content(extra={}) {return {scope:'Synthetic immutable offer',exclusions:'No extra pages',total:{minor:12000,currency:'MAD'},turnaround:'Three days after separately authorized activation',revisions:1,expiresAt:new Date(Date.now()+3600_000).toISOString(),policyVersion:'fixture-acceptance',policyDigest:acceptanceHash,taxTreatment:'Synthetic declared treatment',chargesIncluded:true,...extra};}
 function issue(f,extra={}) {send(f,'provider','issue_offer',{assignmentId:assignment(f).id,content:content(extra)});return value(`select to_jsonb(o) from public.quote_offers o where request_id=${L(f.request)} order by version desc limit 1`);}
 function offered(){const f=seed();assigned(f);return {f,o:issue(f)};}
 const accept=o=>({offerId:o.id,offerDigest:o.digest,policyVersion:'fixture-acceptance',policyDigest:acceptanceHash,language:'en'});
 const detail=(f,actor)=>JSON.parse(query(f[actor],`select public.quote_request_detail(${L(f.request)})`).trim());
 const count=table=>Number(sql(`select count(*) from public.${table}`).trim());

 await test('entire checkout baseline and both private SQL drafts compile',()=>assert.equal(sql('select count(*) from public.quote_settings').trim(),'1'));
 await test('public mutations disabled for verified actors, anonymous users and service role',()=>{
  const f=seed();
  fail(()=>query(f.staff,`select public.quote_command(${L(uuid())},'claim_request',${L(f.request)},1,'{}')`),/COMMANDS_DISABLED/);
  fail(()=>query(f.unverified,`select public.quote_command(${L(uuid())},'claim_request',${L(f.request)},1,'{}')`),/UNAVAILABLE/);
  for(const role of ['anon','service_role']) fail(()=>query(f.staff,`select public.quote_command(${L(uuid())},'claim_request',${L(f.request)},1,'{}')`,role),/permission denied/);
 });
 await test('all quote tables use RLS and grant no direct application-role access',()=>{
  const tables=value("select jsonb_agg(relname) from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'quote_%'");assert.equal(tables.length,17);
  for(const table of tables) for(const role of ['anon','authenticated','service_role']) {
   assert.equal(sql(`select has_table_privilege(${L(role)},${L('public.'+table)},'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')`).trim(),'f');
   assert.equal(sql(`select relrowsecurity from pg_class where oid=${L('public.'+table)}::regclass`).trim(),'t');
  }
  const f=seed();for(const fn of ['quote_command_core','quote_provider_check','quote_digest']) assert.equal(sql(`select has_function_privilege('authenticated',p.oid,'execute') from pg_proc p where proname=${L(fn)}`).trim(),'f');
  fail(()=>query(f.customer,'select * from public.quote_requests'),/permission denied/);
 });
 await test('SQL canonical hashes, scopes, capabilities and minor currency metadata match shared contracts',()=>{
  for(const input of [{z:'Arabic العربية and quote "',a:[true,null,100]},{b:2,a:{d:4,c:3}}]) assert.equal(sql(`select public.quote_digest(${J(input)})`).trim(),digest(input));
  assert.deepEqual(value(`select public.quote_scope(${J({...scope,budget:{minor:0,currency:'JPY'}})})`),validateScope({...scope,budget:{minor:0,currency:'JPY'}}));
  assert.deepEqual(value(`select public.quote_capabilities(${J(caps)})`),validateCapabilities(caps));
  for(const [currency,digits] of [['JPY',0],['MAD',2],['KWD',3]]) assert.deepEqual(value(`select public.quote_money(${J({minor:1,currency})})`),{minor:1,currency,digits});
  for(const minor of [0,-1,0.5,'12000',1000000000000]) fail(()=>sql(`select public.quote_money(${J({minor,currency:'MAD'})})`),/INVALID_INPUT/);
  fail(()=>sql(`select public.quote_money(${J({minor:1,currency:'ZZZ'})})`),/INVALID_CURRENCY/);
 });
 await test('strict scope validation rejects files, test flags, unresolved languages and malformed special services',()=>{
  for(const changes of [{files:[]},{is_test:false},{source:''},{target:'Ｅｎｇｌｉｓｈ'},{source:'Other'},{service:'Interpretation'},{service:'Certified / Sworn Translation'}]) fail(()=>sql(`select public.quote_scope(${J({...scope,...changes})})`),/INVALID_/);
  const i={mode:'remote',location:'Fixture meeting',startsAt:'2026-11-20T12:00:00.000Z',timeZone:'Africa/Casablanca',durationMinutes:60};
  const s={...scope,service:'Interpretation',interpretation:i};assert.deepEqual(value(`select public.quote_scope(${J(s)})`),validateScope(s));
  for(const changes of [{timeZone:'Invalid/Zone'},{startsAt:'2026-02-30T12:00:00.000Z'},{durationMinutes:0}]) fail(()=>sql(`select public.quote_scope(${J({...s,interpretation:{...i,...changes}})})`),/INVALID_|date\/time field/);
 });
 await test('readiness proposal requires staff, approved current vendor, no self-review and approved policy',()=>{
  const f=seed(),p={applicationId:f.application,capabilities:caps,policyVersion:'fixture-participation',policyDigest:participationHash};
  fail(()=>send(f,'provider','propose_readiness',p,f.readiness,0),/UNAVAILABLE/);
  fail(()=>send(f,'staff','propose_readiness',{...p,policyDigest:digest('bad')},f.readiness,0),/POLICY_NOT_APPROVED/);
  sql(`insert into public.learning_review_staff(user_id) values(${L(f.provider)})`);
  fail(()=>send(f,'provider','propose_readiness',p,f.readiness,0),/SELF_REVIEW_DENIED/);
  sql(`update public.vendor_applications set status='pending' where id=${L(f.application)}`);
  fail(()=>send(f,'staff','propose_readiness',p,f.readiness,0),/PROVIDER_INELIGIBLE/);
 });
 await test('exact provider acknowledgement is mandatory and capabilities remain immutable',()=>{
  const f=seed();send(f,'staff','propose_readiness',{applicationId:f.application,capabilities:caps,policyVersion:'fixture-participation',policyDigest:participationHash},f.readiness,0);
  fail(()=>send(f,'staff','enable_readiness',{},f.readiness),/INVALID_STATE/);
  fail(()=>send(f,'provider','acknowledge_participation',{capabilityDigest:digest('wrong'),policyVersion:'fixture-participation',policyDigest:participationHash,language:'en'},f.readiness),/EXACT_ACKNOWLEDGEMENT_REQUIRED/);
  fail(()=>sql(`update public.quote_provider_readiness set capabilities='{}' where id=${L(f.readiness)}`),/QUOTE_IMMUTABLE_CAPABILITY/);
  const d=sql(`select capability_digest from public.quote_provider_readiness where id=${L(f.readiness)}`).trim();
  send(f,'provider','acknowledge_participation',{capabilityDigest:d,policyVersion:'fixture-participation',policyDigest:participationHash,language:'en'},f.readiness);
  fail(()=>sql(`update public.quote_provider_acknowledgements set language='fr' where readiness_id=${L(f.readiness)}`),/QUOTE_IMMUTABLE_HISTORY/);
  send(f,'staff','enable_readiness',{},f.readiness);assert.equal(sql(`select state from public.quote_provider_readiness where id=${L(f.readiness)}`).trim(),'enabled');
  assert.equal(JSON.parse(query(f.provider,'select public.quote_my_readiness()').trim()).length,1);
 });
 await test('provider invitation is redacted; customer/staff/provider projections stay separate',()=>{
  const f=seed();ready(f);send(f,'staff','claim_request');send(f,'staff','invite_provider',{readinessId:f.readiness});
  const invited=detail(f,'provider');assert.equal(invited.scope,undefined);assert.equal(invited.offers,undefined);
  for(const actor of ['customer','provider']) for(const key of ['intakeId','ownerId','isTest']) assert.equal(detail(f,actor)[key],undefined);
  assert.equal(detail(f,'staff').intakeId,f.intake);
  fail(()=>detail(f,'outsider'),/UNAVAILABLE/);fail(()=>query(f.outsider,`select public.quote_request_detail(${L(uuid())})`),/UNAVAILABLE/);
 });
 await test('provider alone issues offer; exact acceptance stops at accepted_pending_activation',()=>{
  const f=seed();assigned(f);
  fail(()=>send(f,'staff','issue_offer',{assignmentId:assignment(f).id,content:content()}),/UNAVAILABLE/);
  const o=issue(f);send(f,'customer','accept_offer',accept(o));assert.equal(req(f).state,'accepted_pending_activation');assert.equal(count('quote_acceptances'),1);
  assert.equal(count('quote_deliveries'),Number(sql("select count(*) from public.quote_deliveries where state='suppressed'").trim()));
  for(const action of ['activate','start_work','pay','upload','issue_offer','invite_provider','revise_scope']) fail(()=>send(f,'staff',action,{}),/INVALID_STATE|UNSUPPORTED_COMMAND/);
  fail(()=>sql(`update public.quote_offers set content='{}' where id=${L(o.id)}`),/QUOTE_IMMUTABLE_OFFER/);
  fail(()=>sql(`update public.quote_acceptances set language='fr' where request_id=${L(f.request)}`),/QUOTE_IMMUTABLE_HISTORY/);
 });
 await test('offer digest and terms must match exactly; caller-selected actor/recipient/flags are rejected',()=>{
  const {f,o}=offered();
  for(const extra of [{offerDigest:digest('wrong')},{policyDigest:digest('wrong')},{policyVersion:'old'},{language:'xx'},{actorId:f.customer},{recipient:'somebody@fixture.invalid'},{allow_test:true}]) fail(()=>send(f,'customer','accept_offer',{...accept(o),...extra}),/EXACT_ACCEPTANCE_REQUIRED|INVALID_INPUT/);
  assert.equal(count('quote_acceptances'),0);
 });
 for(const [name,change] of [
  ['vendor revision',f=>`update public.vendor_applications set revision=revision+1 where id=${L(f.application)}`],
  ['vendor approval loss',f=>`update public.vendor_applications set status='declined' where id=${L(f.application)}`],
  ['vendor test marker',f=>`update public.vendor_applications set is_test=true where id=${L(f.application)}`],
  ['email mismatch',f=>`update auth.users set email='changed@fixture.invalid' where id=${L(f.provider)}`],
  ['verification loss',f=>`update auth.users set email_confirmed_at=null where id=${L(f.provider)}`],
  ['learning exclusion',f=>`insert into public.learning_review_exclusions values(${L(f.provider)},'Synthetic exclusion')`],
  ['translation exclusion',f=>`insert into public.translation_exclusions values(${L(f.provider)},'Synthetic exclusion')`],
  ['quote account exclusion',f=>`insert into public.quote_test_registry(user_id,reason,actor_id) values(${L(f.provider)},'Synthetic exclusion',${L(f.staff)})`],
  ['permanent fixture and alternate application account',f=>`insert into public.vendor_applications(id,source,source_key,user_id,email,name,category,fields,status,is_test) values(${L(uuid())},'translator',${L(uuid())},${L(f.provider)},'provider@fixture.invalid','VENDOR-QA-LOCAL-PERMANENT','translation','{}','approved',true);insert into public.vendor_test_fixtures(application_id,delivery_email,reason) select id,'admin+vendorqa@marocora.com','Synthetic permanent fixture, no mail' from public.vendor_applications where name='VENDOR-QA-LOCAL-PERMANENT'`],
  ['approval-event provenance',f=>`insert into public.vendor_application_events(application_id,actor_id,kind,delivery) values(${L(f.application)},${L(f.staff)},'approved','external')`]
 ]) await test(name+' blocks acceptance without changing historical offer',()=>{
  const {f,o}=offered();sql(change(f));fail(()=>send(f,'customer','accept_offer',accept(o)),/PROVIDER_INELIGIBLE/);assert.equal(count('quote_acceptances'),0);assert.deepEqual(value(`select content from public.quote_offers where id=${L(o.id)}`),o.content);
 });
 await test('closed readiness blocks issue/acceptance and self-assignment cannot be invited',()=>{
  const {f,o}=offered();send(f,'staff','close_readiness',{reason:'Synthetic close'},f.readiness);
  fail(()=>send(f,'customer','accept_offer',accept(o)),/PROVIDER_INELIGIBLE/);
  fail(()=>issue(f),/PROVIDER_INELIGIBLE/);
  const g=seed();ready(g);send(g,'staff','claim_request');sql(`update public.vendor_applications set user_id=${L(g.customer)},email='customer@fixture.invalid' where id=${L(g.application)}`);
  fail(()=>send(g,'staff','invite_provider',{readinessId:g.readiness}),/PROVIDER_INELIGIBLE/);
 });
 await test('offer validation rejects invalid money, unavailable currency, expiry and unapproved policy',()=>{
  const f=seed();assigned(f);
  for(const extra of [{total:{minor:0,currency:'MAD'}},{total:{minor:120.5,currency:'MAD'}},{total:{minor:1,currency:'USD'}},{chargesIncluded:false},{expiresAt:'2020-01-01T00:00:00.000Z'},{policyDigest:digest('unapproved')},{files:[]}]) fail(()=>issue(f,extra),/INVALID_|TOTAL_MUST_INCLUDE_CHARGES|OFFER_EXPIRED|POLICY_NOT_APPROVED/);
  assert.equal(count('quote_offers'),0);
 });
 await test('new offer supersedes prior immutable version; exact prior offer cannot be accepted',()=>{
  const {f,o}=offered();const next=issue(f,{total:{minor:13000,currency:'MAD'}});
  assert.equal(next.version,2);assert.equal(sql("select count(*) from public.quote_offers where state='offered'").trim(),'1');
  assert.deepEqual(value(`select content from public.quote_offers where id=${L(o.id)}`),o.content);fail(()=>send(f,'customer','accept_offer',accept(o)),/OFFER_UNAVAILABLE/);
 });
 await test('scope change withdraws offers, ends assignment and requires provider reconfirmation',()=>{
  const {f,o}=offered(),old=assignment(f);send(f,'customer','revise_scope',{scope:{...scope,description:'Revised synthetic scope'}});
  const current=assignment(f);assert.notEqual(current.id,old.id);assert.equal(current.state,'invited');assert.equal(current.scope_version,2);
  assert.equal(sql(`select state from public.quote_assignments where id=${L(old.id)}`).trim(),'ended');
  fail(()=>issue(f),/UNAVAILABLE/);fail(()=>send(f,'customer','accept_offer',accept(o)),/OFFER_UNAVAILABLE/);
 });
 await test('ineligible revised scope returns to staff and removes old provider access',()=>{
  const {f}=offered();send(f,'customer','revise_scope',{scope:{...scope,target:'Spanish'}});
  assert.equal(sql("select count(*) from public.quote_assignments where state in ('invited','accepted')").trim(),'0');fail(()=>detail(f,'provider'),/UNAVAILABLE/);
 });
 await test('replays survive a new session, create no events/mail, and reject payload or actor changes',()=>{
  const f=seed(),c=make(f,'claim_request');const result=command(f.staff,c),events=count('quote_events'),deliveries=count('quote_deliveries');
  assert.deepEqual(command(f.staff,c),result);assert.equal(count('quote_events'),events);assert.equal(count('quote_deliveries'),deliveries);
  fail(()=>command(f.staff,{...c,expectedRevision:2}),/COMMAND_CONFLICT/);fail(()=>command(f.customer,c),/COMMAND_CONFLICT/);
 });
 await test('revoked provider cannot read or replay previously successful commands',()=>{
  const f=seed();assigned(f);const c=make(f,'issue_offer',{assignmentId:assignment(f).id,content:content()});command(f.provider,c);
  send(f,'staff','revoke_assignment',{reason:'Synthetic revoke'});fail(()=>command(f.provider,c),/UNAVAILABLE/);fail(()=>detail(f,'provider'),/UNAVAILABLE/);
  assert.deepEqual(JSON.parse(query(f.provider,'select public.quote_provider_assignments()').trim()),[]);
 });
 await test('transaction rollback removes mutation, command, event and suppressed outbox together',()=>{
  const f=seed(),c=make(f,'claim_request'),before={q:req(f),events:count('quote_events'),deliveries:count('quote_deliveries'),commands:count('quote_commands')};
  fail(()=>sql(commandSQL(f.staff,c).replace(/commit;$/,'select 1/0;commit;')),/division by zero/);
  assert.deepEqual(req(f),before.q);for(const [table,n] of [['quote_events',before.events],['quote_deliveries',before.deliveries],['quote_commands',before.commands]]) assert.equal(count(table),n);
  command(f.staff,c);assert.equal(req(f).owner_id,f.staff);
 });
 await test('private information and concern threads never leak between participants',()=>{
  const f=seed();assigned(f);send(f,'staff','ask_information',{audience:'customer',body:'Private customer question'});
  let customer=detail(f,'customer');assert.equal(customer.threads.length,1);assert.equal(detail(f,'provider').threads.length,0);
  fail(()=>send(f,'provider','reply_information',{threadId:customer.threads[0].id,body:'Forged answer'}),/UNAVAILABLE/);
  send(f,'customer','reply_information',{threadId:customer.threads[0].id,body:'Customer answer'});
  send(f,'customer','report_concern',{body:'Private concern for staff'});
  assert.equal(detail(f,'provider').threads.length,0);assert.equal(detail(f,'staff').threads.length,2);assert.equal(detail(f,'customer').threads.length,1);
 });
 await test('classification is sticky and summaries exclude tests/unclassified/registry accounts',()=>{
  const f=seed('test');assert.equal(req(f).is_test,true);assert.equal(JSON.parse(query(f.staff,'select public.quote_staff_summary()').trim()).open,0);
  fail(()=>sql(`insert into public.quote_intake_classifications(intake_id,classification,source,reason,actor_id) values(${L(f.intake)},'production','staff','Forbidden downgrade',${L(f.staff)})`),/TEST_CLASSIFICATION_PERMANENT/);
  sql(`update public.quote_requests set is_test=false where id=${L(f.request)}`);assert.equal(req(f).is_test,true);
  const g=seed();assert.equal(JSON.parse(query(g.staff,'select public.quote_staff_summary()').trim()).open,1);
  sql(`insert into public.quote_test_registry(user_id,reason,actor_id) values(${L(g.customer)},'Synthetic registry',${L(g.staff)})`);
  assert.equal(JSON.parse(query(g.staff,'select public.quote_staff_summary()').trim()).open,0);assert.deepEqual(JSON.parse(query(g.staff,'select public.quote_staff_queue()').trim()),[]);
 });
 await test('owner-only recovery and bounded pagination return no other customer records',()=>{
  const f=seed();assert.equal(JSON.parse(query(f.customer,'select public.quote_my_requests()').trim())[0].id,f.request);assert.deepEqual(JSON.parse(query(f.outsider,'select public.quote_my_requests()').trim()),[]);
  fail(()=>query(f.customer,'select public.quote_my_requests(null,null,101)'),/INVALID_INPUT/);fail(()=>query(f.customer,'select public.quote_staff_summary()'),/UNAVAILABLE/);
 });
 await test('accepted cancellation retains immutable exact acceptance and offer evidence',()=>{
  const {f,o}=offered();send(f,'customer','accept_offer',accept(o));const evidence=value(`select to_jsonb(a) from public.quote_acceptances a`);
  send(f,'customer','cancel_request',{reason:'Synthetic cancellation'});assert.equal(req(f).state,'cancelled');assert.deepEqual(value('select to_jsonb(a) from public.quote_acceptances a'),evidence);
  assert.equal(sql(`select state from public.quote_offers where id=${L(o.id)}`).trim(),'accepted');fail(()=>send(f,'staff','claim_request'),/INVALID_STATE/);
 });

 async function waitLock(classid=788601) {
  for(let n=0;n<100;n++) {if(sql(`select exists(select 1 from pg_locks where locktype='advisory' and classid=${classid} and objid=1 and granted)`).trim()==='t') return; await new Promise(r=>setTimeout(r,10));}
  throw new Error('Fixture lock holder did not start');
 }

 await test('enrollment requires classified canonical receipt and cannot impersonate customer scope',()=>{
  const f=seed(),newRequest=uuid(),newIntake=uuid();
  fail(()=>send(f,'staff','enroll_request',{intakeId:f.intake,scope:{...scope,description:'Staff forged scope'}},newRequest,0),/INVALID_INPUT/);
  sql(`insert into public.service_intakes(id,user_id,email,email_verified_at,kind,fields,request_hash) values(${L(newIntake)},${L(f.customer)},'customer@fixture.invalid',clock_timestamp(),'translation','{}',${L('1'.repeat(64))})`);
  fail(()=>send(f,'staff','enroll_request',{intakeId:newIntake},newRequest,0),/CLASSIFICATION_REQUIRED/);
  sql(`insert into public.quote_intake_classifications(intake_id,classification,source,reason,actor_id) values(${L(newIntake)},'production','staff','Explicit local classification',${L(f.staff)})`);
  fail(()=>send(f,'staff','enroll_request',{intakeId:newIntake},newRequest,0),/CANONICAL_RECEIPT_SCOPE_REQUIRED/);
  fail(()=>send(f,'staff','enroll_request',{intakeId:f.intake},newRequest,0),/duplicate key/);
  assert.equal(count('quote_requests'),1);assert.equal(count('quote_deliveries'),0);
 });
 await test('replacement readiness closes old version with an event and one enabled version',()=>{
  const f=seed();ready(f);const old=f.readiness;f.readiness=uuid();ready(f);
  assert.equal(sql(`select state from public.quote_provider_readiness where id=${L(old)}`).trim(),'closed');
  assert.equal(sql("select count(*) from public.quote_provider_readiness where state='enabled'").trim(),'1');
  assert.equal(sql(`select count(*) from public.quote_events where aggregate_id=${L(old)} and kind='readiness_replaced'`).trim(),'1');
 });
 await test('accepted history stays immutable and reads derive later provider eligibility hold',()=>{
  const {f,o}=offered();send(f,'customer','accept_offer',accept(o));assert.equal(detail(f,'customer').eligibilityHold,false);
  sql(`update public.vendor_applications set revision=revision+1,status='declined' where id=${L(f.application)}`);
  const after=detail(f,'customer');assert.equal(after.eligibilityHold,true);assert.equal(after.state,'accepted_pending_activation');assert.equal(after.acceptance.offerDigest,o.digest);
 });
 await test('past providers may report a private concern after access revocation without regaining reads',()=>{
  const {f}=offered();send(f,'staff','revoke_assignment',{reason:'Reassigned local fixture'});
  send(f,'provider','report_concern',{body:'Private post-revocation concern'});fail(()=>detail(f,'provider'),/UNAVAILABLE/);
  assert.equal(detail(f,'staff').threads[0].messages[0].body,'Private post-revocation concern');
 });
 await test('cancellation stores actor, reason and customer communication in staff audit',()=>{
  const {f}=offered();send(f,'staff','cancel_request',{reason:'Owner requested cancellation',communication:'Customer notified through local fixture'});
  const last=detail(f,'staff').audit.at(-1);assert.equal(last.actorId,f.staff);assert.equal(last.payload.reason,'Owner requested cancellation');assert.equal(last.payload.communication,'Customer notified through local fixture');
  assert.equal(detail(f,'customer').audit,undefined);
 });
 await test('partial unique indexes enforce one active assignment and one current offer',()=>{
  const {f,o}=offered();
  fail(()=>sql(`insert into public.quote_assignments(request_id,readiness_id,provider_id,scope_version) values(${L(f.request)},${L(f.readiness)},${L(f.provider)},1)`),/quote_one_active_assignment/);
  fail(()=>sql(`insert into public.quote_offers(request_id,assignment_id,provider_id,scope_version,version,content,total_minor,currency,currency_digits,expires_at,policy_id,digest) select request_id,assignment_id,provider_id,scope_version,version+1,content,total_minor,currency,currency_digits,expires_at,policy_id,digest from public.quote_offers where id=${L(o.id)}`),/quote_one_live_offer/);
 });
 await test('committed command survives immediate local server restart with no replay side effects',()=>{
  const f=seed(),c=make(f,'claim_request'),result=command(f.staff,c),before={events:count('quote_events'),deliveries:count('quote_deliveries')};
  restart();assert.deepEqual(command(f.staff,c),result);assert.equal(count('quote_events'),before.events);assert.equal(count('quote_deliveries'),before.deliveries);
 });
 // Hold the pilot mutex in session one so both processes overlap deterministically.
 async function race(f,c1,actor1,c2,actor2) {
  const one=parallel(commandSQL(f[actor1],c1).replace('select quote_fixture.command','select pg_advisory_xact_lock(788601,1);select pg_sleep(0.35);select quote_fixture.command'));
  await waitLock();
  const two=parallel(commandSQL(f[actor2],c2));return Promise.all([one,two]);
 }
 await test('two real PostgreSQL sessions accept once with one event and one acceptance',async()=>{
  const {f,o}=offered(),n=count('quote_events'),rev=req(f).revision;
  const results=await race(f,make(f,'accept_offer',accept(o),f.request,rev),'customer',make(f,'accept_offer',accept(o),f.request,rev),'customer');
  assert.equal(results.filter(x=>x.status===0).length,1);assert.match(results.find(x=>x.status!==0).stderr,/STALE_REVISION/);assert.equal(count('quote_acceptances'),1);assert.equal(count('quote_events'),n+1);
 });
 await test('concurrent identical replay returns the same durable result once',async()=>{
  const f=seed(),c=make(f,'claim_request'),n=count('quote_events');const results=await race(f,c,'staff',c,'staff');
  assert.ok(results.every(x=>x.status===0));assert.equal(count('quote_events'),n+1);
  assert.deepEqual(JSON.parse(results[0].stdout.trim().split('\n').at(-1)),JSON.parse(results[1].stdout.trim()));
 });
 await test('acceptance races cancellation without double transition',async()=>{
  const {f,o}=offered(),rev=req(f).revision;
  const results=await race(f,make(f,'cancel_request',{reason:'Cancellation wins'},f.request,rev),'customer',make(f,'accept_offer',accept(o),f.request,rev),'customer');
  assert.equal(results[0].status,0);assert.match(results[1].stderr,/STALE_REVISION/);assert.equal(count('quote_acceptances'),0);assert.equal(req(f).state,'cancelled');
 });
 await test('concurrent offer issuance maintains one current offer and revision winner',async()=>{
  const f=seed();assigned(f);const rev=req(f).revision,p={assignmentId:assignment(f).id,content:content()};
  const results=await race(f,make(f,'issue_offer',p,f.request,rev),'provider',make(f,'issue_offer',p,f.request,rev),'provider');
  assert.equal(results.filter(x=>x.status===0).length,1);assert.equal(sql("select count(*) from public.quote_offers where state='offered'").trim(),'1');
 });
 await test('scope edit racing issue invalidates old assignment before issue commits',async()=>{
  const f=seed();assigned(f);const rev=req(f).revision,old=assignment(f);
  const results=await race(f,make(f,'revise_scope',{scope:{...scope,description:'Scope wins'}},f.request,rev),'customer',make(f,'issue_offer',{assignmentId:old.id,content:content()},f.request,rev),'provider');
  assert.equal(results[0].status,0);assert.match(results[1].stderr,/STALE_REVISION/);assert.equal(count('quote_offers'),0);
 });
 await test('vendor-row update in another session serializes with acceptance eligibility',async()=>{
  const {f,o}=offered();
  const update=parallel(`begin;update public.vendor_applications set revision=revision+1,status='declined' where id=${L(f.application)};select pg_advisory_xact_lock(788602,1);select pg_sleep(0.35);commit;`);
  await waitLock(788602);const accepting=parallel(commandSQL(f.customer,make(f,'accept_offer',accept(o))));
  const results=await Promise.all([update,accepting]);assert.equal(results[0].status,0);assert.match(results[1].stderr,/PROVIDER_INELIGIBLE/);assert.equal(count('quote_acceptances'),0);
 });
 await test('expiry uses current database clock after waiting for a lock',async()=>{
  const f=seed();assigned(f);const o=issue(f,{expiresAt:new Date(Date.now()+1000).toISOString()});
  const locker=parallel('begin;select pg_advisory_xact_lock(788601,1);select pg_sleep(1.25);commit;');
  await waitLock();const accepting=parallel(commandSQL(f.customer,make(f,'accept_offer',accept(o))));
  const results=await Promise.all([locker,accepting]);assert.equal(results[0].status,0);assert.match(results[1].stderr,/OFFER_EXPIRED/);assert.equal(count('quote_acceptances'),0);assert.equal(detail(f,'customer').offers[0].state,'expired');
 });
 await test('owner transfer validates current membership and the old owner loses command authority',()=>{
  const f=seed();send(f,'staff','claim_request');
  fail(()=>send(f,'staff','transfer_owner',{ownerId:f.outsider}),/STAFF_REQUIRED/);
  sql(`insert into public.learning_review_staff(user_id) values(${L(f.replacement)})`);
  send(f,'staff','transfer_owner',{ownerId:f.replacement});assert.equal(req(f).owner_id,f.replacement);
  fail(()=>send(f,'staff','close_unfulfilled',{reason:'Old owner cannot close'}),/STAFF_OWNER_REQUIRED/);
 });
 await test('provider may decline an invitation without changing vendor approval',()=>{
  const f=seed();ready(f);send(f,'staff','claim_request');send(f,'staff','invite_provider',{readinessId:f.readiness});
  send(f,'provider','respond_assignment',{assignmentId:assignment(f).id,response:'declined'});
  assert.equal(sql(`select status from public.vendor_applications where id=${L(f.application)}`).trim(),'approved');
  assert.equal(req(f).state,'open');fail(()=>detail(f,'provider'),/UNAVAILABLE/);
 });
 await test('customer decline and provider/staff withdrawal preserve immutable offers',()=>{
  const {f,o}=offered();send(f,'customer','decline_offer',{offerId:o.id});assert.equal(req(f).state,'open');
  const second=issue(f);send(f,'provider','withdraw_offer',{offerId:second.id,reason:'Provider withdrawal'});
  const third=issue(f);send(f,'staff','withdraw_offer',{offerId:third.id,reason:'Staff withdrawal'});
  assert.deepEqual(value(`select jsonb_agg(state order by version) from public.quote_offers`),['declined','withdrawn','withdrawn']);
  assert.deepEqual(value(`select content from public.quote_offers where id=${L(o.id)}`),o.content);
 });
 await test('staff unfulfilled closure records a customer-readable explanation without internal communication',()=>{
  const f=seed();send(f,'staff','claim_request');
  fail(()=>send(f,'customer','close_unfulfilled',{reason:'Customer cannot impersonate staff'}),/STAFF_OWNER_REQUIRED/);
  send(f,'staff','close_unfulfilled',{reason:'No suitable provider available'});
  const d=detail(f,'customer');assert.equal(d.state,'closed_unfulfilled');assert.equal(d.closure.reason,'No suitable provider available');assert.equal(d.audit,undefined);
  fail(()=>send(f,'staff','claim_request'),/INVALID_STATE/);
 });
 await test('all switches remain false and no dispatchable mail exists after every scenario',()=>{
  assert.deepEqual(value('select to_jsonb(s) from public.quote_settings s'),{singleton:true,capture_enabled:false,commands_enabled:false,notifications_enabled:false});
  assert.equal(sql("select count(*) from public.quote_deliveries where state<>'suppressed'").trim(),'0');
 });
 return passed;
}
