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
