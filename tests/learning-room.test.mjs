import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createServer} from 'node:http';
import {createLearningRooms,learningRoomConfig,ROOM_DEFAULTS} from '../server/learning-room.mjs';
import {createLearningRoomFixture} from '../server/learning-room-fixture.mjs';
import {createApiHandler} from '../server/api.mjs';
import {MockLearningRoom} from '../learn/mock-learning-room.mjs';
const start=Date.parse('2026-11-16T12:00:00Z');
const error=code=>e=>e.message===code;
async function fixture(config={}){
 let now=start;const f=await createLearningRoomFixture({clock:()=>now});
 const secret=Buffer.from('SYNTHETIC_TEST_SECRET_32_BYTES_ONLY');
 const rooms=createLearningRooms({marketplace:f.marketplace,clock:()=>now,secret,config:{enabled:true,...config}});
 return {...f,rooms,secret,advance:ms=>{now+=ms;},close(){rooms.close();f.marketplace.close();}};
}
function claims(token){return JSON.parse(Buffer.from(token.split('.')[1],'base64url'));}

test('Learning video gates default OFF; configured cloud keys cannot enable a live transport',async t=>{
 assert.equal(ROOM_DEFAULTS.enabled,false);assert.equal(learningRoomConfig({}).enabled,false);
 assert.throws(()=>learningRoomConfig({LEARNING_VIDEO_ENABLED:'yes'}),error('INVALID_VIDEO_GATE'));
 const f=await fixture({enabled:false});t.after(()=>f.close());
 assert.throws(()=>f.rooms.issue(f.ids.student,{bookingId:f.bookingId}),error('LEARNING_VIDEO_DISABLED'));
 const live=createLearningRooms({marketplace:f.marketplace,config:{enabled:true,mode:'live'}});t.after(()=>live.close());
 assert.throws(()=>live.issue(f.ids.student,{bookingId:f.bookingId}),error('LIVEKIT_CLOUD_NOT_IMPLEMENTED'));
 const config=learningRoomConfig({LEARNING_VIDEO_ENABLED:'true',LIVEKIT_API_SECRET:'DUMMY_NEVER_USED',LIVEKIT_URL:'wss://cloud.invalid'});assert.equal(config.mode,'mock');assert.equal(config.LIVEKIT_API_SECRET,undefined);
});
test('Room JWT is signed server-side, short-lived, opaque, booking-bound and least-privilege by role',async t=>{
 const f=await fixture();t.after(()=>f.close());
 const student=f.rooms.issue(f.ids.student,{bookingId:f.bookingId}),teacher=f.rooms.issue(f.ids.teacher,{bookingId:f.bookingId});
 const a=claims(student.token),b=claims(teacher.token),parts=student.token.split('.');
 assert.equal(parts[2],createHmac('sha256',f.secret).update(parts[0]+'.'+parts[1]).digest('base64url'));
 assert.equal(a.exp-a.iat,120);assert.equal(a.aud,'marocora-learning-mock');assert.equal(a.mock,true);
 assert.equal(student.roomName,teacher.roomName);assert.notEqual(a.sub,b.sub);assert.ok(!a.sub.includes(f.ids.student));
 assert.equal(JSON.parse(a.metadata).bookingId,f.bookingId);assert.equal(JSON.parse(a.metadata).role,'student');assert.equal(teacher.role,'teacher');
 assert.deepEqual(a.video.canPublishSources,['camera','microphone']);assert.ok(b.video.canPublishSources.includes('screen_share'));
 for(const grants of [a.video,b.video]){assert.equal(grants.roomJoin,true);for(const flag of ['roomAdmin','roomCreate','roomRecord','canPublishData','canUpdateOwnMetadata'])assert.equal(grants[flag],false);}
 assert.equal(student.serverUrl,null);assert.ok(!JSON.stringify(student).includes(f.secret.toString()));
 const first=f.rooms.connect(f.ids.student,{bookingId:f.bookingId,token:student.token}),second=f.rooms.connect(f.ids.teacher,{bookingId:f.bookingId,token:teacher.token});assert.equal(first.roomName,second.roomName);assert.notEqual(first.connectionId,second.connectionId);
});
test('Stored booking ownership and organization membership exclude outsiders, other teachers and admins',async t=>{
 const f=await fixture();t.after(()=>f.close());
 for(const id of [f.ids.otherStudent,f.ids.otherTeacher,f.ids.admin])assert.throws(()=>f.rooms.issue(id,{bookingId:f.bookingId}),error('ROOM_NOT_AVAILABLE'));
 f.marketplace.run('DELETE FROM memberships WHERE account_id=?',f.ids.student);
 assert.throws(()=>f.rooms.issue(f.ids.student,{bookingId:f.bookingId}),error('ROOM_NOT_AVAILABLE'));
 f.marketplace.run('DELETE FROM memberships WHERE account_id=?',f.ids.teacher);
 assert.throws(()=>f.rooms.issue(f.ids.teacher,{bookingId:f.bookingId}),error('ROOM_NOT_AVAILABLE'));
});
test('Token requests refuse client-selected tenant, identity, role, room and permissions',async t=>{
 const f=await fixture();t.after(()=>f.close());
 for(const extra of [{role:'teacher'},{tenantId:f.ids.organization},{room:'foreign-room'},{identity:'teacher'},{grants:{roomAdmin:true}}])assert.throws(()=>f.rooms.issue(f.ids.student,{bookingId:f.bookingId,...extra}),error('INVALID_ROOM_REQUEST'));
 assert.throws(()=>f.rooms.issue(f.ids.student,{bookingId:'missing'}),error('ROOM_NOT_AVAILABLE'));
});
test('Only confirmed, active, online bookings within their join window can issue tokens',async t=>{
 const f=await fixture();t.after(()=>f.close());const issue=()=>f.rooms.issue(f.ids.student,{bookingId:f.bookingId});
 for(const state of ['held','expired','payment_failed','reconciliation','cancelled','completed']){f.marketplace.run('UPDATE bookings SET status=? WHERE id=?',state,f.bookingId);assert.throws(issue,error('BOOKING_NOT_CONFIRMED'));}
 f.marketplace.run("UPDATE bookings SET status='confirmed',offering_snapshot=? WHERE id=?",JSON.stringify({deliveryMode:'in_person'}),f.bookingId);assert.throws(issue,error('BOOKING_NOT_VIDEO_ELIGIBLE'));
 f.marketplace.run('UPDATE bookings SET offering_snapshot=?,starts_at=?,ends_at=? WHERE id=?',JSON.stringify({deliveryMode:'online'}),start+30*60000,start+75*60000,f.bookingId);assert.throws(issue,error('ROOM_OUTSIDE_BOOKING_WINDOW'));
 f.advance(20*60000);assert.equal(issue().mock,true);f.advance(65*60000);assert.throws(issue,error('ROOM_OUTSIDE_BOOKING_WINDOW'));
});
test('Expired, forged, cross-account and replayed mock tokens never establish a connection',async t=>{
 const f=await fixture();t.after(()=>f.close());const result=f.rooms.issue(f.ids.student,{bookingId:f.bookingId});
 const parts=result.token.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
 assert.throws(()=>f.rooms.connect(f.ids.student,{bookingId:f.bookingId,token:parts.join('.')}),error('MOCK_TOKEN_INVALID'));
 assert.throws(()=>f.rooms.connect(f.ids.teacher,{bookingId:f.bookingId,token:result.token}),error('ROOM_NOT_AVAILABLE'));
 const joined=f.rooms.connect(f.ids.student,{bookingId:f.bookingId,token:result.token});assert.equal(joined.role,'student');
 assert.throws(()=>f.rooms.leave(f.ids.teacher,{connectionId:joined.connectionId}),error('ROOM_NOT_AVAILABLE'));
 f.rooms.leave(f.ids.student,{connectionId:joined.connectionId});assert.throws(()=>f.rooms.connect(f.ids.student,{bookingId:f.bookingId,token:result.token}),error('MOCK_TOKEN_INVALID'));
 const expired=f.rooms.issue(f.ids.student,{bookingId:f.bookingId});f.advance(121000);assert.throws(()=>f.rooms.connect(f.ids.student,{bookingId:f.bookingId,token:expired.token}),error('MOCK_TOKEN_INVALID'));
});
test('Cancellation after token issuance and membership removal during a connection fail closed',async t=>{
 const f=await fixture();t.after(()=>f.close());const token=f.rooms.issue(f.ids.student,{bookingId:f.bookingId}).token;
 f.marketplace.run("UPDATE bookings SET status='cancelled' WHERE id=?",f.bookingId);assert.throws(()=>f.rooms.connect(f.ids.student,{bookingId:f.bookingId,token}),error('BOOKING_NOT_CONFIRMED'));
 f.marketplace.run("UPDATE bookings SET status='confirmed' WHERE id=?",f.bookingId);const joined=f.rooms.connect(f.ids.student,{bookingId:f.bookingId,token});
 f.marketplace.run('DELETE FROM memberships WHERE account_id=?',f.ids.student);assert.throws(()=>f.rooms.heartbeat(f.ids.student,{connectionId:joined.connectionId}),error('ROOM_NOT_AVAILABLE'));
 f.rooms.leave(f.ids.student,{connectionId:joined.connectionId});
});
test('Mock concurrency, minute budget, token rate limits and stale lease expiry are enforced',async t=>{
 const f=await fixture({maxConcurrentConnections:1});t.after(()=>f.close());
 const token=f.rooms.issue(f.ids.student,{bookingId:f.bookingId}).token;f.rooms.connect(f.ids.student,{bookingId:f.bookingId,token});
 const teacher=f.rooms.issue(f.ids.teacher,{bookingId:f.bookingId});assert.throws(()=>f.rooms.connect(f.ids.teacher,{bookingId:f.bookingId,token:teacher.token}),error('ROOM_CAPACITY_REACHED'));
 f.advance(91000);assert.equal(f.rooms.connect(f.ids.teacher,{bookingId:f.bookingId,token:teacher.token}).role,'teacher');
 for(let i=0;i<4;i++)f.rooms.issue(f.ids.student,{bookingId:f.bookingId});
 // Prior issue was in an earlier minute window; allow one more in this window.
 f.rooms.issue(f.ids.student,{bookingId:f.bookingId});assert.throws(()=>f.rooms.issue(f.ids.student,{bookingId:f.bookingId}),error('ROOM_TOKEN_RATE_LIMIT'));
 const tiny=await fixture({monthlyParticipantMinuteBudget:1});t.after(()=>tiny.close());const small=tiny.rooms.issue(tiny.ids.student,{bookingId:tiny.bookingId});assert.throws(()=>tiny.rooms.connect(tiny.ids.student,{bookingId:tiny.bookingId,token:small.token}),error('ROOM_MINUTE_BUDGET_REACHED'));
});
test('Mock frontend joins, toggles devices without media, heartbeats and leaves without persisting a token',async t=>{
 const f=await fixture();t.after(()=>f.close());const methods={'/api/learning/room-token':'issue','/api/learning/room-connect':'connect','/api/learning/room-heartbeat':'heartbeat','/api/learning/room-leave':'leave'};
 const room=new MockLearningRoom({request:async(path,body)=>f.rooms[methods[path]](f.ids.student,body)});
 await room.connect(f.bookingId);assert.equal(room.state,'connected');assert.equal(room.microphoneMuted,true);assert.equal(room.cameraEnabled,false);assert.equal(room.lease.token,undefined);
 room.toggleCamera();room.toggleMicrophone();assert.equal(room.cameraEnabled,true);assert.equal(room.microphoneMuted,false);
 await room.heartbeat();await room.leave();assert.equal(room.state,'disconnected');assert.equal(room.lease,null);assert.equal(room.cameraEnabled,false);assert.equal(room.microphoneMuted,true);
});
test('Actual HTTP room-token API enforces authentication, origin, JSON, booking role and no-store',async t=>{
 const f=await fixture();t.after(()=>f.close());let origin;
 const server=createServer((req,res)=>handler(req,res));let handler;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 handler=createApiHandler({marketplace:f.marketplace,learningRooms:f.rooms,origin,authenticate:req=>req.headers['x-test-session']||null});
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const call=(actor=f.ids.student,headers={},body={bookingId:f.bookingId})=>fetch(origin+'/api/learning/room-token',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(actor?{'x-test-session':actor}:{}),...headers},body:JSON.stringify(body)});
 assert.equal((await call(null)).status,401);assert.equal((await call(f.ids.student,{Origin:'https://outsider.invalid'})).status,403);assert.equal((await call(f.ids.student,{'Content-Type':'text/plain'})).status,415);
 assert.equal((await call(f.ids.otherStudent)).status,403);assert.equal((await call(f.ids.student,{}, {bookingId:f.bookingId,role:'teacher'})).status,400);
 const response=await call();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const body=await response.json();assert.equal(body.role,'student');assert.equal(body.mock,true);assert.ok(!JSON.stringify(body).includes('SYNTHETIC_TEST_SECRET'));
 assert.equal((await fetch(origin+'/api/learning/room-token')).status,404);
});

