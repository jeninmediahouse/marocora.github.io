// Server-only official SDK. Never imported by a frontend/build entry point.
import {AccessToken,RoomServiceClient,TrackSource,TokenVerifier} from 'livekit-server-sdk';
import {createHmac} from 'node:crypto';
import {DomainError} from './errors.mjs';
export function liveKitConfiguration(env={}){
 const url=env.LIVEKIT_URL,key=env.LIVEKIT_API_KEY,secret=env.LIVEKIT_API_SECRET;
 if(!url||!key||!secret)throw new DomainError('LIVEKIT_ENV_REQUIRED',503);
 let parsed;try{parsed=new URL(url);}catch{throw new DomainError('INVALID_LIVEKIT_URL',503);}
 if(parsed.protocol!=='wss:'||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/'||!parsed.hostname)throw new DomainError('INVALID_LIVEKIT_URL',503);
 if(typeof key!=='string'||!key.trim()||key!==key.trim()||typeof secret!=='string'||secret.length<32||secret!==secret.trim())throw new DomainError('INVALID_LIVEKIT_CREDENTIALS',503);
 return {url:parsed.origin,key,secret,httpUrl:parsed.origin.replace(/^wss:/,'https:')};
}
export function createLiveKitAdapter(env,{roomClient,log=console.log}={}){
 const config=liveKitConfiguration(env);
 const debug=env.LEARNING_VIDEO_DEBUG==='true';
 const client=roomClient||new RoomServiceClient(config.httpUrl,config.key,config.secret,{requestTimeout:5,failover:false});
 return {
  serverUrl:config.url,
  identitySecret:createHmac('sha256',config.secret).update('marocora-learning-room-identity-v1').digest(),
  async ensureRoom(name){
   try{const result=await client.createRoom({name,maxParticipants:2,emptyTimeout:60,departureTimeout:20});if(result.maxParticipants!==2)throw Error('ROOM_LIMIT_MISMATCH');}
   catch{throw new DomainError('LIVEKIT_ROOM_SETUP_FAILED',503);}
  },
  async sign({identity,role,bookingId,grants,ttl}){
   const token=new AccessToken(config.key,config.secret,{identity,ttl,metadata:JSON.stringify({bookingId,role,mock:false})});token.addGrant({...grants,canPublishSources:grants.canPublishSources.map(source=>({camera:TrackSource.CAMERA,microphone:TrackSource.MICROPHONE,screen_share:TrackSource.SCREEN_SHARE,screen_share_audio:TrackSource.SCREEN_SHARE_AUDIO})[source])});
   const jwt=await token.toJwt();
   if(debug){
    const claims=await new TokenVerifier(config.key,config.secret).verify(jwt),now=Math.floor(Date.now()/1000);
    log('LIVEKIT_TOKEN_DEBUG',JSON.stringify({claims,serverUrl:config.url,serverNow:now,serverNowISO:new Date(now*1000).toISOString(),nbfISO:new Date(claims.nbf*1000).toISOString(),expISO:new Date(claims.exp*1000).toISOString(),ttlSeconds:claims.exp-claims.nbf,issuerMatchesConfiguredKey:claims.iss===config.key,signatureVerifiedWithConfiguredSecret:true,notYetValid:claims.nbf>now,expired:claims.exp<=now}));
   }
   return jwt;
  },
  async remove(room,identity){
   try{await client.removeParticipant(room,identity);}
   catch(error){if(error?.code!=='not_found'&&error?.status!==404)throw new DomainError('LIVEKIT_RELEASE_PENDING',503);}
  }
 };
}
