// Runs only on the server. Never trust email/status fields sent by a browser.
export const intakeKinds = Object.freeze({
 contact:{form:'xbgojgrj',subject:'New Marocora Contact Message',role:'client',name:'name'},
 translation:{form:'mdegoene',subject:'New Marocora Translation Service Request',role:'client',name:'client-name'},
 translator:{form:'mnpdqpan',subject:'New Marocora Translator Application',role:'vendor',name:'full-name'},
 network:{form:'xqpqkpzb',subject:'New Marocora Professional Network Application',role:'vendor',name:'full-name'},
 lesson:{form:'mqpznwjy',subject:'New Marocora Teacher Matching Request',role:'client',name:'student-name'},
 introduction:{form:'mqpznwjy',subject:'New Marocora Lesson Request',role:'client',name:'student-name'}
});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reserved=/^(?:_|email$|email_verified|verification|verified|receipt|status$|admin-decision-link$)/i;
const normalize=s=>typeof s==='string'?s.trim().toLowerCase():'';
export function validateIntake(input,user){
 if(!user?.id||!user.email_confirmed_at||!user.email||user.is_anonymous)throw new Error('EMAIL_VERIFICATION_REQUIRED');
 if(!input||!uuid.test(input.requestId||'')||!Object.hasOwn(intakeKinds,input.kind))throw new Error('INVALID_REQUEST');
 if(!input.fields||typeof input.fields!=='object'||Array.isArray(input.fields)||Object.keys(input.fields).length>60)throw new Error('INVALID_FIELDS');
 if(normalize(input.fields.email)!==normalize(user.email))throw new Error('EMAIL_MISMATCH');
 const fields={};
 for(const [key,value] of Object.entries(input.fields)){
  if(key.length>80||!/^[-a-zA-Z0-9_]+$/.test(key))throw new Error('INVALID_FIELDS');
  if(reserved.test(key))continue;
  const values=Array.isArray(value)?value:[value];
  if(values.length>20||values.some(v=>typeof v!=='string'||v.length>8000||v.includes('\0')))throw new Error('INVALID_FIELDS');
  fields[key]=Array.isArray(value)?values:value;
 }
 const kind=intakeKinds[input.kind];
 if(!String(fields[kind.name]||'').trim()||String(fields[kind.name]).length>200)throw new Error('NAME_REQUIRED');
 if(['contact','translation'].includes(input.kind)&&!String(fields.message||'').trim())throw new Error('MESSAGE_REQUIRED');
 fields.email=user.email;
 fields.interface_language=['en','fr','ar','es'].includes(fields.interface_language)?fields.interface_language:'en';
 if(JSON.stringify(fields).length>40000)throw new Error('REQUEST_TOO_LARGE');
 return {requestId:input.requestId,kind:input.kind,role:kind.role,fields};
}
export function createIntakeHandler({supabaseURL,serviceKey,fetcher=fetch,cryptoAPI=crypto}){
 const origins=new Set(['https://marocora.com','https://www.marocora.com']);
 return async request=>{
  const origin=request.headers.get('origin');
  const cors={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://marocora.com','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:cors});
  if(request.method==='OPTIONS')return new Response(null,{status:origins.has(origin)?204:403,headers:cors});
  if(request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
  if(!origins.has(origin))return reply(403,{error:'ORIGIN_NOT_ALLOWED'});
  const bearer=request.headers.get('authorization');
  if(!bearer?.startsWith('Bearer ')||bearer.length>12000)return reply(401,{error:'EMAIL_VERIFICATION_REQUIRED'});
  if(Number(request.headers.get('content-length')||0)>50000)return reply(413,{error:'REQUEST_TOO_LARGE'});
  try{
   // getUser checks the token with Supabase Auth; decoding a JWT is insufficient.
   const auth=await fetcher(`${supabaseURL}/auth/v1/user`,{headers:{apikey:serviceKey,Authorization:bearer},signal:AbortSignal.timeout(10000)});
   if(!auth.ok)return reply(401,{error:'EMAIL_VERIFICATION_REQUIRED'});
   const user=await auth.json();
   const reader=request.body?.getReader();let size=0;const chunks=[];
   if(!reader)return reply(400,{error:'INVALID_REQUEST'});
   for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>50000){await reader.cancel();return reply(413,{error:'REQUEST_TOO_LARGE'});}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
   const raw=new TextDecoder().decode(bytes);
   const input=JSON.parse(raw);const clean=validateIntake(input,user);
   const digest=await cryptoAPI.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(clean)));
   const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
   async function rpc(name,args){
    const r=await fetcher(`${supabaseURL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});
    const data=await r.json();if(!r.ok)throw new Error(data.message||'STORAGE_UNAVAILABLE');return data;
   }
   const record=await rpc('service_intake_reserve',{p_id:clean.requestId,p_user:user.id,p_kind:clean.kind,p_fields:clean.fields,p_hash:hash});
   if(!record.dispatch)return reply(record.delivery==='delivered'?200:202,{receipt:clean.requestId,delivery:record.delivery,verified:true});
   const kind=intakeKinds[clean.kind];
   const body={...clean.fields,_subject:kind.subject,verification_status:'Email verified — confirm receipt in the Marocora service review queue',verification_receipt:clean.requestId,verification_record:`https://marocora.com/service-review.html#${clean.requestId}`,email_verified_at:record.verified_at};
   if(clean.kind==='introduction'){const p=new URLSearchParams({receipt:clean.requestId,reference:clean.fields['booking-reference']||clean.requestId,teacher:clean.fields.teacher||'',time:clean.fields['requested-time']||'',name:clean.fields['student-name']||'',email:user.email});body['admin-decision-link']=`https://marocora.com/lesson-decision.html?${p}`;}
   let delivery='uncertain';
   try{
    const response=await fetcher(`https://formspree.io/f/${kind.form}`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    // A missing/ambiguous response must never automatically resend a duplicate.
    const result=await response.json();
    if(response.ok&&!result.errors&&result.ok!==false)delivery='delivered';
    else if(response.status>=400&&response.status<500)delivery='rejected';
   }catch{/* The durable verification record remains available to staff. */}
   await rpc('service_intake_delivery',{p_id:clean.requestId,p_user:user.id,p_delivery:delivery});
   return reply(delivery==='delivered'?200:202,{receipt:clean.requestId,delivery,verified:true});
  }catch(error){
   const message=error.message||'';
   const known=['EMAIL_VERIFICATION_REQUIRED','EMAIL_MISMATCH','INVALID_REQUEST','INVALID_FIELDS','NAME_REQUIRED','MESSAGE_REQUIRED','REQUEST_TOO_LARGE','REQUEST_CONFLICT','REQUEST_LIMIT'];
   const code=known.find(x=>message.includes(x));
   return reply(code==='REQUEST_LIMIT'?429:code?400:503,{error:code||'INTAKE_UNAVAILABLE'});
  }
 };
}
