import test from 'node:test';
import assert from 'node:assert/strict';
import {instructorFieldProblem as problem} from '../learn/instructor-validation.mjs';
import {normalizeInstructorDraft} from '../server/instructor-draft.mjs';
test('partial drafts remain saveable while submissions identify missing values, including zero-price offers',()=>{
 for(const field of ['displayName','countryOfResidence','subject','qualifications','title','durationMinutes','price','currency']){
  assert.equal(problem(field,'',{complete:false}),null);
  assert.equal(problem(field,'  ',{complete:true}),'required');
 }
 assert.equal(problem('price','0',{complete:true,currency:'MAD'}),null);
 assert.equal(problem('yearsExperience','0',{complete:true}),null);
 assert.equal(problem('photoURL','',{complete:true}),null);
});
test('decimal-price guidance follows currency minor units accepted by the draft contract',()=>{
 for(const [currency,price,minor] of [['MAD','125.50',12550],['JPY','125',125],['KWD','1.125',1125]]){
  assert.equal(problem('price',price,{currency}),null);
  assert.equal(normalizeInstructorDraft({subjects:[{offerings:[{priceMinor:minor,currency}]}]}).subjects[0].offerings[0].priceMinor,minor);
 }
 assert.equal(problem('price','1.125',{currency:'MAD'}),'precision');
 assert.equal(problem('price','125.5',{currency:'JPY'}),'precision');
 assert.equal(problem('price','-1',{currency:'MAD'}),'invalid');
 assert.equal(problem('price','10000000.01',{currency:'MAD'}),'invalid');
});
test('invalid times, insecure media, numeric bounds and list limits identify the field before saving',()=>{
 for(const [field,value] of [['timezone','Mars/Olympus'],['photoURL','http://example.com/photo.jpg'],['introductionVideo','javascript:alert(1)'],['durationMinutes','14'],['durationMinutes','30.5'],['lessonCount','21'],['yearsExperience','81'],['currency','MAD!'],['specialties',Array(11).fill('Topic').join(',')],['levels',Array(7).fill('Level').join(',')],['headline','a'.repeat(181)]])assert.equal(problem(field,value),'invalid',field);
 for(const [field,value] of [['timezone','Africa/Casablanca'],['photoURL','https://example.com/photo.jpg'],['durationMinutes','15'],['lessonCount','20'],['currency','mad']])assert.equal(problem(field,value),null,field);
});
