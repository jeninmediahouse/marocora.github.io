import {startLearningRoomServer} from './learning-room-http.mjs';
import {openNgrokTunnel} from './ngrok-tunnel.mjs';
import {openCloudflareTunnel} from './cloudflare-tunnel.mjs';

export async function startLearningVideoLan({env=process.env,tunnel=true,openTunnel,startServer=startLearningRoomServer,log=console.log}={}){
 const provider=env.LEARNING_TUNNEL_PROVIDER||'cloudflare';
 if(!['cloudflare','ngrok'].includes(provider))throw Error('INVALID_TUNNEL_PROVIDER');
 const connectTunnel=openTunnel||(provider==='cloudflare'?openCloudflareTunnel:openNgrokTunnel);
 const controller=new AbortController();let app,agent,closing,stopping=false;
 const close=()=>closing??=(async()=>{
  stopping=true;controller.abort();
  process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
  try{await agent?.close();}finally{await app?.close();}
 })();
 const stop=()=>{void close().catch(()=>{process.exitCode=1;});};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{
  app=await startServer({mode:'live',env:{...env,LEARNING_VIDEO_MODE:'live',LEARNING_VIDEO_ENABLED:'true'},host:'0.0.0.0',port:Number(env.PORT||4195),handleSignals:false,printLinks:false,log});
  if(stopping){await app.close();throw Error('TUNNEL_START_CANCELLED');}
  if(tunnel){
   log('Opening '+(provider==='cloudflare'?'Cloudflare Quick Tunnel':'ngrok HTTPS tunnel')+'…');
   agent=await connectTunnel({port:app.server.address().port,signal:controller.signal,env});
   if(stopping){await agent.close();throw Error('TUNNEL_START_CANCELLED');}
   app.setPublicOrigin(agent.url);
   log('HTTPS_ORIGIN: '+agent.url);
   void agent.done.then(()=>{if(!stopping){log('Tunnel closed; stopping the learning server.');process.exitCode=1;void close();}});
  }else{
   app.useLanOrigin();log('NO TUNNEL: LAN HTTP only. Camera/microphone require HTTPS or localhost.');
  }
  app.printLinks();log('Use Student on one laptop and Teacher on the other. Ctrl-C stops server and tunnel.');
  return {app,close};
 }catch(error){await close();throw error;}
}
