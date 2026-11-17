import {api,post,authHeaders} from './block1-local.mjs';
const $=id=>document.getElementById(id),form=$('quote-form'),status=$('status');
let me,config,selected;
const money=minor=>new Intl.NumberFormat('en',{style:'currency',currency:'MAD'}).format(minor/100);
const say=text=>{status.textContent=text;};
const element=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
async function run(fn){try{await fn();}catch(e){say(e.message);}}
function action(parent,label,fn){const button=element('button',label);button.type='button';button.onclick=()=>run(async()=>{button.disabled=true;try{await fn();}finally{button.disabled=false;}});parent.append(button);return button;}
async function list(){
 const orders=await api('/api/instant/orders'),container=$('order-list');container.replaceChildren();
 if(!orders.length)container.append(element('p','No translations yet. Your next project starts above.'));
 for(const order of orders){
  const row=element('div',undefined,'order-row'),text=element('div');
  text.append(element('strong',order.source_language+' → '+order.target_language),element('div',order.status.replaceAll('_',' ')),element('small','Order '+order.id));
  row.append(text);action(row,order.total_minor?money(order.total_minor)+' · View':'Manual review · View',()=>show(order.id));container.append(row);
 }
}
async function refresh(id){await list();await show(id);}
async function download(id,kind){
 const response=await fetch('/api/instant/orders/'+id+'/'+kind,{headers:authHeaders(),credentials:'same-origin'});
 if(!response.ok)throw Error((await response.json()).error);
 const url=URL.createObjectURL(await response.blob()),link=element('a',kind==='draft'?'Open watermarked draft PDF':'Download '+kind+' file','download');
 link.href=url;link.target='_blank';link.rel='noopener';if(kind!=='draft')link.download=kind+'.pdf';
 $('order').append(link);link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function show(id){
 selected=id;const q=await api('/api/instant/orders/'+id),panel=$('order');panel.hidden=false;panel.replaceChildren();
 panel.append(element('p',config.mockPayment?'MOCK PAYMENT · NO REAL MONEY':'Payments are not available yet.','eyebrow'),element('h3',q.source_language+' → '+q.target_language),element('span',q.status.replaceAll('_',' '),'tag'));
 if(q.sample_requested)panel.append(element('span','Free 250-word sample requested','tag'));
 if(q.category==='sworn')panel.append(element('p','You must bring the original document to the Marocora office for stamping.','callout'));
 const actions=element('div',undefined,'actions');
 action(actions,'View source document',()=>download(id,'original'));
 if(q.status==='manual_review'){
  panel.append(element('p','Scanned documents require manual review. Our team will evaluate and send you a quote within 1 hour.','callout'));
  if(me.role==='staff'){
   const label=element('label',q.category==='sworn'?'Reviewed number of pages':'Reviewed word count'),count=element('input');count.type='number';count.min='1';count.step='1';count.required=true;label.append(count);label.className='review-input';panel.append(label);
   action(actions,'Approve reviewed quote',async()=>{const n=Number(count.value);if(!Number.isSafeInteger(n)||n<1)throw Error('Enter a positive whole quantity');await post('/api/instant/orders/'+id+'/review',{words:q.category==='sworn'?null:n,pages:q.category==='sworn'?n:null},me.csrf);await refresh(id);});
  }
 }else{
  panel.append(element('p',money(q.total_minor),'price'));
  const conversion=q.conversion?.available?`Estimated ${q.conversion.EUR.toFixed(2)} EUR / ${q.conversion.USD.toFixed(2)} USD · Rates dated ${q.conversion.date}`:'EUR/USD estimate currently unavailable.';
  panel.append(element('p',conversion,'fine'),element('p','Final payment is processed in MAD. Currency conversion is for estimation only.','fine'));
  const breakdown=element('div',undefined,'breakdown');
  for(const [label,value] of [['Subtotal before VAT',money(q.subtotal_minor)],['VAT · 20%',money(q.vat_minor)],['50% deposit',money(q.deposit_minor)],['Remaining balance',money(q.balance_minor)]])breakdown.append(element('span',label),element('strong',value));
  panel.append(breakdown,element('p',q.category==='sworn'?q.page_count+' pages · 150 MAD / page':q.counted_words+' counted words → '+q.billable_words+' billable words after 2% grace.','fine'));
  if(q.first_order)panel.append(element('p','First-order 10% discount applied before the 150 MAD minimum.','fine'));
  panel.append(element('p','Estimated delivery date: '+q.delivery_date+' · Based on 2,000 words per working day; confirmed when work is scheduled.','fine'));
 }
 if(me.role==='customer'&&q.status==='quoted'&&config.paymentConfigured!==false){
  const label=element('label',undefined,'check'),consent=element('input');consent.type='checkbox';consent.required=true;label.append(consent,document.createTextNode(config.consent));panel.append(label);
  const pay=action(actions,'Pay 50% Deposit',async()=>{if(!consent.checked)throw Error('Immediate commencement consent is required');await post('/api/instant/orders/'+id+'/pay',{commandId:crypto.randomUUID(),phase:'deposit',consent:true},me.csrf);say('Mock deposit successful. No real money was collected.');await refresh(id);});pay.disabled=true;consent.onchange=()=>pay.disabled=!consent.checked;
 }
 if(me.role==='staff'&&q.category==='sworn'&&!q.originals_presented_at)action(actions,'Confirm originals presented at office',async()=>{await post('/api/instant/orders/'+id+'/confirm-originals',{},me.csrf);await refresh(id);});
 if(me.role==='staff'&&['quoted','in_progress_deposit_paid'].includes(q.status)){
  const providers=await api('/api/instant/providers'),label=element('label','Assign translator'),select=element('select');
  for(const provider of providers){const option=element('option',provider.name);option.value=provider.id;select.append(option);}
  label.append(select);panel.append(label);action(actions,'Assign translator',async()=>{if(!select.value)throw Error('No eligible translator');await post('/api/instant/orders/'+id+'/assign',{providerId:select.value},me.csrf);await refresh(id);});
 }
 if(me.role==='provider'&&q.status==='in_progress_deposit_paid'){
  if(!q.work_started_at)action(actions,'Begin translation',async()=>{await post('/api/instant/orders/'+id+'/start',{},me.csrf);await refresh(id);});
  else{
   const label=element('label','Completed translation (PDF)'),file=element('input');file.type='file';file.accept='.pdf';label.append(file);panel.append(label);
   action(actions,'Mark Complete',async()=>{
    const doc=file.files[0];if(!doc)throw Error('Attach the completed PDF');
    const response=await fetch('/api/instant/orders/'+id+'/complete',{method:'POST',headers:{...authHeaders(),'Content-Type':'application/pdf',...(me.csrf?{'x-csrf-token':me.csrf}:{})},body:doc,credentials:'same-origin'});
    if(!response.ok)throw Error((await response.json()).error);await refresh(id);
   });
  }
 }
 if(['awaiting_balance','paid_in_full'].includes(q.status))action(actions,'View Draft Watermarked PDF',()=>download(id,'draft'));
 if(me.role==='customer'&&q.status==='awaiting_balance'&&config.paymentConfigured!==false)action(actions,'Pay remaining 50%',async()=>{await post('/api/instant/orders/'+id+'/pay',{commandId:crypto.randomUUID(),phase:'balance',consent:true},me.csrf);say('Mock balance successful. Your final file is unlocked.');await refresh(id);});
 if(q.status==='paid_in_full')action(actions,'Download final translation',()=>download(id,'final'));
 panel.append(actions);panel.scrollIntoView({behavior:'smooth',block:'start'});
}
form.category.onchange=()=>$('sworn-note').hidden=form.category.value!=='sworn';
form.scanned.onchange=()=>$('scan-note').hidden=!form.scanned.checked;
form.onsubmit=event=>{event.preventDefault();run(async()=>{
 const file=form.document.files[0];if(!file||file.size>10000000)throw Error('Choose a document up to 10 MB');if(form.source.value===form.target.value)throw Error('Choose different source and target languages');
 const button=form.querySelector('button');button.disabled=true;say('Scanning document and counting words…');
 try{
  const response=await fetch('/api/instant/orders',{method:'POST',credentials:'same-origin',headers:{...authHeaders(),...(me.csrf?{'x-csrf-token':me.csrf}:{}),'Content-Type':file.type||'application/octet-stream','x-file-name':encodeURIComponent(file.name),'x-quote-details':encodeURIComponent(JSON.stringify({category:form.category.value,source:form.source.value,target:form.target.value,sampleRequested:form.sampleRequested.checked,scanned:form.scanned.checked}))},body:file});
  const q=await response.json();if(!response.ok)throw Error(q.error);say(q.status==='manual_review'?'Your document is queued for manual review.':'Your quote is ready. VAT and the 50/50 split are included.');await refresh(q.id);
 }finally{button.disabled=false;}
});};
$('refresh').onclick=()=>run(list);
await run(async()=>{
 me=await api('/api/me');config=await api('/api/instant/config');$('identity').textContent=me.role+(me.production?'':' · '+(me.staging?'staging':'local'));
 for(const [name,selected] of [['source','English'],['target','French']])for(const language of config.languages){const option=element('option',language);option.value=language;option.selected=language===selected;form[name].append(option);}
 if(me.role!=='customer')$('new-quote').hidden=true;
 if(!me.switches.capture_enabled||!me.switches.commands_enabled){form.querySelector('button').disabled=true;say('Workflow switches are OFF. Read-only access is available.');}
 await list();
 if(location.hash&&/^[0-9a-f-]{36}$/.test(location.hash.slice(1)))await show(location.hash.slice(1));
});
