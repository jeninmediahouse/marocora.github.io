// Public catalog only. No identity evidence, student data or provider secrets here.
import { taxonomy } from './taxonomy.mjs';
export { taxonomy } from './taxonomy.mjs';
export const localize = (value, locale = 'en') => typeof value === 'string' ? value : value?.[locale] || value?.en || '';

export function publishedOfferings(catalog, instructor) {
  if (!instructor || !['active', 'sample'].includes(instructor.status)) return [];
  return catalog.offerings.filter(offering => {
    if (offering.instructorId !== instructor.id || !offering.active) return false;
    const relation = instructor.subjects.find(s => s.subjectId === offering.subjectId);
    const subject = catalog.subjects.find(s => s.id === offering.subjectId);
    const category = catalog.categories.find(c => c.id === subject?.categoryId);
    return ['approved', 'sample'].includes(relation?.approval) && subject?.active !== false && !!category?.active;
  });
}

export function publishedSubjects(catalog, instructor) {
  const offeredIds = new Set(publishedOfferings(catalog, instructor).map(o => o.subjectId));
  return (instructor?.subjects || []).filter(relation => offeredIds.has(relation.subjectId))
    .map(relation => ({ relation, subject: catalog.subjects.find(s => s.id === relation.subjectId) }));
}

// Compatibility adapter: retain legacy IDs, prices, durations and free-intro links.
export function fromLegacy(records) {
  const instructors = records.map(t => ({
    id: t.id, displayName: t.profile.displayName, photo: t.profile.photo,
    headline: { en: 'Practical Moroccan Darija lessons', fr: 'Cours pratiques de darija marocaine' },
    bio: { en: 'Explore practical Moroccan Darija for everyday conversation at your own pace.', fr: 'Découvrez la darija marocaine pour les conversations du quotidien, à votre rythme.' },
    countryOfBirth: null, countryOfResidence: 'MA', citizenships: [], city: null,
    timezone: t.profile.timezone, nativeLanguages: ['darija'],
    spokenLanguages: [{ id: 'darija', level: 'native' }, { id: 'arabic', level: 'unspecified' }, { id: 'english', level: 'unspecified' }],
    teachingStyles: ['patient', 'adaptable'], yearsExperience: t.teaching.yearsTeachingExperience,
    education: [], credentials: [], introductionVideo: t.about.introductionVideo || null,
    // Sample booleans are not evidence of an actual verification process.
    verifications: [], performance: null, status: 'sample',
    weeklyAvailability: t.availability.weeklySchedule,
    legacyProfileURL: '../teacher-sample.html',
    subjects: t.teaching.subjects.map(s => ({ subjectId: s.name === 'Moroccan Darija' ? 'darija' : 'arabic',
      approval: 'sample', qualifications: { en: 'Sample subject information; approval has not been established.', fr: 'Exemple de matière ; l’approbation n’est pas établie.' },
      categoryMetadata: { classification: s.name === 'Moroccan Darija' ? 'native-speaker' : null, languageVarieties: s.name === 'Moroccan Darija' ? ['moroccan-darija'] : [] } }))
  }));
  const offerings = records.flatMap(t => t.offerings.map(o => ({
    id: `${t.id}:${o.id}`, legacyId: o.id, instructorId: t.id, subjectId: 'darija',
    title: { en: o.title, fr: o.type === 'complimentary-introduction' ? 'Rencontrez votre professeur — gratuit' : o.type === 'package' ? 'Forfait de 5 cours de darija' : `Cours particulier de darija — ${o.durationMinutes} minutes` },
    kind: o.type, durationMinutes: o.durationMinutes || o.durationMinutesPerLesson,
    lessonCount: o.lessonCount || 1, priceMinor: Math.round(o.pricing.baseAmount * 100), currency: o.pricing.baseCurrency,
    deliveryMode: 'online', specialtyIds: ['conversation', 'beginners', 'travel', 'expats'],
    levels: ['beginner', 'intermediate'], prerequisites: {}, policyId: null, active: o.active, bookingEnabled: false
  })));
  return { ...taxonomy, instructors, offerings };
}

