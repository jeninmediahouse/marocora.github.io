import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationHTML, feedbackHTML } from '../learn/review-view.mjs';
test('private review and instructor feedback escape applicant and reviewer content', () => {
  const review = { profile_decision:'approved', subject_decisions:[{category:'Languages',subject:'<img src=x onerror=alert(1)>',decision:'needs_changes'}],feedback:'<script>private</script>' };
  const row = { user_id:'applicant', revision:2, status:'submitted', data:{profile:{displayName:'<script>name</script>',photoURL:'https://example.com/track'},subjects:[{category:'Languages',subject:'<img src=x>',qualifications:'<svg onload=alert(1)>',offerings:[]}]},review };
  for (const lang of ['en','fr']) {
    const html = applicationHTML(row,lang,'staff');
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<img'));
    assert.ok(!html.includes('<svg'));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(feedbackHTML(review,lang).includes('&lt;script&gt;'));
    // Reviewing must not load arbitrary remote profile media.
    assert.ok(!html.includes('src="https://example.com/track'));
    assert.ok(applicationHTML({...row,excluded:true},lang,'staff').includes('value="approved"  disabled'));
    assert.ok(applicationHTML(row,lang,'applicant').includes('type="submit" disabled'));
  }
});
