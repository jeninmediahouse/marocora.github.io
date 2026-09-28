import { resolveLocale,applyLocale,changeLocale,captureFields,restoreFields,translateHeader,sharedCopy } from './locale.mjs';
import { instructorCopy as copy } from './instructor-copy.mjs';
import { feedbackHTML, reviewCopy, escapeReview } from './review-view.mjs';
import { taxonomy, canonicalSubject } from './taxonomy.mjs';
import { countryCodes } from './profile-fields.mjs';
import { config } from './config.mjs';
import { instructorFieldProblem, fieldLabels } from './instructor-validation.mjs';
import { request } from './api.mjs';
import { instructorStore, currentInstructor, sendInstructorLink, loadInstructorDraft,
  saveInstructorDraft, submitInstructorDraft, signOutInstructor } from './instructor-store.mjs';
import { normalizeInstructorDraft, requireCompleteInstructorDraft } from '../server/instructor-draft.mjs';

const params = new URLSearchParams(location.search);
let locale = resolveLocale(location.search);

const t = key => copy[locale][key];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const blankOffering = () => ({ title:'', durationMinutes:'', lessonCount:'1', price:'', currency:'', levels:'' });
const blankSubject = () => ({ category:'', subject:'', qualifications:'', specialties:'', offerings:[blankOffering()] });
const blank = () => ({ profile:{}, subjects:[blankSubject()] });
const app = document.querySelector('#app');
const storageKey = 'marocora.learning.instructorDraft';
const readLocal = () => { try { return JSON.parse(localStorage.getItem(storageKey)); } catch { return null; } };
let draft = readLocal() || blank();
let instructor = null;
let serverDraftExists = false;
let review = null;
let applicationStatus = null;
let authVersion = 0;
let validationMode = null;
const digits = currency => { try { return new Intl.NumberFormat('en', { style:'currency', currency }).resolvedOptions().maximumFractionDigits; } catch { return 2; } };
const list = value => String(value || '').split(',').map(s => s.trim()).filter(Boolean);
const input = (field, label, value, { type='text', hint='', placeholder='', min, max, step } = {}) => `<label>${t(label)}<input data-field="${field}" type="${type}" value="${esc(value)}" ${placeholder ? `placeholder="${esc(t(placeholder))}"` : ''} ${min == null ? '' : `min="${min}"`} ${max == null ? '' : `max="${max}"`} ${step == null ? '' : `step="${step}"`}></label>${hint ? `<p class="helper">${t(hint)}</p>` : ''}`;
const area = (field, label, value, placeholder='') => `<label class="wide">${t(label)}<textarea data-field="${field}" rows="4" ${placeholder ? `placeholder="${esc(t(placeholder))}"` : ''}>${esc(value)}</textarea></label>`;

