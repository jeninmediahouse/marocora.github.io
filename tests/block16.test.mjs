import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {cloudmersiveScanner,CLOUDMERSIVE_OPTIONS,CLOUDMERSIVE_QUARANTINE_MESSAGE} from '../server/block1/uploads.mjs';
import {openLocalDatabase,seedLocalActors,root,L,J} from '../server/block1/database.mjs';
import {createLocalApp} from '../server/block1/http.mjs';
import {mockCloudmersive} from './fixtures/cloudmersive-mock.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('Cloudmersive adapter uses official advanced SDK operation with no network',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'marocora-cloud-mock-')),path=join(dir,'fixture.pdf'),bytes=readFileSync(new URL('./fixtures/block15/synthetic.pdf',import.meta.url));writeFileSync(path,bytes);
 try{
  await t.test('strict clean result and all false options reach actual SDK parameter builder',async()=>{
   const mocked=mockCloudmersive();assert.equal(mocked.scanner.available,true);assert.equal(mocked.scanner.engine,'Cloudmersive Virus Scan API');
   assert.deepEqual(await mocked.scanner.scan(path,sha(bytes),{name:'Private customer name.pdf'}),{status:'clean',engine:'Cloudmersive',reason:'API_CLEAN'});
   const call=mocked.calls[0];assert.equal(call.path,'/virus/scan/file/advanced');assert.equal(call.method,'POST');assert.equal(call.timeout,30000);assert.deepEqual(call.bytes,bytes);assert.equal(call.headers.fileName,'document.pdf');
   for(const [key,value] of Object.entries(CLOUDMERSIVE_OPTIONS)){assert.equal(call.headers[key],value);assert.equal(call.normalizedHeaders[key],typeof value==='boolean'?'false':value);}
   assert.equal(call.headers.restrictFileTypes,'.txt,.pdf,.docx,.jpg,.jpeg,.png');
  });
  await t.test('strict infected result is never clean',async()=>{
   const mocked=mockCloudmersive({value:'infected'});assert.deepEqual(await mocked.scanner.scan(path,sha(bytes)),{status:'infected',engine:'Cloudmersive',reason:'API_INFECTED'});
  });
  await t.test('API errors including authorization/rate failure remain generic error',async()=>{
   for(const status of [401,403,429,500]){const mocked=mockCloudmersive({value:'error',httpStatus:status});assert.deepEqual(await mocked.scanner.scan(path,sha(bytes)),{status:'error',engine:'Cloudmersive',reason:'API_ERROR'});}
  });
  await t.test('malformed or coerced booleans and invalid HTTP status fail closed',async()=>{
   for(const raw of [{CleanResult:'false'},{CleanResult:'true'},{CleanResult:1},{CleanResult:null},{},null]){const mocked=mockCloudmersive({value:'clean',raw});assert.equal((await mocked.scanner.scan(path,sha(bytes))).reason,'API_ERROR');}
   const mocked=mockCloudmersive({value:'clean',httpStatus:503});assert.equal((await mocked.scanner.scan(path,sha(bytes))).status,'error');
  });
  await t.test('hash mismatch or missing key prevents SDK invocation entirely',async()=>{
   const mocked=mockCloudmersive();assert.equal((await mocked.scanner.scan(path,'0'.repeat(64))).reason,'API_ERROR');assert.equal(mocked.calls.length,0);
   let invoked=0;const absent=cloudmersiveScanner({env:{},apiFactory:()=>{invoked++;throw Error('Must not instantiate');}});assert.equal(absent.available,false);assert.equal((await absent.scan(path,sha(bytes))).status,'error');assert.equal(invoked,0);
  });
  await t.test('changed file after submission cannot become clean',async()=>{
   const mocked=mockCloudmersive({value:'clean',beforeResponse:()=>writeFileSync(path,'Changed after hash snapshot')});assert.equal((await mocked.scanner.scan(path,sha(bytes))).reason,'API_ERROR');assert.deepEqual(mocked.calls[0].bytes,bytes);writeFileSync(path,bytes);
  });
  await t.test('deadline aborts request and a late clean callback cannot win',async()=>{
   const never=mockCloudmersive({value:'never'},{timeoutMs:5});assert.equal((await never.scanner.scan(path,sha(bytes))).status,'error');assert.equal(never.aborted,1);
   const late=mockCloudmersive({value:'clean',delayMs:30},{timeoutMs:5});const result=await late.scanner.scan(path,sha(bytes));await new Promise(resolve=>setTimeout(resolve,40));assert.equal(result.status,'error');assert.equal(late.aborted,1);
  });
  await t.test('SDK constructor/throw errors are sanitized',async()=>{
   const scanner=cloudmersiveScanner({env:{CLOUDMERSIVE_API_KEY:'SYNTHETIC_TEST_KEY_NOT_A_CREDENTIAL'},apiFactory:()=>{throw Error('Private provider payload must not be returned');}});assert.deepEqual(await scanner.scan(path,sha(bytes)),{status:'error',engine:'Cloudmersive',reason:'API_ERROR'});
  });
  await t.test('selected customer quarantine message is present before and after scan',()=>{
   assert.ok(readFileSync(new URL('../server/block1/ui/block1-request.mjs',import.meta.url),'utf8').includes(CLOUDMERSIVE_QUARANTINE_MESSAGE));
  });
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('launcher refuses missing key before database or HTTP startup',()=>{
 const env={...process.env,QUOTE_PG_BIN:'/nonexistent-postgres-must-not-run'};delete env.CLOUDMERSIVE_API_KEY;
 const guard=fileURLToPath(new URL('./fixtures/block16-network-guard.mjs',import.meta.url));
 assert.throws(()=>execFileSync(process.execPath,['--import',guard,'server/block1/start.mjs'],{cwd:root,env,encoding:'utf8',stdio:['ignore','pipe','pipe']}),e=>{
  assert.equal(e.status,1);assert.ok(e.stderr.includes('Set CLOUDMERSIVE_API_KEY in your environment before launching.'));assert.ok(e.stderr.includes('Scanner: Cloudmersive (available: false)'));assert.ok(!e.stderr.includes('nonexistent-postgres'));return true;
 });
 const ignored=execFileSync('git',['check-ignore','--','.env','.env.cloudmersive'],{cwd:root,encoding:'utf8'}).trim().split('\n');assert.deepEqual(ignored,['.env','.env.cloudmersive']);
});

test('default local startup leaves all three gates OFF and rescan cannot spend quota',{timeout:45000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'marocora-cloud-off-'));let db,app;
 try{
  db=openLocalDatabase(dir);const actors=seedLocalActors(db),mocked=mockCloudmersive();
  const settings=JSON.parse(db.sql('select to_jsonb(s) from public.quote_settings s'));for(const k of ['capture_enabled','commands_enabled','notifications_enabled'])assert.equal(settings[k],false);
  app=createLocalApp(db,actors,{scanner:mocked.scanner});const origin=await app.listen();
  const login=await fetch(origin+'/api/local-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({ticket:app.logins.staff})});
  const cookie=login.headers.get('set-cookie').split(';')[0],me=await (await fetch(origin+'/api/me',{headers:{Cookie:cookie}})).json();
  const response=await fetch(origin+'/api/files/'+randomUUID()+'/rescan',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json','x-csrf-token':me.csrf},body:'{}'});assert.equal(response.status,403);assert.equal((await response.json()).error,'COMMANDS_DISABLED');assert.equal(mocked.calls.length,0);
  assert.throws(()=>db.as(actors.customer,`select public.block1_capture(${L(randomUUID())},${J({service:'Document Translation',source:'English',target:'French',description:'Synthetic'})},${J({name:'Synthetic'})})`),e=>String(e.stderr).includes('CAPTURE_DISABLED'));
  assert.equal(db.sql('select count(*) from public.block15_scan_events'),'0');
 }finally{if(app)await app.close();if(db)db.stop();rmSync(dir,{recursive:true,force:true});}
});
