import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {request as httpRequest} from 'node:http';
import vm from 'node:vm';
import {createProductionSupabase} from '../server/production/supabase.mjs';
import {resetInput} from '../server/production/password-reset.mjs';
import {startProductionServer} from '../server/production/http.mjs';
import {publicPages,browserAssets} from '../server/production/site.mjs';
import {supplyCopy} from '../supply-copy.mjs';

const actor='10000000-0000-4000-8000-000000000001',session='20000000-0000-4000-8000-000000000002';
const jwt=(extra={})=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
 Buffer.from(JSON.stringify({sub:actor,session_id:session,exp:Math.floor(Date.now()/1000)+3600,...extra})).toString('base64url'),
 Buffer.from('SYNTHETIC_SIGNATURE').toString('base64url')].join('.');
const token=jwt(),refresh='SYNTHETIC_REFRESH_TOKEN_ONLY',password='SYNTHETIC_PASSWORD_12_PLUS';
function fixture({recoverFails=false}={}){
 const calls=[];let active=true;
 const user={id:actor,email:'vendor@fixture.invalid',email_confirmed_at:'2026-01-01',is_anonymous:false};
 const env={SUPABASE_URL:'https://auth.fixture.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_ANON',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE'};
 const fetcher=async(input,options={})=>{
  const url=new URL(input instanceof Request?input.url:input),method=options.method||'GET';
  const body=options.body?JSON.parse(options.body):{};
  calls.push({path:url.pathname,method,redirect:url.searchParams.get('redirect_to'),
   hasPkceChallenge:body.code_challenge!=null,passwordMatches:body.password===password,scope:url.searchParams.get('scope')});
  if(url.pathname==='/auth/v1/recover')return Response.json(recoverFails?{message:'SYNTHETIC_UNKNOWN_ACCOUNT'}:{},{status:recoverFails?400:200});
  // Model a JWT still accepted until expiry while refresh is already revoked.
  if(url.pathname==='/auth/v1/user')return Response.json(method==='GET'||active?user:{message:'SYNTHETIC_SESSION_REVOKED'},{status:method==='GET'||active?200:401});
  if(url.pathname==='/auth/v1/token')return active?Response.json({access_token:jwt({iat:Math.floor(Date.now()/1000)}),refresh_token:'SYNTHETIC_ROTATED_REFRESH',token_type:'bearer',expires_in:3600,user})
   :Response.json({message:'SYNTHETIC_REFRESH_REVOKED',code:'refresh_token_not_found'},{status:400});
  if(url.pathname==='/auth/v1/logout'){active=false;return new Response(null,{status:204});}
  throw Error('SYNTHETIC_UNEXPECTED_AUTH_CALL');
 };
 return {calls,env,fetcher,auth:createProductionSupabase(env,{fetcher})};
}
function browser({hash='#'+new URLSearchParams({access_token:token,refresh_token:refresh,type:'recovery'}),search='',ok=true,eraseFails=false}={}){
 const calls=[],logs=[],storage=[],status={textContent:''},button={disabled:false};
 const form={hidden:true,password:{value:password},confirmation:{value:password},querySelector:s=>{assert.equal(s,'button');return button;}};
 const location={hash,search,pathname:'/reset-password.html'};
 const context={URLSearchParams,atob,location,window:{},history:{replaceState:(state,title,path)=>{if(eraseFails)throw Error('SYNTHETIC_HISTORY_FAILURE');location.hash='';location.search=path.includes('?')?'?'+path.split('?')[1]:'';}},
  document:{getElementById:id=>id==='password-reset'?form:status,addEventListener(){}},
  fetch:async(path,options)=>{calls.push({path,options});return {ok,json:async()=>({reset:ok})};},
  console:{log:v=>logs.push(v),error:v=>logs.push(v),warn:v=>logs.push(v)},
  localStorage:{setItem:()=>storage.push('local')},sessionStorage:{setItem:()=>storage.push('session')}};
 vm.runInNewContext(readFileSync('reset-password.mjs','utf8'),context,{timeout:1000});
 return {form,status,button,calls,logs,storage,location,submit:()=>form.onsubmit({preventDefault(){}})};
}
async function server(t,origin='https://app.fixture.invalid'){
 const calls=[];
 const auth={db:{stop(){}},checkReady:async()=>{},authenticate:async()=>{throw Object.assign(Error('AUTH_REQUIRED'),{status:401});},
  requestPasswordReset:async(email,resetOrigin)=>{calls.push(['request',email,resetOrigin]);if(email.startsWith('unknown'))throw Error('SYNTHETIC_UNKNOWN');},
  completePasswordReset:async()=>{calls.push(['complete']);return {reset:true};}};
 const origins=origin==='https://www.marocora.com'?origin+',https://marocora.com':origin;
 const app=await startProductionServer({env:{NODE_ENV:'production',APP_ORIGINS:origins,HOST:'127.0.0.1',PORT:'0',LEARNING_VIDEO_ENABLED:'false'},
  auth,storage:{kind:'spaces'},scanner:{mockOnly:false,available:false},learning:{close:async()=>{}},log:()=>{}});
 t.after(()=>app.close());
 const request=(path,body)=>new Promise((resolve,reject)=>{
  const req=httpRequest({hostname:'127.0.0.1',port:app.server.address().port,path,method:body===undefined?'GET':'POST',
   headers:{Host:new URL(origin).host,Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'})}},res=>{
   const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(chunks).toString()}));});
  req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
 });
 return {calls,request};
}

