import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {supplyCopy} from '../supply-copy.mjs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const pages=['supply-register.html','supply-dashboard.html','supply-profile.html','supply-review.html'];
function mount({supply=false,reset=false}={}){
 const appended=[],prepended=[],options=[],selector={append:o=>options.push(o)};
 const bar={dataset:{},innerHTML:'',querySelector:q=>{assert.equal(q,'select');return selector;}};
 const context={document:{createElement:tag=>tag==='div'?bar:{},querySelector:q=>{assert.equal(q,'body[data-supply-page] > header');return supply?{append:b=>appended.push(b)}:null;},body:{hasAttribute:name=>reset&&name==='data-password-reset',prepend:b=>prepended.push(b)}},localeNames:{en:'English',fr:'Français',ar:'العربية',es:'Español'}};
 const source=read('site-language.mjs'),start=source.indexOf("const bar=document.createElement('div')"),end=source.indexOf('// Personal details',start);
 vm.runInNewContext(source.slice(start,end),context,{timeout:1000});
 return {appended,prepended,bar,options};
}
test('supply locale control mounts inside its single authored header without a second wordmark',()=>{
 for(const page of pages){const html=read(page);assert.match(html,/<body data-supply-page>/);assert.equal((html.match(/<header\b/g)||[]).length,1);assert.equal((html.match(/<strong>MAROCORA<\/strong>/g)||[]).length,1);}
 const supply=mount({supply:true});assert.equal(supply.appended.length,1);assert.equal(supply.prepended.length,0);assert.doesNotMatch(supply.bar.innerHTML,/<a\b/);assert.equal((supply.bar.innerHTML.match(/<select\b/g)||[]).length,1);assert.deepEqual(supply.options.map(o=>o.value),['en','fr','ar','es']);
 const normal=mount();assert.equal(normal.prepended.length,1);assert.match(normal.bar.innerHTML,/<a\b/);
 const reset=mount({reset:true});assert.equal(reset.prepended.length,1);assert.doesNotMatch(reset.bar.innerHTML,/<a\b/);
});
test('supply header retains dashboard navigation and account entry except on the registration page itself',()=>{
 for(const page of pages){const header=read(page).match(/<header>[\s\S]*?<\/header>/)[0];assert.match(header,/href="\/"/);assert.match(header,/href="\/supply-dashboard.html"/);
  assert.equal(header.includes('href="/supply-register.html"'),page!=='supply-register.html');assert.match(header,/aria-label="Supply navigation"/);
 }
});
test('successful signup confirmation includes translated spam advice and failures never show success',async()=>{
 const source=read('supply-register.mjs').replace(/^import[^\n]*\n/,'');
 for(const fails of [false,true]){
  const notices=[],calls=[],button={disabled:false},form={elements:{password:{value:'SYNTHETIC_PASSWORD'}},querySelector:()=>button};
  const notice={};const data={email:'vendor@fixture.invalid',password:'SYNTHETIC_PASSWORD'};
  const context={document:{querySelector:s=>s==='#register-form'?form:notice},FormData:class{get(k){return data[k];}},api:async(path,options)=>{calls.push({path,options});if(fails)throw Error('Synthetic rejection');return {confirmationRequired:true};},message:(el,text,error)=>notices.push({text,error})};
  vm.runInNewContext(source,context,{timeout:1000});await form.onsubmit({preventDefault(){}});
  assert.equal(calls.length,1);assert.equal(form.elements.password.value,'');assert.equal(button.disabled,false);
  if(fails){assert.equal(notices[0].error,true);assert.doesNotMatch(notices[0].text,/check your spam/);}
  else{assert.match(notices[0].text,/If it does not arrive in a few minutes, check your spam folder and mark it as not spam\./);for(const lang of ['en','fr','ar','es'])assert.ok(supplyCopy[notices[0].text]?.[lang]);}
 }
});
