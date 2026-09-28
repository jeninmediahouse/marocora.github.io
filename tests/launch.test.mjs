import test from 'node:test';
import assert from 'node:assert/strict';
import { taxonomy,canonicalSubject } from '../learn/taxonomy.mjs';
import { suggestions,searchCatalog } from '../learn/catalog.mjs';
import { normalizeInstructorDraft } from '../server/instructor-draft.mjs';
import { publicPreviewHTML,publicationControls } from '../learn/publication-view.mjs';
import { readPendingSelection } from '../learn/account-view.mjs';
test('launch taxonomy supports five languages, math branches and physics without inventing teachers',()=>{
 for(const id of ['english','arabic','darija','french','spanish','algebra','geometry','calculus','physics'])assert.ok(taxonomy.subjects.some(s=>s.id===id));
 assert.equal(canonicalSubject('Mathématiques','Géométrie').id,'geometry');assert.equal(canonicalSubject('Science','Physique').id,'physics');assert.equal(canonicalSubject('Music','Piano'),undefined);
 const catalog={...taxonomy,instructors:[],offerings:[]};assert.equal(searchCatalog(catalog,{query:'English'}).length,0);assert.deepEqual(suggestions(catalog,'Algebra'),[]);assert.ok(suggestions(catalog,'Algebra','en',true).includes('Algebra'));
});
test('publication consent is explicit and public preview escapes all applicant content',()=>{
 assert.equal(normalizeInstructorDraft({profile:{publicationConsent:'true'},subjects:[]}).profile.publicationConsent,false);
 assert.equal(normalizeInstructorDraft({profile:{publicationConsent:true},subjects:[]}).profile.publicationConsent,true);
 const payload={instructor:{displayName:'<script>alert(1)</script>',headline:'<img src=x>',bio:'<svg>',countryOfResidence:'MA',timezone:'UTC',education:[],subjects:[{subjectId:'english',qualifications:'<script>private</script>'}]},specialties:[],offerings:[]};
 for(const lang of ['en','fr']){const html=publicPreviewHTML(payload,lang);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('data-action="publish" disabled'));assert.equal(publicationControls({excluded:true},lang,'staff'),'');}
});
test('signup continuation preserves a bounded lesson selection and rejects expired data',()=>{
 const value={instructorId:'id',offeringId:'offer',slotId:'slot',goal:'Learn algebra',savedAt:Date.now()};const storage={getItem:()=>JSON.stringify(value)};
 assert.equal(readPendingSelection(storage).goal,'Learn algebra');value.savedAt-=86400001;assert.equal(readPendingSelection(storage),null);assert.equal(readPendingSelection({getItem:()=>'{invalid'}),null);
});
import { localDateTime } from '../learn/schedule-time.mjs';
import { execFileSync } from 'node:child_process';
test('schedule input rejects invalid dates and ambiguous/nonexistent daylight-saving times',()=>{
 assert.throws(()=>localDateTime('2026-02-30T12:00'));
 const script="import {localDateTime} from './learn/schedule-time.mjs';for(const value of ['2026-03-08T02:30','2026-11-01T01:30']){let rejected=false;try{localDateTime(value)}catch{rejected=true}if(!rejected)process.exit(1)}";
 execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ:'America/New_York'}});
});
