import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {calculatePrice,addVat,splitPayment,SUPPORTED_LANGUAGES} from '../server/quote/instant-pricing.mjs';
import {countUploadedDocument} from '../server/quote/document-count.mjs';
import {createExchangeService,validateRateTable,foreignEstimates} from '../server/quote/exchange-rates.mjs';
import {openLocalDatabase,seedLocalActors,L} from '../server/block1/database.mjs';
import {createLocalApp} from '../server/block1/http.mjs';
import {mockCloudmersive} from './fixtures/cloudmersive-mock.mjs';

const quote=category=>calculatePrice({category,wordCount:1000,firstOrder:false});
test('V3 exact rates, downward grace, minimum, VAT, first-order discount and minor-unit 50/50 split',()=>{
 assert.deepEqual(addVat(10000),{subtotalMinor:10000,vatMinor:2000,totalMinor:12000});
 for(const [category,subtotal] of [['normal',68600],['technical',93100],['legal',107800],['medical',102900]])assert.equal(quote(category).subtotalMinor,subtotal);
 assert.equal(quote('normal').billableWords,980);
 assert.equal(calculatePrice({category:'normal',wordCount:101}).billableWords,98);
 assert.equal(calculatePrice({category:'normal',wordCount:1}).totalMinor,18000);
 assert.equal(calculatePrice({category:'sworn',pageCount:3}).totalMinor,54000);
 assert.equal(calculatePrice({category:'normal',wordCount:1000,firstOrder:true}).subtotalMinor,61740);
 assert.deepEqual(splitPayment(101),{depositMinor:51,balanceMinor:50});
 assert.throws(()=>quote('Interpretation'));assert.throws(()=>calculatePrice({category:'normal',wordCount:1.5}));assert.throws(()=>calculatePrice({category:'sworn',pageCount:0}));
 assert.equal(SUPPORTED_LANGUAGES.length,9);
});
test('V3 currency orientation, dates, malformed table refusal and cached latest table',async()=>{
 const now=Date.parse('2026-11-15T12:00:00Z'),raw={rate_date:'2026-11-13',rates:[{base:'EUR',quote:'MAD',type:'reference',value:10},{base:'USD',quote:'MAD',type:'reference',value:9}]};
 const table=validateRateTable(raw,now);assert.deepEqual(foreignEstimates(18000,table),{EUR:18,USD:20});
 assert.throws(()=>validateRateTable({...raw,rate_date:'2020-01-01'},now));
 assert.throws(()=>validateRateTable({...raw,rates:[{base:'EUR',quote:'MAD',type:'reference',value:0}]},now));
 let calls=0;const service=createExchangeService({apiKey:'DUMMY',now:()=>now,loader:async()=>{calls++;return raw;}});
 assert.equal((await service.estimates(18000)).EUR,18);await service.estimates(20000);assert.equal(calls,1);
 assert.equal((await createExchangeService({apiKey:null}).estimates(18000)).available,false);
});
function zip(entries){
 const chunks=[],central=[];let offset=0;
 const crc=data=>{let v=0xffffffff;for(const byte of data){v^=byte;for(let i=0;i<8;i++)v=(v>>>1)^((v&1)?0xedb88320:0);}return(v^0xffffffff)>>>0;};
 for(const [name,text] of Object.entries(entries)){
  const n=Buffer.from(name),data=Buffer.from(text),header=Buffer.alloc(30),c=Buffer.alloc(46);
  header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt32LE(crc(data),14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(n.length,26);
  c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc(data),16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
  chunks.push(header,n,data);central.push(c,n);offset+=header.length+n.length+data.length;
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(entries).length,8);end.writeUInt16LE(Object.keys(entries).length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...chunks,cd,end]);
}
const docx=()=>zip({'[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>','_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>','word/document.xml':'<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Three sample words</w:t></w:r></w:p></w:body></w:document>'});
async function pdf(text='Three sample words'){
 const doc=await PDFDocument.create(),page=doc.addPage([595,842]);if(text)page.drawText(text,{x:45,y:750,size:16,font:await doc.embedFont(StandardFonts.Helvetica)});return Buffer.from(await doc.save());
}
test('V3 package counts TXT, DOCX, PDF and fails to manual review for image-only or unreadable PDF',async()=>{
 for(const [data,name] of [[Buffer.from('Three sample words'),'test.txt'],[docx(),'test.docx'],[await pdf(),'test.pdf']]){
  const count=await countUploadedDocument(data,name);assert.equal(count.words,3,JSON.stringify({name,count}));assert.equal(count.manualReview,false);
 }
 assert.equal((await countUploadedDocument(await pdf(''),'scan.pdf')).manualReview,true);
 assert.equal((await countUploadedDocument(Buffer.from('%PDF-1.4\ncorrupt\n%%EOF'),'bad.pdf')).manualReview,true);
});
test('V3 HTTP/native SQL customer-first lifecycle, permissions, mock retry, scans and final lock',{timeout:60000},async t=>{
 const directory=mkdtempSync(join(tmpdir(),'marocora-instant-test-'));let db,app;
 try{
  db=openLocalDatabase(directory,{forceLocal:true,block2:true,enableLocalFlow:true});const actors=seedLocalActors(db);
  db.sql(readFileSync(new URL('../supabase/migrations/202611150003_instant_pricing.sql',import.meta.url),'utf8'));
  const mock=mockCloudmersive();app=createLocalApp(db,actors,{scanner:mock.scanner,instantPricing:true,exchangeService:createExchangeService({apiKey:null})});const origin=await app.listen();
  const sessions={};
  for(const role of ['customer','staff','provider','outsider']){
   const response=await fetch(origin+'/api/local-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({ticket:app.logins[role]})});
   const cookie=response.headers.get('set-cookie').split(';')[0],me=await(await fetch(origin+'/api/me',{headers:{Cookie:cookie}})).json();sessions[role]={cookie,csrf:me.csrf};
  }
  const call=async(role,path,payload)=>{const session=sessions[role],response=await fetch(origin+path,{method:payload===undefined?'GET':'POST',headers:{Cookie:session.cookie,Origin:origin,'x-csrf-token':session.csrf,'Content-Type':'application/json'},...(payload===undefined?{}:{body:JSON.stringify(payload)})});return {status:response.status,body:await response.json()};};
  const create=async(fields={},data=Buffer.from('word '.repeat(1000)),name='source.txt')=>{
   const s=sessions.customer,response=await fetch(origin+'/api/instant/orders',{method:'POST',headers:{Cookie:s.cookie,Origin:origin,'x-csrf-token':s.csrf,'x-file-name':name,'Content-Type':name.endsWith('.pdf')?'application/pdf':name.endsWith('.docx')?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'text/plain','x-quote-details':encodeURIComponent(JSON.stringify({category:'normal',source:'English',target:'French',sampleRequested:true,scanned:false,...fields}))},body:data});return {status:response.status,body:await response.json()};
  };
  let id,order,otherQuote;
  await t.test('authoritative package word count, grace, 20% VAT and first-order promotion',async()=>{
   const result=await create();assert.equal(result.status,201,JSON.stringify(result.body));order=result.body;id=order.id;
   assert.equal(order.counted_words,1000);assert.equal(order.billable_words,980);assert.equal(order.total_minor,74088);assert.equal(order.deposit_minor+order.balance_minor,order.total_minor);assert.equal(order.sample_requested,true);assert.ok(order.delivery_date);assert.equal(order.original_file,undefined);otherQuote=(await create()).body.id;
   assert.equal((await call('outsider','/api/instant/orders/'+id)).status,403);
  });
  const path=()=>'/api/instant/orders/'+id;
  await t.test('consent required, no early balance or arbitrary provider completion',async()=>{
   assert.notEqual((await call('customer',path()+'/pay',{commandId:randomUUID(),phase:'balance',consent:true})).status,200);
   assert.notEqual((await call('customer',path()+'/pay',{commandId:randomUUID(),phase:'deposit',consent:false})).status,200);
   assert.notEqual((await call('provider',path()+'/start',{})).status,200);
  });
  await t.test('deposit transaction is idempotent and records consent without pretending work has started',async()=>{
   const commandId=randomUUID();const pay=()=>call('customer',path()+'/pay',{commandId,phase:'deposit',consent:true});
   assert.equal((await pay()).body.status,'in_progress_deposit_paid');assert.equal((await pay()).status,200);
   const detail=(await call('customer',path())).body;assert.ok(detail.consent_at);assert.equal(detail.work_started_at,null);
   assert.equal(db.sql('select count(*) from public.instant_mock_payments'),'1');
   assert.notEqual((await call('customer','/api/instant/orders/'+otherQuote+'/pay',{commandId:randomUUID(),phase:'deposit',consent:true})).status,200);
   assert.notEqual((await call('customer',path()+'/assign',{providerId:actors.provider})).status,200);
   assert.equal((await call('staff',path()+'/assign',{providerId:actors.provider})).status,200);
   assert.equal((await call('provider',path()+'/start',{})).status,200);
  });
  let final;
  await t.test('provider completion watermarks PDF; customer final route locked until remaining half',async()=>{
   final=await pdf('Synthetic completed translation');const s=sessions.provider;
   const response=await fetch(origin+path()+'/complete',{method:'POST',headers:{Cookie:s.cookie,Origin:origin,'x-csrf-token':s.csrf,'Content-Type':'application/pdf'},body:final});const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.status,'awaiting_balance');
   const draft=await fetch(origin+path()+'/draft',{headers:{Cookie:sessions.customer.cookie}});assert.equal(draft.status,200);const draftBytes=Buffer.from(await draft.arrayBuffer());assert.notDeepEqual(draftBytes,final);assert.equal((await PDFDocument.load(draftBytes)).getPageCount(),1);
   assert.equal((await fetch(origin+path()+'/final',{headers:{Cookie:sessions.customer.cookie}})).status,403);
   const qa=join(process.cwd(),'docs/quote/instant-v3-evidence');writeFileSync(join(qa,'draft-watermarked.pdf'),draftBytes);writeFileSync(join(qa,'synthetic-final.pdf'),final);
   assert.equal((await call('customer',path()+'/pay',{commandId:randomUUID(),phase:'balance',consent:true})).body.status,'paid_in_full');
   const unlocked=await fetch(origin+path()+'/final',{headers:{Cookie:sessions.customer.cookie}});assert.equal(unlocked.status,200);assert.deepEqual(Buffer.from(await unlocked.arrayBuffer()),final);
   assert.equal(db.sql('select sum(amount_minor) from public.instant_mock_payments'),String(order.total_minor));
  });
  await t.test('scans and sworn DOCX use manual review; staff supplies reviewed quantities',async()=>{
   for(const [fields,data,name] of [[{scanned:true},Buffer.from('Sample scan text'),'scan.txt'],[{category:'sworn'},docx(),'source.docx']]){
    const result=await create(fields,data,name);assert.equal(result.status,201,JSON.stringify(result.body));assert.equal(result.body.status,'manual_review');assert.equal(result.body.total_minor,null);
    const reviewed=await call('staff','/api/instant/orders/'+result.body.id+'/review',{words:fields.category==='sworn'?null:1000,pages:fields.category==='sworn'?2:null});assert.equal(reviewed.status,200,JSON.stringify(reviewed.body));assert.equal(reviewed.body.status,'quoted');
   }
   const sworn=await create({category:'sworn'},await pdf(),'source.pdf');assert.equal(sworn.status,201,JSON.stringify(sworn.body));assert.equal(sworn.body.total_minor,18000);
   assert.notEqual((await call('staff','/api/instant/orders/'+sworn.body.id+'/assign',{providerId:actors.provider})).status,200);
   assert.equal((await call('staff','/api/instant/orders/'+sworn.body.id+'/confirm-originals',{})).status,200);
   assert.equal((await create({category:'Interpretation'})).status,400);
  });
  await t.test('database enforces OFF gates, restricted table access and private record RPCs',async()=>{
   assert.equal(db.sql("select has_function_privilege('authenticated','public.instant_record_order(uuid,jsonb)','execute')"),'f');
   for(const role of ['anon','authenticated','service_role'])assert.equal(db.sql(`select has_table_privilege('${role}','public.instant_orders','select,insert,update,delete')`),'f');
   db.sql('update public.quote_settings set capture_enabled=false,commands_enabled=false');assert.equal((await create()).status,403);
  });
 }finally{if(app)await app.close();if(db)db.stop();rmSync(directory,{recursive:true,force:true});}
});

