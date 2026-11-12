import test from 'node:test';import assert from 'node:assert/strict';
import {createVendorHandler,mailFields} from '../server/vendor-workflow.mjs';
import {fieldsHTML,historyHTML,requestedQuestions} from '../vendor-view.mjs';
const id='20000000-0000-4000-8000-000000000001',commandId='30000000-0000-4000-8000-000000000001';
const user={id:'10000000-0000-4000-8000-000000000002',email:'owner@example.test',email_confirmed_at:'2026-11-12',is_anonymous:false};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status});
function request(input,token=true,origin='https://marocora.com'){return new Request('https://edge.test',{method:'POST',headers:{Origin:origin,...token?{Authorization:'Bearer user-session'}:{},'Content-Type':'application/json'},body:JSON.stringify(input)});}
test('authentication, origin and configured mail are required before changes',async()=>{
 let calls=0;const h=createVendorHandler({supabaseURL:'https://db.test',serviceKey:'secret',fetcher:async()=>{calls++;return json(user);}});
 assert.equal((await h(request({},false))).status,401);assert.equal((await h(request({},true,'https://evil.test'))).status,403);assert.equal(calls,0);
 const r=await h(request({action:'decide'}));assert.equal(r.status,503);assert.equal(calls,1);assert.equal((await r.json()).error,'EMAIL_WORKFLOW_NOT_CONFIGURED');
});
test('decisions use caller identity while mail recipient and message come only from stored events',async()=>{
 const calls=[];let claimed=false;
 const fetcher=async(url,options)=>{calls.push({url,options});if(url.endsWith('/user'))return json(user);if(url.endsWith('vendor_decide'))return json({application_id:id,event_id:commandId});if(url.endsWith('vendor_claim_mail')){if(claimed)return json(null);claimed=true;return json({application:{id,email:'canonical@example.test',name:'Canonical',category:'transportation'},event:{id:commandId,kind:'needs_information',payload:{message:'Stored request',questions:[{id:'q1',label:'Experience?'}]}}});}if(url.startsWith('https://formspree'))return json({ok:true});return json(null);};
 const h=createVendorHandler({supabaseURL:'https://db.test',serviceKey:'secret',mailForm:'abcdefgh',fetcher});
 const r=await h(request({action:'decide',id,revision:1,commandId,decision:'needs_information',message:'Client text',email:'attacker@example.test'}));assert.equal(r.status,200);
 const write=calls.find(c=>c.url.endsWith('vendor_decide'));assert.equal(write.options.headers.Authorization,'Bearer user-session');
 const mail=calls.find(c=>c.url.startsWith('https://formspree'));const sent=JSON.parse(mail.options.body);assert.equal(sent.email,'canonical@example.test');assert.equal(sent.message,'Stored request');assert.ok(sent.application_url.endsWith('#'+id));assert.ok(!mail.options.body.includes('secret'));
});
test('an ambiguous mail result is recorded without retrying or pretending delivery',async()=>{
 let claimed=false,sends=0,finish;
 const fetcher=async(url,o)=>{if(url.endsWith('/user'))return json(user);if(url.endsWith('vendor_decide'))return json({application_id:id});if(url.endsWith('vendor_claim_mail')){if(claimed)return json(null);claimed=true;return json({application:{id,email:user.email},event:{id:commandId,kind:'approved',payload:{message:'Welcome'}}});}if(url.startsWith('https://formspree')){sends++;throw Error('Timeout');}if(url.endsWith('vendor_finish_mail'))finish=JSON.parse(o.body);return json(null);};
 const h=createVendorHandler({supabaseURL:'https://db.test',serviceKey:'secret',mailForm:'abcdefgh',fetcher});const r=await h(request({action:'decide',id,commandId}));assert.equal(r.status,202);assert.equal(sends,1);assert.equal(finish.p_delivery,'uncertain');
});
test('staff denial never sends an outcome or exposes server internals',async()=>{
 let sends=0;const h=createVendorHandler({supabaseURL:'https://db.test',serviceKey:'secret',mailForm:'abcdefgh',fetcher:async url=>{if(url.endsWith('/user'))return json(user);if(url.includes('formspree'))sends++;return json({message:'STAFF_REQUIRED internal detail secret'},403);}});const r=await h(request({action:'decide',id,commandId}));assert.equal(r.status,403);assert.equal(sends,0);assert.deepEqual(await r.json(),{error:'STAFF_REQUIRED'});
});
test('application HTML escapes submitted content, questions and replies',()=>{
 assert.ok(!fieldsHTML({bio:'<script>alert(1)</script>'}).includes('<script>'));
 assert.ok(!historyHTML({history:[{kind:'needs_information',created_at:'2026-11-12',payload:{message:'<img src=x>',questions:[{id:'q1',label:'<script>x</script>'}],answers:{q1:'<svg onload=x>'}},delivery:'sent'}]}).includes('<script>'));
 assert.deepEqual(requestedQuestions(' Licence details?\n\nService area?'),[{id:'q1',label:'Licence details?'},{id:'q2',label:'Service area?'}]);
 assert.throws(()=>mailFields({application:{},event:{kind:'forged'}}),/INVALID_EVENT/);
});

test('authenticated mail transport is used without a public submission endpoint',async()=>{
 let claimed=false,mail;const h=createVendorHandler({supabaseURL:'https://db.test',serviceKey:'secret',sendMail:async item=>{mail=item;return {state:'sent'};},fetcher:async url=>{if(url.endsWith('/user'))return json(user);if(url.endsWith('vendor_decide'))return json({application_id:id});if(url.endsWith('vendor_claim_mail')){if(claimed)return json(null);claimed=true;return json({application:{id,email:user.email},event:{id:commandId,kind:'approved',payload:{message:'Welcome'}}});}assert.ok(!url.includes('formspree'));return json(null);}});
 const r=await h(request({action:'decide',id,commandId}));assert.equal(r.status,200);assert.equal(mail.application.email,user.email);
});
test('an idempotent retry reports an existing failed mail instead of false success',async()=>{
 const h=createVendorHandler({supabaseURL:'https://db.test',serviceKey:'secret',mailForm:'abcdefgh',fetcher:async url=>{if(url.endsWith('/user'))return json(user);if(url.endsWith('vendor_decide'))return json({application_id:id});if(url.endsWith('vendor_mail_health'))return json({needs_attention:true});return json(null);}});
 const r=await h(request({action:'decide',id,commandId}));assert.equal(r.status,202);assert.equal((await r.json()).email,'needs_attention');
});
