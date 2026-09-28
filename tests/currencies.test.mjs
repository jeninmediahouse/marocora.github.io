import test from 'node:test';
import assert from 'node:assert/strict';
import {currencies,currencyCodes,currencyDigits,formatMoney,currencyName} from '../learn/currencies.mjs';
import {instructorFieldProblem} from '../learn/instructor-validation.mjs';
test('international lesson currencies include MAD and retain the official zero to four decimal units',()=>{
 assert.equal(currencyCodes.length,165);
 for(const code of ['MAD','USD','EUR','GBP','CAD','AUD','CHF','INR','CNY','JPY','KWD','XCG','ZWG'])assert.ok(currencies[code],code);
 assert.equal(currencyDigits('MAD'),2);assert.equal(currencyDigits('JPY'),0);assert.equal(currencyDigits('KWD'),3);assert.equal(currencyDigits('CLF'),4);
 // Browser CLDR defaults differ from the current official ISO precision for these.
 assert.equal(currencyDigits('AFN'),2);assert.equal(currencyDigits('MGA'),2);
 assert.equal(instructorFieldProblem('price','1.23',{currency:'MGA'}),null);
 assert.equal(instructorFieldProblem('price','1.2345',{currency:'CLF'}),null);
 assert.equal(instructorFieldProblem('price','1.23456',{currency:'CLF'}),'precision');
});
test('each listed currency formats in all interface languages with an unambiguous currency code',()=>{
 for(const code of currencyCodes)for(const locale of ['en','ar','fr','es']){
  assert.match(formatMoney(1234,code,locale),new RegExp(code));
  assert.ok(currencyName(code,locale));
 }
 assert.match(formatMoney(12345,'MGA','en'),/123\.45/);
 assert.match(formatMoney(12345,'CLF','en'),/1\.2345/);
 assert.match(formatMoney(12550,'MAD','en'),/125\.50/);
 assert.match(formatMoney(12550,'CAD','en'),/CAD/);
 assert.match(formatMoney(12550,'USD','en'),/USD/);
});
