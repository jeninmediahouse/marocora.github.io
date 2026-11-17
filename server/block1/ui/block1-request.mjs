import {api,post,authHeaders,privateDownload} from './block1-local.mjs';
const form=document.getElementById('translation-request-form'),status=document.getElementById('submission-status');
const button=form.querySelector('[type=submit]'),file=document.getElementById('block1-document');
const banner=document.createElement('p');banner.textContent='LOCAL BLOCK 1 — synthetic accounts and documents only. No email or payment.';banner.className='translation-note';form.before(banner);
const link=document.createElement('a');link.href='translation-workspace.html';link.textContent='View local quote workspace';form.after(link);
const regular=new Set(['Document Translation','Business Translation','Website & Digital Translation','Other Language Service']);
for(const option of [...form.service.options])if(option.value&&!regular.has(option.value))option.remove();
for(const side of ['source','target']){
 const select=form.elements.namedItem(side+'-language'),group=form.querySelector('[data-language-other="'+side+'"]'),other=form.elements.namedItem(side+'-other');
 const update=()=>{group.hidden=select.value!=='Other';other.required=!group.hidden;};select.addEventListener('change',update);update();
}
for(const name of ['budget','quote-currency']){const field=form.elements.namedItem(name);if(field){field.closest('.form-group').hidden=true;field.disabled=true;}}
document.getElementById('block1-upload').hidden=false;file.disabled=false;
let me,block2,busy=false;let savedRequestId=null;const requestId=crypto.randomUUID(),fileId=crypto.randomUUID();
try{me=await api('/api/me');if(me.block2){
 block2=await import('./block2-contracts.mjs');
 const option=document.createElement('option');option.value=option.textContent=block2.SWORN_SERVICE;form.service.append(option);
 const fieldset=document.createElement('fieldset');fieldset.id='sworn-fields';fieldset.hidden=true;
 fieldset.innerHTML='<legend>Sworn Translation (Morocco)</legend><label>Country<input name="sworn-country" value="Morocco" readonly></label><label>Receiving authority<input name="receiving-authority" maxlength="500"></label><label>Authority instructions / requirements<textarea name="authority-requirements" maxlength="2000"></textarea></label><label><input type="checkbox" name="missing-instructions"> I don&#39;t have the receiving authority&#39;s instructions.</label>';
 for(const text of [block2.IN_PERSON,block2.GUARANTEE]){const p=document.createElement('p');p.textContent=text;fieldset.append(p);}
 file.closest('#block1-upload').before(fieldset);
 const update=()=>{const sworn=form.service.value===block2.SWORN_SERVICE;fieldset.hidden=!sworn;file.required=sworn;file.accept=sworn?'.pdf,.jpg,.jpeg,.png':'.txt,.pdf,.docx,.jpg,.jpeg,.png';};form.service.addEventListener('change',update);update();
 }
 if(me.role!=='customer'&&me.role!=='outsider')throw Error('Use a local customer session');form.email.value=me.email||me.role+'@block1.invalid';form.email.readOnly=true;if(!me.switches.capture_enabled||!me.switches.commands_enabled)throw Error('Local workflow switches are OFF');}
catch(e){status.hidden=false;status.textContent=e.message+' — sign in through your local session link.';button.disabled=true;}
form.addEventListener('submit',async event=>{
 event.preventDefault();event.stopImmediatePropagation();if(busy||!me||!me.switches.capture_enabled||!me.switches.commands_enabled||!form.reportValidity())return;
 busy=true;button.disabled=true;status.hidden=false;
 try{
  const doc=file.files[0];if(doc&&doc.size>me.uploads.maxBytes)throw Error('FILE_SIZE_LIMIT: 10 MB per file');
  const f=new FormData(form);const field=k=>String(f.get(k)||'').trim();
  let description=field('message');for(const key of ['deadline','document-type','word-count','document-pages'])if(field(key))description+='\n'+key+': '+field(key);
  const fields={name:field('client-name'),phone:field('phone'),service:field('service'),source:field('source-language')==='Other'?field('source-other'):field('source-language'),target:field('target-language')==='Other'?field('target-other'):field('target-language'),description};
  if(me.block2&&fields.service===block2.SWORN_SERVICE){fields.certified={country:field('sworn-country'),jurisdiction:field('sworn-country'),receivingAuthority:field('receiving-authority')||'Not supplied',requirements:field('authority-requirements')||(form.elements.namedItem('missing-instructions').checked?'Customer does not have the receiving authority instructions':'Requirements need staff review'),missingInstructions:form.elements.namedItem('missing-instructions').checked};}
  if(!savedRequestId){await post('/api/requests',{requestId,fields,...(me.block2?{draft:true}:{})},me.csrf);savedRequestId=requestId;}
  if(file.files[0]){
   document.getElementById('block15-scan-status').textContent='Your file is being scanned for security. This usually takes a few seconds. If the scan does not complete, your file will remain in quarantine and staff will review it manually.';
   const suffix='.'+doc.name.split('.').pop().toLowerCase(),mime=me.uploads.types[suffix]||'application/octet-stream';const response=await fetch('/api/requests/'+savedRequestId+'/files/'+fileId,{method:'POST',credentials:'same-origin',headers:{...authHeaders(),'Content-Type':mime,'x-csrf-token':me.csrf,'x-file-name':encodeURIComponent(doc.name)},body:doc});
   if(!response.ok)throw Error((await response.json()).error);
   const saved=await response.json();document.getElementById('block15-scan-status').textContent=saved.scanStatus==='clean'?'Antivirus scan passed. The staff owner and accepted assigned translator can access the file.':saved.message;
  }
  if(me.block2){await post('/api/requests/'+savedRequestId+'/submit',{},me.csrf);const newOrder=document.createElement('a');newOrder.href='translation-request.html';newOrder.textContent='Missing a page? Start a new order.';form.after(newOrder);}
  status.textContent='Your translation request is saved. No work is scheduled and no payment is due. We will contact you about the next step.';
  link.href='translation-workspace.html#'+savedRequestId;for(const control of form.elements)control.disabled=true;
 }catch(e){status.textContent=(savedRequestId?'Request saved; document was not attached. Retry the file upload or view your saved request. ':'Request was not saved. ')+e.message;button.disabled=false;}
 finally{busy=false;}
},true);
