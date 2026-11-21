import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createSupplyResendAdapter} from '../server/supply-resend.mjs';
import {supplyEmailBatch} from '../server/vendor-mail.mjs';
import {createSupplyMailDispatcher} from '../server/vendor-workflow.mjs';

const apiKey='SYNTHETIC_SUPPLY_KEY';
const fixture=()=>{
 const id=randomUUID();
 return {application:{id:randomUUID(),email:'owner@fixture.invalid',profile:'SYNTHETIC_PRIVATE_PROFILE'},
  event:{id,kind:'submitted',revision:1},claimToken:randomUUID(),idempotencyKey:'marocora-supply/'+id};
};
const response=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}});
const invoke=async(fetcher,options={})=>{
 const item=fixture();return createSupplyResendAdapter({apiKey,fetcher,...options})(supplyEmailBatch(item),{idempotencyKey:item.idempotencyKey});
};

test('supply Resend adapter requires injected transport and bounded private configuration',t=>{
 let implicit=0;t.mock.method(globalThis,'fetch',()=>{implicit++;throw Error('SYNTHETIC_IMPLICIT_FETCH');});
 for(const options of [{},{apiKey},{apiKey,fetcher:null},{apiKey:'',fetcher:async()=>{}},
  {apiKey:'SYNTHETIC\r\nKEY',fetcher:async()=>{}},...[-1,0,15001,1.5,NaN,Infinity,'15'].map(timeoutMs=>({apiKey,fetcher:async()=>{},timeoutMs})),
  {apiKey,fetcher:async()=>{},endpoint:'https://alternate.fixture.invalid'}]){
  assert.throws(()=>createSupplyResendAdapter(options),/SUPPLY_RESEND_ADAPTER_OPTIONS_REQUIRED/);
 }
 assert.equal(implicit,0);
});

