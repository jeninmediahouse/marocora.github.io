import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MAX_MINOR,SWITCHES,money,scope,canonical,digest,offerContent} from '../server/quote/contracts.mjs';
import {QuoteFixtureStore,seed,ids,fixtureCapabilities} from './fixtures/quote-store.mjs';

const raw=(action,targetId,expectedRevision,payload={})=>({commandId:randomUUID(),action,targetId,expectedRevision,payload});
async function send(store,actor,action,payload={},target=ids.request) {
 const s=store.snapshot(),a=s.requests[target]||s.readiness[target];
 return store.execute(ids[actor],raw(action,target,a.revision,payload));
}
async function ready(store) {
 const p=store.snapshot().policies['fixture-participation-v1'];
 await send(store,'staff','propose_readiness',{capabilities:fixtureCapabilities,policyVersion:p.version,policyDigest:p.digest},ids.readiness);
 const r=store.snapshot().readiness[ids.readiness];
 await send(store,'provider','acknowledge_participation',{capabilityDigest:digest(r.capabilities),policyVersion:p.version,policyDigest:p.digest,language:'en'},ids.readiness);
 await send(store,'staff','enable_readiness',{},ids.readiness);
}
async function assigned(store) {
 await ready(store);await send(store,'staff','claim_request');await send(store,'staff','invite_provider',{readinessId:ids.readiness});
 await send(store,'provider','respond_assignment',{assignmentId:store.snapshot().requests[ids.request].assignment.id,response:'accepted'});
}
function content(store,extra={}) {
 const p=store.snapshot().policies['fixture-acceptance-v1'];
 return {scope:'Synthetic fixed scope',exclusions:'No additional pages',total:{minor:12000,currency:'MAD'},turnaround:'Three days after separately authorized activation',revisions:1,expiresAt:'2026-11-14T12:00:00.000Z',policyVersion:p.version,policyDigest:p.digest,taxTreatment:'Synthetic declared treatment',chargesIncluded:true,...extra};
}
async function offered(store) {
 await assigned(store);await send(store,'provider','issue_offer',{assignmentId:store.snapshot().requests[ids.request].assignment.id,content:content(store)});
 return store.snapshot().requests[ids.request].offers.at(-1);
}
function acceptance(o) {return {offerId:o.id,offerDigest:o.digest,policyVersion:o.content.policyVersion,policyDigest:o.content.policyDigest,language:'en'};}

