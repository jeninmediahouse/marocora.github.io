import test from 'node:test';
import assert from 'node:assert/strict';
import { Marketplace, DomainError } from '../server/marketplace.mjs';

const HOUR = 60 * 60 * 1000;

function fixture({ priceMinor = 2500, holdMinutes = 15, freeIntroEligibility } = {}) {
  let now = Date.parse('2026-10-01T12:00:00Z');
  const sessions = [];
  const marketplace = new Marketplace(':memory:', {
    clock: () => now,
    holdMinutes,
    fees: {
      approved: true,
      version: 'fees-1',
      calculate: () => ({ fee: 200, tax: 0, discount: priceMinor === 0 ? 200 : 0 }),
      freeIntroEligibility
    },
    payments: {
      async createCheckout(request) {
        sessions.push(request);
        return { id: `session-${request.bookingId}`, url: `https://payments.example/checkout/${request.bookingId}` };
      }
    },
    notifications: { async send() {} }
  });
  marketplace.addAccount({ id: 'student-1', role: 'student', authSubject: 'student-1' });
  marketplace.addAccount({ id: 'student-2', role: 'student', authSubject: 'student-2' });
  marketplace.addAccount({ id: 'teacher-account', role: 'instructor', authSubject: 'teacher' });
  marketplace.addAccount({ id: 'admin', role: 'admin', authSubject: 'admin' });
  marketplace.addPolicy({ id: 'policy-1', version: 'policy-1', approved: true, text: { en: 'Test policy' } });
  marketplace.importCatalog({
    categories: [{ id: 'languages', active: true }],
    subjects: [{ id: 'darija', categoryId: 'languages' }],
    specialties: [],
    instructors: [{ id: 'teacher', accountId: 'teacher-account', status: 'active', subjects: [
      { subjectId: 'darija', approval: 'approved', qualifications: { en: 'Test' } }
    ] }],
    offerings: [{ id: 'lesson', instructorId: 'teacher', subjectId: 'darija', policyId: 'policy-1',
      priceMinor, currency: 'USD', durationMinutes: 60, lessonCount: 1,
      deliveryMode: 'online', active: true, bookingEnabled: true }]
  });
  marketplace.addSlot({ id: 'slot-1', instructorId: 'teacher',
    startsAt: '2026-10-02T12:00:00Z', endsAt: '2026-10-02T13:00:00Z',
    timezone: 'UTC', offeringIds: ['lesson'] });
  const input = key => ({ offeringId: 'lesson', slotId: 'slot-1', timezone: 'UTC', locale: 'en',
    goal: 'Practice conversation', policyVersion: 'policy-1', policyAccepted: true, idempotencyKey: key });
  return { marketplace, input, sessions, advance: ms => { now += ms; } };
}

