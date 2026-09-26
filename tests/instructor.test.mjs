import test from 'node:test';
import assert from 'node:assert/strict';
import { Marketplace, DomainError } from '../server/marketplace.mjs';

test('one instructor can draft and submit several subjects with independent offerings without publication', t => {
  let now = Date.parse('2026-10-01T12:00:00Z');
  const m = new Marketplace(':memory:', { clock: () => now });
  t.after(() => m.close());
  m.addAccount({ id: 'instructor-1', role: 'instructor', authSubject: 'auth-1' });
  m.addAccount({ id: 'student-1', role: 'student', authSubject: 'auth-2' });

  const incomplete = m.saveInstructorDraft('instructor-1', { profile: { displayName: 'Sam' }, subjects: [] });
  assert.equal(incomplete.status, 'draft');
  assert.throws(() => m.submitInstructorDraft('instructor-1'), error => error.message === 'INSTRUCTOR_DRAFT_INCOMPLETE');
  assert.throws(() => m.saveInstructorDraft('student-1', {}), error => error instanceof DomainError && error.status === 403);

  const profile = { displayName: 'Sam', headline: 'Piano and algebra instructor', bio: 'Teaching beginners and adults.',
    countryOfResidence: 'US', timezone: 'America/New_York', yearsExperience: 7 };
  const subjects = [
    { category: 'Music', subject: 'Piano', qualifications: 'Music degree', specialties: ['Beginner piano'],
      offerings: [{ title: 'Piano introduction', durationMinutes: 30, priceMinor: 1200, currency: 'USD', lessonCount: 1 }] },
    { category: 'Mathematics', subject: 'Algebra', qualifications: 'Mathematics degree', specialties: ['Algebra I'],
      offerings: [{ title: 'Algebra tutoring', durationMinutes: 60, priceMinor: 3000, currency: 'USD', lessonCount: 1 }] }
  ];
  now += 1000;
  const saved = m.saveInstructorDraft('instructor-1', { profile, subjects, status: 'active', verifications: ['verified'] });
  assert.equal(saved.status, 'draft');
  assert.equal(saved.revision, 2);
  assert.equal(saved.data.subjects[0].offerings[0].priceMinor, 1200);
  assert.equal(saved.data.subjects[1].offerings[0].priceMinor, 3000);
  assert.equal(saved.data.status, undefined);
  assert.equal(saved.data.verifications, undefined);
  const submitted = m.submitInstructorDraft('instructor-1');
  assert.equal(submitted.status, 'submitted');
  assert.equal(submitted.submittedAt, now);
  assert.equal(m.submitInstructorDraft('instructor-1').submittedAt, now);
  assert.equal(m.publicCatalog().instructors.length, 0);
  assert.equal(m.publicCatalog().offerings.length, 0);
  assert.equal(m.instructorDraft('instructor-1').data.subjects.length, 2);
});

test('drafts reject duplicate subjects, malformed prices, and unsafe links', t => {
  const m = new Marketplace(':memory:'); t.after(() => m.close());
  m.addAccount({ id: 'instructor-1', role: 'instructor', authSubject: 'auth-1' });
  const subject = { category: 'Music', subject: 'Piano', offerings: [] };
  assert.throws(() => m.saveInstructorDraft('instructor-1', { subjects: [subject, subject] }),
    error => error.message === 'DUPLICATE_SUBJECT');
  assert.throws(() => m.saveInstructorDraft('instructor-1', { subjects: [{ ...subject, offerings: [
    { title: 'Lesson', durationMinutes: 50, priceMinor: -1, currency: 'USD' }
  ] }] }), error => error.message === 'INVALID_OFFERING');
  assert.throws(() => m.saveInstructorDraft('instructor-1', { profile: { introductionVideo: 'javascript:alert(1)' } }),
    error => error.message === 'INVALID_INSTRUCTOR_DRAFT');
});

test('verified instructor subjects provision an idempotent account without changing an existing role', t => {
  const m = new Marketplace(':memory:'); t.after(() => m.close());
  const created = m.provisionInstructorAccount('identity-provider|sam', 'fr');
  assert.equal(created.created, true);
  assert.equal(m.provisionInstructorAccount('identity-provider|sam', 'en').id, created.id);
  assert.equal(m.provisionInstructorAccount('identity-provider|sam').created, false);
  assert.equal(m.account(created.id).locale, 'fr');
  m.addAccount({ id:'student-1', role:'student', authSubject:'identity-provider|student' });
  assert.throws(() => m.provisionInstructorAccount('identity-provider|student'),
    error => error.message === 'ACCOUNT_ROLE_CONFLICT');
  assert.throws(() => m.provisionInstructorAccount(''), error => error.message === 'INVALID_AUTH_SUBJECT');
});
