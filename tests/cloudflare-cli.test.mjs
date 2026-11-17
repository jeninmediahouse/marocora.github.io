import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {cloudflareTunnelArgs,openCloudflareTunnel} from '../server/cloudflare-tunnel.mjs';
import {startLearningVideoLan} from '../server/learning-video-lan.mjs';

test('Exact Cloudflare launch arguments are accepted by the installed CLI in offline help mode',t=>{
 const result=spawnSync('cloudflared',[...cloudflareTunnelArgs(4195),'--help'],{env:{PATH:process.env.PATH},encoding:'utf8',timeout:5000,maxBuffer:100000});
 if(result.error?.code==='ENOENT'){t.skip('optional cloudflared executable is not installed');return;}
 assert.equal(result.error,undefined);assert.equal(result.status,0);assert.doesNotMatch(result.stdout+result.stderr,/incorrect usage|flag provided but not defined|unknown flag/i);
 assert.match(result.stdout+result.stderr,/--output/);assert.ok(!cloudflareTunnelArgs(4195).includes('--logformat'));
});
function agent(write){
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();
 child.kill=()=>{queueMicrotask(()=>{child.emit('exit',0);child.emit('close',0);});return true;};
 return {child,spawnAgent:()=>{queueMicrotask(()=>write(child));return child;}};
}
test('Cloudflare parses stdout JSON and stderr text/tail before registering the exact public origin and printing links',async()=>{
 const f=agent(child=>{
  child.stderr.write('INF Registered tunnel connec');child.stderr.end('tion');
  const line=JSON.stringify({message:'Visit https://working-lesson.trycloudflare.com'}).replaceAll('/','\\/');child.stdout.end(line);
 }),events=[];
 const app={server:{address:()=>({port:4195})},setPublicOrigin:url=>events.push(['origin',url]),printLinks:()=>events.push(['links']),close:async()=>events.push(['closed'])};
 const runtime=await startLearningVideoLan({env:{},log:()=>{},startServer:async()=>app,openTunnel:options=>openCloudflareTunnel({...options,spawnAgent:f.spawnAgent})});
 assert.deepEqual(events,[['origin','https://working-lesson.trycloudflare.com'],['links']]);await runtime.close();assert.equal(events.at(-1)[0],'closed');
});
test('Early Cloudflare exit preserves exit status and safe argument diagnostic without exposing raw stderr',async()=>{
 const f=agent(child=>{child.stderr.end('Incorrect Usage. flag provided but not defined: -badflag PRIVATE_DETAIL');child.emit('exit',2);child.emit('close',2,null);});
 await assert.rejects(openCloudflareTunnel({port:4195,spawnAgent:f.spawnAgent}),error=>{
  assert.equal(error.message,'CLOUDFLARE_AGENT_EXITED');assert.equal(error.exitCode,2);assert.equal(error.diagnostic,'UNSUPPORTED_CLI_FLAG');assert.ok(!JSON.stringify(error).includes('PRIVATE_DETAIL'));return true;
 });
});
