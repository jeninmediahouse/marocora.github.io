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