test('checkout holds a slot; verified payment confirms once and unlocks completed-lesson reviews', async t => {
  const f = fixture(); t.after(() => f.marketplace.close());
  const { marketplace: m } = f;
  const checkout = await m.checkout('student-1', f.input('request-1'));
  assert.match(checkout.redirectURL, /^https:\/\/payments\.example\//);
  assert.equal(m.booking('student-1', checkout.bookingId).status, 'held');
  assert.equal(m.slots('teacher').length, 0);
  assert.throws(() => m.reserve('student-2', f.input('request-2')), error =>
    error instanceof DomainError && error.message === 'SLOT_UNAVAILABLE');
  assert.equal(m.applyVerifiedPayment({ id: 'event-1', bookingId: checkout.bookingId,
    sessionId: `session-${checkout.bookingId}`, kind: 'paid', amountMinor: 2700, currency: 'USD', transactionId: 'charge-1' }).status, 'confirmed');
  assert.deepEqual(m.applyVerifiedPayment({ id: 'event-1', bookingId: checkout.bookingId,
    sessionId: `session-${checkout.bookingId}`, kind: 'paid', amountMinor: 2700, currency: 'USD', transactionId: 'charge-1' }), { duplicate: true });
  assert.deepEqual(m.applyVerifiedPayment({ id: 'event-2', bookingId: checkout.bookingId,
    sessionId: `session-${checkout.bookingId}`, kind: 'paid', amountMinor: 2700, currency: 'USD', transactionId: 'charge-1' }),
    { duplicate: true, status: 'confirmed' });
  assert.equal(m.applyVerifiedPayment({ id: 'failed-after-payment', bookingId: checkout.bookingId,
    sessionId: `session-${checkout.bookingId}`, kind: 'failed', amountMinor: 2700, currency: 'USD' }).status, 'confirmed');
  assert.deepEqual(m.applyVerifiedPayment({ id: 'second-charge-event', bookingId: checkout.bookingId,
    sessionId: `session-${checkout.bookingId}`, kind: 'paid', amountMinor: 2700, currency: 'USD', transactionId: 'charge-2' }),
    { status: 'confirmed', reconciliationRequired: true });
  assert.equal(m.all('SELECT * FROM outbox').length, 2);
  assert.equal(m.all('SELECT * FROM payouts').length, 1);
  assert.throws(() => m.review('student-1', { bookingId: checkout.bookingId, rating: 5, body: 'Great lesson' }),
    error => error.message === 'REVIEW_NOT_ELIGIBLE');
  f.advance(26 * HOUR);
  m.complete('admin', checkout.bookingId);
  assert.equal(m.booking('student-1', checkout.bookingId).reviewEligible, true);
  const review = m.review('student-1', { bookingId: checkout.bookingId, rating: 5, body: 'Great lesson' });
  assert.equal(review.moderation, 'pending');
  assert.equal(m.booking('student-1', checkout.bookingId).reviewEligible, false);
  m.moderate('admin', 'review', review.id, 'published');
  assert.equal(m.publicCatalog().instructors[0].reviews.length, 1);
  const reply = m.reply('teacher-account', { reviewId: review.id, body: 'Thank you' });
  m.moderate('admin', 'reply', reply.id, 'published');
  assert.equal(m.publicCatalog().instructors[0].reviews[0].reply.body, 'Thank you');
});

test('idempotent checkout returns the same booking and rejects changed requests', async t => {
  const f = fixture(); t.after(() => f.marketplace.close());
  const first = await f.marketplace.checkout('student-1', f.input('request-1'));
  const second = await f.marketplace.checkout('student-1', f.input('request-1'));
  assert.equal(second.bookingId, first.bookingId);
  assert.equal(f.sessions.length, 2);
  assert.throws(() => f.marketplace.reserve('student-1', { ...f.input('request-1'), goal: 'Different goal' }),
    error => error.message === 'IDEMPOTENCY_CONFLICT');
});

test('server rejects unchecked or outdated policy and mismatched payment events', async t => {
  const f = fixture(); t.after(() => f.marketplace.close());
  assert.throws(() => f.marketplace.reserve('student-1', { ...f.input('unchecked'), policyAccepted: false }),
    error => error.message === 'POLICY_ACCEPTANCE_REQUIRED');
  assert.throws(() => f.marketplace.reserve('student-1', { ...f.input('outdated'), policyVersion: 'old' }),
    error => error.message === 'POLICY_CHANGED');
  const checkout = await f.marketplace.checkout('student-1', f.input('valid'));
  assert.throws(() => f.marketplace.applyVerifiedPayment({ id: 'wrong-amount', bookingId: checkout.bookingId,
    sessionId: `session-${checkout.bookingId}`, kind: 'paid', amountMinor: 1, currency: 'USD', transactionId: 'charge-wrong' }),
    error => error.message === 'PAYMENT_MISMATCH');
  assert.throws(() => f.marketplace.applyVerifiedPayment({ id: 'wrong-session', bookingId: checkout.bookingId,
    sessionId: 'other-session', kind: 'paid', amountMinor: 2700, currency: 'USD', transactionId: 'charge-wrong' }),
    error => error.message === 'PAYMENT_MISMATCH');
  assert.equal(f.marketplace.booking('student-1', checkout.bookingId).status, 'held');
  assert.equal(f.marketplace.all('SELECT * FROM payment_events').length, 0);
});

test('late verified payment is kept for reconciliation and cannot displace a new reservation', async t => {
  const f = fixture(); t.after(() => f.marketplace.close());
  const first = await f.marketplace.checkout('student-1', f.input('request-1'));
  f.advance(16 * 60 * 1000);
  const second = await f.marketplace.checkout('student-2', f.input('request-2'));
  assert.equal(f.marketplace.applyVerifiedPayment({ id: 'late-event', bookingId: first.bookingId,
    sessionId: `session-${first.bookingId}`, kind: 'paid', amountMinor: 2700, currency: 'USD', transactionId: 'late-charge' }).status, 'reconciliation');
  assert.equal(f.marketplace.booking('student-1', first.bookingId).status, 'reconciliation');
  assert.equal(f.marketplace.booking('student-2', second.bookingId).status, 'held');
  assert.equal(f.marketplace.all('SELECT * FROM outbox').length, 0);
});

test('free introductions need explicit eligibility and do not create paid review eligibility', async t => {
  const f = fixture({ priceMinor: 0, freeIntroEligibility: () => true });
  t.after(() => f.marketplace.close());
  const result = await f.marketplace.checkout('student-1', f.input('free-intro'));
  assert.equal(f.marketplace.booking('student-1', result.bookingId).status, 'confirmed');
  assert.equal(f.sessions.length, 0);
  f.advance(26 * HOUR);
  f.marketplace.complete('admin', result.bookingId);
  assert.equal(f.marketplace.booking('student-1', result.bookingId).reviewEligible, false);
});

test('public catalog and slots hide unpublished instructors and unapproved subjects', t => {
  const f = fixture(); t.after(() => f.marketplace.close());
  const m = f.marketplace;
  assert.equal(m.publicCatalog().offerings.length, 1);
  assert.equal(m.slots('teacher').length, 1);
  const instructor = JSON.parse(m.one('SELECT data FROM instructors WHERE id=?', 'teacher').data);
  instructor.status = 'pending';
  m.run('UPDATE instructors SET data=? WHERE id=?', JSON.stringify(instructor), 'teacher');
  assert.equal(m.publicCatalog().instructors.length, 0);
  assert.equal(m.publicCatalog().offerings.length, 0);
  assert.equal(m.slots('teacher').length, 0);
  instructor.status = 'active';
  m.run('UPDATE instructors SET data=? WHERE id=?', JSON.stringify(instructor), 'teacher');
  m.run('UPDATE instructor_subjects SET approval=? WHERE instructor_id=? AND subject_id=?', 'pending', 'teacher', 'darija');
  assert.equal(m.publicCatalog().instructors.length, 0);
  assert.equal(m.publicCatalog().offerings.length, 0);
  assert.equal(m.slots('teacher').length, 0);
});

test('inactive categories and subjects cannot publish offerings or reach checkout', t => {
  const f = fixture(); t.after(() => f.marketplace.close());
  const m = f.marketplace;
  m.run('UPDATE categories SET data=? WHERE id=?', JSON.stringify({ id: 'languages', active: false }), 'languages');
  assert.equal(m.publicCatalog().categories.length, 0);
  assert.equal(m.publicCatalog().subjects.length, 0);
  assert.equal(m.publicCatalog().instructors.length, 0);
  assert.equal(m.publicCatalog().offerings.length, 0);
  assert.equal(m.slots('teacher').length, 0);
  assert.throws(() => m.quote(f.input('hidden-category')), error => error.message === 'OFFERING_NOT_BOOKABLE');
  m.run('UPDATE categories SET data=? WHERE id=?', JSON.stringify({ id: 'languages', active: true }), 'languages');
  m.run('UPDATE subjects SET data=? WHERE id=?', JSON.stringify({ id: 'darija', categoryId: 'languages', active: false }), 'darija');
  assert.equal(m.publicCatalog().subjects.length, 0);
  assert.equal(m.publicCatalog().offerings.length, 0);
  assert.equal(m.slots('teacher').length, 0);
  assert.throws(() => m.quote(f.input('hidden-subject')), error => error.message === 'OFFERING_NOT_BOOKABLE');
});

test('changing an offering duration cannot overrun an existing slot', t => {
  const f = fixture(); t.after(() => f.marketplace.close());
  const m = f.marketplace;
  const offering = JSON.parse(m.one('SELECT data FROM offerings WHERE id=?', 'lesson').data);
  offering.durationMinutes = 90;
  m.run('UPDATE offerings SET data=? WHERE id=?', JSON.stringify(offering), 'lesson');
  assert.equal(m.slots('teacher').length, 0);
  assert.throws(() => m.quote(f.input('too-long')), error => error.message === 'SLOT_UNAVAILABLE');
});

test('availability requires an explicit canonical UTC instant', t => {
  const f = fixture(); t.after(() => f.marketplace.close());
  const m = f.marketplace;
  assert.throws(() => m.addSlot({ id: 'ambiguous', instructorId: 'teacher', startsAt: '2026-10-03T12:00:00',
    endsAt: '2026-10-03T13:00:00Z', timezone: 'UTC', offeringIds: ['lesson'] }),
  error => error.message === 'INVALID_SLOT');
  assert.equal(m.one('SELECT 1 FROM slots WHERE id=?', 'ambiguous'), undefined);
});

test('one instructor publishes distinct qualifications and prices for multiple subjects', t => {
  const f = fixture(); t.after(() => f.marketplace.close());
  const m = f.marketplace;
  m.importCatalog({
    categories: [{ id: 'languages', active: true }],
    subjects: [{ id: 'darija', categoryId: 'languages' }, { id: 'arabic', categoryId: 'languages' }],
    specialties: [],
    instructors: [{ id: 'teacher', accountId: 'teacher-account', status: 'active', subjects: [
      { subjectId: 'darija', approval: 'approved', qualifications: { en: 'Darija conversation experience' } },
      { subjectId: 'arabic', approval: 'approved', qualifications: { en: 'Arabic grammar qualification' } }
    ] }],
    offerings: [
      { id: 'lesson', instructorId: 'teacher', subjectId: 'darija', policyId: 'policy-1', priceMinor: 2500,
        currency: 'USD', durationMinutes: 60, lessonCount: 1, deliveryMode: 'online', active: true, bookingEnabled: true },
      { id: 'arabic-lesson', instructorId: 'teacher', subjectId: 'arabic', policyId: 'policy-1', priceMinor: 3200,
        currency: 'USD', durationMinutes: 60, lessonCount: 1, deliveryMode: 'online', active: true, bookingEnabled: true }
    ]
  });
  m.addSlot({ id: 'arabic-slot', instructorId: 'teacher', startsAt: '2026-10-03T12:00:00Z',
    endsAt: '2026-10-03T13:00:00Z', timezone: 'UTC', offeringIds: ['arabic-lesson'] });
  const publicCatalog = m.publicCatalog();
  assert.equal(publicCatalog.instructors.length, 1);
  assert.deepEqual(publicCatalog.instructors[0].subjects.map(s => [s.subjectId, s.qualifications.en]).sort(), [
    ['arabic', 'Arabic grammar qualification'], ['darija', 'Darija conversation experience']
  ]);
  assert.deepEqual(publicCatalog.offerings.map(o => [o.subjectId, o.priceMinor]).sort(), [
    ['arabic', 3200], ['darija', 2500]
  ]);
  assert.equal(m.quote({ offeringId: 'arabic-lesson', slotId: 'arabic-slot' }).subtotal, 3200);
});
