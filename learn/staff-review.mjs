import { config } from './config.mjs';
import { instructorStore, currentInstructor, signOutInstructor } from './instructor-store.mjs';
import { reviewCopy, applicationHTML, escapeReview } from './review-view.mjs';
const app = document.querySelector('#app');
const params = new URLSearchParams(location.search);
let locale = params.get('lang') === 'fr' ? 'fr' : 'en';
let user = null, rows = [], busy = false;
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
    rows = await rpc('learning_staff_review_queue');
    shell();
    app.insertAdjacentHTML('beforeend', `<div class="actions"><button data-action="refresh">${t('refresh')}</button><button class="secondary" data-action="out">${t('out')}</button></div>${rows.length ? rows.map(r => applicationHTML(r,locale,user.id)).join('') : `<p>${t('empty')}</p>`}`);
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
app.addEventListener('click', async event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action || busy) return;
  busy = true;
  try { if (action === 'out') { await signOutInstructor(); rows = []; user = null; } await load(); }
  catch { shell(t('error')); }
  finally { busy = false; }
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
