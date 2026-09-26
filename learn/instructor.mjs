import { config } from './config.mjs';
import { request } from './api.mjs';

const params = new URLSearchParams(location.search);
let locale = params.get('lang') === 'fr' ? 'fr' : 'en';
const copy = {
  en: {
    browse: 'Browse learning', title: 'Create your instructor profile', intro: 'Teach one subject or many. Give each subject its own qualifications and each lesson offering its own price and duration.',
    preview: 'Profile builder preview: account creation and submissions open after secure sign-in and profile hosting are connected. Your saved draft stays on this device until then.',
    live: 'Your profile remains private until Marocora reviews and approves each subject. Saving a draft does not publish it.',
    profile: 'Your public profile', displayName: 'Public display name', headline: 'Professional headline', bio: 'Introduce yourself and your teaching style',
    country: 'Country of residence', city: 'City or region (optional)', timezone: 'Your time zone', experience: 'Years of teaching experience',
    education: 'Education and credentials (optional)', native: 'Native language(s), if relevant', spoken: 'Other languages you speak (optional)',
    video: 'Introduction video link (optional)', photo: 'Public photo link (optional)', availability: 'General availability (optional)',
    availabilityHelp: 'Actual bookable dates and times will be added after account setup and instructor approval.',
    photoHelp: 'Use a public HTTPS link. Private verification documents are not collected on this page.',
    subjects: 'Subjects you want to teach', addSubject: 'Add another subject', removeSubject: 'Remove subject',
    category: 'Subject category', subject: 'Subject', qualifications: 'Your qualifications for this subject', specialties: 'Specialties (separate with commas)',
    categoryHint: 'Examples: Languages, Mathematics, Music, Science, Arts, Technology, Writing.',
    offerings: 'Lesson offerings', addOffering: 'Add another offering', removeOffering: 'Remove offering',
    offeringTitle: 'Offering title', duration: 'Minutes per lesson', lessons: 'Lessons in this offer', price: 'Total price', currency: 'Currency code', levels: 'Student levels (separate with commas)',
    priceHelp: 'Set your own price for this offering. A free introduction can be priced at zero. Prices are reviewed before publication.',
    save: 'Save draft', download: 'Download draft', submit: 'Submit for review', savedLocal: 'Draft saved on this device.', savedServer: 'Draft saved to your account.',
    submitted: 'Profile submitted for review. It is not public yet.', error: 'We could not save this draft. Check the fields and try again.',
    precision: 'The price has more decimal places than its currency allows.', noStorage: 'Browser storage is unavailable. Download your draft to keep a copy.',
    signIn: 'Sign in to continue', opening: 'Account sign-up and submissions are not open yet.',
    exampleCategory: 'e.g. Music', exampleSubject: 'e.g. Piano', exampleQualification: 'Describe your training or experience in this subject.',
    exampleOffering: 'e.g. Beginner piano lesson', exampleCurrency: 'e.g. USD, MAD, EUR', exampleLevels: 'e.g. Beginner, Intermediate'
  },
  fr: {
    browse: 'Découvrir les cours', title: 'Créez votre profil de professeur', intro: 'Enseignez une ou plusieurs matières. Présentez vos qualifications pour chaque matière et fixez le prix et la durée de chaque cours.',
    preview: 'Aperçu du créateur de profil : la création de compte et l’envoi des candidatures ouvriront après la mise en place d’une connexion sécurisée et de l’hébergement des profils. Votre brouillon enregistré reste sur cet appareil.',
    live: 'Votre profil reste privé jusqu’à ce que Marocora examine et approuve chaque matière. Un brouillon enregistré n’est pas publié.',
    profile: 'Votre profil public', displayName: 'Nom public', headline: 'Présentation professionnelle', bio: 'Présentez-vous et décrivez votre méthode pédagogique',
    country: 'Pays de résidence', city: 'Ville ou région (facultatif)', timezone: 'Votre fuseau horaire', experience: 'Années d’expérience pédagogique',
    education: 'Formation et diplômes (facultatif)', native: 'Langue(s) maternelle(s), si pertinent', spoken: 'Autres langues parlées (facultatif)',
    video: 'Lien vers une vidéo de présentation (facultatif)', photo: 'Lien vers une photo publique (facultatif)', availability: 'Disponibilités générales (facultatif)',
    availabilityHelp: 'Les dates et heures réservables seront ajoutées après la création du compte et l’approbation du professeur.',
    photoHelp: 'Utilisez un lien HTTPS public. Aucun document privé de vérification n’est recueilli sur cette page.',
    subjects: 'Matières que vous souhaitez enseigner', addSubject: 'Ajouter une matière', removeSubject: 'Supprimer la matière',
    category: 'Catégorie', subject: 'Matière', qualifications: 'Vos qualifications pour cette matière', specialties: 'Spécialités (séparées par des virgules)',
    categoryHint: 'Exemples : Langues, Mathématiques, Musique, Sciences, Arts, Technologie, Écriture.',
    offerings: 'Offres de cours', addOffering: 'Ajouter une offre', removeOffering: 'Supprimer l’offre',
    offeringTitle: 'Nom de l’offre', duration: 'Minutes par cours', lessons: 'Nombre de cours dans cette offre', price: 'Prix total', currency: 'Code de devise', levels: 'Niveaux des élèves (séparés par des virgules)',
    priceHelp: 'Fixez votre propre prix pour cette offre. Une rencontre gratuite peut coûter zéro. Les prix sont examinés avant publication.',
    save: 'Enregistrer le brouillon', download: 'Télécharger le brouillon', submit: 'Envoyer pour examen', savedLocal: 'Brouillon enregistré sur cet appareil.', savedServer: 'Brouillon enregistré dans votre compte.',
    submitted: 'Profil envoyé pour examen. Il n’est pas encore public.', error: 'Impossible d’enregistrer ce brouillon. Vérifiez les champs et réessayez.',
    precision: 'Le prix comporte trop de décimales pour cette devise.', noStorage: 'Le stockage du navigateur est indisponible. Téléchargez votre brouillon pour en garder une copie.',
    signIn: 'Se connecter pour continuer', opening: 'La création de compte et l’envoi des candidatures ne sont pas encore ouverts.',
    exampleCategory: 'p. ex. Musique', exampleSubject: 'p. ex. Piano', exampleQualification: 'Décrivez votre formation ou votre expérience dans cette matière.',
    exampleOffering: 'p. ex. Cours de piano pour débutants', exampleCurrency: 'p. ex. USD, MAD, EUR', exampleLevels: 'p. ex. Débutant, Intermédiaire'
  }
};
const t = key => copy[locale][key];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const blankOffering = () => ({ title:'', durationMinutes:'', lessonCount:'1', price:'', currency:'', levels:'' });
const blankSubject = () => ({ category:'', subject:'', qualifications:'', specialties:'', offerings:[blankOffering()] });
const blank = () => ({ profile:{}, subjects:[blankSubject()] });
const app = document.querySelector('#app');
const storageKey = 'marocora.learning.instructorDraft';
const readLocal = () => { try { return JSON.parse(localStorage.getItem(storageKey)); } catch { return null; } };
let draft = readLocal() || blank();
const digits = currency => { try { return new Intl.NumberFormat('en', { style:'currency', currency }).resolvedOptions().maximumFractionDigits; } catch { return 2; } };
const list = value => String(value || '').split(',').map(s => s.trim()).filter(Boolean);
const input = (field, label, value, { type='text', hint='', placeholder='', min, max } = {}) => `<label>${t(label)}<input data-field="${field}" type="${type}" value="${esc(value)}" ${placeholder ? `placeholder="${esc(t(placeholder))}"` : ''} ${min == null ? '' : `min="${min}"`} ${max == null ? '' : `max="${max}"`}></label>${hint ? `<p class="helper">${t(hint)}</p>` : ''}`;
const area = (field, label, value, placeholder='') => `<label class="wide">${t(label)}<textarea data-field="${field}" rows="4" ${placeholder ? `placeholder="${esc(t(placeholder))}"` : ''}>${esc(value)}</textarea></label>`;

