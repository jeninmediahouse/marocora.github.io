import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const artifact=new URL('ops/supply-rollback/static-boundary/',root);
const overlay=new URL('overlay/',artifact);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',artifact),'utf8'));
const read=name=>readFileSync(new URL(name,overlay),'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
const pages=['supply-register.html','supply-dashboard.html','supply-review.html','supply-profile.html'];
const notice='/professionals.html#supply-unavailable';
const legacy=['/instant-quote.html','/translation-workspace.html','/learning-room.html','/application.html','/vendor-review.html','/service-review.html','/launch-report.html','/staff-review.html','/learn/account.html','/learn/schedule.html'];
const login=read('production-login.mjs');
function browser(next,{ok=true}={}){
 const redirects=[],calls=[],button={disabled:false};
 const form={hidden:false,email:{value:'owner@fixture.invalid'},password:{value:'SYNTHETIC_PASSWORD'},querySelector:selector=>{assert.equal(selector,'button');return button;}};
 const status={textContent:''};
 const location={origin:'https://app.fixture.invalid',search:next===undefined?'':'?'+new URLSearchParams({next}),
  replace:url=>redirects.push({kind:'replace',url}),assign:url=>redirects.push({kind:'assign',url})};
 const context={document:{getElementById:id=>{if(id==='production-login')return form;if(id==='login-status')return status;throw Error('SYNTHETIC_UNKNOWN_ELEMENT');}},
  location,URL,URLSearchParams,window:{},fetch:async(url,options)=>{calls.push({url,options});return {ok};}};
 vm.runInNewContext(login,context,{timeout:1000});
 return {redirects,calls,form,status,button,location,submit:async()=>{let prevented=false;await form.onsubmit({preventDefault(){prevented=true;}});assert.equal(prevented,true);}};
}

test('rollback boundary manifest seals exactly seven files outside the normal website source',()=>{
 assert.equal(manifest.formatVersion,1);assert.equal(manifest.purpose,'rollback-only-supply-unavailable');assert.equal(manifest.deploymentAuthorized,false);
 assert.equal(manifest.overlayRoot,'overlay');assert.equal(manifest.publicNotice,notice);
 assert.deepEqual(manifest.blockedSupplyPaths,pages.map(p=>'/'+p));
 const expected=[...pages,'professionals.html','production-login.mjs','site-extra-copy.mjs'].sort();
 assert.deepEqual(readdirSync(overlay).sort(),expected);
 assert.deepEqual(manifest.files.map(f=>f.path).sort(),expected);
 for(const file of manifest.files){
  const path=new URL(file.path,overlay);assert.equal(lstatSync(path).isSymbolicLink(),false);assert.equal(lstatSync(path).isFile(),true);
  const bytes=readFileSync(path);assert.equal(bytes.length,file.bytes);assert.equal(sha(bytes),file.sha256);
 }
});

test('authored onboarding sources remain unchanged and the boundary is not a source replacement',()=>{
 assert.equal(Object.keys(manifest.preservedSourceSha256).length,14);
 for(const [name,digest] of Object.entries(manifest.preservedSourceSha256))assert.equal(sha(readFileSync(new URL(name,root))),digest,name);
 for(const page of pages){assert.notEqual(read(page),readFileSync(new URL(page,root),'utf8'));}
});

test('all four static entry pages are inert accessible multilingual notices with no submission code',()=>{
 for(const page of pages){const html=read(page);
  assert.match(html,/<!doctype html>/i);assert.match(html,/<main>/);assert.match(html,/<h1>Partner onboarding unavailable<\/h1>/);
  assert.match(html,/Partner onboarding is temporarily unavailable\./);assert.match(html,/Existing applications are retained\./);
  assert.match(html,/<meta name="robots" content="noindex,nofollow">/);
  for(const lang of ['en','fr','ar','es'])assert.match(html,new RegExp('lang="'+lang+'"'));
  assert.match(html,/lang="ar" dir="rtl"/);
  assert.doesNotMatch(html,/<(?:script|form|input|textarea|select|button|iframe|object)\b/i);
  assert.doesNotMatch(html,/http-equiv\s*=|\bon\w+\s*=|https?:\/\/|\/api\/|\bfetch\s*\(|localStorage|location\./i);
  assert.match(html,/href="\/professionals\.html#supply-unavailable"/);
  assert.equal((html.match(/id="supply-unavailable"/g)||[]).length,1);
 }
 assert.equal(new Set(pages.map(read)).size,1);
});

test('professional-page CTA is replaced while all other authored content is preserved',()=>{
 const source=manifest.professionalSourceForOverlay;
 const original=readFileSync(new URL(source.path,artifact),'utf8'),boundary=read('professionals.html');
 assert.equal(sha(original),source.sha256);
 assert.equal(source.commit,'803648b24b4e5aad2987ec197ff292ef66d0c7dc');
 const cta='<a href="supply-register.html" class="button primary-button">Apply as a supply partner</a>';
 assert.equal(original.split(cta).length-1,1);
 assert.doesNotMatch(boundary,/<a\b[^>]*href=["'][^"']*supply-/i);
 assert.match(boundary,/<section id="supply-unavailable" role="status" aria-labelledby="supply-unavailable-title"/);
 const section=/<section id="supply-unavailable"[\s\S]*?<\/section>/;
 assert.equal(boundary.replace(section,''),original.replace(cta,''));
 for(const href of ['#categories','join.html','index.html'])assert.ok(boundary.includes('href="'+href+'"'));
});

test('shared locale overlay matches its pinned legacy source and has no unavailable supply import',()=>{
 const text=read('site-extra-copy.mjs');assert.equal(sha(text),manifest.sharedLocaleSource.sha256);
 assert.equal(manifest.sharedLocaleSource.commit,'346be721e626a6dfab425985213490dc7e3d6d3e');
 assert.doesNotMatch(text,/supply-copy|supply-client/);assert.match(text,/import \{roomCopy\} from '\.\/learn\/room-copy\.mjs'/);
});

test('supply login returns redirect to the public notice before collecting credentials or calling auth',async()=>{
 for(const page of pages)for(const next of ['/'+page,'/'+page+'?id=SYNTHETIC_PRIVATE_ID#SYNTHETIC_TOKEN',
  'https://app.fixture.invalid/'+page,'/'+page+'/',('/'+page).toUpperCase(),'/'+page.replace('.','%2E')]){
  const b=browser(next);assert.equal(b.form.hidden,true,next);
  assert.deepEqual(b.redirects,[{kind:'replace',url:notice}]);assert.deepEqual(b.calls,[]);
  await b.submit();assert.deepEqual(b.calls,[]);assert.equal(b.form.password.value,'SYNTHETIC_PASSWORD');
 }
});

test('all ten legacy login destinations retain their same-origin behavior and auth request',async()=>{
 for(const path of legacy){const next=path+'?ref=SYNTHETIC#section',b=browser(next);
  assert.equal(b.form.hidden,false);assert.deepEqual(b.redirects,[]);await b.submit();
  assert.deepEqual(b.redirects,[{kind:'assign',url:'https://app.fixture.invalid'+next}]);
  assert.equal(b.calls.length,1);assert.equal(b.calls[0].url,'/api/auth/login');
  assert.equal(b.calls[0].options.method,'POST');assert.equal(b.calls[0].options.credentials,'same-origin');assert.equal(b.calls[0].options.cache,'no-store');
  assert.deepEqual(JSON.parse(b.calls[0].options.body),{email:'owner@fixture.invalid',password:'SYNTHETIC_PASSWORD'});
  assert.equal(b.form.password.value,'');assert.equal(b.button.disabled,false);
 }
});

test('external malformed and unknown login targets cannot create an open redirect',async()=>{
 for(const next of ['https://other.fixture.invalid/supply-dashboard.html','//other.fixture.invalid/instant-quote.html',
  'javascript:alert(1)','https://[','/%ZZ','/unlisted.html','https://app.fixture.invalid@other.fixture.invalid/instant-quote.html']){
  const b=browser(next);assert.deepEqual(b.redirects,[]);await b.submit();
  assert.deepEqual(b.redirects,[{kind:'assign',url:'/instant-quote.html'}]);assert.equal(b.calls[0].url,'/api/auth/login');
 }
});

test('missing destination keeps legacy default and failed login does not redirect',async()=>{
 const b=browser(undefined);await b.submit();assert.deepEqual(b.redirects,[{kind:'assign',url:'https://app.fixture.invalid/instant-quote.html'}]);
 const failed=browser('/learn/account.html',{ok:false});await failed.submit();assert.deepEqual(failed.redirects,[]);
 assert.equal(failed.status.textContent,'Sign-in failed. Check your account details and email confirmation.');assert.equal(failed.button.disabled,false);
});

test('a supply destination introduced during auth still redirects without reflecting private query data',async()=>{
 const b=browser('/learn/account.html');
 b.location.search='?'+new URLSearchParams({next:'/supply-dashboard.html?id=SYNTHETIC_PRIVATE#SYNTHETIC_TOKEN'});
 await b.submit();assert.deepEqual(b.redirects,[{kind:'assign',url:notice}]);assert.equal(b.calls.length,1);
 assert.equal(JSON.stringify(b.redirects).includes('SYNTHETIC'),false);
});