function offeringHTML(offering, index) {
  return `<div class="offering-card" data-offering><div class="entry-heading"><h3>${t('offerings')} ${index + 1}</h3><button type="button" class="tertiary danger" data-action="remove-offering">${t('removeOffering')}</button></div><div class="grid">
    ${input('title','offeringTitle',offering.title,{placeholder:'exampleOffering'})}
    ${input('durationMinutes','duration',offering.durationMinutes,{type:'number',min:15,max:240})}
    ${input('lessonCount','lessons',offering.lessonCount,{type:'number',min:1,max:20})}
    ${input('price','price',offering.price,{type:'number',min:0,step:'any'})}
    ${input('currency','currency',offering.currency,{placeholder:'exampleCurrency'})}
    ${input('levels','levels',offering.levels,{placeholder:'exampleLevels'})}
  </div><p class="helper">${t('priceHelp')}</p></div>`;
}
const options = (values, selected) => `<option value=""></option>${values.map(([v,n]) => `<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(n)}</option>`).join('')}${selected && !values.some(([v])=>v===selected) ? `<option value="${esc(selected)}" selected>${esc(selected)}</option>` : ''}`;
function subjectSelect(subject) {
 const canonical = canonicalSubject(subject.category,subject.subject);
 const category = canonical ? taxonomy.categories.find(c => c.id===canonical.categoryId).name.en : subject.category;
 const candidates = taxonomy.subjects.filter(s => taxonomy.categories.find(c => c.id===s.categoryId).name.en===category);
 return `<label>${t('category')}<select data-field="category">${options(taxonomy.categories.map(c=>[c.name.en,c.name[locale]]),category)}</select></label><label>${t('subject')}<select data-field="subject">${options(candidates.map(s=>[s.name.en,s.name[locale]]),canonical?.name.en || subject.subject)}</select></label>`;
}
function countrySelect(value) {
 const names=new Intl.DisplayNames([locale],{type:'region'});
 const values=countryCodes.map(c=>[c,names.of(c)]).sort((a,b)=>a[1].localeCompare(b[1],locale));
 return `<label>${t('country')}<select data-field="countryOfResidence">${options(values,value)}</select></label>`;
}
function subjectHTML(subject, index) {
  return `<section class="subject-card" data-subject><div class="entry-heading"><h2>${t('subject')} ${index + 1}</h2><button type="button" class="tertiary danger" data-action="remove-subject">${t('removeSubject')}</button></div><div class="grid">
    ${subjectSelect(subject)}
    ${area('qualifications','qualifications',subject.qualifications,'exampleQualification')}
    ${input('specialties','specialties',subject.specialties)}
  </div><div class="section-heading"><h3>${t('offerings')}</h3><button type="button" class="secondary" data-action="add-offering" ${subject.offerings.length >= 8 ? 'disabled' : ''}>${t('addOffering')}</button></div>
  ${subject.offerings.map(offeringHTML).join('')}</section>`;
}
function render() {
  const p = draft.profile || {};
  applyLocale(locale);translateHeader(locale);
  document.querySelector('#locale').value = locale;
  document.querySelector('#browse-link').textContent = t('browse');
  document.querySelector('#browse-link').href = `learn/?lang=${locale}`;
  document.title = `${t('title')} | Marocora`;
  const auth = instructorStore ? (instructor
    ? `<div class="auth-panel"><span>${t('signedIn')} ${esc(instructor.email)}</span> <button type="button" class="tertiary" data-action="sign-out">${t('signOut')}</button></div>`
    : `<form id="auth-form" class="auth-panel"><label>${t('email')}<input name="email" type="email" autocomplete="email" required></label><button type="submit">${t('sendLink')}</button></form>`) : '';
  app.innerHTML = `<h1>${t('title')}</h1><p class="lead">${t('intro')}</p><p class="notice">${instructorStore || config.apiBase ? t('live') : t('preview')}</p>${instructorStore && !instructor ? `<p class="helper">${t(config.instructorSignupOpen ? 'signupHelp' : 'existingOnly')}</p>` : ''}${auth}<div id="review-feedback">${reviewStatusHTML()}</div>
    ${instructor && config.learningLaunchOpen ? `<p><a href="learn/schedule.html?lang=${locale}">${sharedCopy[locale].schedule}</a></p>` : ''}<form id="profile-form" novalidate><p class="helper">${t('fieldHint')}</p><div id="field-errors" role="alert" tabindex="-1" hidden></div><section class="panel"><h2>${t('profile')}</h2><div class="grid">
      ${input('displayName','displayName',p.displayName)}${input('headline','headline',p.headline)}
      ${area('bio','bio',p.bio)}${countrySelect(p.countryOfResidence)}${input('city','city',p.city)}
      ${input('timezone','timezone',p.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)}${input('yearsExperience','experience',p.yearsExperience,{type:'number',min:0,max:80})}
      ${area('education','education',p.education)}${input('nativeLanguages','native',p.nativeLanguages)}${input('spokenLanguages','spoken',p.spokenLanguages)}
      ${input('introductionVideo','video',p.introductionVideo,{type:'url'})}${input('photoURL','photo',p.photoURL,{type:'url',hint:'photoHelp'})}
      ${area('availabilityNotes','availability',p.availabilityNotes)}
    </div><p class="helper">${t('availabilityHelp')}</p></section>
    <div class="section-heading"><h2>${t('subjects')}</h2><button type="button" class="secondary" data-action="add-subject" ${draft.subjects.length >= 12 ? 'disabled' : ''}>${t('addSubject')}</button></div>
    ${draft.subjects.map(subjectHTML).join('')}
    <label class="consent"><input type="checkbox" data-field="publicationConsent" ${p.publicationConsent===true?'checked':''}>${sharedCopy[locale].consent}</label><div class="actions"><button type="submit">${t('save')}</button><button type="button" class="secondary" data-action="download">${t('download')}</button><button type="button" data-action="submit" ${instructor || config.apiBase ? '' : 'disabled'}>${t('submit')}</button></div>
    <p id="status" class="status" role="status">${instructorStore ? (instructor ? '' : t('signInFirst')) : (config.apiBase ? '' : t('opening'))}</p>
    ${config.signInURL ? `<p><a href="${esc(config.signInURL)}">${t('signIn')}</a></p>` : ''}
    </form>`;
  translateHeader(locale);
  app.querySelectorAll('#profile-form [data-field]').forEach((field,index)=>{field.id=`profile-field-${index}`;});
  if(validationMode!==null) validateFields(validationMode,false);
}