test('supply Resend adapter sends one exact rendered message with fixed endpoint and stable header',async()=>{
 const item=fixture(),messages=supplyEmailBatch(item),before=JSON.stringify(messages),calls=[];
 const send=createSupplyResendAdapter({apiKey,fetcher:async(url,options)=>{calls.push({url,options});return response({id:randomUUID()});}});
 assert.deepEqual(await send(messages,{idempotencyKey:item.idempotencyKey}),{state:'sent'});
 assert.equal(calls.length,1);const {url,options}=calls[0];
 assert.equal(url,'https://api.resend.com/emails');assert.equal(options.method,'POST');
 assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
 assert.deepEqual(options.headers,{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':item.idempotencyKey});
 assert.equal(options.signal instanceof AbortSignal,true);
 assert.deepEqual(JSON.parse(options.body),messages[0]);assert.equal(JSON.stringify(messages),before);
 assert.equal(options.body.includes('SYNTHETIC_PRIVATE'),false);
});

test('supply Resend adapter rejects malformed routing and extra fields before any HTTP attempt',async()=>{
 let calls=0;const send=createSupplyResendAdapter({apiKey,fetcher:async()=>{calls++;return response({id:randomUUID()});}});
 const item=fixture(),valid=supplyEmailBatch(item),meta={idempotencyKey:item.idempotencyKey};
 for(const messages of [null,[],[valid[0],valid[0]],{},
  ...['cc','bcc','attachments','headers','tags','reply_to','toJSON'].map(k=>[{...valid[0],[k]:'SYNTHETIC_EXTRA'}]),
  ...['','Other <owner@fixture.invalid>'].map(from=>[{...valid[0],from}]),
  ...[[],['owner@fixture.invalid','other@fixture.invalid'],['bad\r\nBcc:other@fixture.invalid'],['owner@fixture.invalid\n'],['bad\0@fixture.invalid'],['owner@fixture.invalid,other@fixture.invalid'],[42]].map(to=>[{...valid[0],to}]),
  ...['','bad\nheader','a'.repeat(201),42].map(subject=>[{...valid[0],subject}]),
  [{...valid[0],text:''}],[{...valid[0],html:''}],[{...valid[0],text:'x'.repeat(16385)}],[{...valid[0],html:'x'.repeat(32769)}]]){
  assert.deepEqual(await send(messages,meta),{state:'failed'});
 }
 for(const m of [undefined,{},null,{idempotencyKey:'forged'},{idempotencyKey:item.idempotencyKey+'\n'},
  {idempotencyKey:item.idempotencyKey,endpoint:'SYNTHETIC_EXTRA'}])assert.deepEqual(await send(valid,m),{state:'failed'});
 let getter=0;const accessor={...valid[0]};Object.defineProperty(accessor,'text',{enumerable:true,get(){getter++;throw Error('SYNTHETIC_GETTER');}});
 assert.deepEqual(await send([accessor],meta),{state:'failed'});assert.equal(getter,0);assert.equal(calls,0);
});

test('supply Resend adapter maps only known permanent status and error pairs to failed',async()=>{
 for(const [status,names] of [[400,['invalid_idempotency_key','validation_error']],
  [401,['missing_api_key','restricted_api_key','validation_error']],
  [403,['invalid_permission','restricted_api_key','suspended_api_key','validation_error']],
  [422,['invalid_parameter','missing_required_field','missing_required_parameter','invalid_attachment']]]){
  for(const name of names){let calls=0;
   assert.deepEqual(await invoke(async()=>{calls++;return response({name,message:'SYNTHETIC_PRIVATE_PROVIDER_ERROR'},status);}),{state:'failed'});
   assert.equal(calls,1);
  }
 }
});

test('supply Resend adapter retries only explicit rate or quota nonacceptance without internal retries',async()=>{
 for(const name of ['rate_limit_exceeded','daily_quota_exceeded','monthly_quota_exceeded']){
  let calls=0;
  assert.deepEqual(await invoke(async()=>{calls++;return response({name,message:'SYNTHETIC_QUOTA'},429,{'Retry-After':'3600'});}),{state:'retry'});
  assert.equal(calls,1); // The adapter neither sleeps nor retries or claims a persisted cooldown.
 }
});

test('supply Resend adapter keeps unknown responses and idempotency conflicts uncertain',async()=>{
 for(const [status,data] of [[200,{}],[200,{id:'invalid'}],[200,{id:randomUUID()+'\n'}],[200,{id:randomUUID(),extra:'SYNTHETIC'}],
  [201,{id:randomUUID()}],[202,{id:randomUUID()}],[400,{name:'unknown'}],[401,{}],
  [403,{name:'rate_limit_exceeded'}],[429,{name:'unknown'}],[429,{}],
  [500,{name:'rate_limit_exceeded'}],[503,{name:'service_unavailable'}],
  [409,{name:'concurrent_idempotent_requests'}],[409,{name:'invalid_idempotent_request'}]]){
  let calls=0;assert.deepEqual(await invoke(async()=>{calls++;return response(data,status);}),{state:'uncertain'});assert.equal(calls,1);
 }
});

test('supply Resend adapter rejects redirects and never follows a second URL',async()=>{
 for(const status of [301,302,303,307,308]){
  let calls=0;assert.deepEqual(await invoke(async(url,options)=>{
   calls++;assert.equal(options.redirect,'error');return response({},status,{Location:'https://other.fixture.invalid'});
  }),{state:'uncertain'});assert.equal(calls,1);
 }
 const r=response({id:randomUUID()});Object.defineProperty(r,'redirected',{value:true});
 assert.deepEqual(await invoke(async()=>r),{state:'uncertain'});
});

test('supply Resend adapter bounds both declared and streamed response bytes',async()=>{
 for(const length of ['16385','999999999999999999999','invalid']){
  assert.deepEqual(await invoke(async()=>response({id:randomUUID()},200,{'Content-Length':length})),{state:'uncertain'});
 }
 let cancelled=0;
 const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(16385));},cancel(){cancelled++;}});
 assert.deepEqual(await invoke(async()=>new Response(body,{headers:{'Content-Type':'application/json'}})),{state:'uncertain'});
 assert.equal(cancelled,1);
 // Exactly the byte limit is accepted, including when split across chunks.
 const json=JSON.stringify({id:randomUUID()}).padEnd(16384,' '),bytes=new TextEncoder().encode(json);
 const chunks=new ReadableStream({start(c){c.enqueue(bytes.slice(0,16));c.enqueue(bytes.slice(16));c.close();}});
 assert.deepEqual(await invoke(async()=>new Response(chunks,{headers:{'Content-Type':'application/json'}})),{state:'sent'});
});

