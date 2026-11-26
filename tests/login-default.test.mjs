import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('a plain sign-in lands on the partner dashboard, not the legacy workspace', () => {
  const source = readFileSync('production-login.mjs', 'utf8');
  assert.ok(!source.includes("||'/instant-quote.html'"), 'default still points at the legacy workspace');
  assert.ok(!source.includes(":'/instant-quote.html'"), 'fallback still points at the legacy workspace');
  const defaults = source.match(/\/supply-dashboard\.html/g) || [];
  assert.ok(defaults.length >= 2, 'both the default and the fallback must use the dashboard');
});

test('both signed-in screens offer a working sign-out control', () => {
  const client = readFileSync('supply-client.mjs', 'utf8');
  assert.match(client, /\/api\/auth\/logout/);
  assert.match(client, /export async function mountSignOut/);
  for (const page of ['supply-dashboard.html', 'supply-review.html'])
    assert.match(readFileSync(page, 'utf8'), /id="sign-out"/, `${page}: no sign-out control`);
  for (const mod of ['supply-dashboard.mjs', 'supply-review.mjs'])
    assert.match(readFileSync(mod, 'utf8'), /mountSignOut\(\)/, `${mod}: sign-out not mounted`);
});