test('password reset page/module are explicitly public and unlisted files remain denied',async t=>{
 assert.ok(publicPages.has('reset-password.html'));assert.ok(browserAssets.has('reset-password.mjs'));
 const f=await server(t),page=await f.request('/reset-password.html'),module=await f.request('/reset-password.mjs');
 assert.equal(page.status,200);assert.match(page.headers['content-type'],/text\/html/);assert.match(page.text,/id="password-reset"/);
 assert.equal(module.status,200);assert.equal((await f.request('/unlisted-password-reset.html')).status,404);
});
test('request-reset HTTP responses do not disclose known versus unknown valid accounts',async t=>{
 const f=await server(t),known=await f.request('/api/auth/request-reset',{email:'known@fixture.invalid'}),unknown=await f.request('/api/auth/request-reset',{email:'unknown@fixture.invalid'});
 assert.equal(known.status,202);assert.equal(unknown.status,202);assert.equal(known.text,unknown.text);
 assert.equal(known.headers['set-cookie'],undefined);assert.equal(unknown.headers['set-cookie'],undefined);
 assert.equal((await f.request('/api/auth/request-reset',{email:'bad'})).status,400);assert.equal(f.calls.length,2);
});
test('request-reset uses documented implicit recovery redirect without PKCE challenge',async()=>{
 const f=fixture(),bad=fixture({recoverFails:true});
 assert.deepEqual(await f.auth.requestPasswordReset('known@fixture.invalid','https://marocora.com'),{accepted:true});
 assert.deepEqual(await bad.auth.requestPasswordReset('unknown@fixture.invalid','https://marocora.com'),{accepted:true});
 assert.equal(f.calls[0].redirect,'https://marocora.com/reset-password.html');
 assert.equal(f.calls[0].hasPkceChallenge,false);
});
test('www recovery uses the already approved canonical redirect origin without config changes',async t=>{
 const f=await server(t,'https://www.marocora.com');
 assert.equal((await f.request('/api/auth/request-reset',{email:'vendor@fixture.invalid'})).status,202);
 assert.equal(f.calls[0][2],'https://marocora.com');
});
test('complete-reset rejects missing malformed expired tokens and short passwords before auth calls',async t=>{
 const f=await server(t);
 for(const fields of [{refreshToken:refresh,password},{accessToken:'bad',refreshToken:refresh,password},
  {accessToken:Buffer.from('not JSON').toString('base64url')+'.'+token.split('.').slice(1).join('.'),refreshToken:refresh,password},
  {accessToken:token,refreshToken:'bad',password},{accessToken:jwt({exp:1}),refreshToken:refresh,password},
  {accessToken:token,refreshToken:refresh,password:'short'},{accessToken:token,refreshToken:refresh,password,confirmation:password}]){
  assert.equal((await f.request('/api/auth/complete-reset',fields)).status,400);
 }
 assert.equal(f.calls.length,0);
});
test('successful complete-reset HTTP response never creates the application cookie',async t=>{
 const f=await server(t),result=await f.request('/api/auth/complete-reset',{accessToken:token,refreshToken:refresh,password});
 assert.equal(result.status,200);assert.equal(result.text,'{"reset":true}');assert.equal(result.headers['set-cookie'],undefined);
});
test('reset adapter validates refresh session updates password and revokes only recovery session',async()=>{
 const f=fixture();assert.deepEqual(await f.auth.completePasswordReset(token,refresh,password),{reset:true});
 assert.ok(f.calls.some(c=>c.path==='/auth/v1/token'));assert.ok(f.calls.some(c=>c.path==='/auth/v1/user'&&c.method==='PUT'&&c.passwordMatches));
 assert.ok(f.calls.some(c=>c.path==='/auth/v1/logout'&&c.scope==='local'));
 const before=f.calls.length;await assert.rejects(f.auth.completePasswordReset(token,refresh,password),/RESET_LINK_EXPIRED/);assert.equal(f.calls.length,before);
 // A separate adapter has no replay cache, but Auth rejects the revoked session.
 const next=createProductionSupabase(f.env,{fetcher:f.fetcher});await assert.rejects(next.completePasswordReset(token,refresh,password),/RESET_LINK_EXPIRED/);
 assert.equal(f.calls.filter(c=>c.path==='/auth/v1/user'&&c.method==='PUT').length,1);
});
test('password bounds include exactly 12 and 128 characters and exclude 129',()=>{
 assert.doesNotThrow(()=>resetInput(token,refresh,'a'.repeat(12)));assert.doesNotThrow(()=>resetInput(token,refresh,'a'.repeat(128)));
 assert.throws(()=>resetInput(token,refresh,'a'.repeat(129)),/RESET_PASSWORD_INVALID/);
});
test('reset transport errors do not print recovery credentials',async()=>{
 const f=fixture(),messages=[],original=console.error;
 console.error=(...args)=>messages.push(args.map(String).join(' '));
 try{
  const auth=createProductionSupabase(f.env,{fetcher:async()=>{throw Error('SYNTHETIC_ERROR '+token+' '+refresh);}});
  await assert.rejects(auth.completePasswordReset(token,refresh,password),/RESET_LINK_EXPIRED/);
  assert.equal(messages.join(' ').includes(token),false);assert.equal(messages.join(' ').includes(refresh),false);
 }finally{console.error=original;}
});
test('browser erases recovery URL and retains no token in DOM storage or console',async()=>{
 const b=browser();assert.equal(b.location.hash,'');assert.equal(b.form.hidden,false);await b.submit();
 assert.equal(b.calls.length,1);assert.equal(b.calls[0].options.credentials,'omit');assert.equal(b.form.hidden,true);
 assert.equal(JSON.stringify(b.form).includes(token),false);assert.equal(JSON.stringify(b.form).includes(refresh),false);
 assert.deepEqual(b.logs,[]);assert.deepEqual(b.storage,[]);assert.match(b.status.textContent,/Password changed/);
 await b.submit();assert.equal(b.calls.length,1);
});
test('mismatched password pair and short password never call server or auth',async()=>{
 const b=browser();b.form.confirmation.value='DIFFERENT_SYNTHETIC_PASSWORD';await b.submit();assert.equal(b.calls.length,0);
 assert.match(b.status.textContent,/do not match/);b.form.password.value='short';b.form.confirmation.value='short';await b.submit();assert.equal(b.calls.length,0);
});
test('forgot-password requests use the email only and never submit the login password',async()=>{
 const calls=[],forgot={disabled:false},status={textContent:''};
 const form={email:{value:'vendor@fixture.invalid'},password:{value:'SYNTHETIC_PASSWORD_NOT_SENT'},querySelector:()=>({disabled:false})};
 vm.runInNewContext(readFileSync('production-login.mjs','utf8'),{
  document:{getElementById:id=>({'production-login':form,'login-status':status,'forgot-password':forgot})[id]},window:{},
  fetch:async(path,options)=>{calls.push({path,options});return {ok:true,json:async()=>({accepted:true})};}
 },{timeout:1000});
 await forgot.onclick();assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/auth/request-reset');
 assert.deepEqual(JSON.parse(calls[0].options.body),{email:'vendor@fixture.invalid'});assert.equal(calls[0].options.credentials,'omit');
 form.email.value='bad';await forgot.onclick();assert.equal(calls.length,1);
});
test('missing malformed expired and PKCE links render an expired notice without calls',()=>{
 for(const options of [{hash:''},{hash:'#access_token=bad&refresh_token=bad&type=recovery'},
  {hash:'#'+new URLSearchParams({access_token:jwt({exp:1}),refresh_token:refresh,type:'recovery'})},{search:'?code=SYNTHETIC_PKCE_CODE'},
  {hash:'#error=access_denied&error_code=otp_expired'}]){
  const b=browser(options);assert.equal(b.form.hidden,true);assert.match(b.status.textContent,/expired/);assert.equal(b.calls.length,0);
 }
});
test('URL erasure failure and rejected completion fail closed with an expired notice',async()=>{
 const failed=browser({eraseFails:true});assert.equal(failed.form.hidden,true);assert.match(failed.status.textContent,/expired/);
 const b=browser({ok:false});await b.submit();assert.equal(b.form.hidden,true);assert.match(b.status.textContent,/expired/);
 await b.submit();assert.equal(b.calls.length,1);
});
test('reset page has no site navigation and its interface uses four-language copy',()=>{
 const html=readFileSync('reset-password.html','utf8');assert.match(html,/<body data-password-reset/);assert.doesNotMatch(html,/<(?:nav|header)\b/);
 assert.match(readFileSync('site-language.mjs','utf8'),/hasAttribute\('data-password-reset'\)/);
 const keys=['Reset your password | Marocora','Reset your password','New password','Confirm new password','Use 12–128 characters.','Save new password',
  'Return to sign in','This link has expired. Request a new one.','Enter your new password.','The passwords do not match.',
  'Password changed. Sign in with your new password.','Forgot your password?',
  'If an account uses this address, a reset link will be sent. Check your inbox and spam folder.'];
 for(const key of keys)for(const lang of ['en','fr','ar','es'])assert.ok(supplyCopy[key]?.[lang]?.trim(),key+' '+lang);
});
