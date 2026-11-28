import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {request as httpRequest} from 'node:http';
import {readFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {TokenVerifier} from 'livekit-server-sdk';
import {createSpacesStore,spacesConfiguration} from '../server/storage/spaces.mjs';
import {instantRoutes} from '../server/block1/instant-http.mjs';
import {createProductionSupabase} from '../server/production/supabase.mjs';
import {productionConfig} from '../server/production/config.mjs';
import {startProductionServer} from '../server/production/http.mjs';
import {publicPages,privatePages} from '../server/production/site.mjs';
import {createProductionLearning} from '../server/production/learning.mjs';
import {createLiveKitAdapter} from '../server/livekit-adapter.mjs';
import {openLocalDatabase,L} from '../server/block1/database.mjs';
const credentials={SPACES_KEY:'SYNTHETIC_KEY',SPACES_SECRET:'SYNTHETIC_SECRET',SPACES_BUCKET:'synthetic-private-bucket',SPACES_REGION:'ams3'};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function memorySpaces(){
 const objects=new Map(),calls=[];let corrupt=false;
 const client={async send(command){calls.push(command);const p=command.input;
  if(command.constructor.name==='PutObjectCommand'){objects.set(p.Key,Buffer.from(p.Body));return {};}
  if(command.constructor.name==='DeleteObjectCommand'){objects.delete(p.Key);return {};}
  const bytes=objects.get(p.Key);if(!bytes)throw Error('NOT_FOUND');return {ContentLength:bytes.length,Body:Readable.from([corrupt?Buffer.alloc(bytes.length):bytes])};
 },destroy(){}};
 return {store:createSpacesStore(credentials,{client}),objects,calls,corrupt(){corrupt=true;}};
}
test('Spaces uses private bounded S3 objects, verifies integrity and refuses foreign descriptors',async()=>{
 const f=memorySpaces(),data=Buffer.from('Synthetic private content'),file=await f.store.put(data,'text/plain');
 assert.equal(file.backend,'spaces');assert.equal(f.calls[0].input.ACL,'private');assert.equal(f.calls[0].input.Metadata.sha256,hash(data));assert.deepEqual(await f.store.get(file),data);
 const before=f.calls.length;for(const extra of [{bucket:'foreign'},{key:'../secret'},{sha256:'bad'},{size:999999999}])await assert.rejects(f.store.get({...file,...extra}));assert.equal(f.calls.length,before);
 const scan=await f.store.scan(file,{scanBytes:async(bytes,digest)=>{assert.deepEqual(bytes,data);assert.equal(digest,file.sha256);return {status:'clean'};}},{name:'document.txt'});assert.equal(scan.status,'clean');
 f.corrupt();await assert.rejects(f.store.get(file),/FILE_INTEGRITY_FAILURE/);await f.store.remove(file);assert.equal(f.objects.size,0);
 assert.equal(spacesConfiguration(credentials).endpoint,'https://ams3.digitaloceanspaces.com');assert.throws(()=>spacesConfiguration({...credentials,SPACES_REGION:'https://foreign.invalid'}));
});
test('Cloud V3 source/final/watermark routes preserve authorization, scan and final-payment gating without local files',async()=>{
 const f=memorySpaces(),customer=randomUUID(),provider=randomUUID(),outsider=randomUUID(),pdf=readFileSync('tests/fixtures/instant-v3/image-only-scan.pdf');let q,scans=0;
 const db={dir:'/nonexistent-no-local-storage',settings:async()=>({capture_enabled:true,commands_enabled:true}),
  rpc:async(session,name)=>{if(name!=='instant_detail'||![customer,provider].includes(session.actor))throw Object.assign(Error('UNAVAILABLE'),{status:403});return q;},
  instantRecord:async(session,name,p)=>{if(name==='instant_record_order')q={id:p.p_payload.id,customer_id:customer,status:'manual_review',original_file:p.p_payload.file};else q={...q,status:'awaiting_balance',final_file:p.p_payload.final,draft_file:p.p_payload.draft};return q;}};
 const route=instantRoutes({db,storage:f.store,scanner:{scanBytes:async()=>{scans++;return {status:'clean'};}},allowMockPayments:false});
 async function call(actor,method,path,data=pdf){let result,bytes;const res={writeHead(status){assert.equal(status,200);},end(value){bytes=value;}};
  await route({req:{method,headers:{'content-type':'application/pdf','x-file-name':'synthetic.pdf','x-quote-details':encodeURIComponent(JSON.stringify({category:'normal',source:'English',target:'French',sampleRequested:false,scanned:true}))}},url:new URL(path,'https://app.invalid'),session:{actor,role:'customer'},body:async()=>data,input:async()=>({}),json:(status,value)=>result={status,value},res});return {result,bytes};}
 await call(customer,'POST','/api/instant/orders');assert.equal(scans,1);assert.equal(q.original_file.backend,'spaces');assert.equal(existsSync(db.dir),false);
 const id=q.id;assert.deepEqual((await call(customer,'GET','/api/instant/orders/'+id+'/original')).bytes,pdf);
 const reads=f.calls.length;await assert.rejects(call(outsider,'GET','/api/instant/orders/'+id+'/original'));assert.equal(f.calls.length,reads);
 q={...q,status:'in_progress_deposit_paid',provider_id:provider,work_started_at:new Date().toISOString()};await call(provider,'POST','/api/instant/orders/'+id+'/complete');assert.equal(scans,2);assert.equal(q.draft_file.backend,'spaces');assert.notEqual(q.final_file.sha256,q.draft_file.sha256);
 const before=f.calls.length;await assert.rejects(call(customer,'GET','/api/instant/orders/'+id+'/final'),/BALANCE_REQUIRED/);assert.equal(f.calls.length,before);
 assert.ok((await call(customer,'GET','/api/instant/orders/'+id+'/draft')).bytes.length>0);
 await assert.rejects(call(customer,'POST','/api/instant/orders/'+id+'/pay'),/PAYMENT_GATEWAY_NOT_CONFIGURED/);
 q.status='paid_in_full';assert.deepEqual((await call(customer,'GET','/api/instant/orders/'+id+'/final')).bytes,pdf);
});
test('Spaces upload scan failures clean up pre-commit objects, while ambiguous DB commits retain recovery bytes',async()=>{
 const pdf=readFileSync('tests/fixtures/instant-v3/image-only-scan.pdf'),session={actor:randomUUID(),role:'customer'};
 async function run(clean,dbFailure){
  const f=memorySpaces();let records=0;
  const db={settings:async()=>({capture_enabled:true,commands_enabled:true}),instantRecord:async()=>{records++;if(dbFailure)throw Error('AMBIGUOUS_COMMIT');return {};}};
  const route=instantRoutes({db,storage:f.store,scanner:{scanBytes:async()=>({status:clean?'clean':'infected'})}});
  await assert.rejects(route({req:{method:'POST',headers:{'content-type':'application/pdf','x-file-name':'synthetic.pdf','x-quote-details':encodeURIComponent(JSON.stringify({category:'normal',source:'English',target:'French',sampleRequested:false,scanned:true}))}},url:new URL('https://app.invalid/api/instant/orders'),session,body:async()=>pdf,json:()=>{}}));
  assert.equal(records,clean?1:0);assert.equal(f.objects.size,dbFailure?1:0);
 }
 await run(false,false);await run(true,true);
});
const actor=randomUUID(),bearer='test.payload.signature';
function supabaseFixture(){
 let user={id:actor,email:'synthetic@production.invalid',email_confirmed_at:'2026-01-01',is_anonymous:false,user_metadata:{role:'staff'}},calls=[];
 const env={NODE_ENV:'production',APP_ORIGINS:'https://app.example.invalid',PORT:'0',SUPABASE_URL:'https://supabase.example.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_ANON',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE',LEARNING_VIDEO_MODE:'live',...credentials};
 const fetcher=async(input,options={})=>{const url=new URL(input),headers=new Headers(options.headers);calls.push({path:url.pathname,authorization:headers.get('authorization')});
  if(url.pathname==='/auth/v1/user')return Response.json(user||{message:'invalid'},{status:user?200:401});
  if(url.pathname==='/auth/v1/token')return Response.json({access_token:bearer,refresh_token:'SYNTHETIC_REFRESH',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user});
  if(url.pathname.endsWith('translation_session_context'))return Response.json({actor,role:'customer'});
  if(url.pathname.endsWith('translation_runtime_settings'))return Response.json({capture_enabled:false,commands_enabled:false,notifications_enabled:false});
  if(url.pathname.endsWith('production_runtime_status'))return Response.json({version:4,mockPayments:false});
  throw Error('UNEXPECTED_RPC');};
 return {env,auth:createProductionSupabase(env,{fetcher}),calls,setUser:value=>user=value};
}
test('Production Supabase auth requires remote confirmed non-anonymous users and resolves roles from DB, not metadata',async()=>{
 const f=supabaseFixture(),session=await f.auth.authenticate(bearer);assert.equal(session.actor,actor);assert.equal(session.role,undefined);
 assert.equal((await f.auth.translationSession(bearer)).role,'customer');assert.ok(f.calls.some(c=>c.path.endsWith('translation_session_context')&&c.authorization==='Bearer '+bearer));
 for(const user of [null,{id:actor,email:'synthetic@invalid',email_confirmed_at:null,is_anonymous:false},{id:actor,email:'synthetic@invalid',email_confirmed_at:'2026-01-01',is_anonymous:true}]){f.setUser(user);await assert.rejects(f.auth.authenticate(bearer),/AUTH_REQUIRED/);}
 await assert.rejects(f.auth.authenticate('forged'),/AUTH_REQUIRED/);
});
const localRequest=(port,path,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{
  const req=httpRequest('http://127.0.0.1:'+port+path,{method,headers:{Host:'app.example.invalid',...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text,json:()=>JSON.parse(text)}));res.on('error',reject);});req.on('error',reject);req.end(body);
});
test('Production restores public website and assets while gating every private page and retaining API authorization',async t=>{
 const f=supabaseFixture(),app=await startProductionServer({env:f.env,auth:f.auth,storage:memorySpaces().store,scanner:{available:true},handleSignals:false,log:()=>{}});
 t.after(()=>app.close());const port=app.server.address().port;
 const home=await localRequest(port,'/?lang=fr');assert.equal(home.status,200);assert.match(home.text,/Local trust, global reach/);assert.ok(!home.text.includes('id="production-login"'));assert.match(home.text,/href="production-login.html"/);
 for(const name of publicPages){
  const response=await localRequest(port,'/'+name);assert.equal(response.status,200,name);
  for(const match of response.text.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/g)){
   const resource=new URL(match[1],'https://app.example.invalid/'+name);
   if(resource.origin==='https://app.example.invalid')assert.equal((await localRequest(port,resource.pathname+resource.search)).status,200,name+' -> '+resource.pathname);
  }
 }
 assert.equal((await localRequest(port,'/learn/?lang=fr')).status,200);
 assert.equal((await localRequest(port,'/learn?lang=fr')).headers.location,'/learn/?lang=fr');
 const inquiry=await localRequest(port,'/translation-request.html');assert.match(inquiry.text,/id="translation-request-form"/);assert.ok(!inquiry.text.includes('My workspace'));
 const image=await localRequest(port,'/GOPR1269.JPG');assert.equal(image.status,200);assert.equal(image.headers['content-type'],'image/jpeg');
 const profile=await localRequest(port,'/translator-tareq-naser.html');assert.match(profile.headers['content-security-policy'],/sha256-/);assert.ok(!profile.headers['content-security-policy'].split(';')[1].includes('unsafe-inline'));
 assert.ok(home.headers['content-security-policy'].includes('https://supabase.example.invalid'));
 assert.equal(f.calls.filter(call=>call.path==='/auth/v1/user').length,0);
 for(const name of privatePages){
  for(const method of ['GET','HEAD']){
   const response=await localRequest(port,'/'+name+'?lang=fr',{method});assert.equal(response.status,302,name);
   const login=new URL(response.headers.location,'https://app.example.invalid');assert.equal(login.pathname,'/production-login.html');assert.equal(login.searchParams.get('next'),'/'+name+'?lang=fr');
  }
 }
 for(const name of ['.env','server/production/site.mjs','docs/deployment/PRODUCTION-BOOTSTRAP.md','learn/config.mjs','learn/instructor-store.mjs','learn/learning-store.mjs','booking-data.js','payment.html'])assert.equal((await localRequest(port,'/'+name)).status,404,name);
 for(const path of ['/api/me','/api/instant/config','/api/learning/room-config'])assert.equal((await localRequest(port,path)).status,401,path);
 const headers={Origin:'https://app.example.invalid','Content-Type':'application/json'};
 const login=await localRequest(port,'/api/auth/login',{method:'POST',headers,body:JSON.stringify({email:'synthetic@production.invalid',password:'SYNTHETIC_PASSWORD'})});
 const cookie=login.headers['set-cookie'][0].split(';')[0];
 for(const name of privatePages)assert.equal((await localRequest(port,'/'+name,{headers:{Cookie:cookie}})).status,200,name);
 f.setUser(null);
 assert.equal((await localRequest(port,'/learning-room.html',{headers:{Cookie:cookie}})).status,302);
 assert.equal((await localRequest(port,'/instant-quote.html',{headers:{Cookie:cookie}})).status,302);
 assert.equal((await localRequest(port,'/api/learning/room-config',{headers:{Cookie:cookie}})).status,401);
});
test('Production HTTP has fixed origins, real auth cookies, no synthetic login and no mock payment or secret exposure',async t=>{
 const f=supabaseFixture(),storage=memorySpaces().store,app=await startProductionServer({env:f.env,auth:f.auth,storage,scanner:{available:true,scanBytes:async()=>({status:'clean'})},handleSignals:false,log:()=>{}});t.after(()=>app.close());const port=app.server.address().port;
 assert.equal((await localRequest(port,'/health')).status,200);assert.equal((await localRequest(port,'/health',{headers:{Host:'foreign.invalid','X-Forwarded-Host':'app.example.invalid'}})).status,403);
 assert.equal((await localRequest(port,'/api/local/learning-login',{method:'POST',headers:{Origin:'https://app.example.invalid'}})).status,404);
 assert.equal((await localRequest(port,'/api/learning/room-config')).status,401);
 const headers={Origin:'https://app.example.invalid','Content-Type':'application/json'};
 assert.equal((await localRequest(port,'/api/auth/login',{method:'POST',headers:{...headers,Origin:'https://foreign.invalid'},body:'{}'})).status,403);
 const login=await localRequest(port,'/api/auth/login',{method:'POST',headers,body:JSON.stringify({email:'synthetic@production.invalid',password:'SYNTHETIC_PASSWORD'})});assert.equal(login.status,200);assert.deepEqual(login.json(),{authenticated:true});assert.match(login.headers['set-cookie'][0],/Secure; HttpOnly; SameSite=Strict/);
 const cookie=login.headers['set-cookie'][0].split(';')[0],config=await localRequest(port,'/api/learning/room-config',{headers:{Cookie:cookie}});assert.deepEqual(config.json(),{enabled:false,transport:'live',mock:false});
 const quote=await localRequest(port,'/api/instant/config',{headers:{Cookie:cookie}});assert.equal(quote.json().mockPayment,false);assert.equal(quote.json().paymentConfigured,false);
 assert.equal((await localRequest(port,'/.env')).status,404);assert.equal((await localRequest(port,'/server/start-production.mjs')).status,404);
 assert.equal((await localRequest(port,'/production-login.html')).status,200);assert.equal((await localRequest(port,'/learn/config.mjs')).status,404);
 assert.ok(!JSON.stringify(quote.json()).includes(f.env.SUPABASE_SERVICE_ROLE_KEY));
 for(const extra of [{APP_ORIGINS:'http://app.invalid'},{HOST:'0.0.0.0'},{NODE_ENV:'development'},{APP_ORIGINS:'https://user:password@app.invalid'}])assert.throws(()=>productionConfig({...f.env,...extra}));
});
test('Managed learning revalidates database party/membership on join and reaps revoked participants',async()=>{
 const student=randomUUID(),teacher=randomUUID(),id=randomUUID(),calls=[];let available=true;
 const now=Date.now(),context={actor:student,bookingId:id,studentId:student,teacherId:teacher,role:'student',status:'confirmed',teacherActive:true,member:true,deliveryMode:'online',startsAt:new Date(now).toISOString(),endsAt:new Date(now+45*60000).toISOString()};
 const auth={authenticate:async token=>({actor:student,bearer:token}),roomContext:async session=>{if(!available||session.actor!==student)throw Error('ROOM_NOT_AVAILABLE');return context;}};
 const env={LEARNING_VIDEO_ENABLED:'true',LEARNING_VIDEO_MODE:'live',LIVEKIT_URL:'wss://synthetic.livekit.cloud',LIVEKIT_API_KEY:'SYNTHETIC_KEY',LIVEKIT_API_SECRET:'SYNTHETIC_SECRET_NOT_REAL_0123456789'};
 const adapter=createLiveKitAdapter(env,{roomClient:{createRoom:async()=>({maxParticipants:2}),removeParticipant:async(...args)=>calls.push(args)}}),rooms=createProductionLearning({auth,env,adapter,intervalMs:0});
 try{const session={actor:student,bearer},token=await rooms.issue(session,{bookingId:id});const claims=await new TokenVerifier(env.LIVEKIT_API_KEY,env.LIVEKIT_API_SECRET).verify(token.token);assert.deepEqual(claims.video.canPublishSources,['camera','microphone']);
  await rooms.connect(session,{bookingId:id,token:token.token});available=false;await rooms.reap();assert.equal(calls.length,1);await assert.rejects(rooms.heartbeat(session,{connectionId:token.connectionId}));
 }finally{await rooms.close();}
});
test('Production migration compiles locally, gates real allowlists/bookings with RLS and revokes mock payments',{timeout:60000},()=>{
 const dir=mkdtempSync(join(tmpdir(),'marocora-production-sql-'));let db;
 try{
  db=openLocalDatabase(dir,{forceLocal:true});db.sql('drop schema public cascade;create schema public;grant usage on schema public to anon,authenticated,service_role;');
  for(const name of ['202611140001_translation_workflow.sql','202611150003_instant_pricing.sql','202611170004_production_runtime.sql'])db.sql(readFileSync('supabase/migrations/'+name,'utf8'));
  const student=randomUUID(),teacher=randomUUID(),outsider=randomUUID(),id=randomUUID(),tenant=randomUUID();
  db.sql(`insert into auth.users(id,email,email_confirmed_at,is_anonymous) values (${L(student)},'student@production.invalid',now(),false),(${L(teacher)},'teacher@production.invalid',now(),false),(${L(outsider)},'outsider@production.invalid',now(),false)`);
  assert.equal(db.sql('select capture_enabled OR commands_enabled OR notifications_enabled from quote_settings where singleton'),'f');
  assert.equal(db.sql(`select public.quote_verified(${L(student)})`),'f');db.sql(`insert into production_translation_accounts(user_id,enabled) values (${L(student)},true)`);assert.equal(db.sql(`select public.quote_verified(${L(student)})`),'t');
  db.sql(`insert into production_learning_bookings(id,student_id,teacher_id,tenant_id,status,teacher_active,starts_at,ends_at) values (${L(id)},${L(student)},${L(teacher)},${L(tenant)},'confirmed',true,now(),now()+interval '45 minutes')`);
  assert.throws(()=>db.as(student,`select production_learning_room_context(${L(id)})`));
  db.sql(`insert into production_learning_memberships values (${L(tenant)},${L(student)}),(${L(tenant)},${L(teacher)})`);
  assert.equal(db.as(student,`select production_learning_room_context(${L(id)})`).role,'student');assert.equal(db.as(teacher,`select production_learning_room_context(${L(id)})`).role,'teacher');assert.throws(()=>db.as(outsider,`select production_learning_room_context(${L(id)})`));
  for(const table of ['production_translation_accounts','production_learning_bookings','production_learning_memberships'])assert.throws(()=>db.as(student,`select count(*) from ${table}`));
  assert.throws(()=>db.as(student,`select instant_pay_mock(${L(id)},${L(randomUUID())},'deposit',true)`));
  db.sql(`update production_learning_bookings set status='cancelled' where id=${L(id)}`);assert.throws(()=>db.as(student,`select production_learning_room_context(${L(id)})`));
  assert.throws(()=>db.sql(readFileSync('supabase/migrations/202611170004_production_runtime.sql','utf8')));assert.equal(db.sql('select count(*) from production_learning_bookings'),'1');
 }finally{db?.stop();rmSync(dir,{recursive:true,force:true});}
});
