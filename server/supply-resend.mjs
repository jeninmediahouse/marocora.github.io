// Isolated supply adapter. No environment lookup, implicit fetch, logging or wiring.
// Contract sources: https://resend.com/docs/api-reference/emails/send-email
// and https://resend.com/docs/api-reference/errors
const endpoint='https://api.resend.com/emails';
const sender='Marocora <no-reply@auth.marocora.com>';
const keyPrefix='marocora-supply/';
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const eventKey=new RegExp('^marocora-supply/'+uuid+'$','i');
const providerId=new RegExp('^'+uuid+'$','i');
const maxResponseBytes=16384;
const permanent=new Map([
 [400,new Set(['invalid_idempotency_key','validation_error'])],
 [401,new Set(['missing_api_key','restricted_api_key','validation_error'])],
 [403,new Set(['invalid_permission','restricted_api_key','suspended_api_key','validation_error'])],
 [422,new Set(['invalid_parameter','missing_required_field','missing_required_parameter','invalid_attachment'])]
]);
const rejectedTemporarily=new Set(['rate_limit_exceeded','daily_quota_exceeded','monthly_quota_exceeded']);

// Reject accessors/toJSON and extra fields before serializing the trusted renderer output.
function record(value,keys){
 return value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype
  &&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>{
   const d=Object.getOwnPropertyDescriptor(value,key);return d&&Object.hasOwn(d,'value')&&d.enumerable;
  });
}
function single(value){
 return Array.isArray(value)&&value.length===1&&Reflect.ownKeys(value).length===2
  &&Object.hasOwn(Object.getOwnPropertyDescriptor(value,'0')||{},'value');
}
function payload(messages,meta){
 if(!record(meta,['idempotencyKey'])||typeof meta.idempotencyKey!=='string'||!meta.idempotencyKey.startsWith(keyPrefix)
  ||meta.idempotencyKey.length!==keyPrefix.length+36||!eventKey.test(meta.idempotencyKey)
  ||!single(messages))return null;
 const m=messages[0];
 if(!record(m,['from','to','subject','text','html'])||m.from!==sender||!single(m.to)
  ||typeof m.to[0]!=='string'||m.to[0].length>320||/[\s\x00-\x1f\x7f]/.test(m.to[0])||!/^[^\s<>@,;]+@[^\s<>@,;]+$/.test(m.to[0])
  ||typeof m.subject!=='string'||!m.subject.length||m.subject.length>200||/[\x00-\x1f\x7f]/.test(m.subject)
  ||typeof m.text!=='string'||!m.text.length||Buffer.byteLength(m.text)>16384
  ||typeof m.html!=='string'||!m.html.length||Buffer.byteLength(m.html)>32768)return null;
 return {body:JSON.stringify({from:m.from,to:[m.to[0]],subject:m.subject,text:m.text,html:m.html}),key:meta.idempotencyKey};
}

export function createSupplyResendAdapter(options={}){
 const {apiKey,fetcher,timeoutMs=15000}=options;
 if(Object.keys(options).some(k=>!['apiKey','fetcher','timeoutMs'].includes(k))
  ||typeof apiKey!=='string'||!apiKey.length||apiKey.length>512||/\s|[\x00-\x1f\x7f]/.test(apiKey)
  ||typeof fetcher!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000){
  throw Error('SUPPLY_RESEND_ADAPTER_OPTIONS_REQUIRED');
 }
 return async(messages,meta)=>{
  let request;
  try{request=payload(messages,meta);}catch{return {state:'failed'};}
  if(!request)return {state:'failed'};
  const controller=new AbortController();let timer,reader,responseBody;
  const cancel=()=>{try{void (reader?reader.cancel():responseBody?.cancel())?.catch(()=>{});}catch{}};
  const deadline=new Promise(resolve=>{timer=setTimeout(()=>{
   controller.abort();cancel();resolve({state:'uncertain'});
  },timeoutMs);});
  const attempt=async()=>{
   try{
    const response=await fetcher(endpoint,{method:'POST',redirect:'error',credentials:'omit',
     headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':request.key},
     body:request.body,signal:controller.signal});
    responseBody=response?.body;
    if(controller.signal.aborted){cancel();return {state:'uncertain'};}
    // A redirect must never be followed, even by an injected transport.
    if(response.redirected||response.status>=300&&response.status<400)return {state:'uncertain'};
    const type=response.headers.get('content-type')||'';
    const length=response.headers.get('content-length');
    if(!/^application\/json(?:\s*;|\s*$)/i.test(type)
     ||length!==null&&(!/^\d+$/.test(length)||Number(length)>maxResponseBytes))return {state:'uncertain'};
    reader=response.body.getReader();
    const chunks=[];let size=0;
    while(true){
     const {done,value}=await reader.read();if(done)break;
     size+=value.byteLength;if(size>maxResponseBytes)return {state:'uncertain'};
     chunks.push(value);
    }
    const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,size)));
    if(response.status===200&&record(data,['id'])&&typeof data.id==='string'&&data.id.length===36&&providerId.test(data.id))return {state:'sent'};
    // Never expose a provider message/error body or infer retry from HTTP status alone.
    if(data&&typeof data.name==='string'){
     if(response.status===429&&rejectedTemporarily.has(data.name))return {state:'retry'};
     if(permanent.get(response.status)?.has(data.name))return {state:'failed'};
    }
    return {state:'uncertain'};
   }catch{return {state:'uncertain'};}
  };
  try{return await Promise.race([attempt(),deadline]);}
  finally{clearTimeout(timer);controller.abort();cancel();}
 };
}