test('V3 migration and mock deposit also work on the exported Supabase-role schema',{timeout:60000},()=>{
 const directory=mkdtempSync(join(tmpdir(),'marocora-instant-managed-shape-'));let db;
 try{
  db=openLocalDatabase(directory,{forceLocal:true});db.sql('drop schema public cascade;create schema public;');
  db.sql(readFileSync(new URL('../supabase/migrations/202611140001_translation_workflow.sql',import.meta.url),'utf8'));
  const actors={staff:randomUUID(),customer:randomUUID(),provider:randomUUID()};
  db.sql(`insert into auth.users(id,email,email_confirmed_at) values ${Object.entries(actors).map(([role,id])=>`(${L(id)},${L(role+'@staging.invalid')},now())`).join(',')}`);
  const seed=readFileSync(new URL('../supabase/migrations/202611140002_translation_seed.sql',import.meta.url),'utf8').replace('staff_id uuid := NULL;',`staff_id uuid := ${L(actors.staff)};`).replace("customers jsonb := '[]';",`customers jsonb := ${L(JSON.stringify([actors.customer]))};`).replace("providers jsonb := '[]';",`providers jsonb := ${L(JSON.stringify([{id:actors.provider,name:'Synthetic translator'}]))};`);
  db.sql(seed);db.sql(readFileSync(new URL('../supabase/migrations/202611150003_instant_pricing.sql',import.meta.url),'utf8'));
  db.sql('update public.quote_settings set capture_enabled=true,commands_enabled=true');
  const q=db.instantRecord({actor:actors.customer},'instant_record_order',{p_payload:{id:randomUUID(),category:'legal',source:'Arabic',target:'Turkish',words:1000,pages:null,manualReview:false,sampleRequested:false,scanned:false,file:{id:randomUUID(),sha256:'0'.repeat(64),size:10,mime:'text/plain'}}});
  assert.equal(q.total_minor,calculatePrice({category:'legal',wordCount:1000,firstOrder:true}).totalMinor);
  const pay=db.rpc({actor:actors.customer},'instant_pay_mock',{p_id:q.id,p_command:randomUUID(),p_phase:'deposit',p_consent:true});assert.equal(pay.status,'in_progress_deposit_paid');
  db.rpc({actor:actors.staff},'instant_assign',{p_id:q.id,p_provider:actors.provider});assert.ok(db.rpc({actor:actors.provider},'instant_start',{p_id:q.id}).work_started_at);
  assert.equal(db.sql(`select public.instant_sworn_provider(${L(actors.provider)})`),'f');
  assert.equal(db.sql("select count(*) from pg_class where relnamespace='public'::regnamespace and relkind='r' and relrowsecurity"),'35');
 }finally{if(db)db.stop();rmSync(directory,{recursive:true,force:true,maxRetries:3});}
});
