import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const ROBOTS = readFileSync('robots.txt', 'utf8');
const SITEMAP = readFileSync('sitemap.xml', 'utf8');
const LOCS = [...SITEMAP.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

test('robots.txt blocks private surfaces and points at the sitemap', () => {
  assert.match(ROBOTS, /^User-agent: \*$/m);
  for (const path of ['/api/', '/supply-dashboard.html', '/supply-review.html', '/production-login.html', '/reset-password.html', '/learning-room.html'])
    assert.ok(ROBOTS.includes('Disallow: ' + path), `robots missing ${path}`);
  assert.ok(ROBOTS.includes('Sitemap: https://marocora.com/sitemap.xml'));
  assert.ok(!/Disallow: \/$/m.test(ROBOTS), 'robots must not block the whole site');
});

test('every sitemap URL resolves to a real page', () => {
  assert.ok(LOCS.length >= 8);
  for (const loc of LOCS) {
    assert.match(loc, /^https:\/\/marocora\.com\//);
    const path = loc.replace('https://marocora.com/', '');
    const file = path === '' ? 'index.html' : path.endsWith('/') ? path + 'index.html' : path;
    assert.ok(existsSync(file), `sitemap entry without a file: ${loc}`);
  }
});

test('the sitemap lists public pages only', () => {
  const privateOnes = ['supply-dashboard', 'supply-review', 'production-login', 'reset-password', 'staff-review', 'vendor-review', 'application.html', 'launch-report'];
  for (const loc of LOCS) for (const bad of privateOnes) assert.ok(!loc.includes(bad), `private page in sitemap: ${loc}`);
  for (const page of ['legal.html', 'privacy.html', 'terms.html', 'imprint.html', 'professionals.html'])
    assert.ok(LOCS.some(loc => loc.endsWith(page)), `sitemap missing ${page}`);
});

test('the admin screen summarises onboarding activity', () => {
  const source = readFileSync('supply-review.mjs', 'utf8');
  assert.match(source, /New this week/);
  assert.match(source, /pending_review/);
  assert.match(source, /updatePulse\(\)/);
});
