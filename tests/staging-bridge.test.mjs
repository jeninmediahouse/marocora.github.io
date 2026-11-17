import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {openLocalDatabase,seedLocalActors,L,J,root} from '../server/block1/database.mjs';
import {createLocalApp} from '../server/block1/http.mjs';
import {mockCloudmersive} from './fixtures/cloudmersive-mock.mjs';

test('Staging adapter verifies users through mocked Auth and preserves the bearer for user-scoped RPCs',{timeout:15000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'marocora-stage-mock-')),actor=randomUUID(),calls=[];let app;
 const environment={SUPABASE_URL:'https://staging.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_ANON_NOT_A_KEY',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE_NOT_A_KEY'},token='synthetic.payload.signature';
 const fetcher=async(input,options)=>{
  const url=new URL(input),headers=new Headers(options.headers);calls.push({url:url.pathname,authorization:headers.get('authorization'),body:options.body});assert.equal(url.origin,environment.SUPABASE_URL);assert.equal(options.redirect,'error');
  if(url.pathname==='/auth/v1/token')return Response.json({access_token:token,refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,user:{id:actor,email:'synthetic@staging.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',is_anonymous:false}});
  if(url.pathname==='/auth/v1/user')return new Response(JSON.stringify({id:actor,email:'synthetic@staging.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',is_anonymous:false,user_metadata:{role:'staff'}}),{headers:{'Content-Type':'application/json'}});
  if(url.pathname.endsWith('/translation_session_context'))return Response.json({actor,role:'customer'});
  if(url.pathname.endsWith('/translation_runtime_settings'))return Response.json({capture_enabled:false,commands_enabled:false,notifications_enabled:false});
  if(url.pathname.endsWith('/translation_list'))return Response.json([]);
  return Response.json({message:'not permitted',code:'42501'},{status:403});
 };
 try{
  const db=openLocalDatabase(dir,{environment,fetcher});assert.equal(db.mode,'staging');assert.equal(calls.length,0);assert.ok(!existsSync(join(dir,'pg')));assert.throws(()=>seedLocalActors(db),/SYNTHETIC_SEED_DENIED/);
  app=createLocalApp(db,{}, {scanner:mockCloudmersive().scanner});const origin=await app.listen();
  assert.equal((await fetch(origin+'/api/me')).status,401);
  assert.equal((await fetch(origin+'/api/local-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{"ticket":"forged"}'})).status,403);
  const r=await fetch(origin+'/api/me',{headers:{Authorization:'Bearer '+token,'x-user-id':randomUUID(),'x-role':'staff'}});assert.equal(r.status,200);const me=await r.json();assert.equal(me.role,'customer');assert.equal(me.staging,true);assert.equal(me.localOnly,false);assert.equal(me.email,'synthetic@staging.invalid');
  assert.equal((await fetch(origin+'/api/requests',{headers:{Authorization:'Bearer '+token}})).status,200);
  for(const c of calls)assert.equal(c.authorization,'Bearer '+token);
  const login=await fetch(origin+'/api/staging-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'synthetic@staging.invalid',password:'SYNTHETIC_NOT_A_PASSWORD'})});assert.equal(login.status,200);assert.equal((await login.json()).accessToken,token);
  const tokenCall=calls.find(c=>c.url==='/auth/v1/token');assert.ok(tokenCall);assert.equal(tokenCall.authorization,'Bearer '+environment.SUPABASE_ANON_KEY);
  const before=calls.length;assert.equal((await fetch(origin+'/api/me',{headers:{Authorization:'Bearer not-a-jwt',Cookie:'block1='+'a'.repeat(64)}})).status,401);assert.equal(calls.length,before);
  assert.equal((await fetch(origin+'/api/requests',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({requestId:randomUUID(),fields:{},actor:randomUUID()})})).status,400);
  assert.equal((await fetch(origin+'/api/requests',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://evil.invalid','Content-Type':'application/json'},body:'{}'})).status,403);
  assert.ok(!JSON.stringify(me).includes(environment.SUPABASE_SERVICE_ROLE_KEY));
 }finally{if(app)await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('Partial cloud configuration and invalid Auth never launch local PostgreSQL or fall back to identity claims',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'marocora-stage-auth-'));
 try{
  assert.throws(()=>openLocalDatabase(dir,{environment:{SUPABASE_URL:'https://staging.invalid'}}),/STAGING_ENV_INCOMPLETE/);assert.ok(!existsSync(join(dir,'pg')));
  const env={SUPABASE_URL:'https://staging.invalid',SUPABASE_ANON_KEY:'fake-anon',SUPABASE_SERVICE_ROLE_KEY:'fake-service'};
  for(const raw of [{id:randomUUID(),email:'synthetic@invalid',is_anonymous:false}, {id:randomUUID(),email:'synthetic@invalid',email_confirmed_at:'2026-01-01',is_anonymous:true},null]){
   const db=openLocalDatabase(dir,{environment:env,fetcher:async()=>Response.json(raw||{message:'invalid'},{status:raw?200:401})});await assert.rejects(db.authenticate('test.payload.signature'),/INVALID_SUPABASE_TOKEN/);
  }
  const childEnv={PATH:process.env.PATH,QUOTE_PG_BIN:'/nonexistent-postgres-must-not-run'};
  assert.throws(()=>execFileSync(process.execPath,['server/block1/start-staging.mjs'],{cwd:root,env:childEnv,encoding:'utf8',stdio:['ignore','pipe','pipe']}),e=>e.status===1&&e.stderr.includes('Staging startup failed')&&!e.stderr.includes('nonexistent-postgres'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Unified migration and owner seed compile without fixtures; standard-role RPCs preserve quote/security gates',{timeout:60000},async t=>{
 const dir=mkdtempSync(join(tmpdir(),'marocora-stage-schema-'));let db;
 try{
  db=openLocalDatabase(dir,{forceLocal:true});
  // This is a disposable LOCAL database only. Replace its public schema while
  // retaining the test Auth compatibility surface, never a managed project.
  db.sql('drop schema public cascade;create schema public;grant usage on schema public to anon,authenticated,service_role;');
  const migration=readFileSync(new URL('../supabase/migrations/202611140001_translation_workflow.sql',import.meta.url),'utf8'),seed=readFileSync(new URL('../supabase/migrations/202611140002_translation_seed.sql',import.meta.url),'utf8');
  assert.ok(!/\bROLLBACK\b|vendor_test_fixtures|CREATE ROLE|CREATE SCHEMA auth|pg_get_functiondef/.test(migration));db.sql(migration);
  assert.equal(db.sql("select count(*) from pg_class where relnamespace='public'::regnamespace and relkind='r' and relrowsecurity"),'32');assert.equal(db.sql("select count(*) from pg_policy where polname='translation_rpc_only'"),'32');
  assert.equal(db.sql("select to_regclass('public.vendor_test_fixtures') is null"),'t');assert.equal(db.sql("select count(*) from public.translation_staff"),'0');
  assert.throws(()=>db.sql(seed),e=>String(e.stderr).includes('SET_STAGING_STAFF_AUTH_UUID'));
  const ids={staff:randomUUID(),provider:randomUUID(),customer:randomUUID(),outsider:randomUUID()};
  db.sql(`insert into auth.users(id,email,email_confirmed_at) values ${Object.entries(ids).map(([role,id])=>`(${L(id)},${L(role+'@staging.invalid')},clock_timestamp())`).join(',')}`);
  const configured=seed.replace("customers jsonb := '[]';",`customers jsonb := ${L(JSON.stringify([ids.customer]))};`).replace('staff_id uuid := NULL;',`staff_id uuid := ${L(ids.staff)};`).replace("providers jsonb := '[]';",`providers jsonb := ${L(JSON.stringify([{id:ids.provider,name:'Synthetic translator'}]))};`);db.sql(configured);
  assert.equal(db.sql("select capture_enabled or commands_enabled or notifications_enabled from public.quote_settings"),'f');
  assert.equal(db.sql("select has_function_privilege('authenticated','public.translation_scan_record_scan(uuid,text,text,text,text,uuid)','execute')"),'f');
  assert.equal(db.sql("select has_function_privilege('service_role','public.quote_command_core(uuid,text,uuid,bigint,jsonb)','execute')"),'f');
  assert.throws(()=>db.as(ids.staff,'select to_jsonb(s) from public.quote_settings s'),e=>String(e.stderr).includes('permission denied'));
  assert.equal(db.as(ids.customer,'select public.translation_session_context()').role,'customer');assert.equal(db.as(ids.staff,'select public.translation_session_context()').role,'staff');
  assert.throws(()=>db.as(ids.outsider,'select public.translation_session_context()'),e=>String(e.stderr).includes('UNAVAILABLE'));
  db.sql('update public.quote_settings set capture_enabled=true,commands_enabled=true,notifications_enabled=true');
  const options=db.as(ids.staff,'select public.translation_workspace_options()'),readiness=options.readiness[0].id,policy=options.policy;
  const qScope={service:'Document Translation',source:'English',target:'French',description:'Synthetic staged translation'},fields={name:'Synthetic customer'};
  const detail=(actor,id)=>db.as(actor,`select public.translation_scan_detail(${L(id)})`);
  const cmd=(actor,id,action,payload)=>db.command(actor,{commandId:randomUUID(),targetId:id,expectedRevision:detail(actor,id).revision,action,payload});
  function assign(id){cmd(ids.staff,id,'invite_provider',{readinessId:readiness});cmd(ids.provider,id,'respond_assignment',{assignmentId:detail(ids.provider,id).invitation.id,response:'accepted'});}
  function quote(id){cmd(ids.staff,id,'issue_offer',{assignmentId:detail(ids.staff,id).assignment.id,content:{scope:'Synthetic scope',exclusions:'No other work',total:{minor:10000,currency:'MAD'},turnaround:'After separate authorization',revisions:1,expiresAt:new Date(Date.now()+3600000).toISOString(),policyVersion:policy.version,policyDigest:policy.digest,taxTreatment:'Synthetic',chargesIncluded:true}});}
  function accept(id,fulfillment){const o=detail(ids.customer,id).offers.at(-1);cmd(ids.customer,id,'accept_offer',{offerId:o.id,offerDigest:o.digest,policyVersion:policy.version,policyDigest:policy.digest,language:'en',fulfillment});}
  await t.test('regular quote accepts exact fulfillment and routes only to a mock queue',()=>{
   const id=randomUUID();db.as(ids.customer,`select public.translation_cert_capture(${L(id)},${J(qScope)},${J(fields)},false)`);assign(id);quote(id);accept(id,{method:'email'});
   assert.equal(detail(ids.staff,id).fulfillment.method,'email');assert.equal(db.sql('select count(*) from public.translation_cert_mock_mail'),'1');
   assert.throws(()=>db.as(ids.customer,`select public.translation_cert_upload_check(${L(id)})`),e=>String(e.stderr).includes('REQUEST_SUBMITTED'));
  });
  await t.test('sworn path requires original scan and staff-approved private credential',()=>{
   const id=randomUUID(),file=randomUUID(),credential=randomUUID(),sc={...qScope,service:'Sworn Translation (Morocco)',certified:{country:'Morocco',jurisdiction:'Morocco',receivingAuthority:'Synthetic authority',requirements:'No instructions',missingInstructions:true}};
   db.as(ids.customer,`select public.translation_cert_capture(${L(id)},${J(sc)},${J(fields)},true)`);
   assert.throws(()=>db.as(ids.customer,`select public.translation_cert_submit(${L(id)})`),e=>String(e.stderr).includes('ORIGINAL_SCAN_REQUIRED'));
   db.as(ids.customer,`select public.translation_scan_register_file(${L(file)},${L(id)},'synthetic.pdf',100,${L('0'.repeat(64))},'application/pdf')`);
   assert.throws(()=>db.as(ids.customer,`select public.translation_scan_record_scan(${L(file)},${L('0'.repeat(64))},'clean','TEST','TEST',${L(ids.customer)})`),e=>String(e.stderr).includes('permission denied'));
   db.sql(`begin;set local role service_role;set local request.jwt.claim.role='service_role';select public.translation_scan_record_scan(${L(file)},${L('0'.repeat(64))},'clean','TEST MOCK','SYNTHETIC_CLEAN',${L(ids.customer)});select public.translation_cert_record_credential(${L(credential)},${L(ids.provider)},'{"legalName":"Synthetic translator","dob":"August 1 1960","credentialNumber":"SYNTHETIC"}',${J({name:'credential.png',mediaType:'image/png',size:100,sha256:'1'.repeat(64)})},'{"status":"clean","engine":"TEST MOCK","reason":"SYNTHETIC_CLEAN"}');commit;`);
   db.as(ids.staff,`select public.translation_cert_review_credential(${L(credential)},${L(randomUUID())},0,'approved','Synthetic review')`);
   db.as(ids.customer,`select public.translation_cert_submit(${L(id)})`);assign(id);quote(id);accept(id,{method:'in_person',originalCheckAccepted:true,guaranteeAccepted:true});
   assert.equal(detail(ids.staff,id).fulfillment.method,'in_person');assert.equal(db.sql("select count(*) from public.quote_deliveries where state in ('sending','accepted','uncertain')"),'0');
  });
  db.sql(`update public.translation_staging_accounts set enabled=false where user_id=${L(ids.customer)}`);assert.throws(()=>db.as(ids.customer,'select public.translation_session_context()'),e=>String(e.stderr).includes('UNAVAILABLE'));
  assert.throws(()=>db.sql(migration),e=>String(e.stderr).includes('TRANSLATION_SCHEMA_ALREADY_EXISTS'));
  db.sql('update public.quote_settings set capture_enabled=false,commands_enabled=false,notifications_enabled=false');
 }finally{if(db)db.stop();rmSync(dir,{recursive:true,force:true,maxRetries:3});}
});
