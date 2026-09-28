import { escapeReview as e } from './review-view.mjs';
import { launchCopy } from './launch-copy.mjs';
import { money, formatSlot, localize } from './catalog.mjs';
export function requestHTML(r,locale='en',instructor=false) {
 const t=launchCopy[locale],s=r.snapshot||{},o=s.offering||{};
 return `<article class="panel request"><h3 dir="auto">${e(instructor?r.studentName:s.instructorName)}</h3><p dir="auto">${e(localize(o.title,locale))} · ${e(o.durationMinutes)} min · ${e(money(o.priceMinor,o.currency,locale))}</p><p>${e(formatSlot({startsAt:s.startsAt},r.timezone,locale))} (${e(r.timezone)})</p><p dir="auto">${e(r.goal)}</p><strong>${e(t[r.status]||r.status)}</strong><p class="muted">${t.requestNote}</p><div class="actions">${!instructor && ['requested','acknowledged'].includes(r.status)?`<button class="secondary" data-request="${e(r.id)}" data-decision="cancelled">${t.cancel}</button>`:''}${instructor && r.status==='requested'?`<button data-request="${e(r.id)}" data-decision="acknowledged">${t.acknowledge}</button><button class="secondary" data-request="${e(r.id)}" data-decision="declined">${t.decline}</button>`:''}</div></article>`;
}
export function readPendingSelection(storage=localStorage) {
 try {
  const value=JSON.parse(storage.getItem('marocora.learning.pendingRequest'));
  if(!value || typeof value.instructorId!=='string' || typeof value.offeringId!=='string' || typeof value.slotId!=='string' || typeof value.goal!=='string' || value.goal.length>2000 || !Number.isFinite(value.savedAt) || Date.now()-value.savedAt>86400000 || value.savedAt>Date.now()+60000) return null;
  return value;
 } catch { return null; }
}
