import { DomainError } from './errors.mjs';

const fail = code => { throw new DomainError(code, 400); };
const text = (value, max = 2000) => {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || value.length > max) fail('INVALID_INSTRUCTOR_DRAFT');
  return value.trim();
};
const list = (value, max = 12) => {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > max) fail('INVALID_INSTRUCTOR_DRAFT');
  return value;
};
const url = value => {
  const result = text(value, 500);
  if (!result) return '';
  try {
    if (new URL(result).protocol !== 'https:') fail('INVALID_INSTRUCTOR_DRAFT');
  } catch { fail('INVALID_INSTRUCTOR_DRAFT'); }
  return result;
};
const currency = value => {
  const code = text(value, 3).toUpperCase();
  if (!code) return '';
  if (!/^[A-Z]{3}$/.test(code)) fail('INVALID_INSTRUCTOR_DRAFT');
  try { new Intl.NumberFormat('en', { style: 'currency', currency: code }); }
  catch { fail('INVALID_INSTRUCTOR_DRAFT'); }
  return code;
};

export function normalizeInstructorDraft(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_INSTRUCTOR_DRAFT');
  const source = input.profile || {};
  if (typeof source !== 'object' || Array.isArray(source)) fail('INVALID_INSTRUCTOR_DRAFT');
  const countryOfResidence = text(source.countryOfResidence, 100);
  const timezone = text(source.timezone, 80);
  if (timezone) {
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }); }
    catch { fail('INVALID_INSTRUCTOR_DRAFT'); }
  }
  const yearsExperience = source.yearsExperience === '' || source.yearsExperience == null ? null : Number(source.yearsExperience);
  if (yearsExperience !== null && (!Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 80)) fail('INVALID_INSTRUCTOR_DRAFT');
  const profile = {
    displayName: text(source.displayName, 120), headline: text(source.headline, 180),
    bio: text(source.bio, 4000), countryOfResidence, city: text(source.city, 120), timezone,
    yearsExperience, education: text(source.education, 2000),
    nativeLanguages: text(source.nativeLanguages, 300), spokenLanguages: text(source.spokenLanguages, 300),
    introductionVideo: url(source.introductionVideo), photoURL: url(source.photoURL),
    availabilityNotes: text(source.availabilityNotes, 1000),
    publicationConsent: source.publicationConsent === true
  };
  const seen = new Set();
  const subjects = list(input.subjects).map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('INVALID_INSTRUCTOR_DRAFT');
    const category = text(item.category, 100);
    const subject = text(item.subject, 100);
    const key = `${category.toLocaleLowerCase()}\0${subject.toLocaleLowerCase()}`;
    if (category && subject && seen.has(key)) fail('DUPLICATE_SUBJECT');
    if (category && subject) seen.add(key);
    const specialties = list(item.specialties, 10).map(value => text(value, 100)).filter(Boolean);
    const offerings = list(item.offerings, 8).map(offering => {
      if (!offering || typeof offering !== 'object' || Array.isArray(offering)) fail('INVALID_INSTRUCTOR_DRAFT');
      const durationMinutes = offering.durationMinutes === '' || offering.durationMinutes == null ? null : Number(offering.durationMinutes);
      const lessonCount = offering.lessonCount === '' || offering.lessonCount == null ? 1 : Number(offering.lessonCount);
      const priceMinor = offering.priceMinor === '' || offering.priceMinor == null ? null : Number(offering.priceMinor);
      if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240)) fail('INVALID_OFFERING');
      if (!Number.isInteger(lessonCount) || lessonCount < 1 || lessonCount > 20) fail('INVALID_OFFERING');
      if (priceMinor !== null && (!Number.isSafeInteger(priceMinor) || priceMinor < 0 || priceMinor > 1_000_000_000)) fail('INVALID_OFFERING');
      const deliveryMode = text(offering.deliveryMode, 20) || 'online';
      if (!['online', 'in-person', 'both'].includes(deliveryMode)) fail('INVALID_OFFERING');
      return {
        title: text(offering.title, 140), durationMinutes, lessonCount,
        priceMinor, currency: currency(offering.currency), deliveryMode,
        levels: list(offering.levels, 6).map(value => text(value, 60)).filter(Boolean)
      };
    });
    return { category, subject, specialties, qualifications: text(item.qualifications, 2000), offerings };
  });
  return { profile, subjects };
}

export function requireCompleteInstructorDraft(draft) {
  const p = draft.profile;
  if (!p.displayName || !p.headline || !p.bio || !p.countryOfResidence || !p.timezone || !draft.subjects.length)
    fail('INSTRUCTOR_DRAFT_INCOMPLETE');
  for (const subject of draft.subjects) {
    if (!subject.category || !subject.subject || !subject.qualifications || !subject.offerings.length)
      fail('INSTRUCTOR_DRAFT_INCOMPLETE');
    for (const offering of subject.offerings) {
      if (!offering.title || offering.durationMinutes === null || offering.priceMinor === null || !offering.currency)
        fail('INSTRUCTOR_DRAFT_INCOMPLETE');
    }
  }
  return draft;
}
