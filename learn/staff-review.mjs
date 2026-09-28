import { publicationControls,publicPreviewHTML } from './publication-view.mjs';
import { launchCopy } from './launch-copy.mjs';
import { config } from './config.mjs';
import { instructorStore, currentInstructor, signOutInstructor } from './instructor-store.mjs';
import { reviewCopy, applicationHTML, escapeReview } from './review-view.mjs';
const app = document.querySelector('#app');
const params = new URLSearchParams(location.search);
let locale = params.get('lang') === 'fr' ? 'fr' : 'en';
let user = null, rows = [], busy = false;
const previews=new Map();
const t = key => reviewCopy[locale][key];
async function rpc(name, args) {
  const {data,error} = await instructorStore.rpc(name,args);
  if (error) throw error;
  return data;
}
function shell(message = '') {
  document.documentElement.lang = locale;
  document.title = `${t('title')} | Marocora`;
  document.querySelector('#locale').value = locale;
  const link = document.querySelector('#apply-link'); link.textContent = t('apply'); link.href = `teacher-apply.html?lang=${locale}`;
  app.innerHTML = `<h1>${t('title')}</h1><p>${t('intro')}</p><p role="status">${escapeReview(message)}</p>`;
  app.setAttribute('aria-busy', 'false');
}
async function load() {
  shell(t('loading'));
  try {
    if (!config.staffReviewOpen) { shell(t('setup')); return; }
    user = await currentInstructor();
    if (!user) { shell(t('signin')); return; }
    if (!await rpc('learning_staff_review_access')) { shell(t('denied')); return; }
    rows = await rpc('learning_staff_review_queue');previews.clear();
    const publications=config.learningLaunchOpen?await rpc('learning_staff_publications'):[];
    shell();
    app.insertAdjacentHTML('beforeend', `<div class="actions"><button data-action="refresh">${t('refresh')}</button><button class="secondary" data-action="out">${t('out')}</button></div>${rows.length ? rows.map(r => applicationHTML(r,locale,user.id)+(config.learningLaunchOpen?publicationControls(r,locale,user.id):'')).join('') : `<p>${t('empty')}</p>`}`);
      if(publications.length)app.insertAdjacentHTML('beforeend',`<section class="panel"><h2>${launchCopy[locale].publication}</h2>${publications.map(p=>`<div data-publication="${escapeReview(p.user_id)}"><p>${escapeReview(p.displayName)} · ${escapeReview(p.revision)} · ${p.visible?(locale==='fr'?'Publié':'Published'):(locale==='fr'?'Masqué':'Hidden')}</p><button class="secondary" data-action="unpublish">${launchCopy[locale].unpublish}</button><p role="status"></p></div>`).join('')}</section>`);
  } catch { rows = []; shell(t('error')); }
}
app.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const form = event.target;
  const row = rows.find(r => r.user_id === form.dataset.applicant);
  if (!row) return;
  const values = new FormData(form);
  const button = form.querySelector('button');
  const status = form.querySelector('[role=status]');
  busy = true; button.disabled = true;
  try {
    await rpc('review_learning_instructor_application', {
      applicant_id:row.user_id, expected_revision:row.revision, profile_decision:values.get('profile'),
      subject_decisions:row.data.subjects.map((s,i) => ({category:s.category, subject:s.subject, decision:values.get(`subject-${i}`)})),
      feedback:values.get('feedback')
    });
    await load();
    const updated = [...app.querySelectorAll('form')].find(f => f.dataset.applicant === row.user_id);
    if (updated) updated.querySelector('[role=status]').textContent = t('saved');
  } catch (error) {
    status.textContent = t(error.message?.includes('STALE_REVISION') || error.message?.includes('NOT_SUBMITTED') ? 'stale' : error.message?.includes('FEEDBACK_REQUIRED') ? 'required' : 'error');
    status.classList.add('error');
  } finally { busy = false; button.disabled = false; }
});
app.addEventListener('change',event=>{
 const section=event.target.closest('[data-publication]');if(!section)return;
 if(event.target.hasAttribute('data-publish-subject')){previews.delete(section.dataset.publication);section.querySelector('[data-preview]').innerHTML='';}
 if(event.target.hasAttribute('data-publication-confirm'))section.querySelector('[data-action="publish"]').disabled=!event.target.checked;
});
app.addEventListener('click', async event => {
 const button=event.target.closest('[data-action]'),action=button?.dataset.action;
 if(!action||busy)return;busy=true;button.disabled=true;
 const section=button.closest('[data-publication]');
 try {
  if(section){
   const row=rows.find(r=>r.user_id===section.dataset.publication),c=launchCopy[locale];
   const indices=[...section.querySelectorAll('[data-publish-subject]:checked')].map(n=>Number(n.value));
   const args={applicant_id:section.dataset.publication,expected_revision:row?.revision,selected_subjects:indices};
   if(action==='preview'){const result=await rpc('learning_staff_publication_preview',args);previews.set(row.user_id,JSON.stringify(args));section.querySelector('[data-preview]').innerHTML=publicPreviewHTML(result,locale);}
   else if(action==='publish'){if(!section.querySelector('[data-publication-confirm]')?.checked||previews.get(row.user_id)!==JSON.stringify(args))throw new Error('PREVIEW_REQUIRED');await rpc('publish_learning_instructor',args);section.querySelector('[role=status]').textContent=c.publishSaved;previews.delete(row.user_id);section.querySelector('[data-preview]').innerHTML='';}
   else if(action==='unpublish'){await rpc('unpublish_learning_instructor',{applicant_id:section.dataset.publication});section.querySelector('[role=status]').textContent=c.publishSaved;}
  }else{if(action==='out'){await signOutInstructor();rows=[];user=null;}await load();}
 }catch{if(section)section.querySelector('[role=status]').textContent=launchCopy[locale].publishError;else shell(t('error'));}
 finally{busy=false;if(action!=='publish')button.disabled=false;}
});
document.querySelector('#locale').onchange = async event => {
  if (busy) { event.target.value = locale; return; }
  locale = event.target.value; params.set('lang',locale); history.replaceState(null,'',`?${params}`); await load();
};
await load();

if (config.staffReviewOpen && instructorStore) {
  instructorStore.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') { rows = []; user = null; shell(t('signin')); }
  });
}
