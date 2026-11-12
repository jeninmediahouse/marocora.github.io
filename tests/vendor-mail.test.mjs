import test from 'node:test';import assert from 'node:assert/strict';
import {vendorEmailBatch,createResendTransport} from '../server/vendor-mail.mjs';
const item={application:{id:'20000000-0000-4000-8000-000000000001',name:'Applicant <script>x</script>',email:'owner@example.test',category:'transportation'},event:{id:'event-1',kind:'needs_information',payload:{message:'Please clarify <img src=x>',questions:[{id:'q1',label:'Licence & service area?'}]}}};
test('transactional messages have exact application links, question text, safe HTML and fixed admin recipient',()=>{
 const [applicant,admin]=vendorEmailBatch(item);assert.deepEqual(applicant.to,['owner@example.test']);assert.deepEqual(admin.to,['admin@marocora.com']);assert.equal(applicant.reply_to,'admin@marocora.com');assert.match(applicant.html,/application.html#20000000/);assert.match(admin.html,/vendor-review.html#20000000/);assert.ok(!applicant.html.includes('<script>'));assert.ok(applicant.html.includes('&lt;img'));assert.match(applicant.text,/Licence & service area/);
});
test('provider authentication and idempotency stay on the server and do not appear in email content',async()=>{
 let sent;const transport=createResendTransport({apiKey:'private-test-key',fetcher:async(u,o)=>{sent={u,o};return new Response(JSON.stringify({data:[{id:'app'},{id:'admin'}]}),{status:200});}});
 assert.deepEqual(await transport(item),{state:'sent',ids:['app','admin']});assert.equal(sent.o.headers.Authorization,'Bearer private-test-key');assert.equal(sent.o.headers['Idempotency-Key'],'marocora-vendor/event-1');assert.ok(!sent.o.body.includes('private-test-key'));
});
test('provider rejections and ambiguous responses are reported without leaking credentials or claiming delivery',async()=>{
 for(const [status,state] of [[403,'failed'],[429,'uncertain'],[409,'uncertain'],[500,'uncertain']]){const t=createResendTransport({apiKey:'private',fetcher:async()=>new Response(JSON.stringify({message:'internal private detail'}),{status})});assert.deepEqual(await t(item),{state});}
});

test('test decisions are clearly marked for both recipients without changing canonical links',()=>{
 const [applicant,admin]=vendorEmailBatch({...item,application:{...item.application,is_test:true}});
 for(const mail of [applicant,admin]){assert.match(mail.subject,/^\[TEST\] /);assert.match(mail.html,/TEST DATA/);assert.match(mail.text,/^\[TEST\] /);}
});
