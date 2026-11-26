import {api,node,dataNode,message,typeNames,statusNames,profileDetails,optionalIntroVideo} from './supply-client.mjs';
const form=document.querySelector('#profile-form'),notice=document.querySelector('#message'),type=document.querySelector('#vendor-type');let rows=[];
const split=value=>value.split(/[,\n]/).map(s=>s.trim()).filter(Boolean);
const field=name=>form.elements.namedItem(name);
const pairBox=document.querySelector('#language-pairs'),addPair=document.querySelector('#add-pair');
function pairRow(source='',target=''){
 const row=document.createElement('div');row.className='pair';
 const from=document.createElement('input');from.placeholder='From language';from.maxLength=80;from.dataset.pair='from';from.value=source;
 const to=document.createElement('input');to.placeholder='To language';to.maxLength=80;to.dataset.pair='to';to.value=target;
 const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remove language pair');
 remove.onclick=()=>{row.remove();if(!pairBox.querySelector('.pair'))pairRow();};
 row.append(from,to,remove);pairBox.append(row);return row;
}
function renderPairs(pairs){pairBox.replaceChildren();for(const pair of pairs)pairRow(pair.source,pair.target);if(!pairBox.querySelector('.pair'))pairRow();}
addPair.textContent='+ Add language pair';
addPair.onclick=()=>pairRow();
function editor(t){
 const row=rows.find(r=>r.type===t),p=row?.profile;form.reset();type.value=t;
 for(const fs of form.querySelectorAll('[data-type]')){fs.hidden=fs.dataset.type!==t;fs.disabled=fs.hidden;}
 if(t==='translator')renderPairs(p?.languagePairs||[]);
 if(!p)return; for(const key of ['displayName','bio','timezone','introVideo','organizationKind','capacity'])if(p[key]!==undefined)field(key).value=p[key];
 field('publicationConsent').checked=p.publicationConsent;
 if(t==='teacher'){field('languages').value=p.languages.join(', ');field('hourlyRate').value=(p.hourlyRateMinor/100).toFixed(2);field('teacherCurrency').value=p.currency;for(const slot of p.availability){form.querySelector(`[name="day"][value="${slot.day}"]`).checked=true;field('start'+slot.day).value=slot.start;field('end'+slot.day).value=slot.end;}}
 if(t==='translator'){for(const box of form.querySelectorAll('[name="specialties"]'))box.checked=p.specialties.includes(box.value);}
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
 const credentialPanel=document.getElementById('credential-panel'),credentialSelect=document.getElementById('credential-application'),translatorRows=rows.filter(r=>r.type==='translator');
 if(credentialPanel){const show=translatorRows.length>0;credentialPanel.hidden=!show;credentialPanel.style.display=show?'':'none';}
 credentialSelect.replaceChildren();if(!translatorRows.length){const option=node('option','Save an application first');option.value='';credentialSelect.append(option);}for(const row of translatorRows){const option=dataNode('option',row.profile.displayName+' · '+(window.MarocoraSite?.t(typeNames[row.type])||typeNames[row.type]));option.value=row.id;credentialSelect.append(option);}
 editor(type.value);
}
async function submit(form,work){const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);message(notice,'Saving…');notice.scrollIntoView({behavior:'smooth',block:'center'});try{await work();await load();void introLoad();message(notice,'Saved. Profile changes and new credentials are pending review. Payout connections remain pending.');notice.scrollIntoView({behavior:'smooth',block:'center'});}catch(error){message(notice,error.message,true);notice.scrollIntoView({behavior:'smooth',block:'center'});}finally{buttons.forEach(b=>b.disabled=false);}}
type.onchange=()=>editor(type.value);
form.onsubmit=event=>{event.preventDefault();void submit(form,async()=>{
 const data=new FormData(form),t=type.value,p={displayName:data.get('displayName').trim(),bio:data.get('bio').trim(),publicationConsent:data.has('publicationConsent')};
 const rate=value=>{if(!/^\d+(\.\d{1,2})?$/.test(value))throw Error('Use a positive rate with at most two decimal places.');return Math.round(Number(value)*100);};
 if(t==='teacher'){Object.assign(p,{languages:split(data.get('languages')),hourlyRateMinor:rate(data.get('hourlyRate')),currency:data.get('teacherCurrency'),timezone:data.get('timezone').trim(),introVideo:optionalIntroVideo(data.get('introVideo')),availability:data.getAll('day').map(day=>({day:Number(day),start:data.get('start'+day),end:data.get('end'+day)}))});}
 if(t==='translator'){const pairs=[...pairBox.querySelectorAll('.pair')].map(row=>({source:row.querySelector('[data-pair="from"]').value.trim(),target:row.querySelector('[data-pair="to"]').value.trim()})).filter(pair=>pair.source||pair.target);if(!pairs.length)throw Error('Add at least one language pair.');for(const pair of pairs)if(!pair.source||!pair.target)throw Error('Each language pair needs both a from and a to language.');Object.assign(p,{organizationKind:data.get('organizationKind'),languagePairs:pairs,specialties:data.getAll('specialties')});}
 if(t==='transport')Object.assign(p,{vehicleTypes:data.getAll('vehicleTypes'),capacity:Number(data.get('capacity')),serviceRegions:split(data.get('serviceRegions')),baseRateMinor:rate(data.get('baseRate')),currency:data.get('transportCurrency')});
 const current=rows.find(r=>r.type===t);await api('/api/supply/applications',{method:'POST',body:{type:t,profile:p,...(current?{id:current.id,revision:current.revision}:{})}});
 });};
