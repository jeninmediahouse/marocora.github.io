import {sharedCopy} from './locale.mjs';
import { launchCopy } from './launch-copy.mjs';
import { escapeReview as e } from './review-view.mjs';
import { taxonomy,canonicalSubject } from './taxonomy.mjs';
import { localize,money } from './catalog.mjs';
export function publicationControls(row,locale,viewerId) {
 if(row.excluded || row.user_id===viewerId)return '';
 const t=launchCopy[locale],candidates=(row.data.subjects||[]).map((s,index)=>({s,index})).filter(({s,index})=>row.review?.subject_decisions?.[index]?.decision==='approved'&&canonicalSubject(s.category,s.subject));
 return `<section class="publication-controls" data-publication="${e(row.user_id)}"><h3>${t.publication}</h3><p>${t.publishedNotice}</p>${row.review?.profile_decision==='approved'&&candidates.length?`<fieldset><legend>${t.publishSubjects}</legend>${candidates.map(({s,index})=>`<label><input type="checkbox" data-publish-subject value="${index}">${e(canonicalSubject(s.category,s.subject).name[locale])}</label>`).join('')}</fieldset><div class="actions"><button class="secondary" data-action="preview">${t.preview}</button></div><div data-preview></div>`:''}<div class="actions"><button class="secondary" data-action="unpublish">${t.unpublish}</button></div><p role="status"></p></section>`;
}
export function publicPreviewHTML(payload,locale) {
 const t=launchCopy[locale],i=payload.instructor;
 return `<section class="publication-preview"><h3 dir="auto">${e(i.displayName)}</h3><p dir="auto">${e(localize(i.headline,locale))}</p><p dir="auto">${e(localize(i.bio,locale))}</p><p>${e(i.countryOfResidence)} · ${e(i.city)} · ${e(i.timezone)}</p>${i.yearsExperience!=null?`<p>${e(i.yearsExperience)} ${sharedCopy[locale].statedExperience}</p>`:''}<p dir="auto">${e(i.nativeLanguageText)} · ${e(i.spokenLanguageText)}</p>${i.education.map(r=>`<p dir="auto">${e(r.description)}</p>`).join('')}<p>${e(i.photo)}<br>${e(i.introductionVideo)}</p>${i.subjects.map(s=>`<h4>${e(localize(taxonomy.subjects.find(t=>t.id===s.subjectId)?.name,locale)||s.subjectId)}</h4><p dir="auto">${e(localize(s.qualifications,locale))}</p>`).join('')}${payload.specialties.map(s=>`<p dir="auto">${e(localize(s.name,locale))}</p>`).join('')}${payload.offerings.map(o=>`<p dir="auto">${e(localize(o.title,locale))} · ${e(o.durationMinutes)} ${sharedCopy[locale].minutes} · ${e(o.lessonCount)} ${sharedCopy[locale].lessons} · ${e(money(o.priceMinor,o.currency,locale))} · ${e(o.levels.join(', '))}</p>`).join('')}</section><label class="consent"><input type="checkbox" data-publication-confirm>${t.consentConfirm}</label><button data-action="publish" disabled>${t.publish}</button>`;
}
