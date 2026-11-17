// Local-only LiveKit-shaped token scaffold. No cloud SDK, keys or network calls.
import {createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {DomainError} from './errors.mjs';
export const SHIP_DESIGN=Object.freeze({monthlyPriceUSD:50,participantMinutes:150000,concurrentConnections:1000,downstreamGB:250,checked:'2026-11-16'});
export const ROOM_DEFAULTS=Object.freeze({enabled:false,mode:'mock',tokenTtlSeconds:120,maxParticipantsPerRoom:2,maxConcurrentConnections:20,maxSessionMinutes:60,monthlyParticipantMinuteBudget:30000,joinEarlyMinutes:10,joinLateMinutes:10});
const fail=(code,status=403)=>{throw new DomainError(code,status);};
const b64=data=>Buffer.from(typeof data==='string'?data:JSON.stringify(data)).toString('base64url');
const validInput=(body,keys)=>{if(!body||Object.getPrototypeOf(body)!==Object.prototype||Object.keys(body).some(k=>!keys.includes(k)))fail('INVALID_ROOM_REQUEST',400);};
export function learningRoomConfig(env={}){
 if(env.LEARNING_VIDEO_ENABLED&&!['true','false'].includes(env.LEARNING_VIDEO_ENABLED))fail('INVALID_VIDEO_GATE',503);
 return {...ROOM_DEFAULTS,enabled:env.LEARNING_VIDEO_ENABLED==='true',mode:env.LEARNING_VIDEO_MODE||'mock'};
}
export function createLearningRooms({marketplace,config={},clock=Date.now,secret=randomBytes(32),resolveAccess}={}){
 const settings={...ROOM_DEFAULTS,...config},issued=new Map(),leases=new Map(),budget=new Map(),rateLimits=new Map();
 if(!marketplace||!Buffer.isBuffer(secret)||secret.length<32)throw Error('ROOM_SERVICE_CONFIGURATION_REQUIRED');
 for(const [key,min,max] of [['tokenTtlSeconds',15,120],['maxConcurrentConnections',1,1000],['maxSessionMinutes',1,60],['monthlyParticipantMinuteBudget',1,150000],['joinEarlyMinutes',0,10],['joinLateMinutes',0,10]])if(!Number.isSafeInteger(settings[key])||settings[key]<min||settings[key]>max)throw Error('INVALID_ROOM_LIMIT');
 if(settings.maxParticipantsPerRoom!==2||typeof settings.enabled!=='boolean')throw Error('INVALID_ROOM_CONFIGURATION');
 const digest=value=>createHmac('sha256',secret).update(value).digest('hex');
 const gate=()=>{if(!settings.enabled)fail('LEARNING_VIDEO_DISABLED',503);if(settings.mode!=='mock')fail('LIVEKIT_CLOUD_NOT_IMPLEMENTED',503);};
 function sweep(){
  const now=clock();
  for(const [id,entry] of issued)if(entry.exp*1000<=now)issued.delete(id);
  for(const [id,lease] of leases)if(lease.leaseExpiresAt<=now||lease.sessionEndsAt<=now)leases.delete(id);
  for(const [key,entry] of rateLimits)if(entry.resetAt<=now)rateLimits.delete(key);
 }
 function authorize(actorId,bookingId){
  if(typeof bookingId!=='string'||bookingId.length>128||!bookingId.trim())fail('INVALID_BOOKING_ID',400);
  const access=resolveAccess?.(actorId,bookingId);
  if(resolveAccess&&!access)fail('ROOM_NOT_AVAILABLE');
  const actor=access?access.actor:marketplace.account(actorId);
  const b=access?access.booking:marketplace.one('SELECT b.*,i.account_id AS teacher_account,i.data AS teacher_data FROM bookings b JOIN instructors i ON i.id=b.instructor_id WHERE b.id=?',bookingId);
  if(!b||!(actor.role==='student'&&actor.id===b.student_id||actor.role==='instructor'&&actor.id===b.teacher_account))fail('ROOM_NOT_AVAILABLE');
  if(b.organization_id&&!(access?access.member:marketplace.one('SELECT 1 FROM memberships WHERE account_id=? AND organization_id=?',actor.id,b.organization_id)))fail('ROOM_NOT_AVAILABLE');
  if(b.status!=='confirmed')fail('BOOKING_NOT_CONFIRMED',409);
  let offering,teacher;try{offering=JSON.parse(b.offering_snapshot);teacher=JSON.parse(b.teacher_data);}catch{fail('BOOKING_NOT_VIDEO_ELIGIBLE',409);}
  if(offering.deliveryMode!=='online'||teacher.status!=='active')fail('BOOKING_NOT_VIDEO_ELIGIBLE',409);
  const now=clock(),windowEnd=b.ends_at+settings.joinLateMinutes*60000;
  if(now<b.starts_at-settings.joinEarlyMinutes*60000||now>=windowEnd)fail('ROOM_OUTSIDE_BOOKING_WINDOW',409);
  const tenant=b.organization_id?'organization:'+b.organization_id:'personal:'+b.student_id;
  return {booking:b,role:actor.role==='instructor'?'teacher':'student',room:'lesson-'+digest(tenant+'|'+b.id).slice(0,32),identity:'participant-'+digest(tenant+'|'+actor.id).slice(0,32),windowEnd};
 }
 function verify(token){
  try{
   if(typeof token!=='string'||token.length>16000)throw Error();
   const parts=token.split('.');if(parts.length!==3)throw Error();
   const expected=createHmac('sha256',secret).update(parts[0]+'.'+parts[1]).digest(),signature=Buffer.from(parts[2],'base64url');
   if(signature.length!==expected.length||!timingSafeEqual(signature,expected))throw Error();
   const header=JSON.parse(Buffer.from(parts[0],'base64url')),claims=JSON.parse(Buffer.from(parts[1],'base64url'));
   if(header.alg!=='HS256'||header.typ!=='JWT'||claims.aud!=='marocora-learning-mock'||claims.iss!=='marocora-mock-issuer'||claims.mock!==true||claims.exp*1000<=clock()||claims.nbf*1000>clock())throw Error();
   const entry=issued.get(claims.jti);if(!entry||entry.token!==token)throw Error();return {entry,claims};
  }catch{fail('MOCK_TOKEN_INVALID',401);}
 }
 const service={
  getConfig(actorId){marketplace.account(actorId);return {enabled:settings.enabled,transport:settings.mode,mock:settings.mode==='mock'};},
  checkAccess(actorId,bookingId){gate();return authorize(actorId,bookingId);},
  issue(actorId,body){
   gate();sweep();validInput(body,['bookingId']);const context=authorize(actorId,body.bookingId);
   const limit=rateLimits.get(actorId)||{count:0,resetAt:clock()+60000};
   if(limit.count>=5)fail('ROOM_TOKEN_RATE_LIMIT',429);limit.count++;rateLimits.set(actorId,limit);
   const now=Math.floor(clock()/1000),exp=Math.min(now+settings.tokenTtlSeconds,Math.floor(context.windowEnd/1000)),jti=randomUUID();
   if(exp<=now)fail('ROOM_OUTSIDE_BOOKING_WINDOW',409);
   const video={roomJoin:true,room:context.room,canPublish:true,canSubscribe:true,canPublishData:false,canUpdateOwnMetadata:false,roomAdmin:false,roomCreate:false,roomRecord:false,canPublishSources:context.role==='teacher'?['camera','microphone','screen_share','screen_share_audio']:['camera','microphone']};
   const claims={iss:'marocora-mock-issuer',aud:'marocora-learning-mock',sub:context.identity,nbf:now,iat:now,exp,jti,mock:true,video,metadata:JSON.stringify({bookingId:body.bookingId,role:context.role,mock:true})};
   const unsigned=b64({alg:'HS256',typ:'JWT'})+'.'+b64(claims),token=unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url');
   issued.set(jti,{token,actorId,bookingId:body.bookingId,exp});
   return {token,expiresAt:new Date(exp*1000).toISOString(),bookingId:body.bookingId,role:context.role,roomName:context.room,identity:context.identity,transport:'mock',serverUrl:null,mock:true,media:{width:1280,height:720,frameRate:15,maxVideoBitrate:800000,maxAudioBitrate:48000}};
  },
  connect(actorId,body){
   gate();sweep();validInput(body,['bookingId','token']);const context=authorize(actorId,body.bookingId),{entry}=verify(body.token);
   if(entry.actorId!==actorId||entry.bookingId!==body.bookingId)fail('ROOM_NOT_AVAILABLE');
   if([...leases.values()].some(l=>l.actorId===actorId&&l.bookingId===body.bookingId))fail('ROOM_ALREADY_CONNECTED',409);
   if(leases.size>=settings.maxConcurrentConnections)fail('ROOM_CAPACITY_REACHED',429);
   if([...leases.values()].filter(l=>l.roomName===context.room).length>=2)fail('ROOM_FULL',409);
   const sessionEndsAt=Math.min(context.windowEnd,clock()+settings.maxSessionMinutes*60000),reserve=Math.ceil((sessionEndsAt-clock())/60000),month=new Date(clock()).toISOString().slice(0,7),used=budget.get(month)||0;
   if(used+reserve>settings.monthlyParticipantMinuteBudget)fail('ROOM_MINUTE_BUDGET_REACHED',429);
   const lease={connectionId:randomUUID(),actorId,bookingId:body.bookingId,role:context.role,roomName:context.room,sessionEndsAt,leaseExpiresAt:Math.min(sessionEndsAt,clock()+90000)};
   leases.set(lease.connectionId,lease);budget.set(month,used+reserve);
   // A redeemed token cannot be replayed after leaving or in a second tab.
   for(const [jti,e] of issued)if(e.token===body.token)issued.delete(jti);
   return publicLease(lease);
  },
  heartbeat(actorId,body){
   gate();sweep();validInput(body,['connectionId']);const lease=leases.get(body.connectionId);
   if(!lease||lease.actorId!==actorId)fail('ROOM_CONNECTION_NOT_FOUND',404);
   authorize(actorId,lease.bookingId);lease.leaseExpiresAt=Math.min(lease.sessionEndsAt,clock()+90000);return publicLease(lease);
  },
  leave(actorId,body){
   validInput(body,['connectionId']);const lease=leases.get(body.connectionId);
   if(lease&&lease.actorId!==actorId)fail('ROOM_NOT_AVAILABLE');
   leases.delete(body.connectionId);return {left:true,mock:true};
  },
  close(){issued.clear();leases.clear();budget.clear();rateLimits.clear();secret.fill(0);}
 };
 return service;
}
function publicLease(lease){return {connectionId:lease.connectionId,bookingId:lease.bookingId,role:lease.role,roomName:lease.roomName,sessionEndsAt:new Date(lease.sessionEndsAt).toISOString(),leaseExpiresAt:new Date(lease.leaseExpiresAt).toISOString(),transport:'mock',mock:true};}
