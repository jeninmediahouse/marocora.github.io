import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {request as httpRequest} from 'node:http';
import {createHash} from 'node:crypto';
import {directoryRows,mountDirectory} from '../supply-directory.mjs';
import {supplyCopy} from '../supply-copy.mjs';
import {startProductionServer} from '../server/production/http.mjs';
import {publicPages,browserAssets} from '../server/production/site.mjs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const id='10000000-0000-4000-8000-000000000001';
const row=(extra={})=>({id,type:'teacher',profile:{displayName:'Synthetic Teacher',bio:'Synthetic public description.'},...extra});
class Element{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.attributes={};this.hidden=false;this.value='';}
 set innerHTML(_){throw Error('SYNTHETIC_UNSAFE_HTML');}
 set textContent(v){this.value=v;this.children=[];}
 get textContent(){return this.value+this.children.map(n=>n.textContent).join(' ');}
 setAttribute(k,v){this.attributes[k]=v;}
 append(...nodes){for(const node of nodes)if(node.tagName==='#fragment')this.children.push(...node.children);else this.children.push(node);}
 replaceChildren(...nodes){this.children=[];this.value='';this.append(...nodes);}
}
function dom(){
 const listeners=new Set();const doc={createElement:tag=>new Element(tag,doc),createDocumentFragment:()=>new Element('#fragment',doc),addEventListener:(name,fn)=>listeners.add(fn),removeEventListener:(name,fn)=>listeners.delete(fn)};
 return {root:new Element('ul',doc),status:new Element('p',doc),language:()=>listeners.forEach(fn=>fn())};
}
const response=value=>({ok:true,json:async()=>value});

test('directory still renders successfully when AbortSignal.timeout is absent',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(AbortSignal,'timeout');
 try{
  delete AbortSignal.timeout;
  assert.equal(typeof AbortSignal.timeout,'undefined');
  const d=dom();let options;
  await mountDirectory({...d,fetcher:async(path,input)=>{options=input;return response([row()]);}});
  assert.equal(options.signal,undefined);assert.equal(d.root.hidden,false);assert.equal(d.root.children.length,1);
  assert.equal(d.status.textContent,'Published partner profiles.');
 }finally{if(descriptor)Object.defineProperty(AbortSignal,'timeout',descriptor);}
});
test('directory requests the ten-second timeout signal when supported',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(AbortSignal,'timeout'),signal=new AbortController().signal,requested=[];
 try{
  Object.defineProperty(AbortSignal,'timeout',{configurable:true,writable:true,value:ms=>{requested.push(ms);return signal;}});
  const d=dom();let options;
  await mountDirectory({...d,fetcher:async(path,input)=>{options=input;return response([row()]);}});
  assert.deepEqual(requested,[10000]);assert.equal(options.signal,signal);assert.equal(d.root.hidden,false);
  assert.equal(d.status.textContent,'Published partner profiles.');
 }finally{if(descriptor)Object.defineProperty(AbortSignal,'timeout',descriptor);else delete AbortSignal.timeout;}
});

