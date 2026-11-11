import {instructorStore} from './learn/instructor-store.mjs';
import {prepareVerification,verificationCopy} from './service-verification.mjs';
import {applyLocale,resolveLocale} from './learn/locale.mjs';
const lang=resolveLocale(location.search),t=verificationCopy[lang];applyLocale(lang);
const status=document.querySelector('#status'),queue=document.querySelector('#queue');
document.querySelector('#title').textContent=t.review;document.querySelector('#policy').textContent=t.policy;
document.querySelector('#refresh').textContent=t.refresh;prepareVerification(document.querySelector('#auth'));
function element(tag,value){const e=document.createElement(tag);e.textContent=String(value??'');return e;}
async function load(){
 queue.replaceChildren();status.textContent='';
 const {data:{user}}=await instructorStore.auth.getUser();
 if(!user){status.textContent=t.staff;return;}
 const {data,error}=await instructorStore.rpc('service_intake_review_queue');
 if(error){status.textContent=t.staff;return;}
 document.querySelector('#auth').hidden=true;
 const id=location.hash.slice(1);const rows=/^[0-9a-f-]{36}$/i.test(id)?data.filter(r=>r.id===id):data;
 if(!rows.length){status.textContent=t.empty;return;}
 for(const r of rows){
  const card=document.createElement('article');card.append(element('h2',`${r.kind} · ${r.id}`),element('p',`${r.email} · ${new Date(r.created_at).toLocaleString(lang)}`),element('p',`${t.verified} ${r.email_verified_at}`),element('p',`${t.delivery}: ${r.delivery} · ${t.work}: ${r.work_status}`));
  const dl=document.createElement('dl');for(const [key,value] of Object.entries(r.fields)){dl.append(element('dt',key),element('dd',Array.isArray(value)?value.join(', '):value));}card.append(dl);
  for(const [state,label] of [['in_progress',t.start],['closed',t.close]]){const b=element('button',label);b.type='button';b.disabled=r.work_status===state;b.onclick=async()=>{b.disabled=true;const {error}=await instructorStore.rpc('service_intake_set_work_status',{p_id:r.id,p_status:state});if(error){status.textContent=t.staff;b.disabled=false;}else await load();};card.append(b);}
  queue.append(card);
 }
}
document.querySelector('#refresh').onclick=load;await load();