test('money uses integer minor units and explicit currency precision',()=>{
 for(const [currency,digits] of [['JPY',0],['MAD',2],['KWD',3]]) assert.deepEqual(money({minor:1,currency}),{minor:1,currency,digits});
 for(const minor of [0,-1,1.2,'1200',MAX_MINOR+1,Infinity]) assert.throws(()=>money({minor,currency:'MAD'}));
 assert.equal(money({minor:0,currency:'MAD'},{budget:true}).minor,0);
 assert.throws(()=>money({minor:1,currency:'ZZZ'}));assert.throws(()=>money({minor:1,currency:'__proto__'}));
});
test('canonical payload hash ignores object key order and rejects ambiguous values',()=>{
 assert.equal(digest({b:2,a:{d:4,c:3}}),digest({a:{c:3,d:4},b:2}));
 for(const x of [undefined,NaN,1.5,{a:undefined}]) assert.throws(()=>canonical(x));
});
test('scope rejects missing languages, forged fields and uploads',()=>{
 const s=seed().requests[ids.request].scope;
 // Canonical scope has optional budget metadata only when provided; basic scope revalidates.
 for(const override of [{source:''},{target:'Ｅｎｇｌｉｓｈ'},{source:'Other'},{files:[]},{is_test:false},{service:'work_start'}]) assert.throws(()=>scope({...s,...override}));
 assert.throws(()=>scope({...s,service:'Certified / Sworn Translation'}));
 assert.throws(()=>scope({...s,service:'Interpretation'}));
 const budgeted=scope({...s,budget:{minor:1000,currency:'MAD'}});assert.deepEqual(scope(budgeted),budgeted);
});
test('interpretation requires mode, location, valid instant and named zone',()=>{
 const base={service:'Interpretation',source:'English',target:'French',description:'Synthetic appointment',interpretation:{mode:'remote',location:'Synthetic meeting',startsAt:'2026-11-20T12:00:00.000Z',timeZone:'Africa/Casablanca',durationMinutes:60}};
 assert.equal(scope(base).interpretation.timeZone,'Africa/Casablanca');
 for(const override of [{timeZone:'+01:00'},{timeZone:'Invalid/Zone'},{startsAt:'2026-02-30T12:00:00.000Z'},{durationMinutes:0},{location:''}]) assert.throws(()=>scope({...base,interpretation:{...base.interpretation,...override}}));
});
test('all exported production switches are false',()=>assert.deepEqual(SWITCHES,{capture:false,commands:false,notifications:false}));
test('unapproved policies and staff impersonation cannot enable readiness',async()=>{
 const store=new QuoteFixtureStore(seed());const p=store.snapshot().policies['fixture-participation-v1'];
 await assert.rejects(send(store,'provider','propose_readiness',{capabilities:fixtureCapabilities,policyVersion:p.version,policyDigest:p.digest},ids.readiness),/STAFF_REQUIRED/);
 await store.arrange(s=>s.policies[p.version].approvedAt=null);
 await assert.rejects(ready(store),/POLICY_NOT_APPROVED/);
});
test('readiness requires exact provider acknowledgement before enable',async()=>{
 const store=new QuoteFixtureStore(seed()),p=store.snapshot().policies['fixture-participation-v1'];
 await send(store,'staff','propose_readiness',{capabilities:fixtureCapabilities,policyVersion:p.version,policyDigest:p.digest},ids.readiness);
 await assert.rejects(send(store,'staff','enable_readiness',{},ids.readiness),/INVALID_STATE/);
 await assert.rejects(send(store,'provider','acknowledge_participation',{capabilityDigest:digest('wrong'),policyVersion:p.version,policyDigest:p.digest,language:'en'},ids.readiness),/EXACT_ACKNOWLEDGEMENT_REQUIRED/);
 await assert.rejects(send(store,'staff','acknowledge_participation',{capabilityDigest:'wrong'},ids.readiness));
});
test('a staff provider cannot review their own readiness',async()=>{
 const s=seed();s.staff.push(ids.provider);const store=new QuoteFixtureStore(s),p=s.policies['fixture-participation-v1'];
 await assert.rejects(send(store,'provider','propose_readiness',{capabilities:fixtureCapabilities,policyVersion:p.version,policyDigest:p.digest},ids.readiness),/STAFF_REQUIRED/);
});
for(const [name,alter] of [
 ['vendor revision',s=>s.applications[ids.application].revision++],
 ['vendor decision',s=>s.applications[ids.application].status='declined'],
 ['test application',s=>s.applications[ids.application].is_test=true],
 ['permanent fixture application',s=>s.vendorFixtureIds.push(ids.application)],
 ['fixture alternate application account',s=>{s.applications[ids.fixtureApplication]={user_id:ids.provider};s.vendorFixtureIds.push(ids.fixtureApplication);}],
 ['learning exclusion',s=>s.learningExclusions.push(ids.provider)],
 ['translation exclusion',s=>s.translationExclusions.push(ids.provider)],
 ['quote test account',s=>s.quoteTestUsers.push(ids.provider)],
 ['email change',s=>s.users[ids.provider].email='changed@fixture.invalid'],
 ['unverified account',s=>s.users[ids.provider].email_confirmed_at=null],
 ['closed readiness',s=>s.readiness[ids.readiness].state='closed'],
 ['withdrawn participation policy',s=>s.policies['fixture-participation-v1'].approvedAt=null],
 ['self assignment',s=>s.requests[ids.request].customerId=ids.provider]
]) test(`${name} blocks current eligibility at acceptance`,async()=>{
 const store=new QuoteFixtureStore(seed()),o=await offered(store);await store.arrange(alter);
 const actor=name==='self assignment'?'provider':'customer';
 await assert.rejects(send(store,actor,'accept_offer',acceptance(o)),/PROVIDER_INELIGIBLE/);
 assert.equal(store.snapshot().requests[ids.request].acceptance,null);
});
test('provider alone authors immutable offer; acceptance stops before activation',async()=>{
 const store=new QuoteFixtureStore(seed());await assigned(store);
 const p={assignmentId:store.snapshot().requests[ids.request].assignment.id,content:content(store)};
 await assert.rejects(send(store,'staff','issue_offer',p),/UNAVAILABLE/);
 await send(store,'provider','issue_offer',p);const o=store.snapshot().requests[ids.request].offers[0];
 await send(store,'customer','accept_offer',acceptance(o));
 const q=store.snapshot().requests[ids.request];assert.equal(q.state,'accepted_pending_activation');assert.deepEqual(q.offers[0].content,o.content);
 for(const action of ['activate','start_work','upload','pay','issue_offer','invite_provider','revise_scope']) await assert.rejects(send(store,'staff',action,{}));
 assert.ok(store.snapshot().deliveries.every(d=>d.state==='suppressed'));
});
test('acceptance requires exact digest, terms and unexpired database-time boundary',async()=>{
 const store=new QuoteFixtureStore(seed()),o=await offered(store);
 for(const override of [{offerDigest:digest('changed')},{policyVersion:'old'},{policyDigest:digest('old')},{language:'xx'},{actorId:ids.customer}]) await assert.rejects(send(store,'customer','accept_offer',{...acceptance(o),...override}));
 await store.arrange(s=>s.now=Date.parse(o.content.expiresAt));
 assert.equal(store.detail(ids.request,ids.customer).offers[0].state,'expired');
 await assert.rejects(send(store,'customer','accept_offer',acceptance(o)),/OFFER_EXPIRED/);
});
test('offer issue validates total, expiry, currency and current acceptance policy',async()=>{
 const store=new QuoteFixtureStore(seed());await assigned(store);
 for(const extra of [{total:{minor:0,currency:'MAD'}},{total:{minor:1,currency:'USD'}},{expiresAt:'2026-11-13T12:00:00.000Z'},{chargesIncluded:false},{policyDigest:digest('unapproved')},{files:[]}]) await assert.rejects(send(store,'provider','issue_offer',{assignmentId:store.snapshot().requests[ids.request].assignment.id,content:content(store,extra)}));
 assert.throws(()=>offerContent(content(store,{total:{minor:0.2,currency:'MAD'}}),store.snapshot().now));
});
test('scope revision withdraws old offer, ends assignment and requires reconfirmation',async()=>{
 const store=new QuoteFixtureStore(seed()),o=await offered(store),before=store.snapshot().requests[ids.request];
 await send(store,'customer','revise_scope',{scope:{...before.scope,description:'Revised synthetic scope'}});
 const q=store.snapshot().requests[ids.request];assert.equal(q.offers[0].state,'withdrawn');assert.equal(q.assignmentHistory[0].state,'ended');assert.equal(q.assignment.state,'invited');assert.notEqual(q.assignment.id,before.assignment.id);
 await assert.rejects(send(store,'provider','issue_offer',{assignmentId:q.assignment.id,content:content(store)}),/UNAVAILABLE/);
 await assert.rejects(send(store,'customer','accept_offer',acceptance(o)),/OFFER_UNAVAILABLE/);
});
test('reassignment revokes old provider reads and even exact command replay',async()=>{
 const store=new QuoteFixtureStore(seed());await assigned(store);
 const c=raw('issue_offer',ids.request,store.snapshot().requests[ids.request].revision,{assignmentId:store.snapshot().requests[ids.request].assignment.id,content:content(store)});
 await store.execute(ids.provider,c);await send(store,'staff','revoke_assignment',{reason:'Synthetic reassignment'});
 assert.throws(()=>store.detail(ids.request,ids.provider),/UNAVAILABLE/);
 await assert.rejects(store.execute(ids.provider,c),/UNAVAILABLE/);
});
test('projection redacts intake, owner, internal notes and invited scope',async()=>{
 const store=new QuoteFixtureStore(seed());await ready(store);await send(store,'staff','claim_request');await send(store,'staff','invite_provider',{readinessId:ids.readiness});
 const invite=store.detail(ids.request,ids.provider);assert.equal(invite.scope,undefined);assert.equal(invite.offers,undefined);
 const customer=store.detail(ids.request,ids.customer);for(const key of ['intakeId','ownerId','internalNotes','classification']) assert.equal(customer[key],undefined);
 assert.equal(store.detail(ids.request,ids.staff).internalNotes,'Fixture internal note');
 for(const id of [ids.request,randomUUID()]) assert.throws(()=>store.detail(id,ids.outsider),/UNAVAILABLE/);
});
test('lost response replay returns same saved result without events or deliveries',async()=>{
 const store=new QuoteFixtureStore(seed()),c=raw('claim_request',ids.request,1);
 const result=await store.execute(ids.staff,c),before=store.snapshot();
 assert.deepEqual(await store.execute(ids.staff,{payload:{},expectedRevision:1,targetId:ids.request,action:'claim_request',commandId:c.commandId}),result);
 assert.deepEqual(store.snapshot(),before);
 await assert.rejects(store.execute(ids.staff,{...c,expectedRevision:2}),/COMMAND_CONFLICT/);
 await assert.rejects(store.execute(ids.customer,c),/COMMAND_CONFLICT/);
});
test('failure before commit rolls back state, command, event and outbox together',async()=>{
 const store=new QuoteFixtureStore(seed()),before=store.snapshot(),c=raw('claim_request',ids.request,1);
 await assert.rejects(store.execute(ids.staff,c,{failBeforeCommit:true}),/SIMULATED_COMMIT_FAILURE/);assert.deepEqual(store.snapshot(),before);
 await store.execute(ids.staff,c);assert.equal(store.snapshot().events.length,1);
});
test('two concurrent acceptances commit one acceptance and one event',async()=>{
 const store=new QuoteFixtureStore(seed()),o=await offered(store),revision=store.snapshot().requests[ids.request].revision,before=store.snapshot().events.length;
 const results=await Promise.allSettled([1,2].map(()=>store.execute(ids.customer,raw('accept_offer',ids.request,revision,acceptance(o)))));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.match(results.find(x=>x.status==='rejected').reason.message,/STALE_REVISION/);assert.equal(store.snapshot().events.length,before+1);
});
test('acceptance racing cancellation or new offer has one revision winner',async()=>{
 for(const other of ['cancel_request','issue_offer']) {
  const store=new QuoteFixtureStore(seed()),o=await offered(store),q=store.snapshot().requests[ids.request];
  const first=store.execute(ids.customer,raw('accept_offer',q.id,q.revision,acceptance(o)));
  const second=store.execute(ids[other==='cancel_request'?'customer':'provider'],raw(other,q.id,q.revision,other==='cancel_request'?{reason:'Cancel synthetic request'}:{assignmentId:q.assignment.id,content:content(store)}));
  const results=await Promise.allSettled([first,second]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(store.snapshot().requests[q.id].state,'accepted_pending_activation');
 }
});
test('cancel after acceptance preserves exact offer and acceptance evidence',async()=>{
 const store=new QuoteFixtureStore(seed()),o=await offered(store);await send(store,'customer','accept_offer',acceptance(o));const before=store.snapshot().requests[ids.request].acceptance;
 await send(store,'customer','cancel_request',{reason:'Synthetic cancellation'});const q=store.snapshot().requests[ids.request];assert.equal(q.state,'cancelled');assert.deepEqual(q.acceptance,before);assert.equal(q.offers[0].state,'accepted');
 await assert.rejects(send(store,'staff','claim_request'),/INVALID_STATE/);
});
test('commands disabled reject new mutations; no stale activation switch exists',async()=>{
 const store=new QuoteFixtureStore(seed());await store.arrange(s=>s.settings.commands=false);
 await assert.rejects(send(store,'staff','claim_request'),/COMMANDS_DISABLED/);
 assert.equal(store.snapshot().events.length,0);
});
test('competing offers leave one current immutable version',async()=>{
 const store=new QuoteFixtureStore(seed());await assigned(store);const q=store.snapshot().requests[ids.request];
 const results=await Promise.allSettled([1,2].map(()=>store.execute(ids.provider,raw('issue_offer',q.id,q.revision,{assignmentId:q.assignment.id,content:content(store)}))));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const first=store.snapshot().requests[q.id].offers[0];
 await send(store,'provider','issue_offer',{assignmentId:q.assignment.id,content:content(store,{total:{minor:13000,currency:'MAD'}})});
 const offers=store.snapshot().requests[q.id].offers;assert.equal(offers.filter(o=>o.state==='offered').length,1);assert.equal(offers[0].state,'superseded');assert.deepEqual(offers[0].content,first.content);
 await assert.rejects(send(store,'customer','accept_offer',acceptance(first)),/OFFER_UNAVAILABLE/);
});
test('scope or vendor change winning a race prevents stale issuance/acceptance',async()=>{
 const store=new QuoteFixtureStore(seed()),o=await offered(store),q=store.snapshot().requests[ids.request];
 const revise=store.execute(ids.customer,raw('revise_scope',q.id,q.revision,{scope:{...q.scope,description:'Changed scope wins'}}));
 const issue=store.execute(ids.provider,raw('issue_offer',q.id,q.revision,{assignmentId:q.assignment.id,content:content(store)}));
 const results=await Promise.allSettled([revise,issue]);assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');
 const change=store.arrange(s=>s.applications[ids.application].revision++);
 const accept=send(store,'customer','accept_offer',acceptance(o));await change;await assert.rejects(accept);
});
test('cancellation winning a race prevents acceptance',async()=>{
 const store=new QuoteFixtureStore(seed()),o=await offered(store),q=store.snapshot().requests[ids.request];
 const results=await Promise.allSettled([store.execute(ids.customer,raw('cancel_request',q.id,q.revision,{reason:'Cancellation wins'})),store.execute(ids.customer,raw('accept_offer',q.id,q.revision,acceptance(o)))]);
 assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');assert.equal(store.snapshot().requests[q.id].acceptance,null);
});
test('expiry never mutates history and ineligible scope change returns request to staff',async()=>{
 const store=new QuoteFixtureStore(seed()),o=await offered(store),before=store.snapshot().events.length;
 await store.arrange(s=>s.now=Date.parse(o.content.expiresAt));store.detail(ids.request,ids.customer);assert.equal(store.snapshot().events.length,before);assert.equal(store.snapshot().requests[ids.request].offers[0].state,'offered');
 await send(store,'customer','revise_scope',{scope:{...store.snapshot().requests[ids.request].scope,target:'Spanish'}});
 assert.equal(store.snapshot().requests[ids.request].assignment,null);assert.throws(()=>store.detail(ids.request,ids.provider),/UNAVAILABLE/);
});