test('directory preserves API order and uses only validated public projection with the recorded100 cap',()=>{
 const second=row({id:'20000000-0000-4000-8000-000000000002',type:'translator'});
 assert.deepEqual(directoryRows([second,row()]).map(r=>r.id),[second.id,id]);
 for(const value of [{},[row(),row()],[row({id:'../private'})],[row({type:'administrator'})],Array(101).fill(row())])assert.throws(()=>directoryRows(value));
});
test('directory fails closed before rendering if even one API profile unexpectedly carries false publication consent',async()=>{
 const d=dom();await mountDirectory({...d,fetcher:async()=>response([row(),row({id:'20000000-0000-4000-8000-000000000002',profile:{displayName:'Must not render',bio:'Synthetic',publicationConsent:false}})])});
 assert.equal(d.root.children.length,0);assert.equal(d.root.hidden,true);assert.match(d.status.textContent,/temporarily unavailable/);assert.doesNotMatch(d.root.textContent,/Must not render|Synthetic Teacher/);
 // Consent is not a public API field, even when true. Do not infer eligibility.
 assert.throws(()=>directoryRows([row({profile:{...row().profile,publicationConsent:true}})]));
});
test('private fields cannot reach directory text attributes links or markup and authored HTML is never injected',async()=>{
 const d=dom(),privateFields={email:'SYNTHETIC_PRIVATE_EMAIL@fixture.invalid',payout:'SYNTHETIC_PRIVATE_PAYOUT',credentials:'SYNTHETIC_PRIVATE_CREDENTIAL',internalNotes:'SYNTHETIC_PRIVATE_NOTE',revision:'SYNTHETIC_PRIVATE_REVISION',owner_id:'SYNTHETIC_PRIVATE_OWNER'};
 const input=row({...privateFields,profile:{...row().profile,...privateFields,displayName:'<img src=x onerror=alert(1)>'}});
 await mountDirectory({...d,fetcher:async()=>response([input])});
 assert.equal(d.root.children.length,1);const card=d.root.children[0];assert.equal(card.children[1].textContent,input.profile.displayName);assert.equal(card.children[1].dataset.userContent,'');
 const publicState={text:d.root.textContent,href:card.children[3].href,attrs:card.children.map(c=>c.attributes),datasets:card.children.map(c=>c.dataset)};
 assert.doesNotMatch(JSON.stringify(publicState),/SYNTHETIC_PRIVATE/);assert.equal(card.children[3].href,'/supply-profile.html?id='+id);
});
test('directory renders loading empty success and sanitized failure states without collecting credentials',async()=>{
 const d=dom();let resolve;const pending=mountDirectory({...d,fetcher:()=>new Promise(r=>resolve=r)});
 assert.match(d.status.textContent,/Loading/);assert.equal(d.root.attributes['aria-busy'],'true');resolve(response([]));await pending;
 assert.equal(d.status.textContent,'No partners published yet.');assert.equal(d.root.hidden,true);
 let request;await mountDirectory({...d,fetcher:async(path,options)=>{request={path,options};return response([row()]);}});
 assert.equal(d.root.hidden,false);assert.equal(d.status.textContent,'Published partner profiles.');assert.equal(request.path,'/api/supply/profiles');assert.equal(request.options.credentials,'omit');assert.equal(request.options.cache,'no-store');assert.equal(request.options.method,'GET');
 for(const fetcher of [async()=>{throw Error('SYNTHETIC_PRIVATE_FAILURE');},async()=>({ok:false}),async()=>response({email:'SYNTHETIC_PRIVATE_RESPONSE'}),async()=>({ok:true,json:async()=>{throw Error('SYNTHETIC_PRIVATE_PARSE');}})]){
  await mountDirectory({...d,fetcher});assert.equal(d.root.hidden,true);assert.equal(d.root.children.length,0);assert.match(d.status.textContent,/temporarily unavailable/);assert.doesNotMatch(d.status.textContent,/SYNTHETIC_PRIVATE/);assert.equal(d.root.attributes['aria-busy'],'false');
 }
});
test('directory status and authored card labels follow all four languages while vendor text stays untouched',async()=>{
 const prior=globalThis.window;let lang='en';globalThis.window={MarocoraSite:{t:key=>supplyCopy[key]?.[lang]||key}};
 try{
  const d=dom();await mountDirectory({...d,fetcher:async()=>response([row()])});
  for(lang of ['en','fr','ar','es']){d.language();assert.equal(d.status.textContent,supplyCopy['Published partner profiles.'][lang]);assert.equal(d.root.children[0].children[0].textContent,supplyCopy['Language teacher'][lang]);assert.equal(d.root.children[0].children[3].textContent,supplyCopy['View public profile'][lang]);assert.equal(d.root.children[0].children[1].textContent,'Synthetic Teacher');}
 }finally{if(prior===undefined)delete globalThis.window;else globalThis.window=prior;}
});
test('directory and its correct profile links are served unauthenticated while unlisted files remain404',async t=>{
 let authentications=0;
 const app=await startProductionServer({env:{NODE_ENV:'production',APP_ORIGINS:'https://app.fixture.invalid',HOST:'127.0.0.1',PORT:'0',LEARNING_VIDEO_ENABLED:'false'},auth:{db:{stop(){}},checkReady:async()=>{},supplyPublic:async()=>[row()],authenticate:async()=>{authentications++;throw Error('SYNTHETIC_AUTH_MUST_NOT_RUN');}},storage:{kind:'spaces'},scanner:{mockOnly:false,available:false},learning:{close:async()=>{}},log:()=>{}});
 t.after(()=>app.close());
 const get=path=>new Promise((resolve,reject)=>{const req=httpRequest({hostname:'127.0.0.1',port:app.server.address().port,path,headers:{Host:'app.fixture.invalid'}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,text:Buffer.concat(chunks).toString(),headers:res.headers}));});req.on('error',reject);req.end();});
 for(const path of ['/professionals.html','/supply-directory.mjs','/supply-profile.html?id='+id,'/api/supply/profiles']){const result=await get(path);assert.equal(result.status,200,path);assert.equal(result.headers['set-cookie'],undefined);}
 assert.equal((await get('/unlisted-directory.html')).status,404);assert.equal(authentications,0);assert.ok(publicPages.has('supply-profile.html'));assert.ok(browserAssets.has('supply-directory.mjs'));
});
test('directory markup is accessible responsive localized and makes no search city or rating promises',()=>{
 const html=read('professionals.html'),section=html.match(/<section class="providers"[\s\S]*?<\/section>/)[0];
 assert.match(section,/aria-labelledby="published-partners-title"/);assert.match(section,/role="status" aria-live="polite"/);assert.match(section,/<ul id="published-partners"/);assert.match(section,/<noscript>/);assert.match(html,/grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,260px\),1fr\)\)/);assert.match(html,/:focus-visible/);
 assert.doesNotMatch(section,/search|rating|city|cities/i);
 for(const text of ['Published partners','Loading published partners…','No partners published yet.','Published partners are temporarily unavailable. Please try again later.','Published partner profiles.','View public profile','Enable JavaScript to view published partners.'])for(const lang of ['en','fr','ar','es'])assert.ok(supplyCopy[text][lang]);
});
test('historical rollback professional page remains sealed without the new live-directory entry point',()=>{
 const base='ops/supply-rollback/static-boundary/',manifest=JSON.parse(read(base+'manifest.json'));
 const archived=read(base+'professionals-source.html'),overlay=read(base+'overlay/professionals.html');
 assert.equal(createHash('sha256').update(archived).digest('hex'),manifest.professionalSourceForOverlay.sha256);
 assert.equal(manifest.professionalSourceForOverlay.commit,'803648b24b4e5aad2987ec197ff292ef66d0c7dc');assert.notEqual(archived,read('professionals.html'));
 assert.doesNotMatch(overlay,/supply-directory\.mjs|id="published-partners"|\/api\/supply\/profiles/);
});
