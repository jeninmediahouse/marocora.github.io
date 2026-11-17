import {spawn} from 'node:child_process';

// Accountless Quick Tunnel; never read developer tunnel configs or credentials.
export function cloudflareTunnelArgs(port){
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('INVALID_LOCAL_PORT');
 return ['tunnel','--config','/dev/null','--no-autoupdate','--url','http://127.0.0.1:'+port,'--output','json'];
}
export async function openCloudflareTunnel({port,signal,spawnAgent=spawn,env=process.env,timeoutMs=60000}={}){
 const childEnv=Object.fromEntries(Object.entries(env).filter(([key])=>['PATH','HOME','USER','TMPDIR'].includes(key)));
 const child=spawnAgent('cloudflared',cloudflareTunnelArgs(port),{env:childEnv,stdio:['ignore','pipe','pipe']});
 let closing,closed=false,resolveDone;
 const done=new Promise(resolve=>resolveDone=resolve);child.once('close',()=>{closed=true;resolveDone();});
 const close=()=>closing??=(async()=>{
  signal?.removeEventListener('abort',abort);if(closed)return;
  child.kill('SIGTERM');const timer=setTimeout(()=>{if(!closed)child.kill('SIGKILL');},1500);timer.unref();
  try{await done;}finally{clearTimeout(timer);}
 })();
 const abort=()=>{void close();};signal?.addEventListener('abort',abort,{once:true});
 try{
  const url=await new Promise((resolve,reject)=>{
   let assigned,connected=false,diagnostic;const buffers=new Map();
   const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);};
   const fail=(code,details)=>{cleanup();reject(Object.assign(Error(code),details));};
   const timer=setTimeout(()=>fail('CLOUDFLARE_TUNNEL_TIMEOUT'),timeoutMs);
   const cancel=()=>fail('TUNNEL_START_CANCELLED');signal?.addEventListener('abort',cancel,{once:true});
   child.once('error',error=>fail(error.code==='ENOENT'?'CLOUDFLARED_NOT_INSTALLED':'TUNNEL_START_FAILED'));
   const parseLine=line=>{
    let entry;try{entry=JSON.parse(line);}catch{}
    const text=[line,entry?.message,entry?.msg,entry?.url].filter(value=>typeof value==='string').join(' ');
    const found=text.match(/https:\/\/([a-z0-9]+(?:-[a-z0-9]+)*)\.trycloudflare\.com(?=[\s"/|]|$)/i);
    if(found)assigned=found[0];
    if(text.includes('Registered tunnel connection'))connected=true;
    if(/flag provided but not defined|unknown flag|incorrect usage/i.test(text))diagnostic='UNSUPPORTED_CLI_FLAG';
    else if(/no such host|temporary failure in name resolution/i.test(text))diagnostic='DNS_FAILED';
    else if(/x509|certificate verify|certificate signed/i.test(text))diagnostic='TLS_CERTIFICATE_FAILED';
    else if(/timed out|timeout/i.test(text))diagnostic='NETWORK_TIMEOUT';
    if(assigned&&connected){cleanup();resolve(assigned);}
   };
   const consume=(stream,chunk,flush=false)=>{
    let buffer=(buffers.get(stream)||'')+chunk;
    if(buffer.length>65536){fail('TUNNEL_INVALID_OUTPUT');void close();return;}
    let index;while((index=buffer.indexOf('\n'))>=0){
     const line=buffer.slice(0,index);buffer=buffer.slice(index+1);
     parseLine(line);
    }
    if(flush&&buffer){parseLine(buffer);buffer='';}
    buffers.set(stream,buffer);
   };
   for(const [name,stream] of [['stdout',child.stdout],['stderr',child.stderr]])stream.once('end',()=>consume(name,'',true));
   child.stdout.on('data',chunk=>consume('stdout',chunk));child.stderr.on('data',chunk=>consume('stderr',chunk));
   child.once('close',(exitCode,exitSignal)=>{
    consume('stdout','',true);consume('stderr','',true);
    fail('CLOUDFLARE_AGENT_EXITED',{exitCode,exitSignal,diagnostic});
   });
   if(signal?.aborted)cancel();
  });
  if(closed||signal?.aborted)throw Error('TUNNEL_START_CANCELLED');
  return {url,done,close};
 }catch(error){await close();throw error;}
}