test('Local launcher serves required assets, denies devices and private files, and defaults video OFF',{timeout:15000},async t=>{
 const {spawn}=await import('node:child_process');
 const child=spawn(process.execPath,['server/start-learning-room.mjs','--port=0'],{env:{PATH:process.env.PATH},stdio:['ignore','pipe','pipe']});
 t.after(()=>new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('close',resolve);child.kill('SIGTERM');}));
 const studentURL=await new Promise((resolve,reject)=>{
  let output='';const timer=setTimeout(()=>reject(Error('MOCK_PREVIEW_START_TIMEOUT')),7000);
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('exit',code=>{clearTimeout(timer);reject(Error('MOCK_PREVIEW_EARLY_EXIT_'+code));});
  child.stdout.on('data',chunk=>{output+=chunk;const match=/student: (http[^\s]+)/.exec(output);if(match){clearTimeout(timer);resolve(new URL(match[1]));}});
 });
 const origin=studentURL.origin;
 for(const path of ['/learning-room.html','/learning-room.mjs','/learn/mock-learning-room.mjs','/site-language.mjs','/site-services.mjs','/learn/room-copy.mjs','/site-language.css']){
  const response=await fetch(origin+path);assert.equal(response.status,200,path);assert.match(response.headers.get('permissions-policy'),/camera=\(\), microphone=\(\)/);
 }
 for(const path of ['/server/learning-room.mjs','/.env','/tests/learning-room.test.mjs'])assert.equal((await fetch(origin+path)).status,404);
 const login=await fetch(origin+'/api/local/learning-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({ticket:studentURL.hash.slice(1)})});assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie');assert.match(cookie,/HttpOnly; SameSite=Strict/);
 const response=await fetch(origin+'/api/learning/room-token',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie.split(';')[0]},body:JSON.stringify({bookingId:studentURL.searchParams.get('bookingId')})});
 assert.equal(response.status,503);assert.equal((await response.json()).error,'LEARNING_VIDEO_DISABLED');
});
