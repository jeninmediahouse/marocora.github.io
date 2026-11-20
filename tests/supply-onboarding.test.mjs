import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID,createDecipheriv} from 'node:crypto';
import {join} from 'node:path';
import {request as httpRequest} from 'node:http';
import {encryptPayout} from '../server/supply/payout.mjs';
import {startProductionServer} from '../server/production/http.mjs';
import {createProductionSupabase} from '../server/production/supabase.mjs';
const root=new URL('../',import.meta.url);
const teacher={displayName:'Synthetic Teacher',bio:'Synthetic teaching profile for local verification.',publicationConsent:true,languages:['English','French'],hourlyRateMinor:25000,currency:'MAD',timezone:'Africa/Casablanca',availability:[{day:1,start:'09:00',end:'12:00'}],introVideo:'https://video.fixture.invalid/introduction'};
const translator={displayName:'Synthetic Translation Agency',bio:'Synthetic translation profile for local verification.',publicationConsent:true,organizationKind:'agency',languagePairs:[{source:'English',target:'French'}],specialties:['Legal','Medical','Technical']};
const transport={displayName:'Synthetic Transportation Company',bio:'Synthetic transport profile for local verification.',publicationConsent:true,vehicleTypes:['sedan','van','bus'],capacity:45,serviceRegions:['Rabat','Casablanca'],baseRateMinor:30000,currency:'MAD'};
const L=v=>"'"+String(v).replaceAll("'","''")+"'",J=v=>L(JSON.stringify(v))+'::jsonb';
const syntheticKey=Buffer.alloc(32,17).toString('base64');
const syntheticPayout={iban:'GB82 WEST 1234 5698 7654 32',swift:'SYNTHGBA',accountHolder:'Synthetic Fixture Holder'};
test('supply payout encryption validates inputs, binds ownership and never exposes banking plaintext',()=>{
 const actor=randomUUID(),id=randomUUID(),options={key:syntheticKey,actor,applicationId:id};const a=encryptPayout(syntheticPayout,options),b=encryptPayout(syntheticPayout,options);
 assert.notEqual(a.envelope.nonce,b.envelope.nonce);assert.equal(a.lastFour,'5432');assert.equal(JSON.stringify(a).includes('WEST'),false);
 const decode=(owner,application)=>{const d=createDecipheriv('aes-256-gcm',Buffer.from(syntheticKey,'base64'),Buffer.from(a.envelope.nonce,'base64'));d.setAAD(Buffer.from(`supply-payout:v1:${owner}:${application}`));d.setAuthTag(Buffer.from(a.envelope.tag,'base64'));return JSON.parse(Buffer.concat([d.update(Buffer.from(a.envelope.ciphertext,'base64')),d.final()]).toString());};
 assert.equal(decode(actor,id).iban,'GB82WEST12345698765432');assert.throws(()=>decode(randomUUID(),id));
 assert.throws(()=>encryptPayout(syntheticPayout,{...options,key:undefined}),/STORAGE_UNAVAILABLE/);
 for(const input of [{...syntheticPayout,iban:'GB00WEST12345698765432'},{...syntheticPayout,swift:'INVALID'},{...syntheticPayout,role:'admin'}])assert.throws(()=>encryptPayout(input,options),/INVALID_PAYOUT/);
});

