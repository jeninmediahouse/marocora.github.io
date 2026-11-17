import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout} from 'node:timers/promises';
import {createSupabaseTransport,safeError,networkHint,STAGING_TIMEOUT_MS} from '../server/block1/network-diagnostics.mjs';
import {testRealAuth} from '../scripts/test-real-auth.mjs';
import {testE2eAuth} from '../scripts/test-e2e-auth.mjs';
import {authEnvironment,authConfig,mockAuthFetch,dummyToken} from '../scripts/auth-test-support.mjs';
const env=authEnvironment({mock:true}),config=authConfig(env);
test('Network diagnostics retain nested DNS/TLS codes without logging keys, passwords, tokens or URL',async()=>{
 const logs=[],secret='DUMMY_PRIVATE_SECRET',token='private.payload.signature';
 const cause=Object.assign(Error('getaddrinfo ENOTFOUND mock-cloud.invalid '+secret+' '+token),{code:'ENOTFOUND',syscall:'getaddrinfo'});
 const transport=createSupabaseTransport(config,{logger:x=>logs.push(x),fetcher:async()=>{throw Error('fetch failed',{cause});}});
 await assert.rejects(transport(config.url+'/auth/v1/token',{headers:{Authorization:'Bearer '+token,apikey:config.anon},body:JSON.stringify({email:'private@staging.invalid',password:secret})}),e=>e.message==='STAGING_CONNECTION_FAILED'&&e.cause.cause===cause);
 const log=logs.join('');assert.match(log,/ENOTFOUND/);assert.match(log,/getaddrinfo/);
 for(const value of [secret,token,config.anon,'mock-cloud.invalid'])assert.ok(!log.includes(value),value);
 assert.match(networkHint(safeError(Object.assign(Error('certificate failed'),{code:'SELF_SIGNED_CERT_IN_CHAIN'}))),/Do not disable TLS/);
});
test('Transport enforces a 45-second default and preserves caller cancellation',async()=>{
 assert.equal(STAGING_TIMEOUT_MS,45000);
 const controller=new AbortController();controller.abort();
 const transport=createSupabaseTransport(config,{logger:()=>{},fetcher:async(input,options)=>{
  assert.equal(options.redirect,'error');assert.equal(options.signal.aborted,true);throw options.signal.reason;
 }});
 await assert.rejects(transport(config.url+'/auth/v1/user',{signal:controller.signal}),/STAGING_CONNECTION_FAILED/);
});
test('Transport deadline aborts slow fetch; origin changes never reach fetch',async()=>{
 let calls=0;
 const transport=createSupabaseTransport(config,{timeoutMs:10,logger:()=>{},fetcher:async(input,{signal})=>{calls++;await setTimeout(30);assert.equal(signal.aborted,true);throw signal.reason;}});
 await assert.rejects(transport(config.url+'/auth/v1/user'),e=>e.cause.name==='TimeoutError');
 await assert.rejects(transport('https://other.invalid/auth/v1/user'),/STAGING_REMOTE_ORIGIN_DENIED/);assert.equal(calls,1);
});
test('Standalone SDK auth signs in and validates user without exposing session by default',async()=>{
 const logs=[],paths=[];
 await testRealAuth(env,{fetcher:async(input,options)=>{paths.push(new URL(input).pathname);return mockAuthFetch(input,options);},logger:x=>logs.push(x)});
 assert.deepEqual(paths,['/auth/v1/settings','/auth/v1/token','/auth/v1/user']);
 assert.match(logs.join(''),/DIRECT_AUTH_PASS/);assert.ok(!logs.join('').includes(dummyToken));assert.ok(!logs.join('').includes('DUMMY_REFRESH'));
});
test('Standalone SDK auth reports exact Auth rejection without attempting getUser',async()=>{
 const paths=[];
 await assert.rejects(testRealAuth(env,{logger:()=>{},fetcher:async(input)=>{
  const path=new URL(input).pathname;paths.push(path);
  if(path.endsWith('/token'))return Response.json({error_code:'invalid_credentials',message:'Invalid login credentials'},{status:400});
  return mockAuthFetch(input);
 }}),e=>e.code==='invalid_credentials'&&e.status===400);
 assert.ok(!paths.includes('/auth/v1/user'));
});
test('Standalone E2E auth starts actual loopback server and verifies scoped identity',async()=>{
 const logs=[];assert.deepEqual(await testE2eAuth(env,{fetcher:mockAuthFetch,logger:x=>logs.push(x)}),{loginStatus:200,meStatus:200,role:'customer'});
 assert.match(logs.join(''),/E2E_AUTH_PASS/);assert.ok(!logs.join('').includes(dummyToken));
});
test('Standalone E2E auth rejects database allowlist failure and closes server',async()=>{
 await assert.rejects(testE2eAuth(env,{logger:()=>{},fetcher:async(input)=>{
  if(new URL(input).pathname.endsWith('/translation_session_context'))return Response.json({code:'P0001',message:'UNAVAILABLE'},{status:403});
  return mockAuthFetch(input);
 }}),e=>e.status===400&&e.message==='E2E_LOGIN_FAILED: UNAVAILABLE');
});
test('E2E login transport failure returns 503 rather than claiming invalid credentials',async()=>{
 await assert.rejects(testE2eAuth(env,{logger:()=>{},fetcher:async(input)=>{
  if(new URL(input).pathname.endsWith('/token'))throw Object.assign(Error('synthetic connection reset'),{code:'ECONNRESET'});
  return mockAuthFetch(input);
 }}),e=>e.status===503&&e.message==='E2E_LOGIN_FAILED: STAGING_CONNECTION_FAILED');
});
