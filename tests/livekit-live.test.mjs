import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {TokenVerifier} from 'livekit-server-sdk';
import {createLiveKitAdapter,liveKitConfiguration} from '../server/livekit-adapter.mjs';
import {createConfiguredLearningRooms} from '../server/live-learning-room.mjs';
import {createLearningRoomFixture} from '../server/learning-room-fixture.mjs';
import {LiveLearningRoom} from '../learn/live-learning-room.mjs';
import {LearningRoomSession} from '../learn/learning-room-session.mjs';
const env={LEARNING_VIDEO_ENABLED:'true',LEARNING_VIDEO_MODE:'live',LIVEKIT_URL:'wss://synthetic.livekit.cloud',LIVEKIT_API_KEY:'SYNTHETIC_API_KEY',LIVEKIT_API_SECRET:'SYNTHETIC_SERVER_SECRET_NOT_REAL_0123456789'};
const code=expected=>error=>error.message===expected;
async function fixture(){
 let now=Date.now();const f=await createLearningRoomFixture({clock:()=>now}),calls=[];
 const roomClient={async createRoom(input){calls.push(['create',input]);return {maxParticipants:2};},async removeParticipant(...args){calls.push(['remove',...args]);}};
 const adapter=createLiveKitAdapter(env,{roomClient});const rooms=createConfiguredLearningRooms({marketplace:f.marketplace,env,adapter,clock:()=>now,cleanupIntervalMs:100000});
 return {...f,rooms,calls,roomClient,advance:ms=>{now+=ms;},async close(){await rooms.close();f.marketplace.close();}};
}
test('Live configuration validates WSS server URL and credentials; OFF requires no keys or SDK calls',async t=>{
 for(const extra of [{LIVEKIT_URL:'https://bad.invalid'},{LIVEKIT_URL:'wss://user:secret@bad.invalid'},{LIVEKIT_URL:'wss://bad.invalid/path'},{LIVEKIT_API_SECRET:'short'},{LIVEKIT_API_KEY:''}])assert.throws(()=>liveKitConfiguration({...env,...extra}));
 const f=await createLearningRoomFixture();t.after(()=>f.marketplace.close());const rooms=createConfiguredLearningRooms({marketplace:f.marketplace,env:{LEARNING_VIDEO_MODE:'live'}});t.after(()=>rooms.close());
 assert.deepEqual(rooms.getConfig(f.ids.student),{enabled:false,transport:'live',mock:false});await assert.rejects(rooms.issue(f.ids.student,{bookingId:f.bookingId}),code('LEARNING_VIDEO_DISABLED'));
});
test('Real official-SDK JWTs verify offline and preserve student/teacher booking-scoped grants',async t=>{
 const f=await fixture();t.after(()=>f.close());const verifier=new TokenVerifier(env.LIVEKIT_API_KEY,env.LIVEKIT_API_SECRET);
 const student=await f.rooms.issue(f.ids.student,{bookingId:f.bookingId}),teacher=await f.rooms.issue(f.ids.teacher,{bookingId:f.bookingId});
 const a=await verifier.verify(student.token),b=await verifier.verify(teacher.token);
 assert.equal(a.iss,env.LIVEKIT_API_KEY);assert.equal(a.video.room,student.roomName);assert.equal(a.video.room,teacher.roomName);assert.equal(a.video.roomJoin,true);
 assert.equal(a.sub,student.identity);assert.ok(a.exp-a.nbf<=120&&a.exp-a.nbf>0);assert.equal(JSON.parse(a.metadata).mock,false);assert.equal(JSON.parse(a.metadata).role,'student');
 assert.deepEqual(a.video.canPublishSources,['camera','microphone']);assert.ok(b.video.canPublishSources.includes('screen_share'));
 for(const token of [a,b])for(const flag of ['roomAdmin','roomCreate','roomRecord','canPublishData','canUpdateOwnMetadata'])assert.equal(token.video[flag],false);
 assert.equal(student.mock,false);assert.equal(student.transport,'live');assert.equal(student.serverUrl,env.LIVEKIT_URL);assert.ok(!JSON.stringify(student).includes(env.LIVEKIT_API_SECRET));
 assert.ok(f.calls.filter(c=>c[0]==='create').every(c=>c[1].maxParticipants===2));
});
test('Live token issuance denies foreign accounts, removed memberships and client-selected grants',async t=>{
 const f=await fixture();t.after(()=>f.close());
 await assert.rejects(f.rooms.issue(f.ids.otherStudent,{bookingId:f.bookingId}),code('ROOM_NOT_AVAILABLE'));
 await assert.rejects(f.rooms.issue(f.ids.student,{bookingId:f.bookingId,role:'teacher'}),code('INVALID_ROOM_REQUEST'));
 f.marketplace.run('DELETE FROM memberships WHERE account_id=?',f.ids.teacher);await assert.rejects(f.rooms.issue(f.ids.teacher,{bookingId:f.bookingId}),code('ROOM_NOT_AVAILABLE'));
 assert.equal(f.calls.length,0);
});
test('Live admission is reserved before JWT issuance; token binding, replay and leave revocation are enforced',async t=>{
 const f=await fixture();t.after(()=>f.close());const result=await f.rooms.issue(f.ids.student,{bookingId:f.bookingId});
 assert.throws(()=>f.rooms.connect(f.ids.teacher,{bookingId:f.bookingId,token:result.token}),code('ROOM_NOT_AVAILABLE'));
 assert.throws(()=>f.rooms.connect(f.ids.student,{bookingId:f.bookingId,token:result.token+'broken'}),code('LIVEKIT_TOKEN_INVALID'));
 const lease=f.rooms.connect(f.ids.student,{bookingId:f.bookingId,token:result.token});assert.equal(lease.transport,'live');assert.equal(lease.connectionId,result.connectionId);
 assert.throws(()=>f.rooms.connect(f.ids.student,{bookingId:f.bookingId,token:result.token}),code('LIVEKIT_TOKEN_INVALID'));
 await assert.rejects(f.rooms.leave(f.ids.teacher,{connectionId:lease.connectionId}),code('ROOM_NOT_AVAILABLE'));
 await f.rooms.leave(f.ids.student,{connectionId:lease.connectionId});assert.ok(f.calls.some(c=>c[0]==='remove'&&c[1]===result.roomName&&c[2]===result.identity));
});
test('Live cleanup removes cancelled or stale participants and never silently accepts a larger room',async t=>{
 const f=await fixture();t.after(()=>f.close());let result=await f.rooms.issue(f.ids.student,{bookingId:f.bookingId});f.rooms.connect(f.ids.student,{bookingId:f.bookingId,token:result.token});
 f.marketplace.run("UPDATE bookings SET status='cancelled' WHERE id=?",f.bookingId);await f.rooms.reap();assert.ok(f.calls.some(c=>c[0]==='remove'));
 f.marketplace.run("UPDATE bookings SET status='confirmed' WHERE id=?",f.bookingId);result=await f.rooms.issue(f.ids.student,{bookingId:f.bookingId});f.advance(91000);await f.rooms.reap();assert.ok(f.calls.filter(c=>c[0]==='remove').length>=2);
 f.roomClient.createRoom=async()=>({maxParticipants:10});await assert.rejects(f.rooms.issue(f.ids.teacher,{bookingId:f.bookingId}),code('LIVEKIT_ROOM_SETUP_FAILED'));
});
function fakeSDK({connectFailure=false,publishFailure=false,captureFailure=false}={}){
 const events={TrackSubscribed:'remote',TrackUnsubscribed:'remove',LocalTrackPublished:'local',LocalTrackUnpublished:'unlocal',Disconnected:'disconnected',Reconnecting:'reconnecting',Reconnected:'reconnected',AudioPlaybackStatusChanged:'audio',TrackMuted:'muted',TrackUnmuted:'unmuted'},calls=[],tracks=['audio','video'].map(kind=>({kind,stopped:0,stop(){this.stopped++;},detach(){return [];}}));let instance;
 class Room extends EventEmitter{
  constructor(){super();instance=this;this.canPlaybackAudio=true;this.localParticipant={trackPublications:new Map(),publishTrack:async track=>{calls.push('publish:'+track.kind);if(publishFailure)throw Error('publish failed');this.localParticipant.trackPublications.set(track.kind,{track});this.emit('local',{track});},setMicrophoneEnabled:async value=>calls.push('mic:'+value),setCameraEnabled:async value=>calls.push('camera:'+value)};}
  async connect(url,token){calls.push('connect');if(connectFailure)throw Error('connection failed');}
  async disconnect(){calls.push('disconnect');this.emit('disconnected');}
  async startAudio(){calls.push('audio');}
 }
 return {sdk:{Room,RoomEvent:events,createLocalTracks:async()=>{calls.push('capture');if(captureFailure)throw Object.assign(Error('Permission denied'),{name:'NotAllowedError'});return tracks;}},calls,tracks,get room(){return instance;}};
}
function frontendRequest(calls){return async(path,body)=>{
 calls.push(path);
 if(path.endsWith('/room-token'))return {token:'SYNTHETIC_SIGNED_TOKEN',serverUrl:'wss://synthetic.livekit.cloud',mock:false,transport:'live',connectionId:'reserved',media:{width:1280,height:720,frameRate:15,maxVideoBitrate:800000,maxAudioBitrate:48000}};
 if(path.endsWith('/room-connect')||path.endsWith('/room-heartbeat'))return {connectionId:'reserved',transport:'live',mock:false};
 return {left:true};
};}
test('Real client adapter connects before capture, publishes tracks, displays remote events, toggles and stops on leave',async()=>{
 const f=fakeSDK(),requests=[],announced=[];const room=new LiveLearningRoom({request:frontendRequest(requests),sdk:f.sdk,onTrack:event=>announced.push(event)});
 await room.connect('booking');assert.ok(f.calls.indexOf('connect')<f.calls.indexOf('capture'));assert.equal(room.cameraEnabled,true);assert.equal(room.microphoneMuted,false);assert.equal(f.calls.filter(c=>c.startsWith('publish:')).length,2);
 const remote={kind:'video',detach:()=>[]};f.room.emit('remote',remote,{},{});assert.ok(announced.some(e=>e.track===remote&&!e.local));
 await room.toggleCamera();await room.toggleMicrophone();assert.equal(room.cameraEnabled,false);assert.equal(room.microphoneMuted,true);await room.startAudio();await room.leave();
 assert.ok(f.tracks.every(track=>track.stopped>=1));assert.ok(f.calls.includes('disconnect'));assert.ok(requests.includes('/api/learning/room-leave'));assert.equal(room.lease,null);assert.equal(room.state,'disconnected');
});
for(const failure of ['connectFailure','captureFailure','publishFailure'])test('Live client '+failure+' releases admission and leaves no active local tracks',async()=>{
 const f=fakeSDK({[failure]:true}),requests=[];const room=new LiveLearningRoom({request:frontendRequest(requests),sdk:f.sdk});
 await assert.rejects(room.connect('booking'));assert.equal(room.state,'disconnected');assert.equal(room.lease,null);assert.ok(requests.includes('/api/learning/room-leave'));assert.ok(f.calls.includes('disconnect'));
 if(failure==='publishFailure')assert.ok(f.tracks.every(track=>track.stopped>=1));if(failure==='connectFailure')assert.ok(!f.calls.includes('capture'));
});
test('OFF frontend gate does not load the live SDK or touch devices',async()=>{
 let loads=0;const session=new LearningRoomSession({request:async()=>({enabled:false,transport:'live'}),loadLive:async()=>{loads++;throw Error('MUST_NOT_LOAD');}});
 await assert.rejects(session.connect('booking'),code('LEARNING_VIDEO_DISABLED'));assert.equal(loads,0);assert.equal(session.state,'disconnected');
});
