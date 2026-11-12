import test from 'node:test';
import assert from 'node:assert/strict';
import {createIntakeHandler,validateIntake,intakeKinds} from '../server/service-intake.mjs';
const id='12345678-1234-4234-8234-123456789abc';
const user={id:'u1',email:'owner@example.com',email_confirmed_at:'2026-11-11T00:00:00Z'};
const input=()=>({kind:'translation',requestId:id,fields:{email:'owner@example.com','client-name':'Owner',message:'Translate a business contract from English to Arabic.',verification_status:'fake',email_verified_at:'fake',_subject:'fake'}});
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
const req=(body=input(),authorization='Bearer owner-token',origin='https://marocora.com')=>new Request('https://example.com/service-intake',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(authorization?{Authorization:authorization}:{})},body:JSON.stringify(body)});
function harness({authUser=user,authStatus=200,delivery='ok'}={}){
 const records=new Map(),calls=[];
 const fetcher=async(url,options={})=>{
  calls.push({url,options});
  if(url.endsWith('/auth/v1/user'))return json(authUser,authStatus);
  if(url.endsWith('/service_intake_reserve')){
   const p=JSON.parse(options.body),old=records.get(p.p_id);
   if(old){if(old.hash!==p.p_hash||old.user!==p.p_user)return json({message:'REQUEST_CONFLICT'},409);return json({dispatch:false,delivery:old.delivery,verified_at:user.email_confirmed_at});}
   records.set(p.p_id,{hash:p.p_hash,user:p.p_user,delivery:'dispatching'});return json({dispatch:true,delivery:'dispatching',verified_at:user.email_confirmed_at});
  }
  if(url.endsWith('/service_intake_delivery')){const p=JSON.parse(options.body);records.get(p.p_id).delivery=p.p_delivery;return json(true);}
  if(url.startsWith('https://formspree.io/f/')){if(delivery==='timeout')throw new Error('network timeout');if(delivery==='html')return new Response('<html>captcha</html>');if(delivery==='reject')return json({errors:['rejected']},400);return json({ok:true});}
  throw new Error('unexpected URL');
 };
 return {handler:createIntakeHandler({supabaseURL:'https://test.supabase.co',serviceKey:'server-secret',fetcher}),calls,records};
}
test('unverified, anonymous, wrong-email and malformed requests cannot create an intake',()=>{
 for(const bad of [null,{...user,email_confirmed_at:null},{...user,is_anonymous:true}])assert.throws(()=>validateIntake(input(),bad),/EMAIL_VERIFICATION_REQUIRED/);
 const p=input();p.fields.email='other@example.com';assert.throws(()=>validateIntake(p,user),/EMAIL_MISMATCH/);
 assert.throws(()=>validateIntake({...input(),kind:'__proto__'},user),/INVALID_REQUEST/);
 assert.throws(()=>validateIntake({...input(),requestId:'not-a-uuid'},user),/INVALID_REQUEST/);
});
test('all client/vendor intake types require a confirmed matching email and a name',()=>{
 for(const [kind,rule] of Object.entries(intakeKinds)){
  const p={kind,requestId:id,fields:{email:user.email,[rule.name]:'Test',message:'A detailed service request'}};
  assert.equal(validateIntake(p,user).role,rule.role);
  p.fields[rule.name]='';assert.throws(()=>validateIntake(p,user),/NAME_REQUIRED/);
 }
 const clean=validateIntake(input(),user);assert.equal(clean.fields.verification_status,undefined);assert.equal(clean.fields.email_verified_at,undefined);assert.equal(clean.fields._subject,undefined);
});
test('the endpoint rejects missing/invalid tokens and unapproved origins before dispatch',async()=>{
 const h=harness();assert.equal((await h.handler(req(input(),null))).status,401);assert.equal((await h.handler(req(input(),'Bearer x','https://evil.example'))).status,403);assert.equal(h.calls.length,0);
 const bad=harness({authStatus:401});assert.equal((await bad.handler(req())).status,401);assert.equal(bad.calls.length,1);
 const unverified=harness({authUser:{...user,email_confirmed_at:null}});assert.equal((await unverified.handler(req())).status,400);assert.equal(unverified.calls.length,1);
});
test('successful dispatch is canonical, uses a server-confirmed receipt and is idempotent',async()=>{
 const h=harness();assert.equal((await h.handler(req())).status,200);assert.equal((await h.handler(req())).status,200);
 const sent=h.calls.filter(c=>c.url.startsWith('https://formspree.io/'));assert.equal(sent.length,1);
 const body=JSON.parse(sent[0].options.body);assert.equal(body._subject,intakeKinds.translation.subject);assert.equal(body.email_verified_at,user.email_confirmed_at);assert.equal(body.verification_receipt,id);assert.ok(!sent[0].options.body.includes('server-secret'));
 const changed=input();changed.fields.message='Different content';assert.equal((await h.handler(req(changed))).status,400);
});
test('ambiguous delivery keeps the durable record and cannot send an automatic duplicate',async()=>{
 for(const delivery of ['timeout','html','reject']){
  const h=harness({delivery});const first=await h.handler(req());assert.equal(first.status,202);const result=await first.json();assert.equal(result.delivery,delivery==='reject'?'rejected':'uncertain');
  await h.handler(req());assert.equal(h.calls.filter(c=>c.url.startsWith('https://formspree.io/')).length,1);
 }
});
test('malformed JSON, oversized payloads and backend failure do not leak internal secrets',async()=>{
 const h=harness();const huge=input();huge.fields.message='x'.repeat(51000);assert.equal((await h.handler(req(huge))).status,413);
 const broken=createIntakeHandler({supabaseURL:'https://test',serviceKey:'do-not-leak',fetcher:async()=>{throw new Error('do-not-leak');}});const response=await broken(req());assert.equal(response.status,503);assert.ok(!(await response.text()).includes('do-not-leak'));
});


test('verified vendor intakes request canonical mail separately from Formspree spam handling',async()=>{
 let reserved=false,archives=0;const notifications=[];
 const p={kind:'network',requestId:id,fields:{email:user.email,'full-name':'Controlled vendor'}};
 const h=createIntakeHandler({supabaseURL:'https://db.test',serviceKey:'server-secret',fetcher:async(url,o)=>{
  if(url.endsWith('/auth/v1/user'))return json(user);
  if(url.endsWith('/service_intake_reserve')){const dispatch=!reserved;reserved=true;return json({dispatch,delivery:'delivered',verified_at:user.email_confirmed_at});}
  if(url.startsWith('https://formspree')){archives++;return json({ok:true});}
  if(url.endsWith('/service_intake_delivery'))return json(true);
  if(url.endsWith('/functions/v1/vendor-workflow')){notifications.push(o);return json({email:'processed'});}
  throw Error('Unexpected request');
 }});
 for(let n=0;n<2;n++){const r=await h(req(p));assert.equal(r.status,200);assert.equal((await r.json()).vendor_notification,'processed');}
 assert.equal(archives,1);assert.equal(notifications.length,2);
 for(const o of notifications){assert.equal(o.headers.Authorization,'Bearer owner-token');assert.equal(o.headers.Origin,'https://marocora.com');assert.deepEqual(JSON.parse(o.body),{action:'deliver',id});assert.ok(!o.body.includes('server-secret'));}
});
