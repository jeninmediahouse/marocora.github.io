import { currentUser,onSignOut,learningRPC,studentDashboard,publicCatalog,publicSlots } from './learning-store.mjs';
import { launchCopy } from './launch-copy.mjs';
import { fromLegacy, localize, publishedOfferings, publishedSubjects, searchCatalog, suggestions, money, formatSlot } from './catalog.mjs';
import { strings } from './i18n.mjs';
import { config } from './config.mjs';
import { api } from './api.mjs';
const params = new URLSearchParams(location.search);
if([...params.keys()].some(k=>k!=='lang'))document.querySelector('meta[name=robots]').content='noindex,follow';
let locale = params.get('lang') === 'fr' ? 'fr' : 'en';
let catalog = fromLegacy(typeof marocoraTeachers === 'undefined' ? [] : marocoraTeachers);
const app = document.querySelector('#app');
const t = key => strings[locale][key] || launchCopy[locale][key] || key;
let student = null;
const l = value => localize(value, locale);
const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url = values => './?' + new URLSearchParams({ lang: locale, ...values });
const read = (key, fallback, storage = localStorage) => { try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value, storage = localStorage) => { try { storage.setItem(key, JSON.stringify(value)); } catch { /* Browsing works without browser storage. */ } };
let favorites = read('marocora.learning.favorites', []);
let timezone = read('marocora.learning.timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
try { formatSlot({ startsAt: Date.now() }, timezone); } catch { timezone = 'UTC'; }
const country = code => code ? new Intl.DisplayNames([locale], { type: 'region' }).of(code) : t('undisclosed');
const subjectName = id => l(catalog.subjects.find(s => s.id === id)?.name) || id;
const languageSubjects = instructor => publishedSubjects(catalog,instructor).filter(({ subject }) => subject?.categoryId === 'languages');
const languageName = id => ({ en: { darija:'Moroccan Darija', arabic:'Arabic', english:'English', french:'French' }, fr:{ darija:'Darija marocaine', arabic:'Arabe', english:'Anglais', french:'Français' } }[locale][id] || subjectName(id));
const option = (value, text, selected) => `<option value="${e(value)}" ${value === selected ? 'selected' : ''}>${e(text)}</option>`;
const select = (id, label, values, selected = '') => `<label>${e(label)}<select id="${id}">${option('', t('all'), selected)}${values.map(([v,n]) => option(v,n,selected)).join('')}</select></label>`;
const row = (label, value) => `<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`;
const safeURL = value => { try { const u = new URL(value, location.origin); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const specialtyNames = offering => (offering.specialtyIds || []).map(id => l(catalog.specialties.find(s => s.id === id)?.name)).filter(Boolean);
const verifiedLabels = instructor => (instructor.verifications || []).filter(v => v.status === 'verified').map(v => l(v.label)).filter(Boolean);
const videoLink = instructor => instructor.introductionVideo && safeURL(instructor.introductionVideo) ? `<a class="button secondary" href="${e(safeURL(instructor.introductionVideo))}" target="_blank" rel="noopener noreferrer">${t('previewVideo')}</a>` : '';
function heading() {
 document.documentElement.lang = locale; document.documentElement.dir = 'ltr';
 document.querySelector('#brand').textContent = t('brand'); document.querySelector('#brand').href = url({});
 document.querySelector('#home').textContent = t('home'); document.querySelector('#browse').textContent = t('browse'); document.querySelector('#browse').href = url({});
 document.querySelector('#locale').value = locale; document.title = t('brand');
 document.querySelector('#student-link').textContent=t('account');document.querySelector('#student-link').href=`account.html?lang=${locale}`;document.querySelector('#teach-link').textContent=t('teach');document.querySelector('#teach-link').href=`../teacher-apply.html?lang=${locale}`;
 document.querySelector('meta[name=description]').content = t('tagline');
}
function saveButtons() { app.querySelectorAll('[data-save]').forEach(button => button.onclick = async () => {
 const id=button.dataset.save, saved=!favorites.includes(id);button.disabled=true;
 try {if(student&&config.learningLaunchOpen)await learningRPC('learning_set_favorite',{instructor_id:id,saved});favorites=saved?[...favorites,id]:favorites.filter(x=>x!==id);if(!student)write('marocora.learning.favorites',favorites);button.textContent=t(saved?'unsave':'save');button.setAttribute('aria-pressed',String(saved));}catch{button.textContent=t('problem');}finally{button.disabled=false;}
 }); }
function avatar(i) { return i.photo && safeURL(i.photo) ? `<img class="avatar" src="${e(safeURL(i.photo))}" alt="${e(i.displayName)}">` : `<span class="avatar" aria-hidden="true">${e(i.displayName.split(' ').map(s => s[0]).slice(0,2).join(''))}</span>`; }
function card({ instructor:i, offerings }) {
 const currencies = [...new Set(offerings.map(o => o.currency))];
 const specialties = [...new Set(offerings.flatMap(specialtyNames))];
 const verifications = verifiedLabels(i);
 return `<article class="card"><div class="card-head">${avatar(i)}<div>${i.status === 'sample' ? `<span class="pill">${t('sample')}</span>` : ''}<h2 dir="auto">${e(i.displayName)}</h2><p>${e(l(i.headline))}</p></div></div><p dir="auto">${e(l(i.bio))}</p><p class="muted">${e(country(i.countryOfResidence))}${i.yearsExperience != null ? ` · ${e(i.yearsExperience)} ${t('years')}` : ''}</p><div class="pills">${[...new Set(offerings.map(o => subjectName(o.subjectId)))].map(n => `<span class="pill">${e(n)}</span>`).join('')}</div>${specialties.length ? `<p class="muted">${t('specialties')}: ${e(specialties.join(', '))}</p>` : ''}${languageSubjects(i).some(({subject}) => offerings.some(o => o.subjectId === subject.id)) && i.nativeLanguages?.length ? `<p>${t('native')}: ${e(i.nativeLanguages.map(languageName).join(', '))}</p>` : ''}${verifications.length ? `<p class="muted">${t('verification')}: ${e(verifications.join(', '))}</p>` : ''}<p class="muted">${i.performance?.reviewCount ? `${e(i.performance.rating)} / 5 · ${e(i.performance.reviewCount)} ${t('reviews')}` : t('noReviews')}</p><p class="price">${t('from')} ${currencies.map(c => money(Math.min(...offerings.filter(o => o.currency === c).map(o => o.priceMinor)),c,locale)).map(e).join(' / ')}</p><div class="actions"><a class="button" href="${url({ instructor:i.id })}">${t('profile')}</a><button class="secondary" data-save="${e(i.id)}" aria-pressed="${favorites.includes(i.id)}">${t(favorites.includes(i.id) ? 'unsave' : 'save')}</button></div></article>`;
}
function browse() {
 const pref = read('marocora.learning.preferences', {}, sessionStorage);
 app.innerHTML = `<section class="hero"><h1>${t('intro')}</h1><p>${t('tagline')}</p>${catalog.instructors.some(i => i.status === 'sample') ? `<p class="notice">${t('sampleNotice')}</p>` : ''}</section><form id="search-form" class="search"><label>${t('search')}<input id="query" list="suggestions" placeholder="${t('searchPlaceholder')}" value="${e(params.get('q') || '')}"><datalist id="suggestions"></datalist></label><button>${t('submit')}</button></form><div class="launch-subjects" aria-label="${t('launchSubjects')}">${catalog.subjects.filter(s=>s.active!==false&&catalog.categories.some(c=>c.id===s.categoryId&&c.active)).map(s=>`<a href="${url({subject:s.id})}">${e(l(s.name))}</a>`).join('')}</div><div id="refinements" class="refinements"></div><details><summary>${t('match')}</summary><div class="match-grid">${select('match-subject',t('subject'),catalog.subjects.filter(s => s.active!==false&&catalog.categories.some(c=>c.id===s.categoryId&&c.active)).map(s => [s.id,l(s.name)]),params.get('subject') || '')}${select('level',t('level'),['beginner','intermediate','advanced','primary-school','middle-school','high-school','university','adult'].map(s => [s,t(s)]))}${catalog.instructors.some(i=>i.teachingStyles?.length)?select('style',t('style'),[...new Set(catalog.instructors.flatMap(i=>i.teachingStyles||[]))].map(s=>[s,t(s)])):''}${catalog.instructors.some(i=>i.subjects.some(s=>s.categoryMetadata?.classification))?select('classification',t('background'),[...new Set(catalog.instructors.flatMap(i=>i.subjects.map(s=>s.categoryMetadata?.classification).filter(Boolean)))].map(s=>[s,t(({ 'native-speaker':'nativeSpeaker',bilingual:'bilingual','fluent-c2':'fluent'})[s]||s)])):''}<label>${t('goal')}<textarea id="match-goal" maxlength="2000">${e(pref.goal || '')}</textarea></label><label>${t('deadline')}<input id="deadline" type="date" value="${e(pref.deadline || '')}"></label><label>${t('schedule')}<input id="schedule" maxlength="200" value="${e(pref.schedule || '')}"></label></div><p class="muted">${t('matchingNote')}</p></details><div class="layout"><section class="filters"><h2>${t('filters')}</h2>${select('country',t('country'),[...new Set(catalog.instructors.map(i => i.countryOfResidence).filter(Boolean))].map(c => [c,country(c)]))}${select('native',t('native'),[...new Set(catalog.instructors.flatMap(i => i.nativeLanguages))].map(s => [s,languageName(s)]))}${select('spoken',t('otherLanguage'),[...new Set(catalog.instructors.flatMap(i => i.spokenLanguages.map(l => l.id)))].map(s => [s,languageName(s)]))}${catalog.instructors.some(i=>i.subjects.some(s=>s.categoryMetadata?.languageVarieties?.length))?select('variety',t('variety'),[...new Set(catalog.instructors.flatMap(i=>i.subjects.flatMap(s=>s.categoryMetadata?.languageVarieties||[])))].map(s=>[s,s])):''}${select('currency',t('currency'),[...new Set(catalog.instructors.flatMap(i => publishedOfferings(catalog,i).map(o => o.currency)))].map(c => [c,c]),'')}<label>${t('budget')}<input id="budget" type="number" min="0" step="1"></label><label>${t('sort')}<select id="sort">${[['best','best'],['rating','rating'],['experience','experience'],['price-asc','priceAsc'],['price-desc','priceDesc']].map(([v,k]) => option(v,t(k),'best')).join('')}</select></label>${['verified','bookable','saved'].map(id => `<label><input type="checkbox" id="${id}">${t(id==='bookable'&&config.learningLaunchOpen?'available':id)}</label>`).join('')}<p class="muted">${t(student?'savedAccount':'savedDevice')}</p><a href="${url({})}">${t('clear')}</a></section><section id="results" class="results" aria-live="polite"></section></div>`;
 let specialty = ''; let slots = [];
 const value = id => document.getElementById(id)?.value || '';
 const update = () => {
   write('marocora.learning.preferences', { goal:value('match-goal'), deadline:value('deadline'), schedule:value('schedule') }, sessionStorage);
   document.getElementById('budget').disabled=!value('currency');
   const filters = { query:value('query'), subject:value('match-subject'), specialty, level:value('level'), style:value('style'), classification:value('classification'), country:value('country'), nativeLanguage:value('native'), spokenLanguage:value('spoken'), variety:value('variety'), currency:value('currency'), maxPrice:value('budget'), sort:value('sort'), verified:document.getElementById('verified').checked, bookable:!config.learningLaunchOpen&&document.getElementById('bookable').checked, availableOnly:config.learningLaunchOpen&&document.getElementById('bookable').checked, slots };
   let found = searchCatalog(catalog,filters,locale);
   if (document.getElementById('saved').checked) found = found.filter(r => favorites.includes(r.instructor.id));
   document.querySelector('#results').innerHTML = found.length ? found.map(card).join('') : `<div class="panel empty"><p>${t(config.learningLaunchOpen?'noTeachers':'noResults')}</p>${config.learningLaunchOpen?`<a class="button" href="account.html?lang=${locale}">${t('account')}</a>`:''}</div>`;
   document.querySelector('#suggestions').innerHTML = suggestions(catalog,value('query'),locale,true).map(s => `<option value="${e(s)}"></option>`).join(''); saveButtons();
 };
 const refine = () => {
   const subject = catalog.subjects.filter(s => s.active!==false&&catalog.categories.some(c=>c.id===s.categoryId&&c.active)).find(s => s.id === value('match-subject') || l(s.name).toLowerCase() === value('query').trim().toLowerCase() || s.id === value('query').trim().toLowerCase());
   const target = document.querySelector('#refinements');
   target.innerHTML = subject && catalog.specialties.some(s=>s.subjectIds.includes(subject.id)) ? `<strong>${t('refine')}</strong><div>${catalog.specialties.filter(s => s.subjectIds.includes(subject.id)).map(s => `<button class="secondary" data-specialty="${e(s.id)}">${e(l(s.name))}</button>`).join('')}<button class="secondary" data-specialty="">${t('skip')}</button></div>` : '';
   target.querySelectorAll('button').forEach(b => b.onclick = () => { specialty = b.dataset.specialty; document.querySelector('#match-subject').value = subject.id; update(); });
 };
 app.querySelectorAll('input,select,textarea').forEach(el => el.addEventListener('input', () => { if (el.id === 'query' || el.id === 'match-subject') { specialty = ''; refine(); } update(); }));
 document.querySelector('#search-form').onsubmit = event => { event.preventDefault(); refine(); update(); };
 update(); refine();
 if (config.apiBase || config.learningLaunchOpen) Promise.all(catalog.instructors.map(i => config.learningLaunchOpen ? publicSlots(i.id) : api.slots(i.id))).then(rows => { slots = rows.flat(); update(); }).catch(() => {});
}
async function profile(id) {
 const i = catalog.instructors.find(i => i.id === id);
 const offers = publishedOfferings(catalog, i);
 if (!offers.length) { app.innerHTML = `<h1>${t('notFound')}</h1><a href="${url({})}">${t('back')}</a>`; return; }
 const pref = read('marocora.learning.preferences', {}, sessionStorage);
 document.title = `${i.displayName} | ${t('brand')}`;
 const subjects = publishedSubjects(catalog,i);
 const isLanguageProfile = subjects.some(({subject}) => subject?.categoryId === 'languages');
 const languageRows = isLanguageProfile && (i.nativeLanguageText || i.spokenLanguageText) ? `${i.nativeLanguageText?row(t('native'),i.nativeLanguageText):''}${i.spokenLanguageText?row(t('spoken'),i.spokenLanguageText):''}` : isLanguageProfile ? `${i.nativeLanguages?.length ? row(t('native'),i.nativeLanguages.map(languageName).join(', ')) : ''}${i.spokenLanguages?.length ? row(t('spoken'),i.spokenLanguages.filter(s => !(i.nativeLanguages || []).includes(s.id)).map(s => `${languageName(s.id)} (${s.level === 'unspecified' ? t('unknown') : s.level})`).join(', ') || t('undisclosed')) : ''}` : '';
 const subjectSections = subjects.map(({relation,subject}) => {
   const relatedOffers = offers.filter(o => o.subjectId === subject.id);
   const specialties = [...new Set(relatedOffers.flatMap(specialtyNames))];
   return `<article class="subject"><h3>${e(l(subject.name))}</h3><p class="muted">${t(relation.approval === 'approved' ? 'approved' : 'sample')}</p>${l(relation.qualifications) ? `<p dir="auto">${e(l(relation.qualifications))}</p>` : ''}${specialties.length ? `<p>${t('specialties')}: ${e(specialties.join(', '))}</p>` : ''}</article>`;
 }).join('');
 const education = (i.education || []).map(s => `<p>${e(l(s.description))}</p>`).join('');
 const credentials = (i.credentials || []).map(s => `<p>${e(l(s.description || s.label))}</p>`).join('');
 const verifications = verifiedLabels(i);
 const offersHTML = offers.map(o => `<article class="offering"><h3>${e(l(o.title))}</h3><p>${e(subjectName(o.subjectId))} · ${e(o.durationMinutes)} ${t('minutes')} · ${t('online')}${o.lessonCount > 1 ? ` · ${e(o.lessonCount)} ${t('package')}` : ''}</p>${specialtyNames(o).length ? `<p class="muted">${e(specialtyNames(o).join(', '))}</p>` : ''}<p class="price">${e(money(o.priceMinor,o.currency,locale))}</p>${o.levels?.length?`<p>${t('level')}: ${e(o.levels.map(t).join(', '))}</p>`:''}</article>`).join('');
 app.innerHTML = `<p><a href="${url({})}">← ${t('back')}</a></p><div class="hero"><div class="card-head">${avatar(i)}<h1>${e(i.displayName)}</h1></div><p>${e(l(i.headline))}</p>${i.status === 'sample' ? `<p class="notice">${t('sampleOnly')}</p>` : ''}</div><div class="profile-layout"><div><section class="panel"><h2>${t('about')}</h2><p dir="auto">${e(l(i.bio))}</p>${videoLink(i)}<dl class="summary">${row(t('residence'),country(i.countryOfResidence))}${i.countryOfBirth ? row(t('birth'),country(i.countryOfBirth)) : ''}${languageRows}</dl></section><section class="panel"><h2>${t('subjects')}</h2>${subjectSections}</section><section class="panel"><h2>${t('education')}</h2>${education || credentials || `<p>${t('noCredentials')}</p>`}${education && credentials ? credentials : ''}<h3>${t('verification')}</h3>${verifications.length ? verifications.map(label => `<p>${e(label)}</p>`).join('') : `<p>${t('noVerification')}</p>`}</section><section class="panel"><h2>${t('offerings')}</h2>${offersHTML}</section><section class="panel"><h2>${t('reviews')}</h2><div id="reviews"><p>${t('noReviews')}</p></div></section></div><aside class="panel"><h2>${t('availability')}</h2><label>${t('choose')}<select id="offering">${offers.map(o => option(o.id,`${l(o.title)} · ${money(o.priceMinor,o.currency,locale)}`,params.get('offering'))).join('')}</select></label><label>${t('timezone')}<input id="timezone" value="${e(timezone)}" list="timezones"><datalist id="timezones">${['UTC','Africa/Casablanca','Europe/Paris','Europe/London','America/New_York','America/Los_Angeles','Asia/Tokyo'].map(z => `<option>${z}</option>`).join('')}</datalist></label><p id="time-error" class="error" role="alert"></p><div id="slots" class="slot-list"><p>${t('noSlots')}</p></div><p class="muted">${t('later')}</p><label>${t('goalLabel')}<textarea id="learning-goal" rows="4" maxlength="2000" placeholder="${t('goalHint')}">${e(pref.goal || '')}</textarea></label><p class="muted">${t(config.learningLaunchOpen?'requestNote':'notConfirmed')}</p>${i.legacyProfileURL && offers.some(o => o.kind === 'complimentary-introduction') ? `<a class="button secondary" href="${e(i.legacyProfileURL)}">${t('legacy')}</a><p class="muted">${t('legacyNote')}</p>` : ''}<div class="actions"><button class="secondary" data-save="${e(i.id)}" aria-pressed="${favorites.includes(i.id)}">${t(favorites.includes(i.id) ? 'unsave' : 'save')}</button></div></aside></div>`;
 saveButtons(); let slots = [];
 const renderSlots = () => {
   const target = document.querySelector('#slots');
   try { formatSlot({ startsAt:Date.now() },document.querySelector('#timezone').value,locale); } catch { document.querySelector('#time-error').textContent = t('timeInvalid'); target.innerHTML = ''; return; }
   timezone = document.querySelector('#timezone').value; write('marocora.learning.timezone',timezone); document.querySelector('#time-error').textContent = '';
   const offer = document.querySelector('#offering').value;
   const selectedOffer=offers.find(o=>o.id===offer);
   const available = slots.filter(s => s.offeringIds.includes(offer) && new Date(s.endsAt)-new Date(s.startsAt)>=Number(selectedOffer?.durationMinutes)*60000);
   target.innerHTML = available.length ? available.map(s => `<button data-slot="${e(s.id)}">${e(formatSlot(s,timezone,locale))}</button>`).join('') : `<p>${t('noSlots')}</p>`;
   target.querySelectorAll('button').forEach(button => button.onclick = () => {
     const goal = document.querySelector('#learning-goal').value.trim();
     if (!goal) { document.querySelector('#learning-goal').focus(); document.querySelector('#learning-goal').setCustomValidity(t('goalHint')); document.querySelector('#learning-goal').reportValidity(); return; }
     if(config.learningLaunchOpen){const pending={instructorId:id,offeringId:offer,slotId:button.dataset.slot,timezone,goal,locale,userId:student?.id||null,savedAt:Date.now()};try{localStorage.setItem('marocora.learning.pendingRequest',JSON.stringify(pending));location.href=`account.html?lang=${locale}`;}catch{document.querySelector('#time-error').textContent=t('problem');}return;}
     write('marocora.learning.draft', { instructorId:id, offeringId:offer, slotId:button.dataset.slot, timezone, goal, locale }, sessionStorage);
     location.href = url({ view:'checkout' });
   });
 };
 document.querySelector('#learning-goal').oninput = event => event.target.setCustomValidity('');
 document.querySelector('#timezone').onchange = renderSlots; document.querySelector('#offering').onchange = renderSlots;
 if (config.apiBase || config.learningLaunchOpen) {
   try { slots = config.learningLaunchOpen ? await publicSlots(id) : await api.slots(id); renderSlots(); } catch { document.querySelector('#slots').textContent = t('problem'); }
   const reviews = i.reviews || [];
   if (reviews.length) document.querySelector('#reviews').innerHTML = reviews.map(r => `<article class="review"><strong>${r.rating} / 5</strong><p>${e(r.body)}</p>${r.reply ? `<blockquote><strong>${t('reply')}</strong><p>${e(r.reply.body)}</p></blockquote>` : ''}</article>`).join('');
 }
}
async function checkout() {
 const draft = read('marocora.learning.draft',null,sessionStorage);
 if (!draft || !config.apiBase) { app.innerHTML = `<h1>${t('checkout')}</h1><p>${t('unavailable')}</p><a href="${url({})}">${t('back')}</a>`; return; }
 app.innerHTML = `<div class="checkout panel"><h1>${t('checkout')}</h1><p id="checkout-state">${t('notConfirmed')}</p><div id="quote"></div></div>`;
 try {
  const quote = await api.quote(draft); const i = catalog.instructors.find(i => i.id === draft.instructorId); const o = catalog.offerings.find(o => o.id === draft.offeringId);
  document.querySelector('#quote').innerHTML = `<dl class="summary">${row(t('profile'),i?.displayName || '')}${row(t('subject'),subjectName(o?.subjectId))}${row(t('choose'),l(o?.title))}${row(t('duration'),`${o?.durationMinutes} ${t('minutes')}`)}${row(t('time'),formatSlot(quote.slot,draft.timezone,locale))}${row(t('timezone'),draft.timezone)}${row(t('online'),t('online'))}${['subtotal','fee','tax','discount','total'].map(k => row(t(k),money(quote[k],quote.currency,locale))).join('')}</dl><h2>${t('policy')}</h2><p>${e(l(quote.policy.text))}</p><p>${e(draft.goal)}</p><form id="checkout-form"><label><input id="policy-accepted" type="checkbox" required>${t('policyAccept')}</label><button>${t('continue')}</button></form><p role="alert" id="checkout-error"></p>`;
  document.querySelector('#checkout-form').onsubmit = async event => {
    event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
    try {
      if (!draft.idempotencyKey) { draft.idempotencyKey = crypto.randomUUID(); write('marocora.learning.draft',draft,sessionStorage); }
      const result = await api.checkout({ ...draft, policyVersion:quote.policy.version, policyAccepted:true });
      if (result.bookingId) write('marocora.learning.lastBooking',result.bookingId,sessionStorage);
      if (result.redirectURL && safeURL(result.redirectURL)) location.href = result.redirectURL;
      else location.href = url({ view:'confirmation', booking:result.bookingId });
    } catch (error) {
      if (error.status === 401) {
        const returnTo = location.pathname + location.search;
        location.href = `${config.apiBase}/auth/start?returnTo=${encodeURIComponent(returnTo)}`;
      } else { document.querySelector('#checkout-error').textContent = t('problem'); button.disabled = false; }
    }
  };
 } catch { document.querySelector('#checkout-state').textContent = t('unavailable'); }
}
async function confirmation() {
 app.innerHTML = `<div class="checkout panel"><h1>${t('pending')}</h1><p>${t('returnNote')}</p><div id="booking"></div></div>`;
 try {
   const booking = await api.booking(params.get('booking') || read('marocora.learning.lastBooking','',sessionStorage));
   const confirmed = ['confirmed','completed'].includes(booking.status);
   app.querySelector('h1').textContent = t(confirmed ? 'confirmed' : 'pending');
   document.querySelector('#booking').innerHTML = `<p>${t('reference')}: ${e(booking.id)}</p><p>${e(formatSlot({startsAt:booking.startsAt},timezone,locale))}</p>${booking.reviewEligible ? `<h2>${t('review')}</h2><form id="review-form"><label>${t('reviewRating')}<input id="review-rating" type="number" min="1" max="5" required></label><label>${t('reviewText')}<textarea id="review-body" maxlength="4000" required></textarea></label><button>${t('send')}</button></form><p id="review-status" role="status"></p>` : ''}`;
   if (booking.reviewEligible) document.querySelector('#review-form').onsubmit = async event => { event.preventDefault(); try { await api.review({bookingId:booking.id,rating:Number(document.querySelector('#review-rating').value),body:document.querySelector('#review-body').value}); document.querySelector('#review-form').remove(); document.querySelector('#review-status').textContent=t('success'); } catch { document.querySelector('#review-status').textContent=t('problem'); } };
 } catch { document.querySelector('#booking').textContent = t('problem'); }
}
document.querySelector('#locale').onchange = event => { params.set('lang',event.target.value); location.search=params.toString(); };
heading();
if (config.learningLaunchOpen) { try { catalog=await publicCatalog();student=await currentUser();if(student){const dash=await studentDashboard();favorites=dash.favorites||[];}}catch{app.innerHTML=`<h1>${t('problem')}</h1><a class="button" href="${url({})}">${t('retry')}</a>`;throw new Error('Catalog unavailable');} }
else if (config.apiBase) { try { catalog = await api.catalog(); } catch { app.innerHTML = `<h1>${t('problem')}</h1>`; throw new Error('Catalog unavailable'); } }
if (params.get('instructor')) await profile(params.get('instructor'));
else if (params.get('view') === 'checkout') await checkout();
else if (params.get('view') === 'confirmation') await confirmation();
else browse();

onSignOut(()=>{student=null;favorites=read("marocora.learning.favorites",[]);saveButtons();});