test('supply migration and review flow on isolated PostgreSQL (no TCP or managed database)',async t=>{
 const bin=process.env.QUOTE_PG_BIN||'/opt/homebrew/opt/postgresql@17/bin',dir=mkdtempSync('/private/tmp/msupply-'),data=join(dir,'pg'),socket=join(dir,'sock');mkdirSync(socket,{mode:0o700});
 const env={PATH:'/usr/bin:/bin:/opt/homebrew/bin',LANG:'C',LC_ALL:'C'};
 const tool=(name,args,input)=>execFileSync(join(bin,name),args,{input,env,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']});
 const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',socket,'-p','55487','-U','supply_fixture_owner','-d','supply_fixture'];
 const sql=q=>tool('psql',args,q).trim(),value=q=>JSON.parse(sql(q));
 const as=(actor,q,role='authenticated')=>`BEGIN;SET LOCAL ROLE ${role};SET LOCAL request.jwt.claim.sub=${L(actor)};SET LOCAL request.jwt.claim.role=${L(role)};${q};COMMIT;`;
 const rpc=(actor,name,params={},role='authenticated')=>value(as(actor,`SELECT to_jsonb(public.${name}(${Object.entries(params).map(([k,v])=>k+'=>'+(v===null?'NULL':typeof v==='object'?J(v):typeof v==='boolean'?String(v):typeof v==='number'?String(v):L(v))).join(',')}))`,role));
 const denied=(fn,code)=>assert.throws(fn,e=>String(e.stderr||e.message).includes(code));
 const ids=Object.fromEntries(['owner','other','staff','excluded','unverified'].map(k=>[k,randomUUID()]));let started=false,applications={};
 try{
  tool('initdb',['-D',data,'-U','supply_fixture_owner','--auth-local=trust','--auth-host=reject','--encoding=UTF8','--no-locale']);tool('pg_ctl',['-D',data,'-l',join(dir,'pg.log'),'-o',`-k ${socket} -p 55487 -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);started=true;tool('createdb',['-h',socket,'-p','55487','-U','supply_fixture_owner','supply_fixture']);
  sql(readFileSync(new URL('tests/quote-sql/bootstrap.sql',root),'utf8'));
  sql('CREATE TABLE public.learning_review_staff(user_id uuid PRIMARY KEY REFERENCES auth.users(id));CREATE TABLE public.learning_review_exclusions(user_id uuid PRIMARY KEY REFERENCES auth.users(id),reason text NOT NULL);');
  const migration=readFileSync(new URL('supabase/migrations/202611200001_supply_onboarding.sql',root),'utf8');
  await t.test('new migration applies once, enables RLS, and refuses repeat application',()=>{sql(migration);assert.equal(sql("SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname LIKE 'supply_%' AND relkind='r' AND relrowsecurity"),'7');denied(()=>sql(migration),'SUPPLY_OBJECTS_ALREADY_EXIST');});
  sql(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ${Object.entries(ids).map(([k,id])=>`(${L(id)},${L(k+'@fixture.invalid')},${k==='unverified'?'NULL':'now()'})`).join(',')}; INSERT INTO public.learning_review_staff VALUES(${L(ids.staff)});INSERT INTO public.learning_review_exclusions VALUES(${L(ids.excluded)},'Synthetic exclusion');`);
  await t.test('scalar RPC results serialize PostgreSQL booleans as JSON without changing values',()=>{
   assert.equal(rpc(ids.staff,'supply_admin_access'),true);
   assert.equal(rpc(ids.other,'supply_admin_access'),false);
   assert.equal(value('SELECT to_jsonb(true)'),true);
   assert.equal(value('SELECT to_jsonb(false)'),false);
  });
  await t.test('profile validator resolves loop variables and query columns for all vendor types',()=>{
   for(const [type,profile] of Object.entries({teacher,translator,transport}))assert.equal(value(`SELECT to_jsonb(public.supply_valid_profile(${L(type)},${J(profile)}))`),true,type);
   for(const [type,profile] of [
    ['translator',{...translator,specialties:['Unsupported']}],
    ['transport',{...transport,vehicleTypes:['motorcycle']}],
    ['teacher',{...teacher,availability:[{day:1,start:'12:00',end:'09:00'}]}]
   ])assert.equal(value(`SELECT to_jsonb(public.supply_valid_profile(${L(type)},${J(profile)}))`),false,type);
  });
  await t.test('each vendor type registers pending_review with distinct profile data and no public listing',()=>{
   for(const [type,profile] of Object.entries({teacher,translator,transport})){const app=rpc(ids.owner,'supply_save_application',{p_type:type,p_profile:profile});applications[type]=app;assert.equal(app.status,'pending_review');assert.equal(app.revision,1);assert.deepEqual(app.profile,profile);assert.deepEqual(app.earnings,{minor:0,currency:'USD'});assert.equal(app.payout.status,'pending');}
   assert.equal(rpc(ids.owner,'supply_my_applications').length,3);assert.deepEqual(rpc('', 'supply_public_profiles',{},'anon'),[]);
   denied(()=>rpc(ids.unverified,'supply_save_application',{p_type:'teacher',p_profile:teacher}),'SUPPLY_VERIFIED_ACCOUNT_REQUIRED');
  });
  await t.test('only current administrators access review queue and decisions; profile owners cannot approve',()=>{
   assert.equal(rpc(ids.staff,'supply_review_queue').length,3);denied(()=>rpc(ids.other,'supply_review_queue'),'SUPPLY_ADMIN_REQUIRED');
   denied(()=>rpc(ids.owner,'supply_review_application',{p_id:applications.teacher.id,p_revision:1,p_decision:'approved',p_reason:''}),'SUPPLY_ADMIN_REQUIRED');
   assert.equal(rpc(ids.other,'supply_my_applications').length,0);
  });
  await t.test('approval updates database and emits only safe public profile; rejection stays private',()=>{
   const a=rpc(ids.staff,'supply_review_application',{p_id:applications.teacher.id,p_revision:1,p_decision:'approved',p_reason:'Synthetic approved profile'});assert.equal(a.status,'approved');assert.equal(sql(`SELECT status FROM public.supply_applications WHERE id=${L(a.id)}`),'approved');
   const publicRows=rpc('','supply_public_profiles',{},'anon');assert.equal(publicRows.length,1);assert.equal(publicRows[0].profile.displayName,teacher.displayName);
   const text=JSON.stringify(publicRows);for(const forbidden of ['publicationConsent','payout','credentials','reviews','owner@fixture.invalid',ids.owner])assert.equal(text.includes(forbidden),false);
   const rejected=rpc(ids.staff,'supply_review_application',{p_id:applications.transport.id,p_revision:1,p_decision:'rejected',p_reason:'Synthetic missing operating details'});assert.equal(rejected.status,'rejected');assert.equal(rejected.reviews[0].reason,'Synthetic missing operating details');assert.deepEqual(rpc('','supply_public_profiles',{p_id:rejected.id},'anon'),[]);
  });
  await t.test('profile edits revoke publication, reject stale decisions and forbid cross-owner updates',()=>{
   const id=applications.teacher.id;const edited=rpc(ids.owner,'supply_save_application',{p_type:'teacher',p_profile:{...teacher,bio:'Synthetic revised teaching profile.'},p_id:id,p_revision:1});assert.equal(edited.status,'pending_review');assert.equal(edited.revision,2);assert.deepEqual(rpc('','supply_public_profiles',{p_id:id},'anon'),[]);
   denied(()=>rpc(ids.staff,'supply_review_application',{p_id:id,p_revision:1,p_decision:'approved',p_reason:''}),'SUPPLY_STALE_REVISION');
   denied(()=>rpc(ids.other,'supply_save_application',{p_type:'teacher',p_profile:teacher,p_id:id,p_revision:2}),'SUPPLY_APPLICATION_NOT_FOUND');
   rpc(ids.staff,'supply_review_application',{p_id:id,p_revision:2,p_decision:'approved',p_reason:''});
  });
  await t.test('sworn approval needs a clean private credential and explicit review at latest revision',()=>{
   const app=applications.translator;const sworn=rpc(ids.owner,'supply_save_application',{p_type:'translator',p_profile:{...translator,specialties:['Sworn']},p_id:app.id,p_revision:1});
   denied(()=>rpc(ids.staff,'supply_review_application',{p_id:app.id,p_revision:sworn.revision,p_decision:'approved',p_reason:''}),'SUPPLY_CREDENTIAL_REVIEW_REQUIRED');
   const file={id:randomUUID(),backend:'spaces',bucket:'synthetic-private-fixtures',key:'translation/v1/'+randomUUID(),sha256:'a'.repeat(64),size:123,mime:'application/pdf'};
   denied(()=>rpc(ids.owner,'supply_record_credential',{p_actor:ids.owner,p_id:app.id,p_file:file}),'permission denied');
   const credential=rpc('', 'supply_record_credential',{p_actor:ids.owner,p_id:app.id,p_file:file},'service_role');assert.deepEqual(rpc(ids.owner,'supply_credential_file',{p_id:credential.id}),file);assert.deepEqual(rpc(ids.staff,'supply_credential_file',{p_id:credential.id}),file);
   denied(()=>rpc(ids.other,'supply_credential_file',{p_id:credential.id}),'SUPPLY_CREDENTIAL_NOT_FOUND');
   denied(()=>rpc(ids.staff,'supply_review_application',{p_id:app.id,p_revision:3,p_decision:'approved',p_reason:''}),'SUPPLY_CREDENTIAL_REVIEW_REQUIRED');
   const approved=rpc(ids.staff,'supply_review_application',{p_id:app.id,p_revision:3,p_decision:'approved',p_reason:'Synthetic credential reviewed',p_credentials_reviewed:true});assert.equal(approved.status,'approved');
  });
  await t.test('payouts accept only backend encrypted envelopes, stay pending, and expose no ciphertext',()=>{
   const id=applications.teacher.id,{envelope,lastFour}=encryptPayout(syntheticPayout,{key:syntheticKey,actor:ids.owner,applicationId:id});
   const p={p_actor:ids.owner,p_id:id,p_envelope:envelope,p_last_four:lastFour};denied(()=>rpc(ids.owner,'supply_save_payout',p),'permission denied');
   assert.equal(rpc('','supply_save_payout',p,'service_role').status,'pending');
   denied(()=>rpc('','supply_save_payout',{...p,p_actor:ids.other},'service_role'),'SUPPLY_APPLICATION_NOT_FOUND');
   const stored=sql('SELECT envelope FROM public.supply_payouts');assert.equal(stored.includes('WEST'),false);assert.equal(JSON.stringify(rpc(ids.owner,'supply_my_applications')).includes(envelope.ciphertext),false);
   // Synthetic opaque values exercise database envelope limits; real banking
   // envelopes are produced by the authenticated encryption adapter above.
   for(const ciphertext of ['', 'A'.repeat(15), 'A'.repeat(8193), 'A'.repeat(15)+'!']){
    denied(()=>rpc('','supply_save_payout',{...p,p_envelope:{...envelope,ciphertext}},'service_role'),'SUPPLY_INVALID_PAYOUT');
    assert.deepEqual(JSON.parse(sql('SELECT envelope FROM public.supply_payouts')),envelope);
   }
   for(const length of [16,8192])assert.equal(rpc('','supply_save_payout',{...p,p_envelope:{...envelope,ciphertext:'A'.repeat(length)}},'service_role').status,'pending');
   rpc('','supply_save_payout',p,'service_role');

  });
  await t.test('current verification, exclusion and consent rules suppress public profiles',()=>{
   const id=applications.teacher.id;sql(`UPDATE auth.users SET email_confirmed_at=NULL WHERE id=${L(ids.owner)}`);assert.deepEqual(rpc('','supply_public_profiles',{p_id:id},'anon'),[]);sql(`UPDATE auth.users SET email_confirmed_at=now() WHERE id=${L(ids.owner)}`);
   const a=rpc(ids.excluded,'supply_save_application',{p_type:'teacher',p_profile:teacher});denied(()=>rpc(ids.staff,'supply_review_application',{p_id:a.id,p_revision:1,p_decision:'approved',p_reason:''}),'SUPPLY_PUBLICATION_BLOCKED');
   const consent=rpc(ids.other,'supply_save_application',{p_type:'teacher',p_profile:{...teacher,publicationConsent:false}});rpc(ids.staff,'supply_review_application',{p_id:consent.id,p_revision:1,p_decision:'approved',p_reason:''});assert.deepEqual(rpc('','supply_public_profiles',{p_id:consent.id},'anon'),[]);
  });
  await t.test('schema validation rejects forged status, malformed types, overlapping availability and wrong pairs',()=>{
   for(const profile of [{...teacher,status:'approved'},{...teacher,hourlyRateMinor:'25000'},{...teacher,availability:[{day:1,start:'12:00',end:'09:00'}]},{...teacher,availability:[...teacher.availability,{day:1,start:'10:00',end:'11:00'}]},{...teacher,introVideo:'javascript:alert(1)'}])denied(()=>rpc(ids.other,'supply_save_application',{p_type:'teacher',p_profile:profile}),'SUPPLY_INVALID_PROFILE');
   denied(()=>rpc(ids.other,'supply_save_application',{p_type:'translator',p_profile:{...translator,languagePairs:[{source:'English',target:'English'}]}}),'SUPPLY_INVALID_PROFILE');
  });
  await t.test('private tables and internal helpers are inaccessible to client and service roles',()=>{
   for(const role of ['anon','authenticated','service_role'])for(const table of ['supply_applications','supply_teacher_profiles','supply_translation_profiles','supply_transport_profiles','supply_credentials','supply_reviews','supply_payouts'])denied(()=>sql(as(ids.owner,`SELECT * FROM public.${table}`,role)),'permission denied');
   denied(()=>rpc(ids.owner,'supply_private_payload',{a:null}),'permission denied');
  });
  await t.test('self-review and a revoked administrator cannot approve applications',()=>{
   const a=rpc(ids.staff,'supply_save_application',{p_type:'transport',p_profile:transport});denied(()=>rpc(ids.staff,'supply_review_application',{p_id:a.id,p_revision:1,p_decision:'approved',p_reason:''}),'SUPPLY_SELF_REVIEW_DENIED');
   sql(`DELETE FROM public.learning_review_staff WHERE user_id=${L(ids.staff)}`);assert.equal(rpc(ids.staff,'supply_admin_access'),false);denied(()=>rpc(ids.staff,'supply_review_queue'),'SUPPLY_ADMIN_REQUIRED');
  });
 }finally{if(started)tool('pg_ctl',['-D',data,'-m','fast','-w','stop']);}
});

test('supply HTTP routes enforce signup, admin access, private uploads, encryption and no payment actions',async()=>{
 const ids={owner:randomUUID(),staff:randomUUID(),other:randomUUID()},application=randomUUID(),credential=randomUUID();let uploaded=0,scans=0,serviceCalls=[],registration=0,scannerStatus='clean';
 const env={NODE_ENV:'production',APP_ORIGINS:'https://app.fixture.invalid',HOST:'127.0.0.1',PORT:'0',LEARNING_VIDEO_MODE:'live',LEARNING_VIDEO_ENABLED:'false',SUPABASE_URL:'https://service.fixture.invalid',SUPPLY_PAYOUT_ENCRYPTION_KEY:syntheticKey};
 const auth={checkReady:async()=>{},db:{stop(){}},authenticate:async token=>{const actor=ids[token?.split('.')[0]];if(!actor)throw Object.assign(Error('AUTH_REQUIRED'),{status:401});return {actor,bearer:token};},register:async()=>{registration++;return {confirmationRequired:true};},supplyPublic:async()=>[],supplyRpc:async(session,name)=>{
  if(name==='supply_admin_access')return session.actor===ids.staff;
  if(name==='supply_my_applications')return session.actor===ids.owner?[{id:application}]:[];
  if(name==='supply_review_queue'){if(session.actor!==ids.staff)throw Object.assign(Error('SUPPLY_ADMIN_REQUIRED'),{status:403});return [];}
  if(name==='supply_upload_context'){if(session.actor!==ids.owner)throw Object.assign(Error('SUPPLY_APPLICATION_NOT_FOUND'),{status:404});return true;}
  if(name==='supply_credential_file'){if(![ids.owner,ids.staff].includes(session.actor))throw Object.assign(Error('SUPPLY_CREDENTIAL_NOT_FOUND'),{status:404});return {mime:'application/pdf'};}
  throw Error('SYNTHETIC_UNEXPECTED_RPC');},supplyServiceRpc:async(name,p)=>{serviceCalls.push({name,p});return {status:'pending'};}};
 const app=await startProductionServer({env,auth,storage:{kind:'spaces',put:async(bytes,mime)=>{uploaded++;return {mime};},get:async()=>Buffer.from('SYNTHETIC_PRIVATE_FILE')},scanner:{available:true,scanBytes:async()=>{scans++;return {status:scannerStatus};}},learning:{close:async()=>{}},handleSignals:false,log:()=>{}});
 const url='http://127.0.0.1:'+app.server.address().port;
 // Use the same explicit-Host HTTP transport as production.test.mjs. Fetch
 // implementations can replace Host with the loopback URL's authority, causing
 // HOST_DENIED before authentication instead of exercising the intended route.
 const request=(path,{role,body,method=body?'POST':'GET',origin='https://app.fixture.invalid',headers={}}={})=>new Promise((resolve,reject)=>{
  const req=httpRequest(url+path,{method,headers:{Host:'app.fixture.invalid',...(method==='POST'?{Origin:origin}:{}),...(role?{Authorization:'Bearer '+role+'.fixture.session'}:{}),...(body?{'Content-Type':Buffer.isBuffer(body)?'application/pdf':'application/json'}:{}),...headers}},res=>{
   let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,json:()=>JSON.parse(text)}));res.on('error',reject);
  });
  req.on('error',reject);req.setTimeout(5000,()=>req.destroy(Error('SYNTHETIC_HTTP_TIMEOUT')));req.end(body?(Buffer.isBuffer(body)?body:JSON.stringify(body)):undefined);
 });
 try{
  const foreignHost=await request('/supply-dashboard.html',{headers:{Host:'foreign.fixture.invalid'}});assert.equal(foreignHost.status,403);assert.equal(foreignHost.json().error,'HOST_DENIED');
  assert.equal((await request('/supply-dashboard.html')).status,302);assert.equal((await request('/supply-review.html',{role:'owner'})).status,403);assert.equal((await request('/supply-review.html',{role:'staff'})).status,200);
  assert.equal((await request('/api/supply/applications')).status,401);assert.equal((await request('/api/supply/review',{role:'owner'})).status,403);assert.equal((await request('/api/supply/review',{role:'staff'})).status,200);
  assert.deepEqual(await (await request('/api/supply/profiles')).json(),[]);
  assert.equal((await request('/api/supply/register',{body:{email:'synthetic@fixture.invalid',password:'SYNTHETIC_PASSWORD_12345'}})).status,202);assert.equal(registration,1);
  assert.equal((await request('/api/supply/register',{body:{email:'synthetic@fixture.invalid',password:'SYNTHETIC_PASSWORD_12345'},origin:'https://foreign.fixture.invalid'})).status,403);
  assert.equal((await request('/api/supply/applications/'+application+'/payout',{role:'owner',body:syntheticPayout})).status,200);const payout=serviceCalls.at(-1);assert.equal(payout.name,'supply_save_payout');assert.equal(payout.p.p_actor,ids.owner);assert.equal(JSON.stringify(payout).includes('WEST'),false);
  const before=serviceCalls.length;assert.equal((await request('/api/supply/applications/'+application+'/payout',{role:'other',body:syntheticPayout})).status,404);assert.equal(serviceCalls.length,before);
  const pdf=Buffer.from('%PDF-1.7\nSYNTHETIC_CREDENTIAL\n%%EOF');
  assert.equal((await request('/api/supply/applications/'+application+'/credentials',{role:'other',body:pdf,headers:{'X-File-Name':'credential.pdf'}})).status,404);assert.equal(scans,0);assert.equal(uploaded,0);
  scannerStatus='infected';assert.equal((await request('/api/supply/applications/'+application+'/credentials',{role:'owner',body:pdf,headers:{'X-File-Name':'credential.pdf'}})).status,422);assert.equal(uploaded,0);
  scannerStatus='clean';assert.equal((await request('/api/supply/applications/'+application+'/credentials',{role:'owner',body:pdf,headers:{'X-File-Name':'credential.pdf'}})).status,201);assert.equal(uploaded,1);assert.equal(serviceCalls.at(-1).name,'supply_record_credential');
  assert.equal((await request('/api/supply/credentials/'+credential,{role:'other'})).status,404);assert.equal((await request('/api/supply/credentials/'+credential,{role:'staff'})).status,200);
  assert.equal((await request('/api/supply/checkout',{role:'owner',body:{}})).status,404);
 }finally{await app.close();}
});

