import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {TokenVerifier} from 'livekit-server-sdk';
import {ConnectionError} from 'livekit-client';
import {createLiveKitAdapter,liveKitConfiguration} from '../server/livekit-adapter.mjs';
import {createConfiguredLearningRooms} from '../server/live-learning-room.mjs';
import {createLearningRoomFixture} from '../server/learning-room-fixture.mjs';
import {LiveLearningRoom} from '../learn/live-learning-room.mjs';
import {liveKitErrorSnapshot} from '../learn/livekit-diagnostics.mjs';
const env={LEARNING_VIDEO_ENABLED:'true',LEARNING_VIDEO_MODE:'live',LEARNING_VIDEO_DEBUG:'true',LIVEKIT_URL:'wss://synthetic.livekit.cloud/',LIVEKIT_API_KEY:'SYNTHETIC_ISSUER',LIVEKIT_API_SECRET:'SYNTHETIC_SECRET_NOT_REAL_0123456789'};
test('Auth diagnostics verify runtime issuer/secret and token times, return exact WSS URL, never log JWT/secret',async t=>{
 const logs=[],fixture=await createLearningRoomFixture();t.after(()=>fixture.marketplace.close());
 const roomClient={createRoom:async()=>({maxParticipants:2}),removeParticipant:async()=>{}};
 const adapter=createLiveKitAdapter(env,{roomClient,log:(...args)=>logs.push(args)}),rooms=createConfiguredLearningRooms({marketplace:fixture.marketplace,env,adapter});t.after(()=>rooms.close());
 const response=await rooms.issue(fixture.ids.student,{bookingId:fixture.bookingId}),details=JSON.parse(logs[0][1]);
 assert.equal(logs[0][0],'LIVEKIT_TOKEN_DEBUG');assert.equal(details.claims.iss,env.LIVEKIT_API_KEY);assert.equal(details.issuerMatchesConfiguredKey,true);assert.equal(details.signatureVerifiedWithConfiguredSecret,true);
 assert.ok(details.claims.nbf<=details.serverNow);assert.ok(details.claims.exp>details.serverNow);assert.ok(details.ttlSeconds>0&&details.ttlSeconds<=120);assert.equal(details.notYetValid,false);assert.equal(details.expired,false);
 assert.equal(details.serverUrl,'wss://synthetic.livekit.cloud');assert.equal(response.serverUrl,details.serverUrl);assert.equal(response.debug,true);
 assert.ok(!JSON.stringify(logs).includes(response.token));assert.ok(!JSON.stringify(logs).includes(env.LIVEKIT_API_SECRET));
 await new TokenVerifier(env.LIVEKIT_API_KEY,env.LIVEKIT_API_SECRET).verify(response.token);
 await assert.rejects(new TokenVerifier(env.LIVEKIT_API_KEY,'WRONG_SYNTHETIC_SECRET_01234567890123').verify(response.token));
 await assert.rejects(new TokenVerifier('WRONG_ISSUER',env.LIVEKIT_API_SECRET).verify(response.token));
 for(const extra of [{LIVEKIT_API_KEY:' '+env.LIVEKIT_API_KEY},{LIVEKIT_API_SECRET:env.LIVEKIT_API_SECRET+' '}])assert.throws(()=>liveKitConfiguration({...env,...extra}),/INVALID_LIVEKIT_CREDENTIALS/);
 const quiet=createLiveKitAdapter({...env,LEARNING_VIDEO_DEBUG:'false'},{roomClient,log:()=>assert.fail('must remain silent')});
 await quiet.sign({identity:'synthetic',role:'student',bookingId:'synthetic',ttl:30,grants:{roomJoin:true,room:'synthetic',canPublishSources:['camera']}});
});
test('Full ConnectionError snapshot includes non-enumerable fields/status/cause while redacting credentials and cycles',()=>{
 const token='eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJTWU5USEVUSUMifQ.synthetic-signature';
 const error=ConnectionError.notAllowed('Unauthorized Bearer '+token,401,{token,url:'https://synthetic.livekit.cloud/settings/regions?access_token='+token,authorization:'Bearer '+token});
 error.cause=Error('nested '+token);error.context.loop=error;
 const snapshot=liveKitErrorSnapshot(error,{token});
 assert.equal(snapshot.name,'ConnectionError');assert.equal(snapshot.status,401);assert.equal(snapshot.reason,0);assert.ok(snapshot.reasonName);assert.ok(snapshot.stack);assert.ok(snapshot.cause.message);
 assert.equal(snapshot.context.token,'[REDACTED]');assert.equal(snapshot.context.authorization,'[REDACTED]');assert.equal(snapshot.context.loop,'[CIRCULAR]');assert.ok(!JSON.stringify(snapshot).includes(token));
 assert.equal(error.context.token,token,'must not mutate the original SDK error');
});
test('room.connect failure logs requested diagnostics and exact URL, then cleans up without capturing devices',async()=>{
 const token='eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJTWU5USEVUSUMifQ.synthetic-signature',logs=[],requests=[];
 class Room extends EventEmitter{
  constructor(){super();this.localParticipant={trackPublications:new Map()};}
  async connect(url,actual){assert.equal(url,'wss://synthetic.livekit.cloud');assert.equal(actual,token);throw ConnectionError.notAllowed('Could not fetch region settings',401,{accessToken:actual});}
  async disconnect(){}
 }
 const request=async(path,body)=>{requests.push(path);if(path.endsWith('/room-token'))return {token,serverUrl:'wss://synthetic.livekit.cloud',debug:true,transport:'live',mock:false,connectionId:'synthetic'};return {connectionId:'synthetic'};};
 const room=new LiveLearningRoom({request,log:(...args)=>logs.push(args),sdk:{Room,RoomEvent:{},createLocalTracks:()=>assert.fail('must not capture after 401')}});
 await assert.rejects(room.connect('synthetic'),error=>error.status===401);
 assert.equal(logs[0][0],'LIVEKIT_CONNECTION_ERROR');assert.equal(logs[0][1].status,401);assert.deepEqual(logs[0][2],{serverUrl:'wss://synthetic.livekit.cloud'});assert.ok(!JSON.stringify(logs).includes(token));
 assert.equal(room.state,'disconnected');assert.equal(room.lease,null);assert.ok(requests.includes('/api/learning/room-leave'));
});
