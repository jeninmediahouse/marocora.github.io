import {supplyRoutes} from '../supply/http.mjs';
import {resetEmail,resetCodeInput,createResetAttemptLimiter} from './password-reset.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {productionConfig} from './config.mjs';
import {createProductionSupabase} from './supabase.mjs';
import {createProductionLearning} from './learning.mjs';
import {createTurnstileVerifier} from './turnstile.mjs';
import {createSpacesStore} from '../storage/spaces.mjs';
import {cloudmersiveScanner} from '../block1/uploads.mjs';
import {instantRoutes} from '../block1/instant-http.mjs';
import {publicPages,privatePages,adminPages,browserAssets,productionAliases,websitePath,loginLocation} from './site.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),cookieName='__Host-marocora_session';
const fail=(code,status=400)=>{throw Object.assign(Error(code),{status});};
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.xml':'application/xml','.txt':'text/plain'};
export async function startProductionServer({env=process.env,auth,storage,scanner,learning,exchangeService,turnstile,handleSignals=true,log=console.log,clock=Date.now}={}){
 const config=productionConfig(env);
 const publicService=env.SUPABASE_URL?new URL(env.SUPABASE_URL).origin:'';
 const policy=(live,hashes=[])=>`default-src 'self'; script-src 'self' https://challenges.cloudflare.com ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ${publicService} https://challenges.cloudflare.com ${live?live+' '+live.replace(/^wss:/,'https:')+' https://*.livekit.cloud wss://*.livekit.cloud':''}; media-src 'self' blob:; worker-src 'self' blob:; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' ${publicService}`;
 auth??=createProductionSupabase(env);await auth.checkReady();storage??=createSpacesStore(env);scanner??=cloudmersiveScanner({env});
 if(storage.kind!=='spaces'||scanner.mockOnly===true)fail('PRODUCTION_ADAPTER_REQUIRED',503);
 learning??=createProductionLearning({auth,env});
 const humanCheck=turnstile===undefined?createTurnstileVerifier(env):turnstile;
 const supply=supplyRoutes({auth,storage,scanner,env});
 const resetAttempts=createResetAttemptLimiter({clock});
 const instant=instantRoutes({db:auth.db,storage,scanner,exchangeService,allowMockPayments:false});
 const origins=new Map(config.origins.map(origin=>[new URL(origin).host,origin])),rates=new Map();let concurrent=0,heavyRequests=0,closing;
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
 const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy',env.LEARNING_VIDEO_ENABLED==='true'?'camera=(self), microphone=(self), display-capture=()':'camera=(), microphone=(), display-capture=()');
  const live=env.LEARNING_VIDEO_ENABLED==='true'?new URL(env.LIVEKIT_URL).origin:null;
  res.setHeader('Content-Security-Policy',policy(live));
  concurrent++;let heavy=false;
  try{
   if(concurrent>128)fail('SERVER_BUSY',503);
   const origin=origins.get(req.headers.host);if(!origin)fail('HOST_DENIED',403);
   const url=new URL(req.url,origin);if(url.origin!==origin)fail('HOST_DENIED',403);
   if(!['GET','HEAD','POST'].includes(req.method))fail('METHOD_DENIED',405);
   if(req.method==='POST'&&req.headers.origin!==origin)fail('ORIGIN_DENIED',403);
   const body=async limit=>{let size=0;const chunks=[];if(Number(req.headers['content-length']||0)>limit)fail('BODY_TOO_LARGE',413);for await(const chunk of req){size+=chunk.length;if(size>limit)fail('BODY_TOO_LARGE',413);chunks.push(chunk);}return Buffer.concat(chunks);};
   const input=async()=>{if(req.headers['content-type']!=='application/json')fail('JSON_REQUIRED',415);try{const value=JSON.parse((await body(20000)).toString('utf8'));if(!value||Array.isArray(value)||typeof value!=='object')fail('INVALID_JSON');return value;}catch(error){if(error.status)throw error;fail('INVALID_JSON');}};
   if(url.pathname==='/health'&&req.method==='GET')return json(res,200,{status:'ok'});
   if(url.pathname.startsWith('/api/local')||url.pathname.startsWith('/api/staging'))fail('NOT_FOUND',404);
   const cookie=/(?:^|;\s*)__Host-marocora_session=([A-Za-z0-9_.-]+)(?:;|$)/.exec(req.headers.cookie||'');
   const bearer=req.headers.authorization!==undefined?(/^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization)?.[1]||''):cookie?.[1];
   if(req.method==='POST'&&url.pathname==='/api/auth/complete-reset')fail('RESET_CODE_REQUIRED',410);
   if(req.method==='POST'&&['/api/auth/request-reset','/api/auth/complete-reset-code'].includes(url.pathname)){
    const ip=config.trustProxy?req.headers['x-real-ip']||req.socket.remoteAddress:req.socket.remoteAddress,now=Date.now();
    for(const [key,value] of rates)if(value.until<=now)rates.delete(key);
    const key=url.pathname+':'+ip,rate=rates.get(key)||{count:0,until:now+60000};
    if(rate.count>=10||rates.size>=5000)fail('RESET_TOO_MANY_ATTEMPTS',429);rate.count++;rates.set(key,rate);
    const fields=await input();
    if(url.pathname==='/api/auth/request-reset'){
     if(Object.keys(fields).length!==1||!Object.hasOwn(fields,'email'))fail('RESET_EMAIL_INVALID');
     fields.email=resetEmail(fields.email);
     resetAttempts.consume({email:fields.email,ip,kind:'request'});
     // Validate the canonical origin; code emails do not depend on a redirect.
     const resetOrigin=origin==='https://www.marocora.com'?'https://marocora.com':origin;
     if(!config.origins.includes(resetOrigin))fail('RESET_ORIGIN_INVALID');
     try{await auth.requestPasswordReset(fields.email,resetOrigin);}catch{}
     return json(res,202,{accepted:true});
    }
    if(Object.keys(fields).length!==3||Object.keys(fields).some(key=>!['email','code','password'].includes(key)))fail('RESET_CODE_MALFORMED');
    fields.email=resetCodeInput(fields.email,fields.code,fields.password);
    resetAttempts.consume({email:fields.email,ip});
    try{await auth.completePasswordResetCode(fields.email,fields.code,fields.password);}
    catch(error){
     const allowed={RESET_CODE_INVALID_OR_EXPIRED:400,RESET_TOO_MANY_ATTEMPTS:429,RESET_PASSWORD_REJECTED:400,RESET_COMPLETION_UNCERTAIN:503,RESET_SERVICE_UNAVAILABLE:503};
     fail(Object.hasOwn(allowed,error?.message)?error.message:'RESET_SERVICE_UNAVAILABLE',allowed[error?.message]||503);
    }
    return json(res,200,{reset:true});
   }
   if(url.pathname==='/api/supply/profiles'&&req.method==='GET'){
    const id=url.searchParams.get('id');if(id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))fail('SUPPLY_INVALID_PROFILE',400);
    return json(res,200,await auth.supplyPublic(id));
   }
   if(url.pathname==='/api/supply/register-config'&&req.method==='GET'){
    return json(res,200,humanCheck?{humanCheck:'turnstile',siteKey:humanCheck.siteKey,action:'supply-register'}:{humanCheck:'unavailable'});
   }
   if(url.pathname==='/api/supply/register'&&req.method==='POST'){
    const ip=config.trustProxy?req.headers['x-real-ip']||req.socket.remoteAddress:req.socket.remoteAddress,now=Date.now();
    for(const [key,value] of rates)if(value.until<=now)rates.delete(key);
    const key='supply-register:'+ip,rate=rates.get(key)||{count:0,until:now+60000};if(rate.count>=3||rates.size>=5000)fail('LOGIN_RATE_LIMIT',429);rate.count++;rates.set(key,rate);
    const fields=await input();if(Object.keys(fields).some(key=>!['email','password','token'].includes(key)))fail('SUPPLY_INVALID_REGISTRATION');
    if(!humanCheck)fail('SUPPLY_REGISTRATION_UNAVAILABLE',503);
    if(!await humanCheck.verify(fields.token,ip))fail('SUPPLY_HUMAN_CHECK_REQUIRED',400);
    return json(res,202,await auth.register(fields.email,fields.password,origin));
   }
   if(url.pathname==='/api/auth/login'&&req.method==='POST'){
    const ip=config.trustProxy?req.headers['x-real-ip']||req.socket.remoteAddress:req.socket.remoteAddress,now=Date.now();
    for(const [key,value] of rates)if(value.until<=now)rates.delete(key);
    const rate=rates.get(ip)||{count:0,until:now+60000};if(rate.count>=10||rates.size>=5000)fail('LOGIN_RATE_LIMIT',429);rate.count++;rates.set(ip,rate);
    const fields=await input();if(Object.keys(fields).some(key=>!['email','password'].includes(key)))fail('INVALID_SIGN_IN');
    const session=await auth.signIn(fields.email,fields.password);
    res.setHeader('Set-Cookie',`${cookieName}=${session.bearer}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=${session.maxAge}`);
    return json(res,200,{authenticated:true});
   }
   if(url.pathname==='/api/auth/logout'&&req.method==='POST'){res.setHeader('Set-Cookie',`${cookieName}=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);return json(res,200,{signedOut:true});}
   if(url.pathname.startsWith('/api/')){
    const session=await auth.authenticate(bearer);
    if(req.method==='POST'&&/^\/api\/supply\/applications\/[^/]+\/credentials$/.test(url.pathname)){if(heavyRequests>=2)fail('UPLOAD_BUSY',429);heavyRequests++;heavy=true;}
    if(await supply({req,url,session,input,body,json,res}))return;
    if(url.pathname==='/api/auth/me'&&req.method==='GET')return json(res,200,{authenticated:true,email:session.email});
    if(url.pathname==='/api/learning/room-config'&&req.method==='GET')return json(res,200,learning.getConfig(session));
    const methods={'/api/learning/room-token':'issue','/api/learning/room-connect':'connect','/api/learning/room-heartbeat':'heartbeat','/api/learning/room-leave':'leave'};
    if(req.method==='POST'&&methods[url.pathname])return json(res,200,await learning[methods[url.pathname]](session,await input()));
    if(url.pathname.startsWith('/api/instant/')||url.pathname==='/api/me'){
     const translation=await auth.translationSession(session.bearer);
     if(req.method==='POST'&&(url.pathname==='/api/instant/orders'||/^\/api\/instant\/orders\/[^/]+\/complete$/.test(url.pathname))){if(heavyRequests>=2)fail('UPLOAD_BUSY',429);heavyRequests++;heavy=true;}
     if(url.pathname==='/api/me'&&req.method==='GET')return json(res,200,{role:translation.role,email:translation.email,csrf:null,production:true,scanner:{available:scanner.available},switches:await auth.db.settings(translation)});
     if(req.method==='POST'&&['/api/instant/orders'].includes(url.pathname)&&!scanner.available)fail('SCANNER_UNAVAILABLE',503);
     if(await instant({req,url,session:translation,input,body,json:(status,value)=>json(res,status,value),res}))return;
    }
    fail('NOT_FOUND',404);
   }
   if(req.method!=='GET'&&req.method!=='HEAD')fail('NOT_FOUND',404);
   if(url.pathname==='/learn'){res.writeHead(302,{Location:'/learn/'+url.search});return res.end();}
   const path=websitePath(decodeURIComponent(url.pathname));
   if(path.split('/').some(part=>part.startsWith('.')||part==='server'||part==='tests'||part==='node_modules')||path.includes('\\')||path.includes('\0'))fail('NOT_FOUND',404);
   const name=path.slice(1),aliases=productionAliases;
   if(privatePages.has(name)||adminPages.has(name)){
    try{const session=await auth.authenticate(bearer);if(adminPages.has(name)&&!await auth.supplyRpc(session,'supply_admin_access',{}))fail('SUPPLY_ADMIN_REQUIRED',403);}
    catch(error){if(error.status!==401)throw error;res.writeHead(302,{Location:loginLocation(path,url.search)});return res.end();}
   }
   let bytes;
   try{
    if(aliases[path])bytes=await readFile(resolve(root,aliases[path]));
    else{if(!publicPages.has(name)&&!privatePages.has(name)&&!adminPages.has(name)&&!browserAssets.has(name))fail('NOT_FOUND',404);const base=resolve(root,'.pages-dist'),target=resolve(base,'.'+path);if(relative(base,target).split(sep).includes('..'))fail('NOT_FOUND',404);bytes=await readFile(target);}
   }catch{fail('NOT_FOUND',404);}
   if(aliases[path]?.endsWith('.html'))bytes=Buffer.from(bytes.toString().replace('STAGING · Mock payments and mock scanning. No real money is collected.','Your documents are scanned before quote processing. Payments are not available yet.'));
   if(extname(path)==='.html'){
    const hashes=[...bytes.toString().matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].filter(match=>match[1].trim()).map(match=>"'sha256-"+createHash('sha256').update(match[1]).digest('base64')+"'");
    res.setHeader('Content-Security-Policy',policy(live,hashes));
   }
   res.writeHead(200,{'Content-Type':mime[extname(path).toLowerCase()]});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(error){req.resume();if(res.headersSent){res.destroy();return;}const code=/^[A-Z][A-Z0-9_]{0,79}$/.test(error.message||'')?error.message:'REQUEST_FAILED';json(res,Number.isInteger(error.status)&&error.status>=400&&error.status<600?error.status:500,{error:code});}
  finally{concurrent--;if(heavy)heavyRequests--;}
 });
 server.requestTimeout=60000;server.headersTimeout=15000;server.keepAliveTimeout=5000;
 const stop=()=>void close().catch(()=>{process.exitCode=1;});
 const close=()=>closing??=(async()=>{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);const done=new Promise(resolve=>server.listening?server.close(resolve):resolve());server.closeAllConnections();try{await learning.close();await done;}finally{storage.close?.();auth.db.stop?.();rates.clear();resetAttempts.clear();}})();
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.port,config.host,()=>{server.removeListener('error',reject);resolve();});});}catch(error){await close();throw error;}
 if(handleSignals){process.once('SIGINT',stop);process.once('SIGTERM',stop);}
 log('PRODUCTION_LISTEN '+config.host+':'+server.address().port+'; origins='+config.origins.join(','));
 return {server,close};
}
