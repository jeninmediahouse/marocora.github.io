import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {request as httpRequest} from 'node:http';
import {spawn} from 'node:child_process';
import {startLearningRoomServer} from '../server/learning-room-http.mjs';
import {startLearningVideoLan} from '../server/learning-video-lan.mjs';
import {openNgrokTunnel} from '../server/ngrok-tunnel.mjs';
const interfaces={wifi:[{family:'IPv4',internal:false,address:'192.0.2.10'}]};
const dummy={PORT:'0',LIVEKIT_URL:'wss://synthetic.invalid',LIVEKIT_API_KEY:'SYNTHETIC_KEY',LIVEKIT_API_SECRET:'SYNTHETIC_SECRET_NEVER_REAL_0123456789'};
const localRequest=(port,path,{host='lesson.example.invalid',origin,body,cookie,extra={}}={})=>new Promise((resolve,reject)=>{
 const req=httpRequest('http://127.0.0.1:'+port+path,{method:body?'POST':'GET',headers:{Host:host,...(origin?{Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra}},res=>{
  let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,json:()=>JSON.parse(text)}));res.on('error',reject);
 });req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
});

test('Dynamic HTTPS tunnel links authenticate with Secure cookies and exact public Origin; forged proxies fail',async t=>{
 const logs=[],app=await startLearningRoomServer({mode:'live',env:{LEARNING_VIDEO_MODE:'live'},host:'127.0.0.1',port:0,interfaces,handleSignals:false,printLinks:false,log:line=>logs.push(line)});t.after(()=>app.close());
 assert.ok(!logs.some(line=>line.startsWith('student:')));
 for(const url of ['http://bad.invalid','https://user:secret@bad.invalid','https://bad.invalid/path','https://bad.invalid?q=1'])assert.throws(()=>app.setPublicOrigin(url),/INVALID_TUNNEL_URL/);
 app.setPublicOrigin('https://lesson.example.invalid');app.printLinks();
 const link=new URL(logs.find(line=>line.startsWith('student:')).slice(9));assert.equal(link.origin,'https://lesson.example.invalid');assert.equal(link.hash,'');assert.match(link.searchParams.get('ticket'),/^[a-f0-9]{64}$/);
 const port=app.server.address().port,ticket=link.searchParams.get('ticket');
 const denied=await localRequest(port,'/api/local/learning-login',{origin:'https://foreign.invalid',body:{ticket}});assert.equal(denied.status,403);
 const login=await localRequest(port,'/api/local/learning-login',{origin:link.origin,body:{ticket}});assert.equal(login.status,200);assert.match(login.headers['set-cookie'][0],/; Secure/);
 const cookie=login.headers['set-cookie'][0].split(';')[0];
 const config=await localRequest(port,'/api/learning/room-config',{cookie});assert.deepEqual(config.json(),{enabled:false,transport:'live',mock:false});
 const forbidden=await localRequest(port,'/api/learning/room-token',{origin:'http://127.0.0.1:'+port,cookie,body:{bookingId:link.searchParams.get('bookingId')}});assert.equal(forbidden.status,403);
 const forged=await localRequest(port,'/learning-room.html',{host:'foreign.invalid',extra:{'X-Forwarded-Host':'lesson.example.invalid','X-Forwarded-Proto':'https'}});assert.equal(forged.status,403);
 await app.close();assert.equal(app.server.listening,false);
});
function fakeAgent({announce=true,error=false}={}){
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kills=[];
 child.kill=signal=>{child.kills.push(signal);queueMicrotask(()=>{child.emit('exit',0);child.emit('close',0);});return true;};
 const spawnAgent=(command,args,options)=>{child.options=options;child.args=args;assert.equal(command,'ngrok');queueMicrotask(()=>{if(error){child.emit('error',Object.assign(Error('SENSITIVE_PROVIDER_MESSAGE'),{code:'ENOENT'}));child.emit('close',-2);}else if(announce){const line=JSON.stringify({msg:'started tunnel',url:'https://lesson.example.invalid'})+'\n';child.stdout.write(line.slice(0,12));child.stdout.write(line.slice(12));}});return child;};
 return {child,spawnAgent};
}
test('Owned ngrok agent parses split JSON, excludes LiveKit secrets from env and terminates cleanly',async()=>{
 const f=fakeAgent(),agent=await openNgrokTunnel({port:4195,spawnAgent:f.spawnAgent,env:{PATH:'/synthetic',HOME:'/synthetic',LIVEKIT_API_SECRET:'NEVER_FORWARD',NGROK_AUTHTOKEN:'DUMMY_NGROK_ONLY'}});
 assert.equal(agent.url,'https://lesson.example.invalid');assert.ok(f.child.args.includes('http://127.0.0.1:4195'));assert.ok(f.child.args.includes('--inspect=false'));
 assert.equal(f.child.options.env.LIVEKIT_API_SECRET,undefined);assert.equal(f.child.options.env.NGROK_AUTHTOKEN,'DUMMY_NGROK_ONLY');
 await agent.close();await agent.close();assert.deepEqual(f.child.kills,['SIGTERM']);
});
test('Ngrok timeout and missing binary fail safely and reap only the owned agent',async()=>{
 const slow=fakeAgent({announce:false});await assert.rejects(openNgrokTunnel({port:4195,spawnAgent:slow.spawnAgent,timeoutMs:10}),/TUNNEL_START_TIMEOUT/);assert.deepEqual(slow.child.kills,['SIGTERM']);
 const missing=fakeAgent({error:true});await assert.rejects(openNgrokTunnel({port:4195,spawnAgent:missing.spawnAgent}),error=>error.message==='NGROK_NOT_INSTALLED');
});
// In-process guards prohibit even Node's numeric DNS lookup for 0.0.0.0.
// Assert the requested bind here; child-process regressions exercise the real
// wildcard listener under OS internet isolation without changing any guard.
const factory=(logs,remember)=>async options=>{assert.equal(options.host,'0.0.0.0');const app=await startLearningRoomServer({...options,host:'127.0.0.1',interfaces});remember(app);return app;};
test('Combined launcher activates explicit live test, prints only HTTPS role links and cleans up both services',async t=>{
 const logs=[];let app,closed=0,resolveDone;
 const runtime=await startLearningVideoLan({env:dummy,log:line=>logs.push(line),startServer:factory(logs,value=>app=value),openTunnel:async({port,signal})=>{assert.ok(port>0);assert.equal(signal.aborted,false);return {url:'https://lesson.example.invalid',done:new Promise(resolve=>resolveDone=resolve),async close(){closed++;resolveDone();}};}});t.after(()=>runtime.close());
 const links=logs.filter(line=>/^(student|teacher|otherStudent):/.test(line));assert.equal(links.length,3);assert.ok(links.every(line=>line.includes('https://lesson.example.invalid/learning-room.html?bookingId=')));
 assert.equal(app.server.address().address,'127.0.0.1');
 await runtime.close();assert.equal(app.server.listening,false);assert.equal(closed,1);
});
test('Tunnel startup failure closes the server and prints no usable tickets',async()=>{
 const logs=[];let app;
 await assert.rejects(startLearningVideoLan({env:dummy,log:line=>logs.push(line),startServer:factory(logs,value=>app=value),openTunnel:async()=>{throw Error('TUNNEL_START_TIMEOUT');}}),/TUNNEL_START_TIMEOUT/);
 assert.equal(app.server.listening,false);assert.ok(!logs.some(line=>line.startsWith('student:')));
});
test('Explicit no-tunnel mode prints detected LAN role links and HTTPS warning without starting ngrok',{timeout:15000},async()=>{
 const script=`import {startLearningVideoLan} from './server/learning-video-lan.mjs';import {startLearningRoomServer} from './server/learning-room-http.mjs';const run=await startLearningVideoLan({env:${JSON.stringify(dummy)},tunnel:false,startServer:options=>startLearningRoomServer({...options,interfaces:${JSON.stringify(interfaces)}}),openTunnel:()=>{throw Error('MUST_NOT_TUNNEL');}});await run.close();`;
 const child=spawn(process.execPath,['--input-type=module','-e',script],{env:{PATH:process.env.PATH},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',chunk=>output+=chunk);
 assert.equal(await new Promise(resolve=>child.once('close',resolve)),0);
 assert.match(output,/student: http:\/\/192\.0\.2\.10:/);assert.match(output,/NO TUNNEL.*HTTPS/);assert.match(output,/HTTP_LISTEN: 0\.0\.0\.0:/);
});
test('Ctrl-C stops the combined HTTP listener and its simulated tunnel process',{timeout:15000},async t=>{
 const script=`import {startLearningVideoLan} from './server/learning-video-lan.mjs';let closed=false;const run=await startLearningVideoLan({env:${JSON.stringify(dummy)},openTunnel:async()=>({url:'https://lesson.example.invalid',done:new Promise(()=>{}),async close(){closed=true;}})});process.on('exit',()=>console.log('CLEANUP_RESULT',closed&&!run.app.server.listening));`;
 const child=spawn(process.execPath,['--input-type=module','-e',script],{env:{PATH:process.env.PATH},stdio:['ignore','pipe','pipe']});let output='';
 t.after(()=>{if(child.exitCode===null)child.kill('SIGTERM');});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('COMBINED_START_TIMEOUT')),7000);child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('Ctrl-C stops')){clearTimeout(timer);resolve();}});child.once('error',e=>{clearTimeout(timer);reject(e);});});
 const ended=new Promise(resolve=>child.once('close',resolve));child.kill('SIGINT');assert.equal(await ended,0);assert.match(output,/CLEANUP_RESULT true/);
});
