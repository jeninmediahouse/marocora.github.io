import {api,node,dataNode,message,typeNames,statusNames,profileDetails} from './supply-client.mjs';
const form=document.querySelector('#profile-form'),notice=document.querySelector('#message'),type=document.querySelector('#vendor-type');let rows=[];
const split=value=>value.split(/[,\n]/).map(s=>s.trim()).filter(Boolean);
const field=name=>form.elements.namedItem(name);
function editor(t){
 const row=rows.find(r=>r.type===t),p=row?.profile;form.reset();type.value=t;
 for(const fs of form.querySelectorAll('[data-type]')){fs.hidden=fs.dataset.type!==t;fs.disabled=fs.hidden;}
 if(!p)return;
 for(const key of ['displayName','bio','timezone','introVideo','organizationKind','capacity'])if(p[key]!==undefined)field(key).value=p[key];
 field('publicationConsent').checked=p.publicationConsent;
 if(t==='teacher'){field('languages').value=p.languages.join(', ');field('hourlyRate').value=(p.hourlyRateMinor/100).toFixed(2);field('teacherCurrency').value=p.currency;for(const slot of p.availability){form.querySelector(`[name="day"][value="${slot.day}"]`).checked=true;field('start'+slot.day).value=slot.start;field('end'+slot.day).value=slot.end;}}
 if(t==='translator'){field('languagePairs').value=p.languagePairs.map(pair=>pair.source+' | '+pair.target).join('\n');for(const box of form.querySelectorAll('[name="specialties"]'))box.checked=p.specialties.includes(box.value);}
 if(t==='transport'){field('serviceRegions').value=p.serviceRegions.join(', ');field('baseRate').value=(p.baseRateMinor/100).toFixed(2);field('transportCurrency').value=p.currency;for(const box of form.querySelectorAll('[name="vehicleTypes"]'))box.checked=p.vehicleTypes.includes(box.value);}
}
async function load(){
 rows=await api('/api/supply/applications');const list=document.querySelector('#applications');list.replaceChildren();
 if(!rows.length)list.append(node('p','No applications yet. Complete a profile below.','muted'));
 for(const row of rows){const card=node('article',undefined,'card');card.append(dataNode('h3',row.profile.displayName),node('p',typeNames[row.type]),node('span',statusNames[row.status],'status '+row.status),profileDetails(row.profile,row.type));const edit=node('button','Edit profile','secondary');edit.type='button';edit.onclick=()=>{editor(row.type);form.scrollIntoView({behavior:'auto'});field('displayName').focus();};card.append(edit);
  const payout=row.payout,payoutLine=node('p',undefined,'muted');payoutLine.append(node('span','Payout connection: pending'));if(payout.configured)payoutLine.append(document.createTextNode(' · '),node('span','Bank details saved'),dataNode('span',' (•••• '+payout.lastFour+')'));card.append(payoutLine);
  for(const review of row.reviews.slice(0,1))if(review.reason){const feedback=node('p');feedback.append(node('span','Review feedback:'),document.createTextNode(' '),dataNode('span',review.reason));card.append(feedback);}
  for(const credential of row.credentials){const link=node('a','Download private credential');link.href='/api/supply/credentials/'+encodeURIComponent(credential.id);link.style.display='block';card.append(link);}
  if(row.status==='approved'&&row.profile.publicationConsent){const link=node('a','View approved public profile');link.href='/supply-profile.html?id='+encodeURIComponent(row.id);const paragraph=node('p');paragraph.append(link);card.append(paragraph);}list.append(card);
 }
 for(const [id,selected] of [['payout-application',rows],['credential-application',rows.filter(r=>r.type==='translator')]]){const select=document.getElementById(id);select.replaceChildren();if(!selected.length){const option=node('option','Save an application first');option.value='';select.append(option);}for(const row of selected){const option=dataNode('option',row.profile.displayName+' · '+(window.MarocoraSite?.t(typeNames[row.type])||typeNames[row.type]));option.value=row.id;select.append(option);}}
 editor(type.value);
}
async function submit(form,work){const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);message(notice,'Saving…');try{await work();await load();message(notice,'Saved. Profile changes and new credentials are pending review. Payout connections remain pending.');}catch(error){message(notice,error.message,true);}finally{buttons.forEach(b=>b.disabled=false);}}
type.onchange=()=>editor(type.value);
form.onsubmit=event=>{event.preventDefault();void submit(form,async()=>{
 const data=new FormData(form),t=type.value,p={displayName:data.get('displayName').trim(),bio:data.get('bio').trim(),publicationConsent:data.has('publicationConsent')};
 const rate=value=>{if(!/^\d+(\.\d{1,2})?$/.test(value))throw Error('Use a positive rate with at most two decimal places.');return Math.round(Number(value)*100);};
 if(t==='teacher'){Object.assign(p,{languages:split(data.get('languages')),hourlyRateMinor:rate(data.get('hourlyRate')),currency:data.get('teacherCurrency'),timezone:data.get('timezone').trim(),introVideo:data.get('introVideo').trim(),availability:data.getAll('day').map(day=>({day:Number(day),start:data.get('start'+day),end:data.get('end'+day)}))});}
 if(t==='translator'){const pairs=data.get('languagePairs').split('\n').filter(s=>s.trim()).map(line=>{const parts=line.split('|');if(parts.length!==2)throw Error('Use one language pair per line, separated by a vertical bar.');return {source:parts[0].trim(),target:parts[1].trim()};});Object.assign(p,{organizationKind:data.get('organizationKind'),languagePairs:pairs,specialties:data.getAll('specialties')});}
 if(t==='transport')Object.assign(p,{vehicleTypes:data.getAll('vehicleTypes'),capacity:Number(data.get('capacity')),serviceRegions:split(data.get('serviceRegions')),baseRateMinor:rate(data.get('baseRate')),currency:data.get('transportCurrency')});
 const current=rows.find(r=>r.type===t);await api('/api/supply/applications',{method:'POST',body:{type:t,profile:p,...(current?{id:current.id,revision:current.revision}:{})}});
 });};
const credentialForm=document.querySelector('#credential-form');credentialForm.onsubmit=event=>{event.preventDefault();void submit(credentialForm,async()=>{const data=new FormData(credentialForm),file=data.get('file'),extension=file.name.split('.').pop().toLowerCase();if(!['pdf','jpg','jpeg','png'].includes(extension)||file.size>5*1024*1024)throw Error('Choose a PDF, JPG or PNG of up to 5 MB.');await api('/api/supply/applications/'+encodeURIComponent(data.get('application'))+'/credentials',{method:'POST',body:file,headers:{'Content-Type':{'pdf':'application/pdf','png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg'}[extension],'X-File-Name':'credential.'+extension}});credentialForm.reset();});};
const payoutForm=document.querySelector('#payout-form');payoutForm.onsubmit=event=>{event.preventDefault();void submit(payoutForm,async()=>{const data=new FormData(payoutForm);try{await api('/api/supply/applications/'+encodeURIComponent(data.get('application'))+'/payout',{method:'POST',body:{iban:data.get('iban'),swift:data.get('swift'),accountHolder:data.get('accountHolder')}});}finally{payoutForm.reset();}});};
load().catch(error=>message(notice,error.message,true));

document.addEventListener('marocora:language',()=>{for(const id of ['payout-application','credential-application'])for(const option of document.getElementById(id).options){const row=rows.find(item=>item.id===option.value);if(row)option.textContent=row.profile.displayName+' · '+window.MarocoraSite.t(typeNames[row.type]);}});