function validateFields(complete=false,focus=true) {
  validationMode=complete;
  const problems=[];
  for(const field of app.querySelectorAll('#profile-form [data-field]')) {
    field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby');
    if(field.dataset.field==='publicationConsent')continue;
    const card=field.closest('[data-offering]'),subject=field.closest('[data-subject]');
    const currency=card?.querySelector('[data-field="currency"]')?.value.trim()||'';
    const problem=instructorFieldProblem(field.dataset.field,field.value,{complete,currency});
    if(problem||field.validity.badInput) {
      let label=t(fieldLabels[field.dataset.field]);
      if(subject)label=`${t('subject')} ${[...app.querySelectorAll('[data-subject]')].indexOf(subject)+1} · ${label}`;
      if(card)label+=` · ${t('offerings')} ${[...subject.querySelectorAll('[data-offering]')].indexOf(card)+1}`;
      problems.push({field,label,message:t(problem==='required'?'requiredField':problem==='precision'?'precision':'invalidField')});
    }
  }
  const subjects=[...app.querySelectorAll('[data-subject]')],seen=new Set();
  subjects.forEach((section,index)=>{
    const category=section.querySelector('[data-field="category"]'),subject=section.querySelector('[data-field="subject"]');
    const key=`${category.value.trim().toLowerCase()}\0${subject.value.trim().toLowerCase()}`;
    if(category.value&&subject.value&&seen.has(key))problems.push({field:subject,label:`${t('subject')} ${index+1}`,message:t('duplicateSubject')});
    seen.add(key);
    if(complete&&!section.querySelector('[data-offering]'))problems.push({field:section.querySelector('[data-action="add-offering"]'),label:`${t('subject')} ${index+1}`,message:t('missingOffer')});
  });
  if(complete&&!subjects.length)problems.push({field:app.querySelector('[data-action="add-subject"]'),label:t('subjects'),message:t('missingSubject')});
  const summary=app.querySelector('#field-errors'); summary.hidden=!problems.length;
  summary.innerHTML=problems.length?`<p>${t('fixFields')}</p><ul>${problems.map((issue,index)=>{
    const field=issue.field;field.id||=`profile-action-${index}`;
    const errorId=`field-error-${index}`;field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',errorId);
    return `<li id="${errorId}"><a href="#${field.id}" data-error-target="${field.id}">${esc(issue.label)}: ${esc(issue.message)}</a></li>`;
  }).join('')}</ul>`:'';
  if(problems.length&&focus)summary.focus();
  return !problems.length;
}
app.addEventListener('input',event=>{if(validationMode!==null&&event.target.closest('#profile-form'))validateFields(validationMode,false);});