export function searchCatalog(catalog, filters = {}, locale = 'en') {
  const query = (filters.query || '').trim().toLocaleLowerCase(locale);
  return catalog.instructors.flatMap(instructor => {
    if (instructor.status !== 'active' && instructor.status !== 'sample') return [];
    if (filters.country && instructor.countryOfResidence !== filters.country) return [];
    if (filters.nativeLanguage && !instructor.nativeLanguages.includes(filters.nativeLanguage)) return [];
    if (filters.spokenLanguage && !instructor.spokenLanguages.some(l => l.id === filters.spokenLanguage)) return [];
    if (filters.style && !instructor.teachingStyles.includes(filters.style)) return [];
    if (filters.verified && !instructor.verifications.some(v => v.kind === 'credentials' && v.status === 'verified')) return [];
    const offerings = publishedOfferings(catalog, instructor).filter(o => {
      const relation = instructor.subjects.find(s => s.subjectId === o.subjectId);
      const subject = catalog.subjects.find(s => s.id === o.subjectId);
      const category = catalog.categories.find(c => c.id === subject?.categoryId);
      const words = [instructor.displayName, localize(subject?.name, locale), ...(subject?.aliases || []), localize(category.name, locale), localize(o.title, locale), ...o.specialtyIds.map(id => localize(catalog.specialties.find(s => s.id === id)?.name, locale))].join(' ').toLocaleLowerCase(locale);
      return (!query || words.includes(query)) && (!filters.subject || o.subjectId === filters.subject)
        && (!filters.specialty || o.specialtyIds.includes(filters.specialty))
        && (!filters.level || o.levels.includes(filters.level))
        && (!filters.currency || o.currency === filters.currency)
        && (filters.maxPrice == null || filters.maxPrice === '' || (filters.currency && o.priceMinor <= Number(filters.maxPrice) * 10 ** new Intl.NumberFormat(locale, {style:"currency",currency:o.currency}).resolvedOptions().maximumFractionDigits))
        && (!filters.availableOnly || (filters.slots || []).some(s=>s.instructorId===instructor.id&&s.offeringIds.includes(o.id)&&new Date(s.endsAt)-new Date(s.startsAt)>=o.durationMinutes*60000))
        && (!filters.bookable || (o.bookingEnabled && (filters.slots || []).some(s => s.instructorId === instructor.id && s.offeringIds.includes(o.id))))
        && (!filters.variety || relation.categoryMetadata?.languageVarieties?.includes(filters.variety))
        && (!filters.classification || relation.categoryMetadata?.classification === filters.classification);
    });
    if (!offerings.length) return [];
    // Organic rank is not a price rank. Missing performance earns no fabricated score.
    const p = instructor.performance;
    const score = (query ? 10 : 0) + instructor.verifications.filter(v => v.status === 'verified').length * 2
      + (p?.rating || 0) + Math.log1p(p?.repeatBookings || 0) + (p?.responseRate || 0);
    return [{ instructor, offerings, score }];
  }).sort((a, b) => {
    const price = row => Math.min(...row.offerings.map(o => o.priceMinor));
    if (filters.sort?.startsWith('price') && filters.currency) return (price(a) - price(b)) * (filters.sort === 'price-desc' ? -1 : 1);
    if (filters.sort === 'rating') return (b.instructor.performance?.rating || 0) - (a.instructor.performance?.rating || 0);
    if (filters.sort === 'experience') return b.instructor.yearsExperience - a.instructor.yearsExperience;
    return b.score - a.score || a.instructor.id.localeCompare(b.instructor.id);
  });
}
export function suggestions(catalog, query, locale = 'en', includeEmpty = false) {
  const offerings = searchCatalog(catalog, {}, locale).flatMap(row => row.offerings);
  const subjectIds = new Set(offerings.map(o => o.subjectId));
  const specialtyIds = new Set(offerings.flatMap(o => o.specialtyIds));
  const values = [
    ...catalog.categories.filter(c => c.active && catalog.subjects.some(s => s.categoryId === c.id && (includeEmpty || subjectIds.has(s.id)))),
    ...catalog.subjects.filter(s => s.active !== false && catalog.categories.some(c=>c.id===s.categoryId&&c.active) && (includeEmpty || subjectIds.has(s.id))),
    ...catalog.specialties.filter(s => includeEmpty ? s.subjectIds.some(id=>catalog.subjects.some(v=>v.id===id&&v.active!==false&&catalog.categories.some(c=>c.id===v.categoryId&&c.active))) : specialtyIds.has(s.id)),
    ...offerings.map(o => ({ name: o.title }))
  ];
  return [...new Set(values.map(v => localize(v.name, locale)))].filter(v => v.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale))).slice(0, 12);
}
export function formatSlot(slot, timezone, locale = 'en') {
  return new Intl.DateTimeFormat(locale, { timeZone: timezone, dateStyle: 'full', timeStyle: 'short' }).format(new Date(slot.startsAt));
}
export function money(minor, currency, locale = 'en') {
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits;
  return formatter.format(minor / 10 ** fractionDigits);
}
