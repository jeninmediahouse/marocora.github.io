import {createHash} from 'node:crypto';
import {createLearningRooms,learningRoomConfig} from './learning-room.mjs';
import {createLiveKitAdapter} from './livekit-adapter.mjs';
import {DomainError} from './errors.mjs';
const fail=(code,status=403)=>{throw new DomainError(code,status);};
const tokenHash=token=>typeof token==='string'?createHash('sha256').update(token).digest('hex'):'';
export function createConfiguredLearningRooms({marketplace,env={},adapter,clock=Date.now,cleanupIntervalMs=15000,resolveAccess}={}){
 const config=learningRoomConfig(env);
 if(config.mode==='mock')return createLearningRooms({marketplace,config,clock});
 if(config.mode!=='live')throw new DomainError('INVALID_VIDEO_MODE',503);
 const live=config.enabled?(adapter||createLiveKitAdapter(env)):null;
 const core=createLearningRooms({marketplace,config:{...config,mode:'mock'},clock,resolveAccess,...(live?{secret:Buffer.from(live.identitySecret)}:{})});
 const records=new Map(),pending=new Map();let reaping=false,closing=false;
 async function release(record){
  record.closing=true;await live.remove(record.roomName,record.identity);
  core.leave(record.actorId,{connectionId:record.connectionId});records.delete(record.connectionId);
  for(const [hash,p] of pending)if(p.connectionId===record.connectionId)pending.delete(hash);
 }
 async function reap(){
  if(reaping||!live)return;reaping=true;
  try{
   for(const [hash,p] of pending)if(p.expiresAt<=clock())pending.delete(hash);
   for(const record of records.values()){
    let valid=true;try{core.checkAccess(record.actorId,record.bookingId);}catch{valid=false;}
    if(record.closing||!valid||record.leaseExpiresAt<=clock()||record.sessionEndsAt<=clock())try{await release(record);}catch{/* retry on next sweep; no secrets logged */}
   }
  }finally{reaping=false;}
 }
 const timer=live&&cleanupIntervalMs>0?setInterval(()=>void reap(),cleanupIntervalMs):null;timer?.unref();
 return {
  getConfig(actor){core.getConfig(actor);return {enabled:config.enabled,transport:'live',mock:false};},
  async issue(actor,body){
   if(closing)fail('LEARNING_VIDEO_DISABLED',503);
   // Core authorization/gates, rate limits, budget and capacity precede a real JWT.
   const mock=core.issue(actor,body),claim=JSON.parse(Buffer.from(mock.token.split('.')[1],'base64url'));
   const lease=core.connect(actor,{bookingId:body.bookingId,token:mock.token});
   const record={...lease,actorId:actor,identity:mock.identity,leaseExpiresAt:Date.parse(lease.leaseExpiresAt),sessionEndsAt:Date.parse(lease.sessionEndsAt),closing:false};records.set(lease.connectionId,record);
   try{
    await live.ensureRoom(mock.roomName);core.checkAccess(actor,body.bookingId);
    const ttl=Math.min(120,Math.floor((Date.parse(mock.expiresAt)-clock())/1000));if(ttl<1)fail('ROOM_OUTSIDE_BOOKING_WINDOW',409);
    const token=await live.sign({identity:mock.identity,role:mock.role,bookingId:body.bookingId,grants:claim.video,ttl});
    core.checkAccess(actor,body.bookingId);
    pending.set(tokenHash(token),{connectionId:lease.connectionId,actor,bookingId:body.bookingId,expiresAt:Date.parse(mock.expiresAt)});
    return {...mock,token,mock:false,transport:'live',serverUrl:live.serverUrl,expiresAt:new Date(clock()+ttl*1000).toISOString(),connectionId:lease.connectionId,...(env.LEARNING_VIDEO_DEBUG==='true'?{debug:true}:{})};
   }catch(error){try{await release(record);}catch{}throw error instanceof DomainError?error:new DomainError('LIVEKIT_TOKEN_FAILED',503);}
  },
  connect(actor,body){
   if(!config.enabled)fail('LEARNING_VIDEO_DISABLED',503);
   if(!body||Object.keys(body).some(k=>!['bookingId','token'].includes(k)))fail('INVALID_ROOM_REQUEST',400);
   const hash=tokenHash(body.token),entry=pending.get(hash);if(!entry||entry.expiresAt<=clock())fail('LIVEKIT_TOKEN_INVALID',401);
   if(entry.actor!==actor||entry.bookingId!==body.bookingId)fail('ROOM_NOT_AVAILABLE');
   const record=records.get(entry.connectionId);if(!record||record.closing)fail('ROOM_CONNECTION_NOT_FOUND',404);
   core.checkAccess(actor,body.bookingId);const lease=core.heartbeat(actor,{connectionId:record.connectionId});record.leaseExpiresAt=Date.parse(lease.leaseExpiresAt);pending.delete(hash);return {...lease,mock:false,transport:'live'};
  },
  async heartbeat(actor,body){
   const record=records.get(body?.connectionId);if(record&&record.actorId!==actor)fail('ROOM_NOT_AVAILABLE');
   if(record?.closing)fail('ROOM_CONNECTION_NOT_FOUND',404);
   try{const lease=core.heartbeat(actor,body);if(!record)fail('ROOM_CONNECTION_NOT_FOUND',404);record.leaseExpiresAt=Date.parse(lease.leaseExpiresAt);return {...lease,mock:false,transport:'live'};}
   catch(error){if(record)try{await release(record);}catch{}throw error;}
  },
  async leave(actor,body){
   const record=records.get(body?.connectionId);if(record&&record.actorId!==actor)fail('ROOM_NOT_AVAILABLE');
   if(record)await release(record);else core.leave(actor,body);return {left:true,mock:false};
  },
  reap,
  async close(){closing=true;clearInterval(timer);for(const record of records.values())try{await release(record);}catch{}core.close();records.clear();pending.clear();}
 };
}
