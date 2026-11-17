import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {learningHttpBinding} from '../server/learning-http-binding.mjs';

const interfaces={wifi:[{family:'IPv4',internal:false,address:'192.0.2.10'}],lo:[{family:'IPv4',internal:true,address:'127.0.0.1'}]};
// Node fetch normalizes Host to the URL. Use HTTP directly to test Host policy.
const localRequest=(url,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{
 const req=httpRequest(url,{method,headers},res=>{
  const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);
  res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:Object.fromEntries(Object.entries(res.headers).map(([key,value])=>[key,Array.isArray(value)?value.join(', '):value]))})));
 });req.on('error',reject);req.end(body);
});
test('Learning HTTP binding defaults to loopback; wildcard trusts only actual local interface hosts',()=>{
 assert.deepEqual(learningHttpBinding({port:4195,interfaces}).origins,['http://127.0.0.1:4195','http://localhost:4195']);
 assert.deepEqual(learningHttpBinding({host:'0.0.0.0',port:4195,interfaces}).origins,['http://127.0.0.1:4195','http://localhost:4195','http://192.0.2.10:4195']);
 assert.deepEqual(learningHttpBinding({host:'192.0.2.10',port:4195,interfaces}).origins,['http://192.0.2.10:4195']);
 for(const host of ['attacker.invalid','0.0.0.0.attacker.invalid','192.0.2.99','::'])assert.throws(()=>learningHttpBinding({host,port:4195,interfaces}),/INVALID_LOCAL_HOST/);
});
async function launch(t,args,env={}){
 const child=spawn(process.execPath,args,{env:{PATH:process.env.PATH,...env},stdio:['ignore','pipe','pipe']});
 t.after(()=>new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('close',resolve);child.kill('SIGTERM');}));
 return new Promise((resolve,reject)=>{
  let output='';const timer=setTimeout(()=>reject(Error('LOCAL_HTTP_START_TIMEOUT')),7000);
  child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',()=>{clearTimeout(timer);reject(Error('LOCAL_HTTP_EARLY_EXIT'));});
  child.stdout.on('data',chunk=>{output+=chunk;const link=/student: (http[^\s]+)/.exec(output);if(link){clearTimeout(timer);resolve({output,url:new URL(link[1])});}});
 });
}
test('Live entry point honors HOST=0.0.0.0 while retaining the OFF gate without keys',{timeout:15000},async t=>{
 const {output,url}=await launch(t,['server/start-learning-live.mjs'],{HOST:'0.0.0.0',PORT:'0',LEARNING_VIDEO_MODE:'live',LEARNING_VIDEO_ENABLED:'false'});
 assert.match(output,/HTTP_LISTEN: 0\.0\.0\.0:\d+/);
 assert.equal((await fetch(url.origin+'/learning-room.html')).status,200);
 const login=await fetch(url.origin+'/api/local/learning-login',{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json'},body:JSON.stringify({ticket:url.hash.slice(1)})});
 assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 const config=await fetch(url.origin+'/api/learning/room-config',{headers:{Cookie:cookie}});
 assert.deepEqual(await config.json(),{enabled:false,transport:'live',mock:false});
});
test('LAN Host and matching Origin can authenticate; foreign and cross-origin requests remain denied',{timeout:15000},async t=>{
 const script=`import {startLearningRoomServer} from './server/learning-room-http.mjs';await startLearningRoomServer({mode:'live',host:'0.0.0.0',port:0,env:{LEARNING_VIDEO_MODE:'live'},interfaces:${JSON.stringify(interfaces)}});`;
 const {url}=await launch(t,['--input-type=module','-e',script]);
 const host='192.0.2.10:'+url.port,origin='http://'+host;
 // TCP stays strictly on loopback; the HTTP Host/Origin exercise the LAN path.
 const post=(originHeader,cookie)=>localRequest(url.origin+'/api/local/learning-login',{method:'POST',headers:{Host:host,Origin:originHeader,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({ticket:url.hash.slice(1)})});
 assert.equal((await localRequest(url.origin+'/learning-room.html',{headers:{Host:host}})).status,200);
 assert.equal((await localRequest(url.origin+'/learning-room.html',{headers:{Host:'attacker.invalid:'+url.port}})).status,403);
 assert.equal((await post('http://attacker.invalid')).status,403);
 const login=await post(origin);assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 const headers={Host:host,Origin:origin,Cookie:cookie,'Content-Type':'application/json'};
 const response=await localRequest(url.origin+'/api/learning/room-token',{method:'POST',headers,body:JSON.stringify({bookingId:url.searchParams.get('bookingId')})});
 assert.equal(response.status,503);assert.equal((await response.json()).error,'LEARNING_VIDEO_DISABLED');
 const cross=await localRequest(url.origin+'/api/learning/room-token',{method:'POST',headers:{...headers,Origin:url.origin},body:'{}'});
 assert.equal(cross.status,403);assert.equal((await cross.json()).error,'ORIGIN_REQUIRED');
});
