import test from 'node:test';
import assert from 'node:assert/strict';
import {eventId, createSupplyNotifier} from '../server/supply-notify.mjs';

const APP = '0b0e1c9d-61e2-49f0-9bb5-d1b6e6fb3cbc';
const quiet = {warn() {}};

test('event ids are deterministic v5 uuids, unique per kind and revision', () => {
  const a = eventId(APP, 'submitted', 1);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(a, eventId(APP, 'submitted', 1));
  assert.notEqual(a, eventId(APP, 'submitted', 2));
  assert.notEqual(a, eventId(APP, 'approved', 1));
  assert.notEqual(a, eventId('11111111-1111-4111-8111-111111111111', 'submitted', 1));
});

test('missing api key disables sending without throwing', async () => {
  const notify = createSupplyNotifier({env: {}, logger: quiet});
  assert.deepEqual(await notify({kind: 'submitted', application: {id: APP, email: 'a@b.co'}, revision: 1}), {state: 'disabled'});
});

test('a submission sends one message with the expected idempotency key', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({url, options});
    return new Response(JSON.stringify({id: '22222222-2222-4222-8222-222222222222'}), {
      status: 200, headers: {'content-type': 'application/json'},
    });
  };
  const notify = createSupplyNotifier({env: {SUPPLY_RESEND_API_KEY: 'k'.repeat(20)}, fetcher, logger: quiet});
  const result = await notify({kind: 'approved', application: {id: APP, email: 'vendor@example.com'}, revision: 3});
  assert.equal(result.state, 'sent');
  assert.equal(calls.length, 1);
  assert.match(calls[0].options.headers['Idempotency-Key'], /^marocora-supply\/[0-9a-f-]{36}$/);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.to[0], 'vendor@example.com');
  assert.match(body.subject, /review is complete/);
  assert.ok(!JSON.stringify(body).includes('password'));
});

test('the default transport uses global fetch when no fetcher is injected', async () => {
  const original = globalThis.fetch;
  let called = 0;
  globalThis.fetch = async () => {
    called++;
    return new Response(JSON.stringify({id: '33333333-3333-4333-8333-333333333333'}), {
      status: 200, headers: {'content-type': 'application/json'},
    });
  };
  try {
    const notify = createSupplyNotifier({env: {SUPPLY_RESEND_API_KEY: 'k'.repeat(20)}, logger: quiet});
    const result = await notify({kind: 'submitted', application: {id: APP, email: 'a@b.co'}, revision: 1});
    assert.equal(result.state, 'sent');
    assert.equal(called, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test('transport failures are reported, never thrown', async () => {
  const notify = createSupplyNotifier({
    env: {SUPPLY_RESEND_API_KEY: 'k'.repeat(20)},
    fetcher: async () => { throw new Error('network down'); },
    logger: quiet,
  });
  const result = await notify({kind: 'submitted', application: {id: APP, email: 'a@b.co'}, revision: 1});
  assert.equal(result.state, 'uncertain');
});

test('invalid events are rejected before any network call', async () => {
  let called = false;
  const notify = createSupplyNotifier({
    env: {SUPPLY_RESEND_API_KEY: 'k'.repeat(20)},
    fetcher: async () => { called = true; return new Response('{}'); },
    logger: quiet,
  });
  assert.equal((await notify({kind: 'nonsense', application: {id: APP, email: 'a@b.co'}, revision: 1})).state, 'invalid');
  assert.equal((await notify({kind: 'submitted', application: {id: APP, email: 'a@b.co'}, revision: 0})).state, 'invalid');
  assert.equal((await notify({kind: 'submitted', application: {id: 'not-a-uuid', email: 'a@b.co'}, revision: 1})).state, 'invalid');
  assert.equal(called, false);
});
