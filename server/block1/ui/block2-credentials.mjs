import {api,post,authHeaders,privateDownload} from './block1-local.mjs';
import {validateDOB} from './block2-contracts.mjs';
const form=document.getElementById('credential-form'),status=document.getElementById('status'),list=document.getElementById('credentials');
let me;
const node=(tag,value,parent)=>{const e=document.createElement(tag);e.textContent=value;parent.append(e);return e;};
async function refresh(){
 list.replaceChildren();const rows=await api('/api/credentials');
 if(!rows.length)node('p','No clean credential image has been submitted.',list);
 for(const c of rows){const article=document.createElement('article');list.append(article);
  node('h2',c.legal_name,article);node('p','DOB: '+c.dob+' · Ministry credential: '+c.credential_number,article);node('p','Review: '+c.reviewState+(c.isCurrent?' (current)':' (historical)'),article);
  const link=node('a','Download clean credential image',article);link.href='/api/credentials/'+c.id+'/file';privateDownload(link);
  if(me.role==='staff'&&c.isCurrent){
   const label=node('label','Review reason',article),reason=document.createElement('input');reason.maxLength=2000;label.append(reason);
   for(const decision of ['approved','rejected','revoked']){const b=node('button',decision,article);b.type='button';b.disabled=!me.switches.commands_enabled;b.onclick=async()=>{b.disabled=true;try{if(!reason.value.trim())throw Error('Provide a review reason');await post('/api/credentials/'+c.id+'/review',{reviewId:crypto.randomUUID(),expectedRevision:c.revision,decision,reason:reason.value.trim()},me.csrf);await refresh();status.textContent='Local staff decision recorded. No email sent.';}catch(e){status.textContent=e.message;b.disabled=false;}};}
  }
 }
}
form.dob.addEventListener('input',()=>{try{validateDOB(form.dob.value);form.dob.setCustomValidity('');}catch(e){form.dob.setCustomValidity(e.message);}});
form.addEventListener('submit',async event=>{
 event.preventDefault();const button=form.querySelector('button');button.disabled=true;
 try{
  validateDOB(form.dob.value);if(!form.reportValidity())return;
  const image=form.image.files[0];if(!image)throw Error('Credential image required');if(image.size>me.uploads.maxBytes)throw Error('FILE_SIZE_LIMIT');
  const fields={legalName:form.legalName.value,dob:form.dob.value,credentialNumber:form.credentialNumber.value};
  const response=await fetch('/api/credentials',{method:'POST',credentials:'same-origin',headers:{...authHeaders(),'x-csrf-token':me.csrf,'x-file-name':encodeURIComponent(image.name),'x-credential-fields':encodeURIComponent(JSON.stringify(fields)),'Content-Type':image.name.toLowerCase().endsWith('.png')?'image/png':'image/jpeg'},body:image});
  const result=await response.json();if(!response.ok)throw Error(result.error);
  status.textContent=result.scanStatus==='clean'?'Clean image saved privately. Staff review pending.':'Credential was not submitted: '+result.scanStatus+'. No image retained. No automatic retry.';await refresh();
 }catch(e){status.textContent=e.message;}finally{button.disabled=!me?.switches.capture_enabled||!me?.switches.commands_enabled;}
});
try{me=await api('/api/me');if(!me.block2)throw Error('Use the Block 2 mock launcher');form.hidden=!['provider','replacement'].includes(me.role);form.querySelector('button').disabled=!me.switches.capture_enabled||!me.switches.commands_enabled;await refresh();}catch(e){status.textContent=e.message;}
