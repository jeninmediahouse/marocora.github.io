import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {publicPages, browserAssets} from '../server/production/site.mjs';

const PAGES = ['legal.html', 'privacy.html', 'terms.html', 'imprint.html'];
const FACTS = ['Jenin Global Enterprises LLC', 'North Carolina', '5540 Centerview Dr, Unit 200', 'tareq@jeninmediahouse.com'];
const LINKED_FROM = ['index.html', 'contact.html', 'learn/index.html'];

test('legal pages exist, are publishable, and their stylesheet is served', () => {
  for (const page of PAGES) {
    assert.ok(existsSync(page), `${page} missing`);
    assert.ok(publicPages.has(page), `${page} not in publicPages`);
  }
  assert.ok(browserAssets.has('legal.css'), 'legal.css not in browserAssets');
  assert.ok(existsSync('legal.css'), 'legal.css missing');
});

test('legal pages carry the real entity facts in both languages', () => {
  for (const page of PAGES) {
    const source = readFileSync(page, 'utf8');
    for (const fact of FACTS) assert.ok(source.includes(fact), `${page}: missing ${fact}`);
    assert.match(source, /lang="ar"/, `${page}: no Arabic section`);
    assert.match(source, /dir="rtl"/, `${page}: no RTL section`);
    assert.match(source, /data-user-content/, `${page}: content must be exempt from machine translation`);
    assert.ok(!/src="site-language\.mjs/.test(source), `${page}: must not run the page translator`);
  }
});

test('no placeholder or draft markers can reach production', () => {
  const forbidden = [/\{\{/, /\}\}/, /\bTODO\b/, /\bTBD\b/, /\[insert/i, /XXXX/];
  for (const page of PAGES) {
    const source = readFileSync(page, 'utf8');
    for (const pattern of forbidden) assert.ok(!pattern.test(source), `${page}: placeholder ${pattern}`);
  }
});

test('privacy policy names processors, retention and rights', () => {
  const source = readFileSync('privacy.html', 'utf8');
  for (const token of ['Supabase', 'DigitalOcean', 'Formspree', 'Cloudflare', 'Resend', 'Cloudmersive'])
    assert.ok(source.includes(token), `missing processor ${token}`);
  for (const token of ['24 months', '12 months', '30 days', 'CNDP'])
    assert.ok(source.includes(token), `missing retention or authority ${token}`);
  assert.match(source, /we do not (sell|use)/i, 'missing no-sale or no-tracker statement');
});

test('terms define the venue role and the governing law', () => {
  const source = readFileSync('terms.html', 'utf8');
  assert.match(source, /introductions platform/i);
  assert.match(source, /not a party/i);
  assert.match(source, /North Carolina/);
  assert.match(source, /not enabled/i, 'payments must be described as unavailable');
  assert.match(source, /cannot lawfully be (excluded|limited)/i, 'consumer carve-out missing');
});

test('legal pages are linked from the public pages', () => {
  for (const page of LINKED_FROM) {
    const source = readFileSync(page, 'utf8');
    assert.match(source, /href="[^"]*legal\.html"/, `${page}: no legal link`);
  }
  const hub = readFileSync('legal.html', 'utf8');
  for (const page of ['privacy.html', 'terms.html', 'imprint.html'])
    assert.ok(hub.includes(page), `hub does not link ${page}`);
});

test('obsolete corporate identities never appear on published legal pages', () => {
  const forbidden = ['Jenin Realty', '3074883', 'Jenin Media House'];
  for (const page of PAGES) {
    const source = readFileSync(page, 'utf8');
    for (const token of forbidden) assert.ok(!source.includes(token), `${page}: obsolete identity ${token}`);
    assert.ok(source.includes('Jenin Global Enterprises LLC'), `${page}: missing current entity`);
  }
});