function collect() {
  const profile = Object.fromEntries([...app.querySelectorAll('.panel [data-field]')].map(el => [el.dataset.field, el.value.trim()]));
  const subjects = [...app.querySelectorAll('[data-subject]')].map(section => {
    const value = field => section.querySelector(`:scope > .grid [data-field="${field}"]`)?.value.trim() || '';
    const offerings = [...section.querySelectorAll('[data-offering]')].map(card => Object.fromEntries([...card.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el.value.trim()])));
    return { category:value('category'), subject:value('subject'), qualifications:value('qualifications'), specialties:value('specialties'), offerings };
  });
  profile.publicationConsent = !!app.querySelector('[data-field="publicationConsent"]')?.checked;
  draft = { profile, subjects };
}
function payload() {
  return normalizeInstructorDraft({ profile:{ ...draft.profile,
    yearsExperience:!draft.profile.yearsExperience ? null : Number(draft.profile.yearsExperience) },
    subjects:draft.subjects.map(s => ({ ...s, specialties:list(s.specialties), offerings:s.offerings.map(o => {
    const currency = o.currency.toUpperCase();
    const factor = 10 ** digits(currency || 'USD');
    const value = o.price === '' ? null : Number(o.price) * factor;
    if (value !== null && (!Number.isFinite(value) || Math.abs(value - Math.round(value)) > 0.000001)) throw new Error('precision');
    return { title:o.title, durationMinutes:o.durationMinutes === '' ? null : Number(o.durationMinutes),
      lessonCount:Number(o.lessonCount), priceMinor:value === null ? null : Math.round(value), currency,
      deliveryMode:'online', levels:list(o.levels) };
  }) })) });
}
function status(message, kind='success') {
  const target = document.querySelector('#status'); target.textContent = message; target.className = `status ${kind}`;
}
function reviewStatusHTML() {
  if (!instructor || !config.staffReviewOpen || !applicationStatus) return '';
  const c = reviewCopy[locale];
  return `<p>${c.status}: ${escapeReview(c[applicationStatus] || applicationStatus)}. ${c.private}</p>${feedbackHTML(review, locale)}${review ? `<p class="helper">${c.obsolete}</p>` : ''}`;
}
async function refreshReview() {
  if (!instructor || !config.staffReviewOpen) return;
  const target = document.querySelector('#review-feedback');
  const version = authVersion, userId = instructor.id;
  try {
    const record = await loadInstructorDraft(userId);
    if (version !== authVersion || instructor?.id !== userId) return;
    applicationStatus = record?.status;
    const result = await instructorStore.rpc('learning_instructor_review_feedback');
    if (version !== authVersion || instructor?.id !== userId) return;
    if (result.error) throw result.error;
    review = result.data;
    if (target) target.innerHTML = reviewStatusHTML();
  } catch {
    if (version !== authVersion || instructor?.id !== userId) return;
    review = null;
    if (target) target.textContent = sharedCopy[locale].feedbackError;
  }
}

