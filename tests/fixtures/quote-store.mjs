// Deliberately test-only. Synthetic transactional reference model, NOT a database adapter.
// One queue serializes all commands, including changes to vendor/readiness context.
import {randomUUID} from 'node:crypto';
import {requireThat as check,record,text,integer,scope,capabilities,offerContent,digest,command,verified,providerEligible,exactPolicy,visibleRequest,LANGUAGES} from '../../server/quote/contracts.mjs';

export class QuoteFixtureStore {
 #state; #tail=Promise.resolve();
 constructor(seed) {this.#state=structuredClone(seed);}
 snapshot() {return structuredClone(this.#state);}
 detail(requestId,actorId) {return structuredClone(visibleRequest(this.#state,requestId,actorId));}
 // Trusted fixture administration only, serialized with commands; no external input.
 arrange(fn) {return this.#serialize(()=>{const next=structuredClone(this.#state);fn(next);this.#state=next;});}
 #serialize(fn) {const result=this.#tail.then(fn);this.#tail=result.catch(()=>{});return result;}
 execute(actorId,raw,{failBeforeCommit=false}={}) {
  return this.#serialize(()=>{
   const c=command(raw),s=structuredClone(this.#state);
   check(verified(s.users[actorId]),'UNAVAILABLE');
   const readinessAction=['propose_readiness','acknowledge_participation','enable_readiness','close_readiness'].includes(c.action);
   let aggregate=readinessAction?s.readiness[c.targetId]:s.requests[c.targetId];
   // Check CURRENT access even for a saved replay.
   if(readinessAction) check(aggregate&&(s.staff.includes(actorId)||aggregate.providerId===actorId),'UNAVAILABLE');
   else visibleRequest(s,c.targetId,actorId);
   const hash=digest({actorId,...c}),saved=s.commands[c.commandId];
   if(saved) {check(saved.actorId===actorId&&saved.hash===hash,'COMMAND_CONFLICT');return structuredClone(saved.result);}
   check(aggregate.revision===c.expectedRevision,'STALE_REVISION');
   check(s.settings.commands,'COMMANDS_DISABLED');
   if(readinessAction) this.#readiness(s,aggregate,actorId,c);
   else this.#request(s,aggregate,actorId,c);
   aggregate.revision++;
   const event={id:randomUUID(),aggregateId:aggregate.id,revision:aggregate.revision,actorId,kind:c.action,at:new Date(s.now).toISOString()};
   s.events.push(event);
   // No addresses or transport; every disabled event is permanently suppressed.
   const recipients=readinessAction?[aggregate.providerId]:[aggregate.customerId,aggregate.ownerId,aggregate.assignment?.providerId];
   for(const recipientId of new Set(recipients.filter(Boolean))) s.deliveries.push({id:randomUUID(),eventId:event.id,recipientId,state:'suppressed',reason:'DISCONNECTED_FIXTURE_NO_TRANSPORT'});
   const result={commandId:c.commandId,...(readinessAction?{readinessId:aggregate.id}:{requestId:aggregate.id}),revision:aggregate.revision,eventId:event.id,result:c.action,notificationState:'suppressed'};
   s.commands[c.commandId]={actorId,hash,result};
   check(!failBeforeCommit,'SIMULATED_COMMIT_FAILURE');
   this.#state=s;
   return structuredClone(result);
  });
 }
 #context(s,r) {
  const a=s.applications[r.applicationId];
  return {application:a,user:s.users[r.providerId],readiness:r,acknowledgement:s.acknowledgements[r.id],policy:s.policies[r.policyVersion],approvalEvent:s.approvalEvents[r.approvalEventId],excludedApplicationIds:s.vendorFixtureIds,excludedUserIds:[...s.learningExclusions,...s.translationExclusions,...s.quoteTestUsers,...s.vendorFixtureIds.map(id=>s.applications[id]?.user_id)]};
 }
 #eligible(s,q,r) {check(providerEligible(this.#context(s,r),q.scope,q.customerId),'PROVIDER_INELIGIBLE');}
 #readiness(s,r,actor,c) {
  const p=c.payload;
  if(c.action==='propose_readiness') {
   record(p,['capabilities','policyVersion','policyDigest']);
   check(s.staff.includes(actor)&&actor!==r.providerId,'STAFF_REQUIRED');
   check(r.state==='draft','INVALID_STATE');
   const ctx=this.#context(s,r),a=ctx.application,u=ctx.user;
   check(a?.status==='approved'&&a.category==='translation'&&a.is_test===false&&verified(u)&&a.user_id===r.providerId&&a.email.toLowerCase()===u.email.toLowerCase()&&!ctx.excludedApplicationIds.includes(a.id)&&!ctx.excludedUserIds.includes(u.id),'PROVIDER_INELIGIBLE');
   exactPolicy(s.policies[p.policyVersion],'participation',p.policyVersion,p.policyDigest);
   check(ctx.approvalEvent?.application_id===a.id&&ctx.approvalEvent.kind==='approved','INVALID_APPROVAL_EVENT');
   r.capabilities=capabilities(p.capabilities);r.policyVersion=p.policyVersion;r.policyDigest=p.policyDigest;r.applicationRevision=a.revision;r.reviewerId=actor;r.state='proposed';
  } else if(c.action==='acknowledge_participation') {
   record(p,['capabilityDigest','policyVersion','policyDigest','language']);
   check(actor===r.providerId&&r.state==='proposed','UNAVAILABLE');
   check(p.capabilityDigest===digest(r.capabilities)&&p.policyVersion===r.policyVersion&&p.policyDigest===r.policyDigest&&LANGUAGES.includes(p.language),'EXACT_ACKNOWLEDGEMENT_REQUIRED');
   exactPolicy(s.policies[r.policyVersion],'participation',p.policyVersion,p.policyDigest);
   check(!s.acknowledgements[r.id],'IMMUTABLE_ACKNOWLEDGEMENT');
   s.acknowledgements[r.id]={providerId:actor,readinessId:r.id,...p,at:new Date(s.now).toISOString()};r.state='acknowledged';
  } else {
   record(p,[]);check(s.staff.includes(actor)&&actor!==r.providerId,'STAFF_REQUIRED');
   if(c.action==='enable_readiness') {
    check(r.state==='acknowledged','INVALID_STATE');r.state='enabled';
    // Check identity/acknowledgement with one declared capability as a witness.
    const pair=r.capabilities.directions[0];
    this.#eligible(s,{scope:{service:r.capabilities.services[0],...pair},customerId:null},r);
    for(const other of Object.values(s.readiness)) if(other.id!==r.id&&other.providerId===r.providerId&&other.state==='enabled') {
     other.state='closed';other.revision++;
     s.events.push({id:randomUUID(),aggregateId:other.id,revision:other.revision,actorId:actor,kind:'readiness_replaced',at:new Date(s.now).toISOString()});
    }
   } else {check(['proposed','acknowledged','enabled'].includes(r.state),'INVALID_STATE');r.state='closed';}
  }
 }
 #request(s,q,actor,c) {
  const p=c.payload,owner=()=>check(s.staff.includes(actor)&&q.ownerId===actor,'STAFF_OWNER_REQUIRED');
  const customer=()=>check(q.customerId===actor,'CUSTOMER_REQUIRED');
  const open=()=>check(q.state==='open','INVALID_STATE');
  const end=()=>{if(q.assignment&&['invited','accepted'].includes(q.assignment.state)) q.assignment.state='ended';for(const o of q.offers) if(o.state==='offered') o.state='withdrawn';};
  const current=()=>{const o=q.offers.find(o=>o.id===p.offerId);check(o?.state==='offered'&&q.assignment?.state==='accepted'&&o.assignmentId===q.assignment.id&&o.scopeVersion===q.scopeVersion,'OFFER_UNAVAILABLE');return o;};
  switch(c.action) {
   case 'claim_request':
    record(p,[]);open();check(s.staff.includes(actor)&&!q.ownerId,'STAFF_REQUIRED');q.ownerId=actor;break;
   case 'transfer_owner':
    record(p,['ownerId']);open();owner();check(s.staff.includes(p.ownerId),'STAFF_REQUIRED');q.ownerId=p.ownerId;break;
   case 'invite_provider': {
    record(p,['readinessId']);open();owner();const r=s.readiness[p.readinessId];check(r,'PROVIDER_INELIGIBLE');this.#eligible(s,q,r);end();
    if(q.assignment) q.assignmentHistory.push(q.assignment);
    q.assignment={id:randomUUID(),providerId:r.providerId,readinessId:r.id,scopeVersion:q.scopeVersion,state:'invited'};break;
   }
   case 'respond_assignment': {
    record(p,['assignmentId','response']);open();const a=q.assignment;
    check(a?.id===p.assignmentId&&a.providerId===actor&&a.state==='invited'&&a.scopeVersion===q.scopeVersion,'UNAVAILABLE');
    check(['accepted','declined'].includes(p.response));this.#eligible(s,q,s.readiness[a.readinessId]);a.state=p.response;break;
   }
   case 'revise_scope': {
    record(p,['scope']);open();customer();const next=scope(p.scope);end();q.scope=next;q.scopeVersion++;q.scopeHistory.push({version:q.scopeVersion,scope:next,authorId:actor,digest:digest(next)});
    if(q.assignment) {
     const old=q.assignment;q.assignmentHistory.push(old);q.assignment=null;
     if(providerEligible(this.#context(s,s.readiness[old.readinessId]),next,q.customerId)) q.assignment={id:randomUUID(),providerId:old.providerId,readinessId:old.readinessId,scopeVersion:q.scopeVersion,state:'invited'};
    }break;
   }
   case 'issue_offer': {
    record(p,['assignmentId','content']);open();const a=q.assignment;
    check(a?.id===p.assignmentId&&a.providerId===actor&&a.state==='accepted'&&a.scopeVersion===q.scopeVersion,'UNAVAILABLE');
    const r=s.readiness[a.readinessId];this.#eligible(s,q,r);const content=offerContent(p.content,s.now);
    exactPolicy(s.policies[content.policyVersion],'acceptance',content.policyVersion,content.policyDigest);
    check(r.capabilities.currencies.includes(content.total.currency),'INVALID_CURRENCY');
    for(const old of q.offers) if(old.state==='offered') old.state='superseded';
    const immutable={id:randomUUID(),assignmentId:a.id,providerId:actor,version:q.offers.length+1,scopeVersion:q.scopeVersion,content};
    q.offers.push({...immutable,digest:digest(immutable),state:'offered'});break;
   }
   case 'accept_offer': {
    record(p,['offerId','offerDigest','policyVersion','policyDigest','language']);open();customer();const o=current();
    check(o.digest===p.offerDigest&&o.content.policyVersion===p.policyVersion&&o.content.policyDigest===p.policyDigest&&LANGUAGES.includes(p.language),'EXACT_ACCEPTANCE_REQUIRED');
    check(Date.parse(o.content.expiresAt)>s.now,'OFFER_EXPIRED');this.#eligible(s,q,s.readiness[q.assignment.readinessId]);
    exactPolicy(s.policies[p.policyVersion],'acceptance',p.policyVersion,p.policyDigest);
    check(!q.acceptance,'ALREADY_ACCEPTED');o.state='accepted';q.acceptance={...p,actorId:actor,at:new Date(s.now).toISOString()};q.state='accepted_pending_activation';break;
   }
   case 'decline_offer':
    record(p,['offerId']);open();customer();current().state='declined';break;
   case 'withdraw_offer':
    record(p,['offerId','reason']);open();text(p.reason,2000);{const o=current();if(actor!==o.providerId) owner();o.state='withdrawn';}break;
   case 'revoke_assignment':
    record(p,['reason']);open();owner();text(p.reason,2000);end();if(q.assignment) q.assignment.state='revoked';break;
   case 'cancel_request':
    record(p,['reason','communication']);check(['open','accepted_pending_activation'].includes(q.state),'INVALID_STATE');text(p.reason,2000);
    if(q.customerId!==actor) {owner();text(p.communication,2000);}end();q.state='cancelled';break;
   case 'close_unfulfilled':
    record(p,['reason']);open();owner();text(p.reason,2000);end();q.state='closed_unfulfilled';break;
   default: throw new Error('UNSUPPORTED_COMMAND');
  }
 }
}

export const ids=Object.freeze(Object.fromEntries(['customer','provider','staff','outsider','application','readiness','request','intake','approval','replacement','fixtureApplication'].map((k,i)=>[k,`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`])));
export function seed() {
 const users=Object.fromEntries(['customer','provider','staff','outsider','replacement'].map(k=>[ids[k],{id:ids[k],email:`${k}@fixture.invalid`,email_confirmed_at:'2026-11-13T00:00:00.000Z',is_anonymous:false}]));
 const requestScope=scope({service:'Document Translation',source:'English',target:'French',description:'Synthetic fixture scope only.'});
 const participation={kind:'participation',version:'fixture-participation-v1',digest:digest('Synthetic participation wording'),approvedAt:'2026-11-13T00:00:00.000Z'};
 const acceptance={kind:'acceptance',version:'fixture-acceptance-v1',digest:digest('Synthetic acceptance wording'),approvedAt:'2026-11-13T00:00:00.000Z'};
 return {now:Date.parse('2026-11-13T12:00:00.000Z'),settings:{capture:false,commands:true,notifications:false},users,staff:[ids.staff],applications:{[ids.application]:{id:ids.application,user_id:ids.provider,email:users[ids.provider].email,status:'approved',category:'translation',revision:3,is_test:false}},approvalEvents:{[ids.approval]:{id:ids.approval,application_id:ids.application,kind:'approved'}},readiness:{[ids.readiness]:{id:ids.readiness,revision:1,state:'draft',applicationId:ids.application,providerId:ids.provider,approvalEventId:ids.approval}},acknowledgements:{},policies:{[participation.version]:participation,[acceptance.version]:acceptance},vendorFixtureIds:[],learningExclusions:[],translationExclusions:[],quoteTestUsers:[],commands:{},events:[],deliveries:[],requests:{[ids.request]:{id:ids.request,intakeId:ids.intake,customerId:ids.customer,ownerId:null,state:'open',revision:1,scopeVersion:1,scope:requestScope,scopeHistory:[{version:1,scope:requestScope,authorId:ids.customer,digest:digest(requestScope)}],assignment:null,assignmentHistory:[],offers:[],acceptance:null,classification:'test',internalNotes:'Fixture internal note'}}};
}
export const fixtureCapabilities={services:['Document Translation'],directions:[{source:'English',target:'French'}],currencies:['MAD','JPY','KWD'],availability:'Synthetic fixture only',specialAssessment:'No certified or interpretation capability'};
