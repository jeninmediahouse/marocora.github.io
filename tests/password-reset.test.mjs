import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {request as httpRequest} from 'node:http';
import vm from 'node:vm';
import {createProductionSupabase} from '../server/production/supabase.mjs';
import {resetCodeInput,createResetAttemptLimiter} from '../server/production/password-reset.mjs';
import {startProductionServer} from '../server/production/http.mjs';
import {publicPages,browserAssets} from '../server/production/site.mjs';
import {supplyCopy} from '../supply-copy.mjs';
const actor='10000000-0000-4000-8000-000000000001';
const email='vendor@fixture.invalid',code='123456',password='SYNTHETIC_PASSWORD_12_PLUS';
const token=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:actor,session_id:'20000000-0000-4000-8000-000000000002',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),Buffer.from('SYNTHETIC_SIGNATURE').toString('base64url')].join('.');
function fixture({verifyError,updateError,logoutError,recoverFails=false}={}){
 const calls=[];let consumed=false;
 const user={id:actor,email,email_confirmed_at:'2026-01-01',is_anonymous:false};
 const env={SUPABASE_URL:'https://auth.fixture.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_ANON',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE'};
 const fetcher=async(input,options={})=>{
  const url=new URL(input instanceof Request?input.url:input),method=options.method||'GET',body=options.body?JSON.parse(options.body):{};
  calls.push({path:url.pathname,method,bodyKeys:Object.keys(body).sort(),code_challenge:body.code_challenge,code_challenge_method:body.code_challenge_method,type:body.type,emailMatches:body.email===email,codeMatches:body.token===code,passwordMatches:body.password===password,scope:url.searchParams.get('scope'),redirect:url.searchParams.get('redirect_to')});
  const error=value=>Response.json({code:value.status,error_code:value.code,msg:'SYNTHETIC_PRIVATE_PROVIDER_MESSAGE'}, {status:value.status});
  if(url.pathname==='/auth/v1/recover')return recoverFails?error({code:'validation_failed',status:400}):Response.json({});
  if(url.pathname==='/auth/v1/verify'){
   if(verifyError)return error(verifyError);
   if(consumed)return error({code:'otp_expired',status:403});
   consumed=true;return Response.json({access_token:token,refresh_token:'SYNTHETIC_REFRESH_TOKEN',token_type:'bearer',expires_in:3600,user});
  }
  if(url.pathname==='/auth/v1/user'){if(method==='PUT'&&updateError)return error(updateError);return Response.json(user);}
  if(url.pathname==='/auth/v1/logout')return logoutError?error(logoutError):new Response(null,{status:204});
  throw Error('SYNTHETIC_UNEXPECTED_AUTH_CALL');
 };
 return {calls,env,fetcher,auth:createProductionSupabase(env,{fetcher})};
}
function browser({fetcher,hash='',search=''}={}){
 const calls=[],logs=[],storage=[],attributes=[];const buttons=[{disabled:false},{disabled:false,hidden:false}];
 const form={hidden:false,email:{value:email},code:{value:code},password:{value:password},confirmation:{value:password},querySelectorAll:()=>buttons,setAttribute:(...args)=>attributes.push(args)};
 const status={textContent:''},location={hash,search,pathname:'/reset-password.html'};
 vm.runInNewContext(readFileSync('reset-password.mjs','utf8'),{window:{},location,history:{replaceState(){throw Error('SYNTHETIC_URL_MUST_NOT_BE_CHANGED');}},document:{getElementById:id=>({'password-reset':form,'reset-status':status,'send-new-code':buttons[1]})[id],addEventListener(){}},fetch:async(path,options)=>{calls.push({path,options});return fetcher?fetcher(path,options):{ok:true,json:async()=>({reset:true})};},console:{log:(...v)=>logs.push(v),warn:(...v)=>logs.push(v),error:(...v)=>logs.push(v)},localStorage:{setItem:()=>storage.push('local')},sessionStorage:{setItem:()=>storage.push('session')}},{timeout:1000});
 return {form,status,calls,logs,storage,attributes,location,buttons,submit:()=>form.onsubmit({preventDefault(){}}),resend:()=>buttons[1].onclick()};
}
async function server(t,{origin='https://app.fixture.invalid',clock=Date.now,complete}={}){
 const calls=[];
 const app=await startProductionServer({env:{NODE_ENV:'production',APP_ORIGINS:origin==='https://www.marocora.com'?origin+',https://marocora.com':origin,HOST:'127.0.0.1',PORT:'0',LEARNING_VIDEO_ENABLED:'false'},clock,auth:{db:{stop(){}},checkReady:async()=>{},authenticate:async()=>{throw Object.assign(Error('AUTH_REQUIRED'),{status:401});},requestPasswordReset:async(e,o)=>{calls.push({kind:'request',email:e,origin:o});if(e.startsWith('unknown'))throw Error('SYNTHETIC_UNKNOWN');},completePasswordResetCode:async(...args)=>{calls.push({kind:'complete'});return complete?complete(...args):{reset:true};}},storage:{kind:'spaces'},scanner:{mockOnly:false,available:false},learning:{close:async()=>{}},log:()=>{}});
 t.after(()=>app.close());
 const request=(path,body)=>new Promise((resolve,reject)=>{const req=httpRequest({hostname:'127.0.0.1',port:app.server.address().port,path,method:body===undefined?'GET':'POST',headers:{Host:new URL(origin).host,Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'})}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(chunks).toString()}));});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));});
 return {calls,request};
}
const payload={email,code,password},endpoint='/api/auth/complete-reset-code';

test('code reset page/module are allowlisted public and unlisted files remain404',async t=>{
 assert.ok(publicPages.has('reset-password.html'));assert.ok(browserAssets.has('reset-password.mjs'));
 const f=await server(t);assert.equal((await f.request('/reset-password.html')).status,200);assert.equal((await f.request('/reset-password.mjs')).status,200);assert.equal((await f.request('/unlisted-password-reset.html')).status,404);
});
test('request-reset answers identically for known unknown and provider rejection without account disclosure',async t=>{
 const f=await server(t),known=await f.request('/api/auth/request-reset',{email}),unknown=await f.request('/api/auth/request-reset',{email:'unknown@fixture.invalid'});
 assert.equal(known.status,202);assert.equal(unknown.status,202);assert.equal(known.text,unknown.text);assert.equal(known.headers['set-cookie'],undefined);assert.equal(unknown.headers['set-cookie'],undefined);
});
test('code request uses the existing recovery API without a redirect or PKCE link dependency',async()=>{
 for(const recoverFails of [false,true]){const f=fixture({recoverFails});assert.deepEqual(await f.auth.requestPasswordReset(email,'https://marocora.com'),{accepted:true});assert.equal(f.calls[0].path,'/auth/v1/recover');assert.equal(f.calls[0].redirect,null);assert.equal(f.calls[0].code_challenge,null);assert.equal(f.calls[0].code_challenge_method,null);}
});
test('www request preserves approved canonical origin without auth configuration changes',async t=>{
 const f=await server(t,{origin:'https://www.marocora.com'});assert.equal((await f.request('/api/auth/request-reset',{email})).status,202);assert.equal(f.calls[0].origin,'https://marocora.com');
});
test('malformed codes short passwords invalid email and extra keys fail before any auth call',async t=>{
 const f=await server(t);
 for(const [body,error] of [[{...payload,code:'12345'},'RESET_CODE_MALFORMED'],[{...payload,code:123456},'RESET_CODE_MALFORMED'],[{...payload,password:'short'},'RESET_PASSWORD_INVALID'],[{...payload,email:'bad'},'RESET_EMAIL_INVALID'],[{...payload,confirmation:password},'RESET_CODE_MALFORMED']]){const r=await f.request(endpoint,body);assert.equal(r.status,400);assert.equal(JSON.parse(r.text).error,error);}
 assert.equal(f.calls.length,0);
});
test('successful code reset HTTP response creates no app cookie and legacy fragment completion is superseded',async t=>{
 const f=await server(t),r=await f.request(endpoint,payload);assert.equal(r.status,200);assert.equal(r.text,'{"reset":true}');assert.equal(r.headers['set-cookie'],undefined);assert.equal((await f.request('/api/auth/complete-reset',{accessToken:token})).status,410);
});
test('adapter verifies recovery code updates password and signs out local once without returning tokens',async()=>{
 const f=fixture();assert.deepEqual(await f.auth.completePasswordResetCode(email,code,password),{reset:true});
 const verify=f.calls.find(c=>c.path==='/auth/v1/verify');assert.equal(verify.type,'recovery');assert.equal(verify.emailMatches,true);assert.equal(verify.codeMatches,true);
 assert.ok(f.calls.findIndex(c=>c.path==='/auth/v1/user'&&c.method==='PUT')>f.calls.indexOf(verify));assert.ok(f.calls.some(c=>c.passwordMatches));assert.equal(f.calls.filter(c=>c.path==='/auth/v1/logout').length,1);assert.equal(f.calls.at(-1).scope,'local');
 await assert.rejects(f.auth.completePasswordResetCode(email,code,password),/RESET_CODE_INVALID_OR_EXPIRED/);assert.equal(f.calls.filter(c=>c.method==='PUT').length,1);
});
test('password bounds include12and128 and reject129 while six-digit code shape is exact',()=>{
 for(const length of [12,128])assert.equal(resetCodeInput(email,code,'a'.repeat(length)),email);
 for(const length of [0,11,129])assert.throws(()=>resetCodeInput(email,code,'a'.repeat(length)),/RESET_PASSWORD_INVALID/);
 for(const value of ['12345','1234567','123 45','abcdef','１２３４５６',null])assert.throws(()=>resetCodeInput(email,value,password),/RESET_CODE_MALFORMED/);
});
test('wrong expired reused and unknown-account OTP rejections share the truthful ambiguous reason',async()=>{
 for(const kind of ['wrong','expired','reused','unknown']){const f=fixture({verifyError:{code:'otp_expired',status:403}});await assert.rejects(f.auth.completePasswordResetCode(kind==='unknown'?'unknown@fixture.invalid':email,code,password),/RESET_CODE_INVALID_OR_EXPIRED/);assert.equal(f.calls.some(c=>c.method==='PUT'),false);}
});
test('provider throttling and upstream service failure have their own safe reasons',async()=>{
 for(const [status,code,error] of [[429,'over_request_rate_limit','RESET_TOO_MANY_ATTEMPTS'],[503,'unexpected_failure','RESET_SERVICE_UNAVAILABLE']]){const f=fixture({verifyError:{status,code}});await assert.rejects(f.auth.completePasswordResetCode(email,'123456',password),new RegExp(error));}
});
test('password policy refusal and completion uncertainty never pretend the code expired',async()=>{
 for(const options of [{updateError:{code:'weak_password',status:422}},{updateError:{code:'same_password',status:422}},{logoutError:{code:'unexpected_failure',status:503}}]){const f=fixture(options);await assert.rejects(f.auth.completePasswordResetCode(email,code,password),options.updateError?/RESET_PASSWORD_REJECTED/:/RESET_COMPLETION_UNCERTAIN/);assert.ok(f.calls.filter(c=>c.path==='/auth/v1/logout').length<=2);}
});
test('transport failures never log email code password token or provider response',async()=>{
 const f=fixture(),logs=[],original={error:console.error,warn:console.warn,log:console.log};for(const k of Object.keys(original))console[k]=(...v)=>logs.push(v.map(String).join(' '));
 try{const auth=createProductionSupabase(f.env,{fetcher:async()=>{throw Error([email,code,password,token].join(' '));}});await assert.rejects(auth.completePasswordResetCode(email,code,password),/RESET_SERVICE_UNAVAILABLE/);for(const secret of [email,code,password,token])assert.equal(logs.join(' ').includes(secret),false);}finally{Object.assign(console,original);}
});
test('empty URL renders neutral code form and allows requesting a code without a prior failure',async()=>{
 const b=browser({fetcher:async()=>({ok:true,json:async()=>({accepted:true})})});assert.equal(b.form.hidden,false);assert.equal(b.status.textContent,'Enter the code from your email.');assert.equal(b.calls.length,0);assert.equal(b.location.hash,'');assert.equal(b.location.search,'');assert.doesNotMatch(b.status.textContent,/expired/);assert.equal(b.buttons[1].hidden,false);
 await b.resend();assert.equal(b.calls.length,1);assert.equal(b.calls[0].path,'/api/auth/request-reset');assert.deepEqual(JSON.parse(b.calls[0].options.body),{email});assert.match(b.status.textContent,/If an account uses this address/);
 const old=browser({hash:'#access_token=SYNTHETIC_TOKEN',search:'?code=SYNTHETIC'});assert.equal(old.location.hash,'#access_token=SYNTHETIC_TOKEN');assert.equal(old.calls.length,0);
});
test('malformed code short password and mismatched confirmation each fail client-side before fetch',async()=>{
 const b=browser();b.form.code.value='123';await b.submit();assert.equal(b.status.textContent,'Enter the 6-digit code.');b.form.code.value=code;b.form.password.value='short';await b.submit();assert.equal(b.status.textContent,'Password must be 12 to 128 characters.');b.form.password.value=password;b.form.confirmation.value='DIFFERENT_SYNTHETIC';await b.submit();assert.equal(b.status.textContent,'The passwords do not match.');assert.equal(b.calls.length,0);
});
test('successful browser reset clears secrets and never places them in attributes logs storage or URLs',async()=>{
 const b=browser();await b.submit();assert.equal(b.form.hidden,true);assert.equal(b.status.textContent,'Password changed. Sign in with your new password.');assert.deepEqual(JSON.parse(b.calls[0].options.body),payload);assert.equal(b.calls[0].options.credentials,'omit');assert.equal(b.calls[0].options.cache,'no-store');assert.equal(b.form.email.value,'');
 for(const secret of [email,code,password,token])assert.equal(JSON.stringify([b.attributes,b.logs,b.storage,b.location]).includes(secret),false);assert.equal(b.form.code.value,'');assert.equal(b.form.password.value,'');assert.equal(b.form.confirmation.value,'');await b.submit();assert.equal(b.calls.length,1);
});
test('browser shows exact ambiguous throttle and service messages without blanket expired handling',async()=>{
 for(const [error,status,text] of [['RESET_CODE_INVALID_OR_EXPIRED',400,'The code is incorrect or has expired. Request a new code.'],['RESET_TOO_MANY_ATTEMPTS',429,'Too many attempts. Try again later.'],['RESET_SERVICE_UNAVAILABLE',503,'Service temporarily unavailable. Please try again later.']]){const b=browser({fetcher:async()=>({ok:false,status,json:async()=>({error})})});await b.submit();assert.equal(b.status.textContent,text);assert.equal(b.buttons[1].hidden,false);assert.equal(b.form.hidden,false);}
});
test('verifying shows loading locks duplicate submissions and clears busy after completion',async()=>{
 let resolve;const b=browser({fetcher:()=>new Promise(r=>resolve=r)}),pending=b.submit();assert.equal(b.status.textContent,'Verifying your code…');assert.ok(b.buttons.every(x=>x.disabled));await b.submit();await b.resend();assert.equal(b.calls.length,1);resolve({ok:true,json:async()=>({reset:true})});await pending;assert.ok(b.buttons.every(x=>!x.disabled));assert.deepEqual(b.attributes.at(-1),['aria-busy','false']);
});
test('send new code uses only email existing endpoint generic response and no verification-limit reset',async()=>{
 let request=0;const b=browser({fetcher:async()=>++request===1?{ok:false,status:400,json:async()=>({error:'RESET_CODE_INVALID_OR_EXPIRED'})}:{ok:true,status:202,json:async()=>({accepted:true})}});await b.submit();await b.resend();assert.equal(b.calls[1].path,'/api/auth/request-reset');assert.deepEqual(JSON.parse(b.calls[1].options.body),{email});assert.match(b.status.textContent,/If an account uses this address/);assert.equal(b.form.code.value,'');
});
test('per-email limit is case-insensitive across IPs and clears after fixed window',()=>{
 let now=1000;const limiter=createResetAttemptLimiter({clock:()=>now});for(let n=0;n<5;n++)limiter.consume({email:n%2?email.toUpperCase():email,ip:'synthetic-'+n});assert.throws(()=>limiter.consume({email,ip:'another'}),/RESET_TOO_MANY_ATTEMPTS/);now=900001;assert.doesNotThrow(()=>limiter.consume({email,ip:'another'}));
});
test('per-IP limits and full-map limits fail closed without evicting active counters',()=>{
 let now=1000;const limiter=createResetAttemptLimiter({clock:()=>now});for(let n=0;n<20;n++)limiter.consume({email:'vendor'+n+'@fixture.invalid',ip:'synthetic-shared'});assert.throws(()=>limiter.consume({email:'next@fixture.invalid',ip:'synthetic-shared'}),/RESET_TOO_MANY_ATTEMPTS/);
 const bounded=createResetAttemptLimiter({clock:()=>now,maxEntries:2});bounded.consume({email,ip:'one'});assert.throws(()=>bounded.consume({email:'other@fixture.invalid',ip:'two'}),/RESET_TOO_MANY_ATTEMPTS/);now=900001;assert.doesNotThrow(()=>bounded.consume({email:'other@fixture.invalid',ip:'two'}));
});
test('HTTP verification limiter engages before auth call and clears after fixed window',async t=>{
 let now=1000;const f=await server(t,{clock:()=>now});for(let n=0;n<5;n++)assert.equal((await f.request(endpoint,payload)).status,200);assert.equal((await f.request(endpoint,payload)).status,429);assert.equal(f.calls.length,5);now=900001;assert.equal((await f.request(endpoint,payload)).status,200);assert.equal(f.calls.length,6);
});
test('request and resend share bounded limits but requesting never clears verification attempts',async t=>{
 const f=await server(t);for(let n=0;n<5;n++)await f.request(endpoint,payload);assert.equal((await f.request('/api/auth/request-reset',{email})).status,202);assert.equal((await f.request(endpoint,payload)).status,429);for(let n=0;n<2;n++)assert.equal((await f.request('/api/auth/request-reset',{email})).status,202);assert.equal((await f.request('/api/auth/request-reset',{email})).status,429);
});
test('login forgot-password requests never include password or email in navigation',async()=>{
 const calls=[],redirects=[],forgot={disabled:false},status={textContent:''},form={email:{value:email},password:{value:password},querySelector:()=>({disabled:false})};
 vm.runInNewContext(readFileSync('production-login.mjs','utf8'),{document:{getElementById:id=>({'production-login':form,'forgot-password':forgot,'login-status':status})[id]},window:{},location:{assign:path=>redirects.push(path)},fetch:async(path,options)=>{calls.push({path,options});return {ok:true,json:async()=>({accepted:true})};}},{timeout:1000});await forgot.onclick();assert.deepEqual(JSON.parse(calls[0].options.body),{email});assert.deepEqual(redirects,['/reset-password.html']);assert.equal(calls[0].options.body.includes(password),false);
});
test('neutral code form all safe reasons and resend copy have four languages with no fragment handler',()=>{
 const html=readFileSync('reset-password.html','utf8'),js=readFileSync('reset-password.mjs','utf8');assert.match(html,/name="email"/);assert.match(html,/name="code"/);assert.doesNotMatch(html,/<form[^>]*\bhidden\b/);assert.doesNotMatch(html,/This link has expired/);assert.doesNotMatch(html,/<(?:header|nav)\b/);assert.doesNotMatch(js,/location\.|history\.|localStorage|sessionStorage|console\./);
 for(const key of ['Recovery code','Enter the code from your email.','Enter the 6-digit code.','The code is incorrect or has expired. Request a new code.','Too many attempts. Try again later.','Password must be 12 to 128 characters.','The passwords do not match.','Service temporarily unavailable. Please try again later.','Verifying your code…','Send a new code','Sending a new code…','If an account uses this address, a new code will be sent. Check your inbox and spam folder.','Choose a different password that meets the security requirements.','The password may have changed, but confirmation failed. Try signing in or request a new code.'])for(const lang of ['en','fr','ar','es'])assert.ok(supplyCopy[key][lang]);
});
