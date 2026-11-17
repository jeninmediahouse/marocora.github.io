import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createLessonLogin,lessonURLAfterLogin} from '../learn/lesson-login.mjs';
const ticket='c'.repeat(64);

test('Query login waits for acknowledgement then removes only its ticket while preserving booking and language',async()=>{
 let href='https://lesson.example.invalid/learning-room.html?bookingId=synthetic&ticket='+ticket,complete,joined=false;const calls=[];
 const login=createLessonLogin({href,request:async(path,body)=>{calls.push([path,body]);await new Promise(resolve=>complete=resolve);},onAuthenticated:value=>{href='https://lesson.example.invalid'+lessonURLAfterLogin(href,value);}});
 const result=login.join({connect:id=>{joined=true;return id;}});
 href+='&lang=fr';await Promise.resolve();assert.equal(joined,false);assert.equal(new URL(href).searchParams.get('ticket'),ticket);
 complete();assert.equal(await result,'synthetic');assert.equal(joined,true);
 const clean=new URL(href);assert.equal(clean.searchParams.has('ticket'),false);assert.equal(clean.searchParams.get('bookingId'),'synthetic');assert.equal(clean.searchParams.get('lang'),'fr');
 assert.deepEqual(calls,[['/api/local/learning-login',{ticket}]]);
 assert.equal(lessonURLAfterLogin('https://lesson.example.invalid/?ticket='+'d'.repeat(64),ticket),null);
});
test('Failed query exchange retains the ticket for retry and never joins with a stale cookie',async()=>{
 const href='https://lesson.example.invalid/learning-room.html?bookingId=synthetic&ticket='+ticket;
 const login=createLessonLogin({href,request:async()=>{throw Error('INVALID_MOCK_TICKET');},onAuthenticated:()=>assert.fail('must not erase failed login')});
 await assert.rejects(login.join({connect:()=>assert.fail('must not join')}),/INVALID_MOCK_TICKET/);assert.equal(new URL(href).searchParams.get('ticket'),ticket);
});
test('Ambiguous or malformed query tickets fail closed; legacy fragment login remains unchanged',async()=>{
 for(const suffix of ['?ticket=','?ticket=bad','?ticket='+ticket+'&ticket='+ticket,'?ticket='+ticket+'#'+'d'.repeat(64)]){
  const login=createLessonLogin({href:'https://lesson.example.invalid/'+suffix,request:()=>assert.fail('invalid login must not reach API')});await assert.rejects(login.ready,/INVALID_MOCK_TICKET/);
 }
 const legacy=createLessonLogin({href:'https://lesson.example.invalid/?bookingId=legacy#'+ticket,request:async(path,body)=>{assert.deepEqual(body,{ticket});},onAuthenticated:()=>assert.fail('legacy fragment must remain')});
 assert.equal(await legacy.join({connect:id=>id}),'legacy');
});
test('A real local 302 preserving query but dropping fragments still authenticates the generated query format',async t=>{
 let submitted;
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/warning'){res.writeHead(302,{Location:'/learning-room.html'+url.search});res.end();return;}
  if(url.pathname==='/api/local/learning-login'){let body='';for await(const chunk of req)body+=chunk;submitted=JSON.parse(body);res.writeHead(200,{'Content-Type':'application/json'});res.end('{"mock":true}');return;}
  res.end('Synthetic learning page');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const origin='http://127.0.0.1:'+server.address().port;
 const response=await fetch(origin+'/warning?bookingId=synthetic&ticket='+ticket+'&lang=en');assert.equal(new URL(response.url).searchParams.get('ticket'),ticket);
 let cleaned;
 const login=createLessonLogin({href:response.url,request:async(path,body)=>{const result=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return result.json();},onAuthenticated:value=>cleaned=lessonURLAfterLogin(response.url,value)});
 assert.equal(await login.join({connect:id=>id}),'synthetic');assert.deepEqual(submitted,{ticket});assert.equal(cleaned,'/learning-room.html?bookingId=synthetic&lang=en');
});