function offeringHTML(offering, index) {
  return `<div class="offering-card" data-offering><div class="entry-heading"><h3>${t('offerings')} ${index + 1}</h3><button type="button" class="tertiary danger" data-action="remove-offering">${t('removeOffering')}</button></div><div class="grid">
    ${input('title','offeringTitle',offering.title,{placeholder:'exampleOffering'})}
    ${input('durationMinutes','duration',offering.durationMinutes,{type:'number',min:15,max:240})}
    ${input('lessonCount','lessons',offering.lessonCount,{type:'number',min:1,max:20})}
    ${input('price','price',offering.price,{type:'number',min:0})}
    ${input('currency','currency',offering.currency,{placeholder:'exampleCurrency'})}
    ${input('levels','levels',offering.levels,{placeholder:'exampleLevels'})}
  </div><p class="helper">${t('priceHelp')}</p></div>`;
}
function subjectHTML(subject, index) {
  return `<section class="subject-card" data-subject><div class="entry-heading"><h2>${t('subject')} ${index + 1}</h2><button type="button" class="tertiary danger" data-action="remove-subject">${t('removeSubject')}</button></div><div class="grid">
    ${input('category','category',subject.category,{placeholder:'exampleCategory',hint:'categoryHint'})}
    ${input('subject','subject',subject.subject,{placeholder:'exampleSubject'})}
    ${area('qualifications','qualifications',subject.qualifications,'exampleQualification')}
    ${input('specialties','specialties',subject.specialties)}
  </div><div class="section-heading"><h3>${t('offerings')}</h3><button type="button" class="secondary" data-action="add-offering" ${subject.offerings.length >= 8 ? 'disabled' : ''}>${t('addOffering')}</button></div>
  ${subject.offerings.map(offeringHTML).join('')}</section>`;
}
function render() {
  const p = draft.profile || {};
  document.documentElement.lang = locale;
  document.querySelector('#locale').value = locale;
  document.querySelector('#browse-link').textContent = t('browse');
  document.querySelector('#browse-link').href = `learn/?lang=${locale}`;
  document.title = `${t('title')} | Marocora`;
  app.innerHTML = `<h1>${t('title')}</h1><p class="lead">${t('intro')}</p><p class="notice">${config.apiBase ? t('live') : t('preview')}</p>
    <form id="profile-form"><section class="panel"><h2>${t('profile')}</h2><div class="grid">
      ${input('displayName','displayName',p.displayName)}${input('headline','headline',p.headline)}
      ${area('bio','bio',p.bio)}${input('countryOfResidence','country',p.countryOfResidence)}${input('city','city',p.city)}
      ${input('timezone','timezone',p.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)}${input('yearsExperience','experience',p.yearsExperience,{type:'number',min:0,max:80})}
      ${area('education','education',p.education)}${input('nativeLanguages','native',p.nativeLanguages)}${input('spokenLanguages','spoken',p.spokenLanguages)}
      ${input('introductionVideo','video',p.introductionVideo,{type:'url'})}${input('photoURL','photo',p.photoURL,{type:'url',hint:'photoHelp'})}
      ${area('availabilityNotes','availability',p.availabilityNotes)}
    </div><p class="helper">${t('availabilityHelp')}</p></section>
    <div class="section-heading"><h2>${t('subjects')}</h2><button type="button" class="secondary" data-action="add-subject" ${draft.subjects.length >= 12 ? 'disabled' : ''}>${t('addSubject')}</button></div>
    ${draft.subjects.map(subjectHTML).join('')}
    <div class="actions"><button type="submit">${t('save')}</button><button type="button" class="secondary" data-action="download">${t('download')}</button><button type="button" data-action="submit" ${config.apiBase ? '' : 'disabled'}>${t('submit')}</button></div>
    <p id="status" class="status" role="status">${config.apiBase ? '' : t('opening')}</p>
    ${config.signInURL ? `<p><a href="${esc(config.signInURL)}">${t('signIn')}</a></p>` : ''}
    </form>`;
}