test('supply Resend adapter fails closed on malformed JSON, media types, UTF8 and stream errors',async()=>{
 for(const r of [new Response('{',{headers:{'Content-Type':'application/json'}}),
  new Response(JSON.stringify({id:randomUUID()})),
  new Response(new Uint8Array([255]),{headers:{'Content-Type':'application/json'}}),
  response(null),response([]),new Response(null,{status:204}),
  new Response(new ReadableStream({start(c){c.error(Error('SYNTHETIC_READ_FAILURE'));}}),{headers:{'Content-Type':'application/json'}})]){
  assert.deepEqual(await invoke(async()=>r),{state:'uncertain'});
 }
});

test('supply Resend adapter contains exceptions and never logs sensitive transport data',async t=>{
 const logs=[];for(const name of ['log','error','warn','info','debug','trace'])t.mock.method(console,name,(...args)=>logs.push(args));
 for(const fetcher of [async()=>{throw Error(apiKey+' owner@fixture.invalid SYNTHETIC_PRIVATE_BODY');},
  async()=>response({name:'validation_error',message:apiKey+' owner@fixture.invalid'},403),
  async()=>response({id:randomUUID()})]){
  const result=await invoke(fetcher);assert.deepEqual(Object.keys(result),['state']);
  assert.equal(JSON.stringify(result).includes('SYNTHETIC'),false);
 }
 assert.deepEqual(logs,[]);
});

test('supply Resend adapter times out and aborts even when fetch ignores its signal',async()=>{
 let signal,calls=0;
 const result=await invoke(async(url,options)=>{calls++;signal=options.signal;return new Promise(()=>{});},{timeoutMs:10});
 assert.deepEqual(result,{state:'uncertain'});assert.equal(signal.aborted,true);assert.equal(calls,1);
 let finish,cancelled=0;
 const late=invoke(async()=>new Promise(resolve=>{finish=resolve;}),{timeoutMs:10});
 assert.deepEqual(await late,{state:'uncertain'});
 finish(new Response(new ReadableStream({cancel(){cancelled++;}}),{headers:{'Content-Type':'application/json'}}));
 await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,1);
});

test('supply Resend adapter deadline includes stalled response consumption and cancels the reader',async()=>{
 let cancelled=0,signal;
 const body=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));},cancel(){cancelled++;}});
 assert.deepEqual(await invoke(async(url,options)=>{signal=options.signal;return new Response(body,{headers:{'Content-Type':'application/json'}});},{timeoutMs:10}),{state:'uncertain'});
 assert.equal(signal.aborted,true);assert.equal(cancelled,1);
});

test('supply Resend adapter preserves payload and key across separate safe retry invocations',async()=>{
 const calls=[],item=fixture(),messages=supplyEmailBatch(item);
 const send=createSupplyResendAdapter({apiKey,fetcher:async(url,options)=>{
  calls.push(options);return calls.length===1?response({name:'rate_limit_exceeded'},429):response({id:randomUUID()});
 }});
 assert.deepEqual(await send(messages,{idempotencyKey:item.idempotencyKey}),{state:'retry'});
 assert.equal(calls.length,1);
 assert.deepEqual(await send(messages,{idempotencyKey:item.idempotencyKey}),{state:'sent'});
 assert.equal(calls.length,2);assert.equal(calls[0].body,calls[1].body);
 assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);
});

test('supply Resend adapter plugs into existing dispatcher and fences completion without private projection leaks',async()=>{
 for(const expected of ['sent','retry','failed','uncertain']){
  const item=fixture(),calls=[];let claim=false,http=0;
  const sendMail=createSupplyResendAdapter({apiKey,fetcher:async(url,options)=>{
   http++;assert.equal(options.headers['Idempotency-Key'],item.idempotencyKey);
   assert.equal(options.body.includes('SYNTHETIC_PRIVATE'),false);assert.equal(options.body.includes(item.claimToken),false);
   return expected==='sent'?response({id:randomUUID()}):expected==='retry'?response({name:'rate_limit_exceeded'},429)
    :expected==='failed'?response({name:'validation_error'},400):response({},500);
  }});
  const dispatch=createSupplyMailDispatcher({sendMail,serviceRpc:async(name,args)=>{
   calls.push({name,args});if(name==='supply_mail_claim'){if(claim)return null;claim=true;return item;}
   assert.equal(args.p_claim,item.claimToken);assert.equal(args.p_event,item.event.id);assert.equal(args.p_result,expected);return expected;
  }});
  assert.deepEqual(await dispatch({applicationId:item.application.id,actorId:randomUUID()}),[{eventId:item.event.id,state:expected}]);
  assert.equal(http,1);assert.equal(calls.filter(c=>c.name==='supply_mail_finish').length,1);
 }
});
