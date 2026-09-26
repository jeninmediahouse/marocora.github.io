import test from 'node:test';
import assert from 'node:assert/strict';
import { money, publishedOfferings, publishedSubjects, searchCatalog, suggestions } from '../learn/catalog.mjs';

function instructor(id, displayName, subjects, extras = {}) {
  return {
    id, displayName, headline: { en: `${displayName} lessons` }, bio: { en: 'Sample biography' },
    status: 'active', countryOfResidence: 'US', nativeLanguages: [], spokenLanguages: [],
    teachingStyles: ['patient'], verifications: [], yearsExperience: 5, performance: null,
    subjects: subjects.map(subjectId => ({ subjectId, approval: 'approved', qualifications: { en: `${subjectId} qualification` }, categoryMetadata: {} })),
    ...extras
  };
}

const offering = (id, instructorId, subjectId, priceMinor, extras = {}) => ({
  id, instructorId, subjectId, title: { en: `${subjectId} lesson` }, active: true,
  currency: 'USD', priceMinor, durationMinutes: 50, specialtyIds: [], levels: ['beginner'],
  bookingEnabled: false, ...extras
});

test('one profile can teach multiple subjects with independent prices; a new category is data-only', () => {
  const catalog = {
    categories: [
      { id: 'languages', active: true, name: { en: 'Languages' } },
      { id: 'music', active: false, name: { en: 'Music' } },
      { id: 'mathematics', active: false, name: { en: 'Mathematics' } }
    ],
    subjects: [
      { id: 'darija', categoryId: 'languages', name: { en: 'Darija' }, aliases: [] },
      { id: 'arabic', categoryId: 'languages', name: { en: 'Arabic' }, aliases: [] },
      { id: 'english', categoryId: 'languages', name: { en: 'American English' }, aliases: ['English'] },
      { id: 'piano', categoryId: 'music', name: { en: 'Piano' }, aliases: [] },
      { id: 'algebra', categoryId: 'mathematics', name: { en: 'Algebra' }, aliases: [] }
    ],
    specialties: [],
    instructors: [
      instructor('amal', 'Amal', ['darija', 'arabic'], { countryOfResidence: 'MA', nativeLanguages: ['darija'] }),
      instructor('beth', 'Beth', ['english'], { nativeLanguages: ['english'] }),
      instructor('sam', 'Sam', ['piano', 'algebra'])
    ],
    offerings: [
      offering('amal-darija', 'amal', 'darija', 700),
      offering('amal-arabic', 'amal', 'arabic', 850),
      offering('beth-english', 'beth', 'english', 2500),
      offering('sam-piano', 'sam', 'piano', 3000),
      offering('sam-algebra', 'sam', 'algebra', 2800)
    ]
  };
  assert.deepEqual(searchCatalog(catalog, { query: 'Darija' }).map(r => r.instructor.id), ['amal']);
  assert.deepEqual(searchCatalog(catalog, { query: 'English' }).map(r => r.instructor.id), ['beth']);
  assert.equal(searchCatalog(catalog, { query: 'Piano' }).length, 0);
  assert.equal(suggestions(catalog, 'Piano').length, 0);
  catalog.categories[1].active = true;
  catalog.categories[2].active = true;
  assert.deepEqual(searchCatalog(catalog, { query: 'Piano' }).map(r => r.instructor.id), ['sam']);
  assert.deepEqual(searchCatalog(catalog, { query: 'Algebra' }).map(r => r.instructor.id), ['sam']);
  assert.equal(searchCatalog(catalog, { subject: 'piano' })[0].offerings[0].priceMinor, 3000);
  assert.equal(searchCatalog(catalog, { subject: 'algebra' })[0].offerings[0].priceMinor, 2800);
  assert.deepEqual(publishedOfferings(catalog, catalog.instructors[2]).map(o => o.id), ['sam-piano', 'sam-algebra']);
  assert.deepEqual(publishedSubjects(catalog, catalog.instructors[2]).map(({subject}) => subject.id), ['piano', 'algebra']);
  assert.ok(suggestions(catalog, 'Piano').includes('Piano'));
  catalog.subjects[3].active = false;
  assert.equal(searchCatalog(catalog, { query: 'Piano' }).length, 0);
  assert.equal(suggestions(catalog, 'Piano').length, 0);
  catalog.subjects[3].active = true;
  catalog.instructors[2].subjects[0].approval = 'pending';
  assert.equal(searchCatalog(catalog, { query: 'Piano' }).length, 0);
  assert.deepEqual(publishedOfferings(catalog, catalog.instructors[2]).map(o => o.id), ['sam-algebra']);
  catalog.instructors[2].status = 'pending';
  assert.equal(publishedOfferings(catalog, catalog.instructors[2]).length, 0);
});

test('search does not advertise an unoffered subject merely mentioned in a headline', () => {
  const catalog = {
    categories: [{ id:'languages', active:true, name:{en:'Languages'} }],
    subjects: [{id:'darija',categoryId:'languages',name:{en:'Darija'},aliases:[]},{id:'arabic',categoryId:'languages',name:{en:'Arabic'},aliases:[]}],
    specialties: [],
    instructors: [instructor('teacher','Teacher',['darija','arabic'],{headline:{en:'Darija and Arabic lessons'}})],
    offerings: [offering('darija-lesson','teacher','darija',800)]
  };
  assert.equal(searchCatalog(catalog,{query:'Arabic'}).length,0);
  assert.deepEqual(publishedSubjects(catalog,catalog.instructors[0]).map(({subject}) => subject.id),['darija']);
});

test('price formatting uses the currency minor unit', () => {
  assert.equal(money(1234, 'JPY', 'en'), '¥1,234');
  assert.match(money(1234, 'KWD', 'en'), /1\.234/);
});
