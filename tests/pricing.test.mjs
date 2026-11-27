import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {teachingRate, commissionRate, priceFromNet, splitGross, nextTier, TEACHING_TIERS} from '../pricing.mjs';
import {browserAssets} from '../server/production/site.mjs';

test('teaching commission falls through the published tiers', () => {
  assert.equal(teachingRate(0), 0.30);
  assert.equal(teachingRate(19 * 60), 0.30);
  assert.equal(teachingRate(20 * 60), 0.28);
  assert.equal(teachingRate(49 * 60), 0.28);
  assert.equal(teachingRate(50 * 60), 0.25);
  assert.equal(teachingRate(199 * 60), 0.25);
  assert.equal(teachingRate(200 * 60), 0.23);
  assert.equal(teachingRate(399 * 60), 0.23);
  assert.equal(teachingRate(400 * 60), 0.20);
  assert.equal(teachingRate(9999 * 60), 0.20);
  assert.equal(teachingRate(-5), 0.30);
});

test('translation is a flat 30 percent regardless of volume', () => {
  assert.equal(commissionRate('translator', 0), 0.30);
  assert.equal(commissionRate('translator', 9999 * 60), 0.30);
  assert.equal(commissionRate('transport', 0), 0.30);
});

test('customer price divides by one minus commission, never adds a percentage', () => {
  const r = priceFromNet(2000, 0.30);
  assert.equal(r.grossMinor, 2857);
  assert.equal(r.commissionMinor, 857);
  assert.equal(r.netMinor, 2000);
  // The wrong method would produce 2600 and underpay the provider by 143.
  assert.notEqual(r.grossMinor, 2600);
});

test('a frozen customer price splits so the provider still receives the promised net', () => {
  const {grossMinor} = priceFromNet(2000, 0.30);
  const split = splitGross(grossMinor, 0.30);
  assert.equal(split.netMinor, 2000);
  assert.equal(split.commissionMinor, 857);
});

test('the customer price stays fixed while the provider share rises with tier', () => {
  const gross = priceFromNet(2000, 0.30).grossMinor;
  const shares = TEACHING_TIERS.map(tier => splitGross(gross, tier.rate).netMinor);
  for (let i = 1; i < shares.length; i += 1) assert.ok(shares[i] > shares[i - 1], `tier ${i} should pay more`);
  assert.equal(shares[0], 2000);
  assert.equal(shares[shares.length - 1], 2286);
});

test('rounding never pays the provider less than requested', () => {
  for (const net of [1, 99, 100, 333, 1999, 2000, 12345]) {
    for (const rate of [0.20, 0.23, 0.25, 0.28, 0.30]) {
      const built = priceFromNet(net, rate);
      assert.ok(built.netMinor === net, `${net} at ${rate}`);
      assert.ok(splitGross(built.grossMinor, rate).netMinor >= net - 1);
    }
  }
});

test('the next tier reports the hours remaining', () => {
  assert.deepEqual(nextTier(0), {fromHours: 20, rate: 0.28, hoursRemaining: 20});
  assert.equal(nextTier(19 * 60).hoursRemaining, 1);
  assert.equal(nextTier(20 * 60).fromHours, 50);
  assert.equal(nextTier(400 * 60), null);
});

test('the dashboard preview uses the shared engine and states the split', () => {
  const source = readFileSync('supply-dashboard.mjs', 'utf8');
  assert.match(source, /from '\.\/pricing\.mjs'/);
  assert.match(source, /splitGross\(/);
  assert.match(source, /Marocora keeps/);
  assert.match(source, /you receive/);
});

test('the pricing module is published to browsers', () => {
  assert.ok(browserAssets.has('pricing.mjs'), 'pricing.mjs must be served to the dashboard');
});