function collect() {
  const profile = Object.fromEntries([...app.querySelectorAll('.panel [data-field]')].map(el => [el.dataset.field, el.value.trim()]));
  const subjects = [...app.querySelectorAll('[data-subject]')].map(section => {
    const value = field => section.querySelector(`:scope > .grid [data-field="${field}"]`)?.value.trim() || '';
    const offerings = [...section.querySelectorAll('[data-offering]')].map(card => Object.fromEntries([...card.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el.value.trim()])));
    return { category:value('category'), subject:value('subject'), qualifications:value('qualifications'), specialties:value('specialties'), offerings };
  });
  draft = { profile, subjects };
}
function payload() {
  return { profile:draft.profile, subjects:draft.subjects.map(s => ({ ...s, specialties:list(s.specialties), offerings:s.offerings.map(o => {
    const currency = o.currency.toUpperCase();
    const factor = 10 ** digits(currency || 'USD');
    const value = o.price === '' ? null : Number(o.price) * factor;
    if (value !== null && (!Number.isFinite(value) || Math.abs(value - Math.round(value)) > 0.000001)) throw new Error('precision');
    return { title:o.title, durationMinutes:o.durationMinutes, lessonCount:o.lessonCount, priceMinor:value === null ? null : Math.round(value), currency,
      deliveryMode:'online', levels:list(o.levels) };
  }) })) };
}
function status(message, kind='success') {
  const target = document.querySelector('#status'); target.textContent = message; target.className = `status ${kind}`;
}
async function save() {
  collect();
  try { payload(); }
  catch (error) { status(t(error.message === 'precision' ? 'precision' : 'error'),'error'); return false; }
  let stored = true;
  try { localStorage.setItem(storageKey, JSON.stringify(draft)); }
  catch { stored = false; }
  if (!stored && !config.apiBase) { status(t('noStorage'),'error'); return false; }
  if (!config.apiBase) { status(t('savedLocal')); return true; }
  try { await request('/instructor/draft', payload()); status(t('savedServer')); return true; }
  catch (error) { status(t(error.message === 'precision' ? 'precision' : 'error'),'error'); return false; }
}
app.addEventListener('submit', async event => { event.preventDefault(); await save(); });
app.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const action = button.dataset.action;
  if (action === 'download') {
    collect(); const file = new Blob([JSON.stringify(draft,null,2)], { type:'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(file); link.download = 'marocora-instructor-draft.json';
    link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); return;
  }
  if (action === 'submit') {
    if (!config.apiBase || !await save()) return;
    try { await request('/instructor/submit', {}); status(t('submitted')); }
    catch { status(t('error'),'error'); }
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
document.querySelector('#locale').onchange = event => { collect(); locale = event.target.value; params.set('lang',locale); history.replaceState(null,'',`?${params}`); render(); };
render();
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
