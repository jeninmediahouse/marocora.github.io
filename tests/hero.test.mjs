import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync, existsSync} from 'node:fs';
import {browserAssets} from '../server/production/site.mjs';
import {siteCopy} from '../site-copy.mjs';

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

test('contact details stay readable in both directions', () => {
  const home = readFileSync('index.html', 'utf8');
  assert.match(home, /<div class="contact-address">/);
  assert.match(home, /<span class="addr" dir="ltr">/);
  assert.match(home, /<span dir="ltr"><span aria-hidden="true">✉️<\/span>/);
  assert.doesNotMatch(home, /<span class="addr">/, 'address must be isolated from RTL flow');
});
