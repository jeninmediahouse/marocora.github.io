import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {request as httpRequest} from 'node:http';
import {openCloudflareTunnel} from '../server/cloudflare-tunnel.mjs';
import {startLearningRoomServer} from '../server/learning-room-http.mjs';
import {startLearningVideoLan} from '../server/learning-video-lan.mjs';

function fakeAgent({missing=false}={}){
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kills=[];
 child.kill=signal=>{child.kills.push(signal);queueMicrotask(()=>{child.emit('exit',0);child.emit('close',0);});return true;};
 const spawnAgent=(command,args,options)=>{assert.equal(command,'cloudflared');child.args=args;child.options=options;if(missing)queueMicrotask(()=>{child.emit('error',Object.assign(Error('PRIVATE_CONFIG_DETAIL'),{code:'ENOENT'}));child.emit('close',-2);});return child;};
 return {child,spawnAgent};
}
test('Cloudflare agent waits for public URL and registered connection, isolates env and stops only its process',async()=>{
 const f=fakeAgent();let ready=false;
 const pending=openCloudflareTunnel({port:4195,spawnAgent:f.spawnAgent,env:{PATH:'/synthetic',HOME:'/synthetic',LIVEKIT_API_SECRET:'DUMMY_PRIVATE',NGROK_AUTHTOKEN:'DUMMY_PRIVATE'}}).then(agent=>{ready=true;return agent;});
 const line=JSON.stringify({message:'Visit https://synthetic-lesson.trycloudflare.com'})+'\n';f.child.stderr.write(line.slice(0,30));f.child.stderr.write(line.slice(30));await Promise.resolve();assert.equal(ready,false);
 f.child.stderr.write(JSON.stringify({message:'Registered tunnel connection',connIndex:0})+'\n');const agent=await pending;
 assert.equal(agent.url,'https://synthetic-lesson.trycloudflare.com');assert.ok(f.child.args.includes('--no-autoupdate'));assert.ok(f.child.args.includes('/dev/null'));assert.ok(f.child.args.includes('http://127.0.0.1:4195'));
 assert.equal(f.child.options.env.LIVEKIT_API_SECRET,undefined);assert.equal(f.child.options.env.NGROK_AUTHTOKEN,undefined);
 await agent.close();await agent.close();assert.deepEqual(f.child.kills,['SIGTERM']);
});
test('Cloudflare missing binary and unregistered/invalid endpoint timeout fail closed with safe errors',async()=>{
 const missing=fakeAgent({missing:true});await assert.rejects(openCloudflareTunnel({port:4195,spawnAgent:missing.spawnAgent}),error=>error.message==='CLOUDFLARED_NOT_INSTALLED');
 const stalled=fakeAgent();const pending=openCloudflareTunnel({port:4195,spawnAgent:stalled.spawnAgent,timeoutMs:10});
 stalled.child.stderr.write('https://synthetic.trycloudflare.com.attacker.invalid\nRegistered tunnel connection\n');
 await assert.rejects(pending,/CLOUDFLARE_TUNNEL_TIMEOUT/);assert.deepEqual(stalled.child.kills,['SIGTERM']);
 await assert.rejects(startLearningVideoLan({env:{LEARNING_TUNNEL_PROVIDER:'unknown'},startServer:()=>assert.fail('invalid provider must not listen')}),/INVALID_TUNNEL_PROVIDER/);
});
const localRequest=(port,path,{method='GET',body,cookie}={})=>new Promise((resolve,reject)=>{
 const req=httpRequest('http://127.0.0.1:'+port+path,{method,headers:{Host:'synthetic-lesson.trycloudflare.com',Origin:'https://synthetic-lesson.trycloudflare.com',...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})}},res=>{
  let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,json:()=>JSON.parse(text)}));res.on('error',reject);
 });req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
});
test('Preview GET/HEAD never consume a login ticket or change live mode; only explicit login POST redeems it',async t=>{
 const logs=[],app=await startLearningRoomServer({mode:'live',env:{LEARNING_VIDEO_MODE:'live'},port:0,handleSignals:false,printLinks:false,log:line=>logs.push(line)});t.after(()=>app.close());
 app.setPublicOrigin('https://synthetic-lesson.trycloudflare.com');app.printLinks();
 const link=new URL(logs.find(line=>line.startsWith('student:')).slice(9)),port=app.server.address().port,path=link.pathname+link.search,ticket=link.searchParams.get('ticket');
 for(let i=0;i<3;i++)assert.equal((await localRequest(port,path)).status,200);
 assert.equal((await localRequest(port,path,{method:'HEAD'})).status,405);
 assert.equal((await localRequest(port,'/api/local/learning-login?ticket='+ticket)).status,403);
 const login=await localRequest(port,'/api/local/learning-login',{method:'POST',body:{ticket}});assert.equal(login.status,200);
 const cookie=login.headers['set-cookie'][0].split(';')[0];
 const config=await localRequest(port,'/api/learning/room-config',{cookie});assert.deepEqual(config.json(),{enabled:false,transport:'live',mock:false});
 const replay=await localRequest(port,'/api/local/learning-login',{method:'POST',body:{ticket}});assert.equal(replay.status,401);
});
