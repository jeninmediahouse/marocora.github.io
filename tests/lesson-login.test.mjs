import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createLessonLogin} from '../learn/lesson-login.mjs';

test('Lesson login preserves fragment and booking across language URL updates; Join awaits cookie exchange',async()=>{
 const ticket='a'.repeat(64),url=new URL('http://127.0.0.1:4195/learning-room.html?bookingId=synthetic-booking#'+ticket),calls=[];
 let complete;
 const login=createLessonLogin({href:url.href,request:async(path,body)=>{calls.push([path,body]);await new Promise(resolve=>{complete=resolve;});}});
 url.searchParams.set('lang','en'); // Same operation as the language selector.
 let connected=false;
 const joined=login.join({async connect(bookingId){connected=true;assert.equal(bookingId,'synthetic-booking');return 'joined';}});
 await Promise.resolve();assert.equal(connected,false);
 assert.equal(url.hash,'#'+ticket);assert.equal(url.searchParams.get('lang'),'en');
 assert.deepEqual(calls,[['/api/local/learning-login',{ticket}]]);
 complete();assert.equal(await joined,'joined');assert.equal(connected,true);
 await login.join({async connect(){return 'rejoined';}});
 assert.equal(calls.length,1,'Joining must not replay the login ticket');
});

test('Failed ticket exchange preserves link and prevents any room API/SDK join',async()=>{
 const href='http://127.0.0.1:4195/learning-room.html?bookingId=synthetic#'+'b'.repeat(64);
 const login=createLessonLogin({href,request:async()=>{throw Error('INVALID_MOCK_TICKET');}});
 await assert.rejects(login.join({connect(){assert.fail('must not join with a stale cookie');}}),/INVALID_MOCK_TICKET/);
 assert.ok(new URL(href).hash);
});

test('Lesson without a fragment uses the existing authenticated cookie and sends no fabricated ticket',async()=>{
 const login=createLessonLogin({href:'http://127.0.0.1:4195/learning-room.html?bookingId=synthetic&lang=fr',request:()=>assert.fail('no ticket exchange expected')});
 assert.equal(await login.join({connect:id=>id}),'synthetic');
});

test('Real local HTTP ticket exchange survives reload only for its original session and authorizes the booking',{timeout:15000},async t=>{
 const child=spawn(process.execPath,['server/start-learning-room.mjs','--enable-local-video-mock','--port=0'],{env:{PATH:process.env.PATH},stdio:['ignore','pipe','pipe']});
 t.after(()=>new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('close',resolve);child.kill('SIGTERM');}));
 const links=await new Promise((resolve,reject)=>{
  let output='';const timer=setTimeout(()=>reject(Error('LOCAL_LESSON_START_TIMEOUT')),7000);
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('exit',()=>{clearTimeout(timer);reject(Error('LOCAL_LESSON_EARLY_EXIT'));});
  child.stdout.on('data',chunk=>{output+=chunk;const student=/student: (http[^\s]+)/.exec(output),outsider=/otherStudent: (http[^\s]+)/.exec(output);if(student&&outsider){clearTimeout(timer);resolve({student:new URL(student[1]),outsider:new URL(outsider[1])});}});
 });
 const origin=links.student.origin,ticket=links.student.hash.slice(1),bookingId=links.student.searchParams.get('bookingId');
 const post=(path,body,cookie)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 const initial=await post('/api/local/learning-login',{ticket});assert.equal(initial.status,200);
 const cookie=initial.headers.get('set-cookie').split(';')[0];
 const again=await post('/api/local/learning-login',{ticket},cookie);assert.equal(again.status,200);assert.equal(again.headers.get('set-cookie'),null);
 assert.equal((await post('/api/local/learning-login',{ticket})).status,401);
 const outsider=await post('/api/local/learning-login',{ticket:links.outsider.hash.slice(1)}),otherCookie=outsider.headers.get('set-cookie').split(';')[0];
 assert.equal((await post('/api/local/learning-login',{ticket},otherCookie)).status,401);
 const denied=await post('/api/learning/room-token',{bookingId},otherCookie);assert.equal(denied.status,403);assert.equal((await denied.json()).error,'ROOM_NOT_AVAILABLE');
 let storedCookie=cookie;
 const login=createLessonLogin({href:links.student.href,request:async(path,body)=>{const response=await post(path,body,storedCookie);assert.equal(response.status,200);return response.json();}});
 const roomToken=await login.join({async connect(id){const response=await post('/api/learning/room-token',{bookingId:id},storedCookie);assert.equal(response.status,200);return response.json();}});
 assert.equal(roomToken.role,'student');assert.equal(roomToken.bookingId,bookingId);
 const connected=await post('/api/learning/room-connect',{bookingId,token:roomToken.token},cookie);assert.equal(connected.status,200);
 for(const invalid of [null,{},'not-a-ticket'])assert.equal((await post('/api/local/learning-login',{ticket:invalid},cookie)).status,401);
 assert.equal((await fetch(origin+'/learn/lesson-login.mjs')).status,200);
 const html=await (await fetch(origin+'/learning-room.html')).text();assert.match(html,/id="join"[^>]*disabled/);
 const page=await (await fetch(origin+'/learning-room.mjs')).text();assert.match(page,/onAuthenticated:ticket=>/);assert.match(page,/lessonURLAfterLogin\(location.href,ticket\)/);assert.match(page,/await login.join/);
});
