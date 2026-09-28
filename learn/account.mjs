import { resolveLocale,applyLocale,changeLocale,captureFields,restoreFields,translateHeader,sharedCopy } from './locale.mjs';
import { config } from './config.mjs';
import { currentUser,signOut,onSignOut,sendStudentLink,learningRPC,studentDashboard,publicCatalog,publicSlots } from './learning-store.mjs';
import { taxonomy,localize,money,formatSlot } from './catalog.mjs';
import { escapeReview as e } from './review-view.mjs';
import { launchCopy } from './launch-copy.mjs';
import { requestHTML,readPendingSelection } from './account-view.mjs';
const params=new URLSearchParams(location.search);
let locale=resolveLocale(location.search);
let user=null,dashboard=null,catalog=null,selection=null,busy=false,profileDirty=false;
const app=document.querySelector('#app'),t=k=>launchCopy[locale][k];
function status(message,error=false){const s=document.querySelector('#status');if(s){s.textContent=message;s.className=error?'error':'status';}}
function render(message='') {
 applyLocale(locale);translateHeader(locale);document.title=`${t('account')} | Marocora`;document.querySelector('#locale').value=locale;
 for(const [id,key] of [['browse','browse'],['teach','teach']]){document.querySelector('#'+id).textContent=t(key);document.querySelector('#'+id).href=id==='browse'?`./?lang=${locale}`:`../teacher-apply.html?lang=${locale}`;}
 app.innerHTML=`<h1>${t('account')}</h1><p id="status" role="status">${e(message)}</p>`;
 if(!config.learningLaunchOpen){status(t('setup'));return;}
 if(!user){app.insertAdjacentHTML('beforeend',`<section class="panel"><h2>${t('signin')}</h2><form id="auth-form"><label>${t('email')}<input name="email" type="email" autocomplete="email" required></label><button>${t('send')}</button></form><p>${t('privacy')}</p></section>`);return;}
 const p=dashboard?.profile||{},zone=p.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
 app.insertAdjacentHTML('beforeend',`<div class="actions"><p>${t('signed')} ${e(user.email)}</p><button class="secondary" data-action="out">${t('out')}</button></div><section class="panel"><h2>${t('account')}</h2><form id="student-form"><label>${t('name')}<input name="display_name" value="${e(p.display_name||'')}" maxlength="120" autocomplete="name" required></label><label>${t('timezone')}<input name="timezone" value="${e(zone)}" required></label><label>${t('goals')}<textarea name="goals" maxlength="2000" dir="auto">${e(p.goals||'')}</textarea></label><fieldset><legend>${t('subjects')}</legend><div class="subject-choices">${taxonomy.subjects.map(s=>`<label><input type="checkbox" name="subjects" value="${s.id}" ${(p.subjects||[]).includes(s.id)?'checked':''}>${e(localize(s.name,locale))}</label>`).join('')}</div></fieldset><p class="muted">${t('privacy')}</p><button>${t('save')}</button></form></section><section id="pending-selection"></section><section><h2>${t('favorites')}</h2><div class="pills">${(dashboard?.favorites||[]).map(id=>catalog?.instructors.find(i=>i.id===id)).filter(Boolean).map(i=>`<a class="pill" href="./?instructor=${e(i.id)}&amp;lang=${locale}" dir="auto">${e(i.displayName)}</a>`).join('')||`<p>${t('noFavorites')}</p>`}</div></section><section><h2>${t('requests')}</h2>${(dashboard?.requests||[]).map(r=>requestHTML(r,locale)).join('')||`<p>${t('emptyRequests')}</p>`}</section>`);
 if(selection) {
  const {pending,teacher,offer,slot}=selection;
  document.querySelector('#pending-selection').innerHTML=`<div class="panel"><h2>${t('reviewSelection')}</h2><p dir="auto">${e(teacher.displayName)} · ${e(localize(offer.title,locale))}</p><p>${e(formatSlot(slot,pending.timezone,locale))} (${e(pending.timezone)})</p><p>${e(offer.durationMinutes)} ${sharedCopy[locale].minutes} · ${e(money(offer.priceMinor,offer.currency,locale))}</p><p dir="auto">${e(pending.goal)}</p><p class="notice">${t('requestNote')}</p>${dashboard?.profile?`<button data-action="request">${t('continueRequest')}</button>`:`<p>${t('profileRequired')}</p>`}</div>`;
 }
}
async function load(message='') {
 user=await currentUser();dashboard=null;selection=null;
 if(user){dashboard=await studentDashboard();catalog=await publicCatalog();const pending=readPendingSelection();if(pending&&(!pending.userId||pending.userId===user.id)){const teacher=catalog.instructors.find(i=>i.id===pending.instructorId),offer=catalog.offerings.find(o=>o.id===pending.offeringId&&o.instructorId===pending.instructorId);if(teacher&&offer){const slot=(await publicSlots(teacher.id)).find(s=>s.id===pending.slotId&&s.offeringIds.includes(offer.id));if(slot){try{formatSlot(slot,pending.timezone,locale);selection={pending,teacher,offer,slot};}catch{}}}if(!selection)message=t('cancelledUnavailable');}}
 profileDirty=false;render(message);
}
app.addEventListener('input',event=>{if(event.target.closest('#student-form'))profileDirty=true;});
app.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;busy=true;const button=event.target.querySelector('button');button.disabled=true;
 try {
  const f=new FormData(event.target);
  if(event.target.id==='auth-form'){await sendStudentLink(f.get('email').trim(),locale);status(t('sent'));}
  else {new Intl.DateTimeFormat('en',{timeZone:f.get('timezone').trim()});await learningRPC('learning_save_student_profile',{display_name:f.get('display_name').trim(),timezone:f.get('timezone').trim(),locale,goals:f.get('goals').trim(),subjects:f.getAll('subjects')});await load(t('saved'));}
 }catch{status(t(event.target.id==='auth-form'?'linkError':'error'),true);}finally{busy=false;button.disabled=false;}
});
app.addEventListener('click',async event=>{
 const b=event.target.closest('button');if(!b||busy)return;busy=true;b.disabled=true;
 try {
  if(b.dataset.action==='out'){await signOut();dashboard=null;selection=null;user=null;render();}
  else if(b.dataset.action==='request'&&selection){const p=selection.pending;await learningRPC('learning_request_lesson',{slot_id:p.slotId,offering_id:p.offeringId,goal:p.goal,timezone:p.timezone});try{localStorage.removeItem('marocora.learning.pendingRequest');}catch{}await load(t('requestSent'));}
  else if(b.dataset.request){await learningRPC('learning_update_lesson_request',{request_id:b.dataset.request,decision:b.dataset.decision});await load(t('updated'));}
 }catch(error){status(t(error.message?.includes('REQUEST_LIMIT')?'requestLimit':'error'),true);}finally{busy=false;b.disabled=false;}
});
window.addEventListener('beforeunload',event=>{if(profileDirty){event.preventDefault();event.returnValue='';}});
document.querySelector('#locale').onchange=event=>{if(busy){event.target.value=locale;return;}const fields=captureFields(app);locale=changeLocale(event.target.value,params);render();restoreFields(app,fields);translateHeader(locale);};
render(t('loading'));
if(config.learningLaunchOpen){try{await load();}catch{render(t('error'));}}

onSignOut(()=>{user=null;dashboard=null;selection=null;profileDirty=false;render();});
