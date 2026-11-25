import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('translator profiles use structured from/to rows instead of a vertical-bar textarea', () => {
  const html = read('supply-dashboard.html');
  const js = read('supply-dashboard.mjs');
  assert.match(html, /id="language-pairs"/);
  assert.match(html, /id="add-pair"/);
  assert.doesNotMatch(html, /name="languagePairs"/);
  assert.doesNotMatch(html, /vertical bar/i);
  assert.match(js, /data-pair="from"/);
  assert.match(js, /data-pair="to"/);
  assert.match(js, /Add at least one language pair/);
  assert.match(js, /Each language pair needs both/);
  assert.match(js, /scrollIntoView/);
  const reviewHtml = read('supply-review.html');
  const reviewJs = read('supply-review.mjs');
  const dashboardHtml = read('supply-dashboard.html');
  assert.match(reviewHtml, /id="all-applications-section"/);
  assert.match(reviewJs, /\/api\/supply\/applications\/all/);
  assert.match(reviewJs, /\/api\/auth\/me/);
  assert.match(reviewJs, /allStatus\.value=''/);
  assert.match(reviewJs, /allType\.value=''/);
  assert.match(dashboardHtml, /id="signed-in"/);
  assert.match(dashboardHtml, /id="credential-panel"/);
  assert.doesNotMatch(dashboardHtml, /id="payout-form"/);
  assert.doesNotMatch(dashboardHtml, /Account holder|IBAN|SWIFT/);
  assert.match(js, /credentialPanel/);
});

test('expired human-check messages tell the vendor to complete the check again', () => {
  const client = read('supply-client.mjs');
  const register = read('supply-register.mjs');
  assert.match(client, /expired or was not completed/);
  assert.match(register, /expired or is not finished/);
  assert.match(register, /expired-callback/);
});