test('production auth adapter registers with verified-email redirect and allowlists supply RPCs',async()=>{
 const calls=[];const env={SUPABASE_URL:'https://service.fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_PUBLIC_KEY_123',SUPABASE_SECRET_KEY:'sb_secret_SYNTHETIC_SERVER_KEY_123',SUPABASE_REQUIRE_MODERN_KEYS:'true'};
 const auth=createProductionSupabase(env,{fetcher:async(input,options={})=>{calls.push({url:String(input),body:options.body});return Response.json({user:{id:randomUUID(),email:'synthetic@fixture.invalid'},session:null});}});
 await assert.rejects(auth.register('synthetic@fixture.invalid','short','https://app.fixture.invalid'),/INVALID_REGISTRATION/);assert.equal(calls.length,0);
 await auth.register('synthetic@fixture.invalid','SYNTHETIC_PASSWORD_12345','https://app.fixture.invalid');assert.equal(calls.length,1);assert.equal(new URL(calls[0].url).pathname,'/auth/v1/signup');assert.equal(new URL(calls[0].url).searchParams.get('redirect_to'),'https://app.fixture.invalid/production-login.html?next=%2Fsupply-dashboard.html');
 await assert.rejects(auth.supplyRpc({bearer:'synthetic.fixture.session'},'supply_save_payout'),/RPC_DENIED/);await assert.rejects(auth.supplyServiceRpc('supply_public_profiles',{}),/RPC_DENIED/);
});
