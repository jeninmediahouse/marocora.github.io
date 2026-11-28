import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync, existsSync} from 'node:fs';
import {browserAssets} from '../server/production/site.mjs';
import {siteCopy} from '../site-copy.mjs';
import {homeCopy} from '../home-copy.mjs';

test('the hero image is present, published and used by the homepage', () => {
  assert.ok(existsSync('hero-global.jpg'), 'hero image missing');
  assert.ok(statSync('hero-global.jpg').size > 100 * 1024, 'hero image suspiciously small');
  assert.ok(browserAssets.has('hero-global.jpg'), 'hero image not on the browser allowlist');
  const home = readFileSync('index.html', 'utf8');
  assert.match(home, /hero-global\.jpg/);
  assert.match(home, /Local trust\./);
  assert.match(home, /Global reach\./);
  assert.match(home, /<div class="hero-media"/);
});

test('the new hero copy is translated into all four languages', () => {
  for (const phrase of ['Local trust.', 'Global reach.']) {
    for (const lang of ['en', 'ar', 'fr', 'es'])
      assert.ok(siteCopy[phrase]?.[lang]?.trim(), `${phrase} missing ${lang}`);
  }
});

test('the section photographs are present, published and used', () => {
  const home = readFileSync('index.html', 'utf8');
  for (const [file, width] of [['online-lesson.jpg', 1400], ['language-class.jpg', 1400]]) {
    assert.ok(existsSync(file), `${file} missing`);
    assert.ok(statSync(file).size > 60 * 1024, `${file} suspiciously small`);
    assert.ok(browserAssets.has(file), `${file} not on the browser allowlist`);
    assert.match(home, new RegExp(file.replace('.', '\\.')));
  }
  assert.match(home, /<figure class="about-media">/);
  assert.match(home, /<figure class="teaching-media">/);
  assert.match(home, /alt="[^"]{20,}"/);
});

test('the contact block carries the operator, both addresses and the copyright', () => {
  const home = readFileSync('index.html', 'utf8');
  assert.match(home, /class="contact-email"><a href="mailto:admin@marocora\.com"/);
  assert.match(home, /Marocora is operated by Jenin Global Enterprises LLC/);
  assert.match(home, /5540 Centerview Drive, Suite 200, Mailbox 357/);
  assert.match(home, /Raleigh, NC 27606, USA/);
  assert.match(home, /Morocco Operations: Jenin Media House SARLAU/);
  assert.match(home, /03 Lotissement ONA 1, Étage 2/);
  assert.match(home, /Deroua, Berrechid, Morocco/);
  assert.match(home, /© 2026 Marocora\. All rights reserved\./);
  assert.match(home, /unicode-bidi: plaintext/, 'addresses must keep their own direction inside RTL');
});

test('every paragraph of the founder letter is published and translated', () => {
  const home = readFileSync('index.html', 'utf8');
  assert.match(home, /Tareq Naser, Founder of Marocora/);
  const block = home.slice(home.indexOf('<div class="about-text">'), home.indexOf('<figure class="about-media">'));
  const paragraphs = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map(m => m[1].replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter(text => text !== 'Tareq Naser, Founder of Marocora');
  assert.equal(paragraphs.length, 11, 'the letter should have eleven paragraphs');
  for (const text of paragraphs) {
    for (const lang of ['en', 'ar', 'fr', 'es']) {
      assert.ok(homeCopy[text]?.[lang]?.trim(), `missing ${lang} for: ${text.slice(0, 48)}…`);
    }
  }
});