async function save() {
  if(!validateFields(false))return false;
  collect();
  let data;
  try { data = payload(); }
  catch (error) { status(t(error.message === 'precision' ? 'precision' : 'error'),'error'); return false; }
  if (instructor) {
    try { await saveInstructorDraft(instructor.id, data, serverDraftExists); serverDraftExists = true; await refreshReview(); status(t('savedServer')); return true; }
    catch { status(t('error'),'error'); return false; }
  }
  let stored = true;
  try { localStorage.setItem(storageKey, JSON.stringify(draft)); }
  catch { stored = false; }
  if (!stored && !config.apiBase) { status(t('noStorage'),'error'); return false; }
  if (!config.apiBase) { status(t('savedLocal')); return true; }
  try { await request('/instructor/draft', data); status(t('savedServer')); return true; }
  catch (error) { status(t(error.message === 'precision' ? 'precision' : 'error'),'error'); return false; }
}
app.addEventListener('change', event => {
 if (event.target.dataset.field==='category') {
  collect(); const index=[...app.querySelectorAll('[data-subject]')].indexOf(event.target.closest('[data-subject]'));
  draft.subjects[index].subject=''; render();
 }
});
app.addEventListener('submit', async event => {
  event.preventDefault();
  if (event.target.id === 'auth-form') {
    const sendButton = event.target.querySelector('button');
    if (sendButton.disabled) return;
    sendButton.disabled = true;
    try { await sendInstructorLink(event.target.elements.email.value.trim()); status(t('linkSent')); }
    catch { status(t('linkError'),'error'); }
    finally { sendButton.disabled = false; }
    return;
  }
  await save();
});
app.addEventListener('click', async event => {
  const errorLink=event.target.closest('[data-error-target]');
  if(errorLink){event.preventDefault();document.getElementById(errorLink.dataset.errorTarget)?.focus();return;}
  const button = event.target.closest('[data-action]'); if (!button) return;
  event.preventDefault();
  const action = button.dataset.action;
  if (action === 'sign-out') {
    try { await signOutInstructor(); instructor = null; serverDraftExists = false; review = null; applicationStatus = null; draft = readLocal() || blank(); validationMode = null; render(); }
    catch { status(t('error'),'error'); }
    return;
  }
  if (action === 'download') {
    collect(); const file = new Blob([JSON.stringify(draft,null,2)], { type:'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(file); link.download = 'marocora-instructor-draft.json';
    link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); return;
  }
  if (action === 'submit') {
    if (!instructor && !config.apiBase) return;
    if(!validateFields(true))return;
    collect();
    try { requireCompleteInstructorDraft(payload()); }
    catch { status(t('incomplete'),'error'); return; }
    if (!await save()) return;
    try {
      if (instructor) await submitInstructorDraft();
      else await request('/instructor/submit', {});
      await refreshReview();
      status(t('submitted'));
    } catch (error) { status(t(error.message?.includes('DRAFT_INCOMPLETE') ? 'incomplete' : 'error'),'error'); }
    return;
  }
  collect();
  const section = button.closest('[data-subject]');
  if (action === 'add-subject' && draft.subjects.length < 12) draft.subjects.push(blankSubject());
  if (action === 'remove-subject') draft.subjects.splice([...app.querySelectorAll('[data-subject]')].indexOf(section),1);
  if (action === 'add-offering' && section) draft.subjects[[...app.querySelectorAll('[data-subject]')].indexOf(section)].offerings.push(blankOffering());
  if (action === 'remove-offering' && section) {
    const subjectIndex = [...app.querySelectorAll('[data-subject]')].indexOf(section);
    const offeringIndex = [...section.querySelectorAll('[data-offering]')].indexOf(button.closest('[data-offering]'));
    draft.subjects[subjectIndex].offerings.splice(offeringIndex,1);
  }
  render();
});
document.querySelector('#locale').onchange = event => { const fields=captureFields(app); collect(); locale = changeLocale(event.target.value,params); render();restoreFields(app,fields);translateHeader(locale); };
render();
if (instructorStore) {
  // Clear private account content when another open tab signs out. Late reads
  // must not restore a previous account's draft or review after that event.
  instructorStore.auth.onAuthStateChange(event => {
    if (event !== 'SIGNED_OUT') return;
    authVersion++;
    instructor = null; serverDraftExists = false; review = null;
    applicationStatus = null; draft = blank(); validationMode = null; render();
  });
  const version = authVersion;
  try {
    const signedIn = await currentInstructor();
    if (version === authVersion) instructor = signedIn;
    if (instructor && version === authVersion) {
      const userId = instructor.id;
      const record = await loadInstructorDraft(userId);
      if (version === authVersion && instructor?.id === userId) {
        serverDraftExists = !!record;
        await refreshReview();
        if (version === authVersion && instructor?.id === userId) {
          draft = record ? { profile:record.data.profile, subjects:record.data.subjects.map(s => ({ ...s,
            specialties:s.specialties.join(', '), offerings:s.offerings.map(o => ({ ...o,
              price:o.priceMinor == null ? '' : String(o.priceMinor / 10 ** digits(o.currency)),
              levels:o.levels.join(', ') })) })) } : readLocal() || blank();
        }
      }
    }
    render();
  } catch { if (version === authVersion) status(t('error'),'error'); }
}
if (config.apiBase) {
  try {
    const response = await request('/instructor/draft');
    if (response.draft?.data) {
      draft = { profile:response.draft.data.profile, subjects:response.draft.data.subjects.map(s => ({ ...s,
        specialties:s.specialties.join(', '), offerings:s.offerings.map(o => ({ ...o, price:o.priceMinor == null ? '' : String(o.priceMinor / 10 ** digits(o.currency)),
          levels:o.levels.join(', ') })) })) };
      render();
    }
  } catch { /* Sign-in may not be connected yet. The local draft remains available. */ }
}
