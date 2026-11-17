import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {randomBytes,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,extname} from 'node:path';
import {createApiHandler} from './api.mjs';
import {createLearningRooms} from './learning-room.mjs';
import {createConfiguredLearningRooms} from './live-learning-room.mjs';
import {createLearningRoomFixture} from './learning-room-fixture.mjs';
import {learningHttpBinding} from './learning-http-binding.mjs';
export async function startLearningRoomServer({mode='mock',enabled=false,env={},port=4196,host='127.0.0.1',interfaces,handleSignals=true,printLinks=true,log=console.log}={}){
const root=fileURLToPath(new URL('../',import.meta.url));
learningHttpBinding({host,port,interfaces});
if(mode!=='live'&&host!=='127.0.0.1')throw Error('MOCK_REQUIRES_LOOPBACK');
let origin,publicOrigin=null;const apis=new Map();
const fixture=await createLearningRoomFixture(),sessions=new Map(),tickets=new Map();
const rooms=mode==='live'?createConfiguredLearningRooms({marketplace:fixture.marketplace,env}):createLearningRooms({marketplace:fixture.marketplace,config:{enabled,mode:'mock'}});
const cookieName=mode==='live'?'learning_live_test':'learning_mock';
const liveEnabled=mode==='live'&&env.LEARNING_VIDEO_ENABLED==='true';
const configuredUrl=liveEnabled?new URL(env.LIVEKIT_URL):null;
const assets=new Set(['learn/lesson-login.mjs','learning-room.html','learning-room.css','learning-room.mjs','learn/learning-room-session.mjs','learn/live-learning-room.mjs','learn/mock-learning-room.mjs','learn/room-copy.mjs','site-language.mjs','site-language.css','site-services.mjs','learn/locale.mjs','site-copy.mjs','home-copy.mjs','site-ui-copy.mjs','site-extra-copy.mjs','translation-copy.mjs']);
const getSession=req=>{const match=new RegExp('(?:^|;\\s*)'+cookieName+'=([a-f0-9]{64})(?:;|$)').exec(req.headers.cookie||'');const session=match&&sessions.get(match[1]);return session&&session.expires>Date.now()?session:null;};
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Permissions-Policy',liveEnabled?'camera=(self), microphone=(self), display-capture=()':'camera=(), microphone=(), display-capture=()');res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ${liveEnabled?configuredUrl.origin+' '+configuredUrl.origin.replace(/^wss:/,'https:')+' wss://*.livekit.cloud https://*.livekit.cloud':''}; media-src ${liveEnabled?"'self' blob:":"'none'"}; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`);
 try{
  const requestOrigin=publicOrigin&&req.headers.host===new URL(publicOrigin).host?publicOrigin:'http://'+req.headers.host,api=apis.get(requestOrigin);
  if(!api)return json(res,403,{error:'HOST_DENIED'});
  const origin=requestOrigin;
  const url=new URL(req.url,origin);
  if(url.origin!==origin)return json(res,403,{error:'HOST_DENIED'});
  if(url.pathname==='/api/local/learning-login'){
   if(req.method!=='POST'||req.headers.origin!==origin)return json(res,403,{error:'ORIGIN_REQUIRED'});
   if(req.headers['content-type']!=='application/json')return json(res,415,{error:'JSON_REQUIRED'});
   let data='',size=0;for await(const chunk of req){size+=chunk.length;if(size>1024)return json(res,413,{error:'REQUEST_TOO_LARGE'});data+=chunk;}
   const body=JSON.parse(data);if(!body||typeof body.ticket!=='string'||!/^[a-f0-9]{64}$/.test(body.ticket))return json(res,401,{error:'INVALID_MOCK_TICKET'});
   const ticketHash=createHash('sha256').update(body.ticket).digest('hex'),existing=getSession(req);
   // Reload/retry may reuse a consumed ticket only with its original live cookie.
   // Possessing the URL alone never redeems a consumed ticket in another session.
   if(existing?.ticketHash===ticketHash)return json(res,200,{mock:true});
   const actor=tickets.get(body.ticket);if(!actor)return json(res,401,{error:'INVALID_MOCK_TICKET'});tickets.delete(body.ticket);
   const session=randomBytes(32).toString('hex');sessions.set(session,{actor,ticketHash,expires:Date.now()+3600000});res.setHeader('Set-Cookie',`${cookieName}=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600${origin.startsWith('https:')?'; Secure':''}`);return json(res,200,{mock:true});
  }
  if(url.pathname.startsWith('/api/learning/'))return await api(req,res);
  if(req.method!=='GET')return json(res,405,{error:'METHOD_NOT_ALLOWED'});
  const path=url.pathname==='/'?'learning-room.html':url.pathname.slice(1);if(!assets.has(path))return json(res,404,{error:'NOT_FOUND'});
  res.writeHead(200,{'Content-Type':extname(path)==='.html'?'text/html; charset=utf-8':extname(path)==='.css'?'text/css; charset=utf-8':'text/javascript; charset=utf-8'});res.end(readFileSync(path==='learn/live-learning-room.mjs'?join(root,'.learning-room-assets/live-learning-room.mjs'):join(root,path)));
 }catch{json(res,400,{error:'INVALID_LOCAL_REQUEST'});}
});
const addOrigin=allowedOrigin=>apis.set(allowedOrigin,createApiHandler({marketplace:fixture.marketplace,origin:allowedOrigin,learningRooms:rooms,authenticate:req=>getSession(req)?.actor||null}));
let closing;
const close=()=>closing??=(async()=>{
 process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
 // Stop accepting requests before awaiting potentially slow provider cleanup.
 const stopped=new Promise(resolve=>server.listening?server.close(resolve):resolve());
 server.closeAllConnections();
 try{await rooms.close();await stopped;}finally{fixture.marketplace.close();apis.clear();sessions.clear();tickets.clear();}
})();
const stop=()=>{void close().catch(()=>{process.exitCode=1;});};
try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.removeListener('error',reject);resolve();});});}
catch(error){await close();throw error;}
const binding=learningHttpBinding({host,port:server.address().port,interfaces});
origin=binding.origins[0];
for(const allowedOrigin of binding.origins)addOrigin(allowedOrigin);
function setPublicOrigin(value){
 if(mode!=='live')throw Error('MOCK_REQUIRES_LOOPBACK');
 let url;try{url=new URL(value);}catch{throw Error('INVALID_TUNNEL_URL');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||!url.hostname||url.port)throw Error('INVALID_TUNNEL_URL');
 if(publicOrigin)apis.delete(publicOrigin);publicOrigin=url.origin;addOrigin(publicOrigin);origin=publicOrigin;
}
function showLinks(){
 for(const role of ['student','teacher','otherStudent']){const ticket=randomBytes(32).toString('hex');tickets.set(ticket,fixture.ids[role]);const suffix='/learning-room.html?bookingId='+fixture.bookingId+(publicOrigin?'&ticket=':'#')+ticket;log(role+': '+origin+suffix);if(!publicOrigin&&host==='0.0.0.0'&&binding.linkOrigin!==origin)log(role+' LAN: '+binding.linkOrigin+suffix);}
}
log(mode==='live'?'LEARNING VIDEO: live test; gate '+(liveEnabled?'ON':'OFF')+'. Synthetic accounts/bookings only.':'LEARNING VIDEO: local mock only; video gate '+(enabled?'ON':'OFF')+'. No cloud, hardware access, media or money.');
log('HTTP_LISTEN: '+server.address().address+':'+server.address().port);
if(host!=='127.0.0.1'){
 for(const allowedOrigin of binding.origins)log('HTTP_ORIGIN: '+allowedOrigin);
 log('LAN HTTP serves the page; camera/microphone require a trusted HTTPS origin.');
}
if(printLinks)showLinks();
if(handleSignals){process.once('SIGINT',stop);process.once('SIGTERM',stop);}
return {server,rooms,close,setPublicOrigin,useLanOrigin(){origin=binding.linkOrigin;},printLinks:showLinks};
}
