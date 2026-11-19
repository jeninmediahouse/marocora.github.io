import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {cloudConfiguration} from '../server/block1/supabase-database.mjs';
import {createProductionSupabase} from '../server/production/supabase.mjs';
import {edgeSupabaseConfiguration} from '../server/supabase-api-keys.mjs';
import {publicSupabaseConfiguration,publicSupabaseUserHeaders,publicSupabaseFetch} from '../learn/supabase-public.mjs';
import {createIntakeHandler} from '../server/service-intake.mjs';
import {createVendorHandler} from '../server/vendor-workflow.mjs';
import {checkModernSupabaseKeys} from '../scripts/check-supabase-modern-keys.mjs';
import {authConfig} from '../scripts/auth-test-support.mjs';

// Synthetic, non-working placeholders only. No environment files or live API.
const pub='sb_publishable_SYNTHETIC_PUBLIC_NOT_A_REAL_KEY';
const secret='sb_secret_SYNTHETIC_PRIVATE_NOT_A_REAL_KEY';
const env={SUPABASE_URL:'https://supabase.fixture.invalid',SUPABASE_PUBLISHABLE_KEY:pub,SUPABASE_SECRET_KEY:secret};
const actor=randomUUID(),id=randomUUID(),token='SYNTHETIC.session.signature';
const user={id:actor,email:'owner@fixture.invalid',email_confirmed_at:'2026-11-19',is_anonymous:false};
const publicConfig={supabaseURL:env.SUPABASE_URL,supabasePublishableKey:pub};
const response=(value,status=200)=>Response.json(value,{status});
const request=(body,authorization='Bearer '+token)=>new Request('https://edge.fixture.invalid',{method:'POST',headers:{Origin:'https://marocora.com',apikey:pub,...(authorization?{Authorization:authorization}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)});

test('Modern server credentials win over stale legacy variables; partial pairs fail closed',()=>{
 const stale={SUPABASE_ANON_KEY:'SYNTHETIC_OLD_ANON',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_OLD_SERVICE'};
 const config=cloudConfiguration({...stale,...env});assert.equal(config.keyMode,'modern');assert.equal(config.anon,pub);assert.equal(config.service,secret);
 assert.equal(authConfig({...stale,...env}).service,secret);
 assert.equal(cloudConfiguration({SUPABASE_URL:env.SUPABASE_URL,...stale}).keyMode,'legacy');
 for(const input of [{...env,SUPABASE_SECRET_KEY:undefined},{...env,SUPABASE_PUBLISHABLE_KEY:secret},{...env,SUPABASE_SECRET_KEY:pub},{SUPABASE_URL:env.SUPABASE_URL,...stale,SUPABASE_REQUIRE_MODERN_KEYS:'true'}]){
  assert.throws(()=>cloudConfiguration({...stale,...input}),e=>e.message==='SUPABASE_MODERN_KEY_PAIR_REQUIRED');
 }
 assert.throws(()=>cloudConfiguration({...env,SUPABASE_URL:'https://supabase.fixture.invalid/other'}),/INVALID_SUPABASE_URL/);
});

test('Production SDK sends opaque API keys only as apikey and preserves verified user JWT identity',async()=>{
 const calls=[];let allow=true;
 const auth=createProductionSupabase(env,{fetcher:async(input,options)=>{
  const path=new URL(input).pathname,headers=new Headers(options.headers);calls.push({path,headers});
  assert.equal(options.redirect,'error');
  if(path.endsWith('/auth/v1/user'))return response(allow?user:{message:'invalid'},allow?200:401);
  if(path.endsWith('/production_runtime_status'))return response({version:4,mockPayments:false});
  if(path.endsWith('/translation_session_context'))return response({actor,role:'customer'});
  if(path.endsWith('/translation_scan_record_scan'))return response({recorded:true});
  throw Error('UNEXPECTED_SYNTHETIC_PATH');
 }});
 await auth.checkReady();assert.equal((await auth.translationSession(token)).actor,actor);
 await auth.db.recordScan({actor},id,'0'.repeat(64),{status:'clean',engine:'SYNTHETIC',reason:'SYNTHETIC'});
 for(const call of calls){
  const privileged=/production_runtime_status|translation_scan_record_scan/.test(call.path);
  assert.equal(call.headers.get('apikey'),privileged?secret:pub);
  assert.equal(call.headers.get('authorization'),privileged?null:'Bearer '+token);
 }
 allow=false;const before=calls.length;await assert.rejects(auth.authenticate(token),/AUTH_REQUIRED/);assert.equal(calls.length,before+1);
 const rejected=calls.length;await assert.rejects(auth.authenticate(secret),/AUTH_REQUIRED/);assert.equal(calls.length,rejected);
});

test('Browser config rejects elevated/legacy keys; API-key headers never replace a signed-in user',async()=>{
 assert.equal(publicSupabaseConfiguration(publicConfig).key,pub);
 for(const key of [secret,'SYNTHETIC.legacy.signature','',undefined])assert.throws(()=>publicSupabaseConfiguration({...publicConfig,supabasePublishableKey:key}),/PUBLIC_SUPABASE_CONFIGURATION_REQUIRED/);
 assert.deepEqual(publicSupabaseUserHeaders(publicConfig,{access_token:token}),{apikey:pub,Authorization:'Bearer '+token,'Content-Type':'application/json'});
 for(const access_token of [pub,secret,'',undefined,'invalid\r\nheader'])assert.throws(()=>publicSupabaseUserHeaders(publicConfig,{access_token}),/SIGN_IN_REQUIRED/);
 const calls=[],fetcher=publicSupabaseFetch(async(input,options)=>{calls.push(new Headers(options.headers));return response({});});
 await fetcher('https://supabase.fixture.invalid/auth/v1/token',{headers:{apikey:pub,Authorization:'Bearer '+pub}});
 await fetcher(new Request('https://supabase.fixture.invalid/auth/v1/user',{headers:{apikey:pub,Authorization:'Bearer '+token}}));
 assert.equal(calls[0].get('apikey'),pub);assert.equal(calls[0].get('authorization'),null);assert.equal(calls[1].get('authorization'),'Bearer '+token);
});

test('Edge configuration selects the named modern secret and never falls back to legacy/default keys',()=>{
 const named='marocora-production-20261119';
 const select=values=>edgeSupabaseConfiguration(name=>values[name]);
 const base={SUPABASE_URL:env.SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_OLD_DO_NOT_USE'};
 assert.equal(select({...base,SUPABASE_SECRET_KEYS:JSON.stringify({[named]:secret})}).serviceKey,secret);
 assert.equal(select({...base,MAROCORA_SUPABASE_SECRET_KEY:secret}).serviceKey,secret);
 assert.equal(select({...base,MAROCORA_SUPABASE_SECRET_KEY_NAME:'reviewed-backend',SUPABASE_SECRET_KEYS:JSON.stringify({'reviewed-backend':secret})}).serviceKey,secret);
 for(const extra of [{},{SUPABASE_SECRET_KEYS:'broken'},{SUPABASE_SECRET_KEYS:JSON.stringify({default:secret})},{MAROCORA_SUPABASE_SECRET_KEY:pub},{MAROCORA_SUPABASE_SECRET_KEY:''},{SUPABASE_SECRET_KEYS:'[]'}]){
  assert.throws(()=>select({...base,...extra}),e=>/^SUPABASE_/.test(e.message)&&!e.message.includes(secret));
 }
});

test('Actual Edge Function entrypoints start with the selected modern key and reject API-key-only callers',async t=>{
 const previousDeno=globalThis.Deno,previousFetch=globalThis.fetch;
 t.after(()=>{if(previousDeno===undefined)delete globalThis.Deno;else globalThis.Deno=previousDeno;globalThis.fetch=previousFetch;});
 for(const entry of ['service-intake','vendor-workflow']){
  const values={SUPABASE_URL:env.SUPABASE_URL,SUPABASE_SECRET_KEYS:JSON.stringify({'marocora-production-20261119':secret})};let handler;const calls=[];
  globalThis.Deno={env:{get:name=>values[name]},serve:value=>{handler=value;}};
  globalThis.fetch=async(input,options)=>{calls.push({input,headers:new Headers(options.headers)});return response({message:'invalid'},401);};
  await import('../supabase/functions/'+entry+'/index.ts?fixture='+randomUUID());assert.equal(typeof handler,'function');
  for(const authorization of [null,'Bearer '+pub,'Bearer '+secret])assert.equal((await handler(request({},authorization))).status,401);
  assert.equal(calls.length,0);
  assert.equal((await handler(request({}))).status,401);assert.equal(calls.length,1);
  assert.equal(calls[0].headers.get('apikey'),secret);assert.equal(calls[0].headers.get('authorization'),'Bearer '+token);
 }
});

test('Modern intake still validates Auth/email before writes, while privileged RPCs have no API-key bearer',async()=>{
 const calls=[];let valid=true;
 const handler=createIntakeHandler({supabaseURL:env.SUPABASE_URL,serviceKey:secret,fetcher:async(input,options)=>{
  calls.push({input,headers:new Headers(options.headers)});
  if(input.endsWith('/auth/v1/user'))return response(valid?user:{...user,email_confirmed_at:null});
  if(input.endsWith('/service_intake_reserve'))return response({dispatch:false,delivery:'delivered'});
  throw Error('UNEXPECTED_SYNTHETIC_PATH');
 }});
 const body={kind:'contact',requestId:id,fields:{email:user.email,name:'Synthetic owner',message:'Synthetic request'}};
 assert.equal((await handler(request(body))).status,200);assert.equal(calls.length,2);
 assert.equal(calls[0].headers.get('authorization'),'Bearer '+token);
 assert.equal(calls[1].headers.get('apikey'),secret);assert.equal(calls[1].headers.get('authorization'),null);
 valid=false;const before=calls.length;assert.equal((await handler(request(body))).status,400);assert.equal(calls.length,before+1);
});

test('Modern vendor workflow preserves caller-scoped decisions and server-only mail RPCs and staff denial',async()=>{
 const calls=[];let deny=false;
 const handler=createVendorHandler({supabaseURL:env.SUPABASE_URL,serviceKey:secret,sendMail:async()=>{throw Error('SHOULD_NOT_SEND');},fetcher:async(input,options)=>{
  calls.push({input,headers:new Headers(options.headers)});
  if(input.endsWith('/auth/v1/user'))return response(user);
  if(input.endsWith('/vendor_decide'))return deny?response({message:'STAFF_REQUIRED'},403):response({application_id:id});
  if(input.endsWith('/vendor_claim_mail'))return response(null);
  if(input.endsWith('/vendor_mail_health'))return response({needs_attention:false});
  throw Error('UNEXPECTED_SYNTHETIC_PATH');
 }});
 const body={action:'decide',id,commandId:randomUUID(),decision:'approved',revision:1};
 assert.equal((await handler(request(body))).status,200);
 for(const call of calls){assert.equal(call.headers.get('apikey'),secret);assert.equal(call.headers.get('authorization'),/vendor_claim_mail|vendor_mail_health/.test(call.input)?null:'Bearer '+token);}
 deny=true;const before=calls.length;const result=await handler(request(body));assert.equal(result.status,403);assert.deepEqual(await result.json(),{error:'STAFF_REQUIRED'});assert.equal(calls.length,before+2);
});

test('Owner-run modern-key canary is read-only, rejects partial configuration and fails on anonymous Edge acceptance',async()=>{
 const calls=[];
 const fetcher=async(input,options)=>{
  calls.push({input,options});
  if(new URL(input).pathname.endsWith('/production_runtime_status'))return response({version:4,mockPayments:false});
  assert.match(new URL(input).pathname,/^\/functions\/v1\/(service-intake|vendor-workflow)$/);assert.equal(options.body,'{}');
  const headers=new Headers(options.headers);assert.equal(headers.get('authorization'),null);assert.equal(headers.get('apikey'),pub);
  return response({error:'SIGN_IN_REQUIRED'},401);
 };
 assert.deepEqual(await checkModernSupabaseKeys(env,{fetcher}),{runtimeReadiness:true,anonymousEdgeRequestsDenied:true});assert.equal(calls.length,3);
 await assert.rejects(checkModernSupabaseKeys({...env,SUPABASE_SECRET_KEY:undefined},{fetcher}),/SUPABASE_MODERN_KEY_PAIR_REQUIRED/);assert.equal(calls.length,3);
 await assert.rejects(checkModernSupabaseKeys(env,{fetcher:async input=>new URL(input).pathname.endsWith('/production_runtime_status')?response({version:4,mockPayments:false}):response({})}),/EDGE_ANONYMOUS_REJECTION_REQUIRED/);
});
