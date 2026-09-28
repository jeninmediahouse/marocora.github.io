import { resolveLocale,applyLocale,changeLocale,captureFields,restoreFields,translateHeader,sharedCopy } from './locale.mjs';
import { localDateTime } from './schedule-time.mjs';
import { config } from './config.mjs';
import { currentUser,signOut,onSignOut,learningRPC,instructorDashboard } from './learning-store.mjs';
import { localize,formatSlot,money } from './catalog.mjs';
import { escapeReview as e } from './review-view.mjs';
import { launchCopy } from './launch-copy.mjs';
import { requestHTML } from './account-view.mjs';
const params=new URLSearchParams(location.search);let locale=resolveLocale(location.search);
const t=k=>launchCopy[locale][k],app=document.querySelector('#app');
const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
let user=null,data=null,busy=false;
function render(message=''){
 applyLocale(locale);translateHeader(locale);document.title=`${t('schedule')} | Marocora`;document.querySelector('#locale').value=locale;document.querySelector('#browse').textContent=t('browse');document.querySelector('#browse').href=`./?lang=${locale}`;document.querySelector('#teach').textContent=t('teach');document.querySelector('#teach').href=`../teacher-apply.html?lang=${locale}`;
 app.innerHTML=`<h1>${t('schedule')}</h1><p id="status" role="status">${e(message)}</p>`;
 if(!config.learningLaunchOpen){app.insertAdjacentHTML('beforeend',`<p>${t('setup')}</p>`);return;}
 if(!user){app.insertAdjacentHTML('beforeend',`<p>${t('instructorRequired')}</p><a class="button" href="../teacher-apply.html?lang=${locale}">${t('teach')}</a>`);return;}
 app.insertAdjacentHTML('beforeend',`<p>${t('signed')} ${e(user.email)}</p><button class="secondary" data-action="out">${t('out')}</button>`);
 const p=data?.publication;
 if(!p){app.insertAdjacentHTML('beforeend',`<p>${t('publicationRequired')}</p>`);return;}
 if(!p.visible){app.insertAdjacentHTML('beforeend',`<p class="notice">${t('hidden')}</p>`);}
 else {
  const offers=p.data.offerings.filter(o=>o.lessonCount===1);
  app.insertAdjacentHTML('beforeend',`<p class="notice">${t('availabilityNote')}</p><section class="panel"><h2>${t('addSlot')}</h2><form id="slot-form"><p>${t('browserZone')} <strong>${e(zone)}</strong></p><div class="match-grid"><label>${t('start')}<input type="datetime-local" name="starts_at" required></label><label>${t('end')}<input type="datetime-local" name="ends_at" required></label></div><fieldset><legend>${t('slotOffers')}</legend>${offers.map(o=>`<label><input type="checkbox" name="offering_ids" value="${e(o.id)}">${e(localize(o.title,locale))} · ${e(o.durationMinutes)} ${sharedCopy[locale].minutes} · ${e(money(o.priceMinor,o.currency,locale))}</label>`).join('')}</fieldset><button>${t('saveSlot')}</button></form></section>`);
 }
 app.insertAdjacentHTML('beforeend',`<section><h2>${t('schedule')}</h2>${(data.slots||[]).map(s=>`<article class="panel"><p>${e(formatSlot({startsAt:s.starts_at},zone,locale))} - ${e(new Intl.DateTimeFormat(locale,{timeZone:zone,timeStyle:'short'}).format(new Date(s.ends_at)))} (${e(zone)})</p><p>${s.offering_ids.map(id=>p.data.offerings.find(o=>o.id===id)).filter(Boolean).map(o=>e(localize(o.title,locale))).join(', ')}</p><button class="secondary" data-slot="${e(s.id)}">${t('remove')}</button></article>`).join('')||`<p>${t('noSlots')}</p>`}</section><section><h2>${t('requests')}</h2>${(data.requests||[]).map(r=>requestHTML(r,locale,true)).join('')||`<p>${t('emptyRequests')}</p>`}</section>`);
}
async function load(message=''){user=await currentUser();data=user?await instructorDashboard():null;render(message);}
function status(message){const s=document.querySelector('#status');s.textContent=message;s.className='error';}
app.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;busy=true;const b=event.target.querySelector('button');b.disabled=true;
 try{const f=new FormData(event.target),ids=f.getAll('offering_ids');if(!ids.length)throw new Error('INVALID_AVAILABILITY');const start=localDateTime(f.get('starts_at')),end=localDateTime(f.get('ends_at'));await learningRPC('learning_save_availability',{starts_at:start,ends_at:end,offering_ids:ids});await load(t('updated'));}catch{status(t('slotError'));}finally{busy=false;b.disabled=false;}
});
app.addEventListener('click',async event=>{
 const b=event.target.closest('button');if(!b||busy)return;busy=true;b.disabled=true;
 try{if(b.dataset.action==='out'){await signOut();user=null;data=null;render();}else if(b.dataset.slot){await learningRPC('learning_remove_availability',{slot_id:b.dataset.slot});await load(t('updated'));}else if(b.dataset.request){await learningRPC('learning_update_lesson_request',{request_id:b.dataset.request,decision:b.dataset.decision});await load(t('updated'));}}catch{status(t('error'));}finally{busy=false;b.disabled=false;}
});
document.querySelector('#locale').onchange=event=>{if(busy){event.target.value=locale;return;}const fields=captureFields(app);locale=changeLocale(event.target.value,params);render();restoreFields(app,fields);translateHeader(locale);};render(t('loading'));if(config.learningLaunchOpen){try{await load();}catch{render(t('error'));}}

onSignOut(()=>{user=null;data=null;render();});
