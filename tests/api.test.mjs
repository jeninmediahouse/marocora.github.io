import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApiHandler } from '../server/api.mjs';

async function call(handler, method, path, { body, origin, contentType, session } = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  const request = Readable.from(payload ? [Buffer.from(payload)] : []);
  request.method = method;
  request.url = path;
  request.headers = { ...(origin ? { origin } : {}),
    ...(contentType ? { 'content-type': contentType } : {}),
    ...(session ? { 'x-test-session': session } : {}) };
  const response = {
    writeHead(status, headers) { this.status = status; this.headers = headers; return this; },
    end(data) { this.body = data ? JSON.parse(data) : null; return this; }
  };
  await handler(request, response);
  return response;
}

test('API enforces same-origin writes, server authentication, and verified payment webhooks', async () => {
  let applied = null;
  const handler = createApiHandler({
    origin: 'https://marocora.example',
    authenticate: request => request.headers['x-test-session'] || null,
    verifyPaymentWebhook: (raw, headers) => headers['x-test-session'] === 'signed'
      ? { kind: 'paid', id: 'event-1', bookingId: 'booking-1', amountMinor: 100, currency: 'USD', transactionId: 'charge-1' }
      : null,
    marketplace: {
      account: id => ({ id }),
      publicCatalog: () => ({ instructors: [] }),
      slots: () => [],
      quote: () => ({ total: 100 }),
      checkout: async id => ({ bookingId: `${id}-booking` }),
      booking: (id, bookingId) => ({ id: bookingId, studentId: id }),
      applyVerifiedPayment: event => { applied = event; return { status: 'confirmed' }; }
    }
  });
  assert.equal((await call(handler, 'GET', '/catalog')).status, 200);
  assert.equal((await call(handler, 'POST', '/checkout', { body: {}, contentType: 'application/json' })).status, 403);
  assert.equal((await call(handler, 'POST', '/checkout', { body: {}, contentType: 'application/json', origin: 'https://marocora.example' })).status, 401);
  const checkout = await call(handler, 'POST', '/checkout', { body: {}, contentType: 'application/json',
    origin: 'https://marocora.example', session: 'student-1' });
  assert.equal(checkout.status, 200);
  assert.equal(checkout.body.bookingId, 'student-1-booking');
  assert.equal((await call(handler, 'GET', '/bookings/booking-1')).status, 401);
  assert.equal((await call(handler, 'POST', '/webhooks/payment', { body: {}, session: 'bad' })).status, 401);
  assert.equal(applied, null);
  assert.equal((await call(handler, 'POST', '/webhooks/payment', { body: {}, session: 'signed' })).status, 200);
  assert.equal(applied.bookingId, 'booking-1');
});

test('instructor draft routes require an authenticated instructor and same-origin writes', async () => {
  let saved = null;
  let submitted = false;
  const handler = createApiHandler({
    origin: 'https://marocora.example',
    authenticate: request => request.headers['x-test-session'] || null,
    marketplace: {
      account: id => ({ id }),
      instructorDraft: id => id === 'instructor-1' ? saved : null,
      saveInstructorDraft: (id, body) => { if (id !== 'instructor-1') throw new Error('wrong actor'); saved = { status: 'draft', data: body }; return saved; },
      submitInstructorDraft: id => { if (id !== 'instructor-1') throw new Error('wrong actor'); submitted = true; return { ...saved, status: 'submitted' }; }
    }
  });
  assert.equal((await call(handler, 'GET', '/instructor/draft')).status, 401);
  assert.equal((await call(handler, 'GET', '/instructor/draft', { session: 'instructor-1' })).body.draft, null);
  assert.equal((await call(handler, 'POST', '/instructor/draft', { body: { profile: {} },
    contentType: 'application/json', session: 'instructor-1' })).status, 403);
  const result = await call(handler, 'POST', '/instructor/draft', { body: { profile: { displayName: 'Sam' } },
    contentType: 'application/json', origin: 'https://marocora.example', session: 'instructor-1' });
  assert.equal(result.body.draft.data.profile.displayName, 'Sam');
  assert.equal((await call(handler, 'POST', '/instructor/submit', { body: {},
    contentType: 'application/json', origin: 'https://marocora.example', session: 'instructor-1' })).body.draft.status, 'submitted');
  assert.equal(submitted, true);
});
