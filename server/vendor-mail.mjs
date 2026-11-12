// Prepared authenticated transactional transport. Only server-held credentials may send.
const titles={submitted:'Your Marocora application has been received',approved:'Your Marocora application is approved',declined:'Update: your Marocora application was declined',needs_information:'More information needed for your Marocora application',information_received:'Your additional information has been received'};
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const style='font-family:Arial,sans-serif;color:#153b31;line-height:1.6;max-width:620px;margin:24px auto;padding:28px;border:1px solid #d8e2db;border-radius:12px';
const button=(url,label)=>`<a href="${escape(url)}" style="display:inline-block;background:#12644f;color:white;padding:12px 20px;border-radius:7px;text-decoration:none;font-weight:bold">${escape(label)}</a>`;
export function vendorEmailBatch({application:a,event:e},{from='Marocora <no-reply@auth.marocora.com>'}={}){
 const title=titles[e.kind];if(!title)throw Error('INVALID_EVENT');
 const appURL=`https://marocora.com/application.html#${a.id}`,reviewURL=`https://marocora.com/vendor-review.html#${a.id}`;
 const questions=e.payload.questions||[],message=e.payload.message||'';
 const questionText=questions.map(q=>q.label).join('\n');
 const applicantText=`Hello ${a.name},\n\n${message}${questionText?'\n\nInformation requested:\n'+questionText:''}\n\nView your application or provide information: ${appURL}\nUse the same verified email address you used to apply. You do not need to submit a new application.\n\nReference: ${a.id}\nQuestions? Reply to admin@marocora.com.`;
 const applicantHTML=`<div style="${style}"><p style="font-size:26px;font-weight:bold;color:#12644f">Marocora</p><h1 style="font-size:25px;line-height:1.3">${escape(title)}</h1><p>Hello ${escape(a.name)},</p><p style="white-space:pre-wrap">${escape(message)}</p>${questions.length?`<h2 style="font-size:19px">Information requested</h2><ul>${questions.map(q=>`<li>${escape(q.label)}</li>`).join('')}</ul>`:''}<p>${button(appURL,'View my application / send information')}</p><p>Sign in with the same verified email address you used to apply. Your application is saved; you do not need to start again.</p><p style="font-size:13px;color:#64756e">Reference: ${escape(a.id)}</p><p>Questions? Reply to <a href="mailto:admin@marocora.com">admin@marocora.com</a>.</p></div>`;
 const summary=e.kind==='submitted'?'New vendor application':e.kind==='information_received'?'Applicant supplied requested information':`Application ${e.kind.replaceAll('_',' ')}`;
 const adminText=`${summary}: ${a.name}\n${a.email} · ${a.category}\n\n${message}\n\nOpen complete application: ${reviewURL}\nSign in with your authorised reviewer account.\nReference: ${a.id}`;
 const adminHTML=`<div style="${style}"><p style="font-size:26px;font-weight:bold;color:#12644f">Marocora</p><h1 style="font-size:25px">${escape(summary)}</h1><h2>${escape(a.name)}</h2><p>${escape(a.email)} · ${escape(a.category)}</p><p style="white-space:pre-wrap">${escape(message)}</p><p>${button(reviewURL,'Open complete application & review')}</p><p>Review the application, choose Approve, Decline or Request information, and email your decision from the same page.</p><p style="font-size:13px;color:#64756e">Reference: ${escape(a.id)}</p></div>`;
 return [{from,to:[a.email],reply_to:'admin@marocora.com',subject:title,html:applicantHTML,text:applicantText},{from,to:['admin@marocora.com'],reply_to:'admin@marocora.com',subject:`${summary} — ${a.name}`,html:adminHTML,text:adminText}];
}
export function createResendTransport({apiKey,from,fetcher=fetch}){
 return async item=>{
  const payload=vendorEmailBatch(item,{from});
  const r=await fetcher('https://api.resend.com/emails/batch',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`marocora-vendor/${item.event.id}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
  const data=await r.json();
  if(r.ok&&Array.isArray(data.data)&&data.data.length===2&&data.data.every(v=>v.id))return {state:'sent',ids:data.data.map(v=>v.id)};
  return {state:r.status>=400&&r.status<500&&![409,429].includes(r.status)?'failed':'uncertain'};
 };
}