const credentialForm=document.querySelector('#credential-form');credentialForm.onsubmit=event=>{event.preventDefault();void submit(credentialForm,async()=>{const data=new FormData(credentialForm),file=data.get('file'),extension=file.name.split('.').pop().toLowerCase();if(!['pdf','jpg','jpeg','png'].includes(extension)||file.size>5*1024*1024)throw Error('Choose a PDF, JPG or PNG of up to 5 MB.');await api('/api/supply/applications/'+encodeURIComponent(data.get('application'))+'/credentials',{method:'POST',body:file,headers:{'Content-Type':{'pdf':'application/pdf','png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg'}[extension],'X-File-Name':'credential.'+extension}});credentialForm.reset();});};
load().catch(error=>message(notice,error.message,true));
api('/api/auth/me').then(me=>{const el=document.querySelector('#signed-in');if(el)el.textContent=me.email?'Signed in as '+me.email:'';}).catch(()=>{});

document.addEventListener('marocora:language',()=>{for(const id of ['credential-application'])for(const option of document.getElementById(id).options){const row=rows.find(item=>item.id===option.value);if(row)option.textContent=row.profile.displayName+' · '+window.MarocoraSite.t(typeNames[row.type]);}});
// —— Introduction video (step 2): upload first, camera recording second. ——
const introCapture=document.querySelector('#intro-capture'),introStatus=document.querySelector('#intro-status'),introPreview=document.querySelector('#intro-preview'),introFile=document.querySelector('#intro-file'),introRecord=document.querySelector('#intro-record'),introStop=document.querySelector('#intro-stop'),introUpload=document.querySelector('#intro-upload'),introProgress=document.querySelector('#intro-progress');
const INTRO_MAX_BYTES=120*1024*1024,INTRO_MAX_SECONDS=180;
let introPending=null,introRecorder=null,introTimer=null,introPoll=null,introStream=null;
function introSay(text,error=false){introStatus.textContent=text;introStatus.classList.toggle('error',error);}
function introBytes(n){return n>=1024*1024?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';}
function introPick(row){return row&&row.type==='teacher'?row:null;}
function introCleanup(){if(introTimer){clearInterval(introTimer);introTimer=null;}if(introPoll){clearTimeout(introPoll);introPoll=null;}if(introStream){introStream.getTracks().forEach(t=>t.stop());introStream=null;}if(introRecorder&&introRecorder.state!=='inactive')introRecorder.stop();introRecorder=null;if(introStop)introStop.hidden=true;if(introRecord)introRecord.hidden=false;}
function introReset(){if(introPending){URL.revokeObjectURL(introPreview.src);introPending=null;}introPreview.hidden=true;introPreview.removeAttribute('src');introUpload.hidden=true;introProgress.hidden=true;introProgress.value=0;}
async function introLoad(){
 const row=introPick(rows.find(r=>r.type==='teacher'));
 if(!type.value||type.value!=='teacher'){introCapture.hidden=true;introCleanup();return;}
 introCapture.hidden=false;
 if(!row){introSay('Save your profile once to add a video.');introFile.disabled=true;introRecord.disabled=true;introUpload.disabled=true;introReset();return;}
 introFile.disabled=false;introRecord.disabled=false;
 introSay('Checking your video…');
 try{
  const state=await api('/api/supply/applications/'+encodeURIComponent(row.id)+'/intro');
  if(state.status==='ready'){
   introSay('Video ready on file'+(state.hasAudio===false?' (no sound detected — please record again with a microphone)':'')+'. Duration '+Math.round(state.durationSeconds||0)+'s. Uploading a new one replaces it.');
   introPreview.src='/api/supply/applications/'+encodeURIComponent(row.id)+'/intro/video?v='+Date.now();introPreview.hidden=false;introUpload.hidden=true;
  }else if(state.status==='processing'){
   introSay('Processing your video…');introUpload.hidden=true;scheduleIntroPoll(row.id);
  }else if(state.status==='failed'){
   introSay('The last video could not be processed ('+(state.failureCode||'unknown')+'). Please try again.',true);introReset();
  }else{
   introSay('No video yet. Upload a file, or record with your camera.');introReset();
  }
 }catch(error){introSay(error.message,true);}
}
function scheduleIntroPoll(id){if(introPoll)clearTimeout(introPoll);introPoll=setTimeout(()=>{introPoll=null;void introLoad();},4000);}
function introChoose(file){
 if(!file)return;
 if(file.size>INTRO_MAX_BYTES){introSay('That file is '+introBytes(file.size)+'. The limit is 120 MB.',true);return;}
 if(!['video/mp4','video/webm','video/quicktime'].includes(file.type)){introSay('Choose an MP4, WebM or MOV video.',true);return;}
 introPending=file;introPreview.src=URL.createObjectURL(file);introPreview.hidden=false;introUpload.hidden=false;
 introSay('Ready to upload: '+file.name+' ('+introBytes(file.size)+').');
}
function introSend(blob,filename){
 const row=introPick(rows.find(r=>r.type==='teacher'));if(!row)return;
 introSay('Uploading…');introProgress.hidden=false;introProgress.value=0;introUpload.disabled=true;introRecord.disabled=true;
 const xhr=new XMLHttpRequest();xhr.open('POST','/api/supply/applications/'+encodeURIComponent(row.id)+'/intro');
 xhr.withCredentials=true;xhr.setRequestHeader('Content-Type',blob.type||'video/mp4');xhr.setRequestHeader('X-File-Name',filename);
 xhr.upload.onprogress=event=>{if(event.lengthComputable)introProgress.value=Math.round(event.loaded/event.total*100);};
 xhr.onload=()=>{
  introUpload.disabled=false;introRecord.disabled=false;
  let data={};try{data=JSON.parse(xhr.responseText||'{}');}catch{}
  if(xhr.status===202){introSay('Uploaded. Converting for playback…');scheduleIntroPoll(row.id);return;}
  introProgress.hidden=true;introSay(data.error?({SUPPLY_INTRO_TOO_LARGE:'That video is too large.',SUPPLY_INTRO_TOO_LONG:'That video is longer than 3 minutes.',SUPPLY_INTRO_FORMAT_INVALID:'That file is not a readable MP4, WebM or MOV.',SUPPLY_INTRO_RATE_LIMIT:'Too many uploads in the last hour. Please try again later.',SUPPLY_INTRO_UNAVAILABLE:'Video upload is not available right now.'}[data.error]||'The upload failed. Please try again.'):'The upload failed. Please try again.',true);
 };
 xhr.onerror=()=>{introUpload.disabled=false;introRecord.disabled=false;introProgress.hidden=true;introSay('The upload was interrupted. Check your connection and try again.',true);};
 xhr.send(blob);
}
introFile.onchange=()=>introChoose(introFile.files[0]);
introUpload.onclick=()=>{if(!introPending)return;introSend(introPending,introPending.name||'introduction');introPending=null;};
introRecord.onclick=async()=>{
 introReset();introSay('Requesting camera and microphone…');
 try{
  introStream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:true});
  introPreview.srcObject=introStream;introPreview.muted=true;introPreview.hidden=false;await introPreview.play().catch(()=>{});
  const candidates=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'];
  const mime=candidates.find(c=>window.MediaRecorder&&MediaRecorder.isTypeSupported(c));
  if(!mime)throw Error('Recording is not supported on this browser. Please upload a file instead.');
  const chunks=[];introRecorder=new MediaRecorder(introStream,{mimeType:mime});
  introRecorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
  introRecorder.onstop=()=>{
   const blob=new Blob(chunks,{type:mime.split(';')[0]});
   introCleanup();introPreview.srcObject=null;
   if(!blob.size){introSay('Nothing was recorded. Please try again.',true);return;}
   introPending=new File([blob],'introduction.'+(blob.type==='video/webm'?'webm':'mp4'),{type:blob.type});
   introPreview.src=URL.createObjectURL(introPending);introPreview.muted=false;introPreview.hidden=false;introUpload.hidden=false;
   introSay('Recorded '+introBytes(blob.size)+'. Watch it back, then upload.');
  };
  let seconds=0;introSay('Recording… 0:00');
  introRecorder.start(1000);introRecord.hidden=true;introStop.hidden=false;
  introTimer=setInterval(()=>{
   seconds+=1;introSay('Recording… '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'));
   if(seconds>=INTRO_MAX_SECONDS-5){introRecorder.stop();}
  },1000);
 }catch(error){introCleanup();introSay(error&&error.name==='NotAllowedError'?'Camera access was refused. Allow camera permission in your browser settings, or upload a recording from your phone.':(error.message||'Recording could not start. You can upload a file instead.'),true);}
};
introStop.onclick=()=>{if(introRecorder&&introRecorder.state!=='inactive')introRecorder.stop();};
const originalEditor=editor;
editor=function(t){originalEditor(t);void introLoad();};
