import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moneyError,languagePairError,translationServices} from '../translation-validation.mjs';
test('translation quote budgets respect currency units while per-unit provider rates allow fractions',()=>{
 assert.equal(moneyError('',''),null);assert.equal(moneyError('','MAD'),null);
 assert.equal(moneyError('125.50','mad'),null);assert.equal(moneyError('1.125','KWD'),null);
 assert.equal(moneyError('1.25','JPY').field,'amount');assert.equal(moneyError('1.125','MAD').field,'amount');
 assert.equal(moneyError('1','').field,'currency');assert.equal(moneyError('1','XYZ').field,'currency');
 assert.equal(moneyError('-1','MAD').field,'amount');assert.equal(moneyError('Infinity','USD').field,'amount');
 assert.equal(moneyError('0.075','MAD',{unitRate:true}),null);assert.equal(moneyError('0.000001','USD',{unitRate:true}),null);
 assert.equal(moneyError('0.0000001','USD',{unitRate:true}).field,'amount');assert.equal(moneyError('0','MAD'),null);
});
test('language pairs distinguish direction and require named other languages',()=>{
 assert.equal(languagePairError('Arabic','English'),null);assert.equal(languagePairError('English','Arabic'),null);
 assert.equal(languagePairError('Other','English','','').field,'source-other');
 assert.equal(languagePairError('English','Other','','').field,'target-other');
 assert.equal(languagePairError('Arabic','Arabic').field,'target-language');
 assert.equal(languagePairError('Other','Other','  Italian ','ITALIAN').field,'target-language');
 assert.equal(languagePairError('Other','Other','Italian','German'),null);
});
test('real quote requests have no sample assignment and service choices agree across application and intake',()=>{
 const request=readFileSync('translation-request.html','utf8'),directory=readFileSync('translators.html','utf8'),application=readFileSync('translator-apply.html','utf8');
 assert.match(request,/name="provider" value="Unassigned"/);assert.doesNotMatch(request,/Sample Translator Profile/);
 assert.doesNotMatch(directory,/class="translator-card"|data-search-index|href="translator-sample/);
 for(const service of translationServices){assert.ok(request.includes(service));assert.ok(application.includes(service));}
 assert.match(application,/name="pricing-method"/);assert.match(application,/name="rate-currency"/);assert.match(application,/name="rate-unit"/);
 assert.doesNotMatch(request,/<input[^>]+type="file"/);
});
