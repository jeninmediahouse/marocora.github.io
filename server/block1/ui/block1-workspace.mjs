import {api,post,authHeaders,privateDownload} from './block1-local.mjs';
const status=document.getElementById('status'),detail=document.getElementById('detail'),list=document.getElementById('list');
let me,options,selected,block2;
const node=(tag,text,parent)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(parent)parent.append(n);return n;};
const report=e=>{status.textContent=e.message;status.className='error';};
const stateLabel=state=>({open:'Awaiting quote or response',accepted_pending_activation:'Quote accepted — awaiting a separately agreed start',cancelled:'Cancelled',closed_unfulfilled:'Closed without fulfilment'}[state]||'Needs review');
function action(label,handler,parent=detail){const b=node('button',label,parent);b.type='button';b.disabled=!me.switches.commands_enabled;b.addEventListener('click',async()=>{b.disabled=true;try{await handler();status.textContent='Saved. Notification queued locally; no email sent.';await refresh();if(selected)await open(selected);}catch(e){report(e);b.disabled=false;}});return b;}
async function command(q,action,payload){return post('/api/command',{commandId:crypto.randomUUID(),action,targetId:q.id,expectedRevision:q.revision,payload},me.csrf);}
async function refresh(){list.replaceChildren();const rows=await api('/api/requests');if(!rows.length)node('p','No saved local requests.',list);for(const q of rows){const a=node('a','Request '+q.id.slice(0,8)+' — '+stateLabel(q.state),list);a.href='#'+q.id;a.onclick=event=>{event.preventDefault();open(q.id).catch(report);};}}
function field(form,label,name,value='',type='text'){
 const wrapper=node('label',label,form),input=node(type==='textarea'?'textarea':'input',undefined,wrapper);input.name=name;if(type!=='textarea')input.type=type;input.value=value;input.required=true;return input;
}
async function open(id){
 selected=id;location.hash=id;const q=await api('/api/requests/'+id);detail.replaceChildren();detail.hidden=false;
 node('h2','Request '+q.id.slice(0,8),detail);node('p',stateLabel(q.state),detail);
 if(q.customer){node('p',q.customer.fields.name+' · '+q.customer.email,detail);if(q.customer.fields.phone)node('p',q.customer.fields.phone,detail);}
 if(me.block2){
 const newOrder=node('a','Missing a page? Start a new order.',detail);newOrder.href='translation-request.html';
 node('p',q.submitted?'Request submitted: additional pages cannot be added.':'Draft: submit your initial documents before a quote can be issued.',detail);
 if(q.scope?.service===block2.SWORN_SERVICE||q.service===block2.SWORN_SERVICE){node('p',block2.IN_PERSON,detail);node('p',block2.GUARANTEE,detail);if(q.scope?.certified)node('p','Morocco · '+q.scope.certified.receivingAuthority+' · '+(q.scope.certified.missingInstructions?'Customer does not have authority instructions':q.scope.certified.requirements),detail);}
 if(q.fulfillment){node('h3','Selected fulfillment',detail);node('p',q.fulfillment.method,detail);if(q.fulfillment.method==='usb'){node('p',block2.USB_COST_WARNING,detail);node('p',block2.USB_WARNING,detail);}if(q.fulfillment.method==='shipping')node('p',block2.SHIPPING_WARNING,detail);}
 }
 if(q.scope){node('p',q.scope.service+' · '+q.scope.source+' → '+q.scope.target,detail);node('pre',q.scope.description,detail);}
 if(q.eligibilityHold)node('p','Provider eligibility is on hold. No work or payment is authorized.',detail);
 if(q.documentsHold)node('p','Documents are quarantined or have not passed antivirus scanning. Downloads, quote issuance and acceptance are blocked. Staff can review the status; no manual clean override is available.',detail);
 if(q.invitation)action('Agree to assess request',()=>command(q,'respond_assignment',{assignmentId:q.invitation.id,response:'accepted'}));
 if(q.files){node('h3','Private documents',detail);for(const file of q.files){const p=node('p',file.name+' ('+file.size+' bytes) — '+(file.scanStatus==='clean'?'Antivirus scan passed':file.scanStatus==='infected'?'Blocked: scanner flagged this file':file.scanStatus==='error'?'Quarantined: scanner error':'Quarantined: clean scan required'),detail);
  if(file.scanStatus!=='clean'){
   if(file.scanReason==='SCANNER_NOT_INSTALLED')node('span',' No scanner is installed locally.',p);
   if(q.role==='staff'){const scan=node('button','Retry antivirus scan for '+file.name,p);scan.type='button';scan.disabled=!me.switches.commands_enabled;scan.onclick=async()=>{scan.disabled=true;try{await post('/api/files/'+file.id+'/rescan',{},me.csrf);await open(q.id);status.textContent='Scan status updated locally. No email sent.';}catch(e){report(e);scan.disabled=false;}};}
   continue;
  }
  const a=node('a',' Download',p);a.href='/api/files/'+file.id;privateDownload(a);
  if(file.mediaType!=='text/plain')continue;
  const view=node('button','View '+file.name,p);view.type='button';view.onclick=async()=>{view.disabled=true;try{const response=await fetch('/api/files/'+file.id,{credentials:'same-origin',headers:authHeaders()});if(!response.ok)throw Error('DOCUMENT_UNAVAILABLE');node('pre',await response.text(),detail);}catch(e){report(e);}finally{view.disabled=false;}};
 }}
 if(q.role==='staff'&&q.state==='open'){
  const select=node('select',undefined,detail);select.setAttribute('aria-label','Eligible translator');for(const r of options.readiness){const o=node('option',r.label,select);o.value=r.id;}
  action(q.assignment?'Replace invitation':'Invite translator',()=>command(q,'invite_provider',{readinessId:select.value}));
  if(q.assignment?.state==='accepted'&&!q.documentsHold&&(!me.block2||q.submitted)){
   const form=node('form',undefined,detail);node('h3','Issue staff quote',form);node('p','Issued by you as staff, for the assigned translator. No email or payment.',form);
   field(form,'Scope','scope',q.scope.description,'textarea');field(form,'Exclusions','exclusions','No services beyond this scope','textarea');
   const amount=field(form,'Exact total in minor units (MAD: 100 = 1 MAD)','minor','12000','number');amount.min='1';amount.max='999999999999';amount.step='1';
   field(form,'Currency','currency','MAD');field(form,'Turnaround / future start condition','turnaround','Three days after a separately agreed start');
   field(form,'Included revisions','revisions','1','number').min='0';
   field(form,'Expiry (UTC ISO timestamp)','expiresAt',new Date(Date.now()+86400000).toISOString());
   field(form,'Tax treatment / included charges','taxTreatment','Local synthetic quote; all provider charges included');
   node('p',options.policy.wording.en,form);
   const submit=node('button','Issue quote',form);submit.type='submit';submit.disabled=!me.switches.commands_enabled;
   form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity())return;submit.disabled=true;
    try{const f=new FormData(form);await command(q,'issue_offer',{assignmentId:q.assignment.id,content:{scope:f.get('scope'),exclusions:f.get('exclusions'),total:{minor:Number(f.get('minor')),currency:f.get('currency')},turnaround:f.get('turnaround'),revisions:Number(f.get('revisions')),expiresAt:f.get('expiresAt'),policyVersion:options.policy.version,policyDigest:options.policy.digest,taxTreatment:f.get('taxTreatment'),chargesIncluded:true}});await open(q.id);await refresh();status.textContent='Quote saved; customer notification queued locally. No email sent.';}catch(e){report(e);submit.disabled=false;}
   });
  }
 }
 for(const offer of q.offers||[]){
  const article=node('article',undefined,detail);article.className='offer';node('h3','Staff-issued quote '+offer.version+' — '+offer.state,article);
  const c=offer.content;node('p','Total: '+new Intl.NumberFormat('en',{style:'currency',currency:c.total.currency,currencyDisplay:'code',minimumFractionDigits:c.total.digits,maximumFractionDigits:c.total.digits}).format(c.total.minor/10**c.total.digits),article);
  for(const [label,value] of [['Scope',c.scope],['Exclusions',c.exclusions],['Turnaround / start condition',c.turnaround],['Included revisions',c.revisions],['Expiry',c.expiresAt],['Tax treatment',c.taxTreatment]])node('p',label+': '+value,article);
  node('p','All translation/provider charges included. Physical fulfillment extras are separate where selected.',article);
  if(c.fulfillmentTerms)for(const [key,value] of Object.entries(c.fulfillmentTerms))if(key!=='method')node('p',value,article);node('h4','Documents covered by this quote',article);if(c.documents?.length)for(const file of c.documents)node('p',file.name+' ('+file.size+' bytes)',article);else node('p','No documents attached.',article);
  node('p',q.policies?.[c.policyVersion]?.en||'Policy unavailable',article);
  if(q.role==='customer'&&offer.state==='offered'&&!q.eligibilityHold&&!q.documentsHold){
   const label=node('label',undefined,article);label.className='check';const check=node('input',undefined,label);check.type='checkbox';node('span','I agree to this exact quote, its document list, scope, total, turnaround and displayed terms. No work is scheduled and no payment is due.',label);
   let delivery,extra,encryption,original,guarantee;
   const ack=text=>{const label=node('label',undefined,article),input=document.createElement('input');input.type='checkbox';label.append(input,document.createTextNode(text));return input;};
   if(me.block2){
    if(q.scope.service===block2.SWORN_SERVICE){original=ack(block2.IN_PERSON);guarantee=ack(block2.GUARANTEE);}
    else{delivery=node('select',undefined,article);delivery.setAttribute('aria-label','Fulfillment option');for(const [value,text] of [['','Choose fulfillment'],['email','Email Delivery — final file emailed to your verified address'],['shipping','Physical Shipping — '+block2.SHIPPING_WARNING],['usb','USB Flash Drive (Encrypted) — '+block2.USB_COST_WARNING]]){const o=node('option',text,delivery);o.value=value;}extra=ack('I agree that shipping charges, and the flash drive cost if selected, are extra.');encryption=ack(block2.USB_WARNING);const update=()=>{extra.parentElement.hidden=!['shipping','usb'].includes(delivery.value);encryption.parentElement.hidden=delivery.value!=='usb';};delivery.onchange=update;update();}
   }
   action('Accept this exact quote',async()=>{if(!check.checked)throw Error('Confirm the exact quote terms first');await command(q,'accept_offer',{offerId:offer.id,offerDigest:offer.digest,policyVersion:c.policyVersion,policyDigest:c.policyDigest,language:'en',...(me.block2?{fulfillment:q.scope.service===block2.SWORN_SERVICE?{method:'in_person',originalCheckAccepted:original.checked,guaranteeAccepted:guarantee.checked}:{method:delivery.value,...(['shipping','usb'].includes(delivery.value)?{extraCostsAccepted:extra.checked}:{}),...(delivery.value==='usb'?{encryptionAccepted:encryption.checked}:{})}}:{})});},article);
  }
 }
 if(q.acceptance){node('h3','Acceptance recorded',detail);node('p','Recorded at '+q.acceptance.at,detail);node('p','You agreed to the saved quote. No work is scheduled and no payment is due.',detail);}
}
document.getElementById('refresh').onclick=()=>refresh().catch(report);
document.getElementById('logout').onclick=async()=>{try{await post('/api/logout',{},me.csrf);detail.replaceChildren();list.replaceChildren();sessionStorage.removeItem('marocora-staging-token');status.textContent='Signed out';}catch(e){report(e);}};
try{me=await api('/api/me');if(me.block2){block2=await import('./block2-contracts.mjs');const link=node('a','Moroccan sworn translator credentials / staff review',document.querySelector('main'));link.href='block2-credentials.html';}const on=key=>me.switches[key]?'ON':'OFF';document.getElementById('identity').textContent='Local '+me.role+' · capture '+on('capture_enabled')+' · commands '+on('commands_enabled')+' · notifications '+on('notifications_enabled')+' (queue only)';if(me.role==='staff'||me.role==='otherStaff'){options=await api('/api/options');document.getElementById('heading').textContent='Local Staff Translation Dashboard';}await refresh();if(location.hash)await open(location.hash.slice(1));}catch(e){report(e);}
