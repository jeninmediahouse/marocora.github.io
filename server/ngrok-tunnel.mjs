import {spawn} from 'node:child_process';

// Manage only the agent we start. Never inspect existing agents or dump logs/config.
export async function openNgrokTunnel({port,signal,spawnAgent=spawn,env=process.env,timeoutMs=20000}={}){
 const childEnv=Object.fromEntries(Object.entries(env).filter(([key])=>['PATH','HOME','USER','TMPDIR','XDG_CONFIG_HOME','NGROK_AUTHTOKEN'].includes(key)));
 const child=spawnAgent('ngrok',['http','http://127.0.0.1:'+port,'--log=stdout','--log-format=json','--log-level=info','--inspect=false'],{env:childEnv,stdio:['ignore','pipe','pipe']});
 let closing,closed=false,buffer='',lastCode='',resolveDone;
 const done=new Promise(resolve=>{resolveDone=resolve;});
 child.once('close',()=>{closed=true;resolveDone();});
 // A missing binary can emit error without an exit; close still follows.
 const close=()=>closing??=(async()=>{
  signal?.removeEventListener('abort',abort);
  if(closed)return;child.kill('SIGTERM');
  const timer=setTimeout(()=>{if(!closed)child.kill('SIGKILL');},1500);timer.unref();
  try{await done;}finally{clearTimeout(timer);}
 })();
 const abort=()=>{void close();};
 signal?.addEventListener('abort',abort,{once:true});
 try{
  const url=await new Promise((resolve,reject)=>{
   const fail=code=>reject(Error(code));
   const timer=setTimeout(()=>fail('TUNNEL_START_TIMEOUT'),timeoutMs);
   const finish=()=>clearTimeout(timer);
   const onAbort=()=>fail('TUNNEL_START_CANCELLED');
   signal?.addEventListener('abort',onAbort,{once:true});
   const clear=()=>{finish();signal?.removeEventListener('abort',onAbort);};
   child.once('error',error=>{clear();fail(error.code==='ENOENT'?'NGROK_NOT_INSTALLED':'TUNNEL_START_FAILED');});
   child.once('exit',()=>{clear();fail(lastCode||'TUNNEL_AGENT_EXITED');});
   child.stdout.on('data',chunk=>{
    buffer+=chunk; if(buffer.length>65536){clear();fail('TUNNEL_INVALID_OUTPUT');void close();return;}
    let index;while((index=buffer.indexOf('\n'))>=0){
     const line=buffer.slice(0,index);buffer=buffer.slice(index+1);let entry;try{entry=JSON.parse(line);}catch{continue;}
     if(typeof entry.url==='string'&&entry.msg==='started tunnel'&&entry.url.startsWith('https://')){clear();resolve(entry.url);}
     const code=String(entry.err||entry.error||'').match(/ERR_NGROK_\d+/)?.[0];if(code)lastCode=code;
    }
   });
   // Consume stderr without printing potentially sensitive provider diagnostics.
   child.stderr.on('data',chunk=>{const code=String(chunk).match(/ERR_NGROK_\d+/)?.[0];if(code)lastCode=code;});
   if(signal?.aborted){clear();onAbort();}
  });
  if(closed||signal?.aborted)throw Error('TUNNEL_START_CANCELLED');
  return {url,close,done};
 }catch(error){await close();throw error;}
}
