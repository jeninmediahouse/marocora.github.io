// Server-only vendor review and notification bridge. Browser never chooses recipients.
const allowedOrigins=new Set(['https://marocora.com','https://www.marocora.com']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const eventTitles={submitted:'Your Marocora application has been received',approved:'Your Marocora application is approved',declined:'Update: your Marocora application was declined',needs_information:'More information needed for your Marocora application',information_received:'Your additional information has been received'};
export function mailFields({application:a,event:e}){
 if(!eventTitles[e.kind])throw new Error('INVALID_EVENT');
 const appURL=`https://marocora.com/application.html#${a.id}`,reviewURL=`https://marocora.com/vendor-review.html#${a.id}`;
 const questions=(e.payload.questions||[]).map(q=>q.label).join('\n');
 const answers=Object.entries(e.payload.answers||{}).map(([id,v])=>`${e.payload.questions?.find(q=>q.id===id)?.label||id}: ${v}`).join('\n\n');
 return {email:a.email,name:a.name,event_title:eventTitles[e.kind],application_status:e.kind,application_reference:a.id,category:a.category,
 message:e.payload.message,requested_information:questions,additional_information:answers,application_url:appURL,review_application:reviewURL,
 _subject:`Marocora application: ${a.name} — ${e.kind==='submitted'?'new application':e.kind.replaceAll('_',' ')}`};
}
export function createVendorHandler({supabaseURL,serviceKey,mailForm,sendMail,fetcher=fetch}){
 return async request=>{
  const origin=request.headers.get('origin');
  const headers={'Access-Control-Allow-Origin':allowedOrigins.has(origin)?origin:'https://marocora.com','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(request.method==='OPTIONS')return new Response(null,{status:allowedOrigins.has(origin)?204:403,headers});
  if(request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
  if(!allowedOrigins.has(origin))return reply(403,{error:'ORIGIN_NOT_ALLOWED'});
  const token=request.headers.get('authorization');
  if(!token?.startsWith('Bearer ')||token.length>12000)return reply(401,{error:'SIGN_IN_REQUIRED'});
  let phase='authenticate';
  try{
   const ar=await fetcher(`${supabaseURL}/auth/v1/user`,{headers:{apikey:serviceKey,Authorization:token},signal:AbortSignal.timeout(10000)});
   if(!ar.ok)return reply(401,{error:'SIGN_IN_REQUIRED'});
   const user=await ar.json();if(!user.email_confirmed_at||user.is_anonymous)return reply(401,{error:'EMAIL_VERIFICATION_REQUIRED'});
   let size=0,body='';const reader=request.body?.getReader(),decoder=new TextDecoder();
   if(!reader)return reply(400,{error:'INVALID_REQUEST'});
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>60000){await reader.cancel();return reply(413,{error:'REQUEST_TOO_LARGE'});}body+=decoder.decode(value,{stream:true});}body+=decoder.decode();
   const input=JSON.parse(body);
   async function rpc(name,args,server=false){
    phase=`rpc:${name}`;
    const r=await fetcher(`${supabaseURL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:serviceKey,Authorization:server?`Bearer ${serviceKey}`:token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
    const text=await r.text(),result=text.trim()?JSON.parse(text):null;if(!r.ok){const error=new Error(result?.message||'WORKFLOW_UNAVAILABLE');error.code=result?.code;throw error;}return result;
   }
   let result;
   // Fail before saving a decision when mail integration has not been activated.
   if(!sendMail&&!/^[a-z]{8}$/.test(mailForm||''))return reply(503,{error:'EMAIL_WORKFLOW_NOT_CONFIGURED'});
   if(input.action==='decide'){
    if(!uuid.test(input.commandId||'')||!uuid.test(input.id||''))return reply(400,{error:'INVALID_REQUEST'});
    result=await rpc('vendor_decide',{p_id:input.id,p_revision:input.revision,p_decision:input.decision,p_message:input.message,p_questions:input.questions||[],p_subjects:input.subjects||[],p_command:input.commandId});
   }else if(input.action==='reply'){
    if(!uuid.test(input.commandId||'')||!uuid.test(input.id||''))return reply(400,{error:'INVALID_REQUEST'});
    result=await rpc('vendor_reply',{p_id:input.id,p_revision:input.revision,p_answers:input.answers,p_command:input.commandId});
   }else if(input.action==='submit_teacher'){
    await rpc('submit_learning_instructor_draft',{});
    const rows=await rpc('vendor_my_applications',{}),a=rows.find(r=>r.source==='teacher');
    if(!a)throw new Error('APPLICATION_NOT_FOUND');result={application_id:a.id};
   }else if(input.action==='deliver'&&uuid.test(input.id||''))result={application_id:input.id};
   else return reply(400,{error:'INVALID_REQUEST'});
   let pending=false;
   // Only stored events are sent; caller cannot supply a recipient, body or outcome.
   for(let n=0;n<5;n++){
    const item=await rpc('vendor_claim_mail',{p_id:result.application_id,p_user:user.id},true);if(!item)break;
    let state='uncertain';
    try{
     if(sendMail){state=(await sendMail(item)).state;}else{
     const r=await fetcher(`https://formspree.io/f/${mailForm}`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(mailFields(item)),signal:AbortSignal.timeout(15000)});
     const data=await r.json();if(r.ok&&!data.errors&&data.ok!==false)state='sent';else if(r.status>=400&&r.status<500)state='failed';
     }
    }catch{}
    await rpc('vendor_finish_mail',{p_event:item.event.id,p_delivery:state},true);if(state!=='sent')pending=true;
   }
   const health=await rpc('vendor_mail_health',{p_id:result.application_id,p_user:user.id},true);
   if(health?.needs_attention)pending=true;
   return reply(pending?202:200,{...result,email:pending?'needs_attention':'processed'});
  }catch(error){
   console.warn('vendor-workflow failure',{phase,code:/^[A-Z0-9_]{1,32}$/.test(error.code||'')?error.code:'UNCLASSIFIED',type:error.name});
   const message=error.message||'';
   const known=['STAFF_REQUIRED','ACCESS_DENIED','APPLICATION_NOT_FOUND','STALE_REVISION','INVALID_DECISION','INVALID_QUESTIONS','QUESTIONS_REQUIRED','INVALID_ANSWERS','ANSWERS_REQUIRED','EMAIL_VERIFICATION_REQUIRED','QA_APPROVAL_BLOCKED','SELF_REVIEW_DENIED','INVALID_REVIEW','FEEDBACK_REQUIRED','NOT_SUBMITTED'];
   const code=known.find(k=>message.includes(k));return reply(code==='STAFF_REQUIRED'||code==='ACCESS_DENIED'?403:code?400:503,{error:code||'WORKFLOW_UNAVAILABLE'});
  }
 };
}
