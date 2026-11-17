import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {analyzeDocument} from '../server/quote/document-count-core.mjs';
import {countUploadedDocument} from '../server/quote/document-count.mjs';
import {openLocalDatabase,seedLocalActors,L} from '../server/block1/database.mjs';
import {createLocalApp} from '../server/block1/http.mjs';
import {mockCloudmersive} from './fixtures/cloudmersive-mock.mjs';
const scan=readFileSync(new URL('./fixtures/instant-v3/image-only-scan.pdf',import.meta.url));

test('Image-only PDF detection bypasses the word counter, including raster pages nested in Form XObjects',async()=>{
 let calls=0;const counter=async()=>{calls++;throw Error('SCANNED_PDF_MUST_BYPASS_COUNTER');};
 const expected={manualReview:true,reason:'SCANNED_OR_IMAGE_ONLY_PDF',words:null,pages:1};
 assert.deepEqual(await analyzeDocument(scan,'.pdf',{counter}),expected);
 const source=await PDFDocument.load(scan),nested=await PDFDocument.create();
 const embedded=await nested.embedPage(source.getPage(0));nested.addPage([595,842]).drawPage(embedded);
 assert.deepEqual(await analyzeDocument(await nested.save(),'.pdf',{counter}),expected);
 assert.equal(calls,0);
 assert.deepEqual(await countUploadedDocument(scan,'image-only-scan.pdf'),expected);
});

test('Unflagged scanned PDF upload goes to staff review with null quantities/prices and cannot take a deposit',{timeout:60000},async()=>{
 const directory=mkdtempSync(join(tmpdir(),'marocora-scanned-pdf-'));let db,app;
 try{
  db=openLocalDatabase(directory,{forceLocal:true,block2:true,enableLocalFlow:true});const actors=seedLocalActors(db);
  db.sql(readFileSync(new URL('../supabase/migrations/202611150003_instant_pricing.sql',import.meta.url),'utf8'));
  let conversions=0;
  app=createLocalApp(db,actors,{scanner:mockCloudmersive().scanner,instantPricing:true,exchangeService:{estimates:async()=>{conversions++;throw Error('MANUAL_REVIEW_MUST_NOT_PRICE');}}});
  const origin=await app.listen(),sessions={};
  for(const role of ['customer','staff']){
   const login=await fetch(origin+'/api/local-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({ticket:app.logins[role]})});
   assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
   const me=await(await fetch(origin+'/api/me',{headers:{Cookie:cookie}})).json();sessions[role]={cookie,csrf:me.csrf};
  }
  const customer=sessions.customer;
  const upload=await fetch(origin+'/api/instant/orders',{method:'POST',headers:{Cookie:customer.cookie,Origin:origin,'x-csrf-token':customer.csrf,'Content-Type':'application/pdf','x-file-name':'image-only-scan.pdf','x-quote-details':encodeURIComponent(JSON.stringify({category:'normal',source:'English',target:'French',sampleRequested:false,scanned:false}))},body:scan});
  assert.equal(upload.status,201);const order=await upload.json();assert.equal(order.status,'manual_review');assert.equal(order.scanned,true);
  for(const field of ['counted_words','billable_words','subtotal_minor','vat_minor','total_minor','deposit_minor','balance_minor','delivery_date'])assert.equal(order[field],null,field);
  assert.equal(order.page_count,1);assert.equal(conversions,0);
  assert.equal(db.sql(`select status from public.instant_orders where id=${L(order.id)}`),'manual_review');
  const staff=await fetch(origin+'/api/instant/orders',{headers:{Cookie:sessions.staff.cookie}});assert.equal(staff.status,200);assert.ok((await staff.json()).some(q=>q.id===order.id&&q.status==='manual_review'));
  const pay=await fetch(origin+'/api/instant/orders/'+order.id+'/pay',{method:'POST',headers:{Cookie:customer.cookie,Origin:origin,'x-csrf-token':customer.csrf,'Content-Type':'application/json'},body:JSON.stringify({commandId:randomUUID(),phase:'deposit',consent:true})});
  assert.notEqual(pay.status,200);assert.equal(db.sql('select count(*) from public.instant_mock_payments'),'0');
 }finally{if(app)await app.close();if(db)db.stop();rmSync(directory,{recursive:true,force:true,maxRetries:3});}
});
