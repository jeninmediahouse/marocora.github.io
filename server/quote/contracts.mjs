// Pure, disconnected contracts. No Auth, database, network, or mail adapter.
import {createHash} from 'node:crypto';
import {currencies} from '../../learn/currencies.mjs';
import {translationServices} from '../../translation-validation.mjs';

export const MAX_MINOR = 999_999_999_999; // Same bound in the SQL draft; positive offers only.
export const SWITCHES = Object.freeze({capture:false, commands:false, notifications:false});
export const LANGUAGES = Object.freeze(['en','fr','ar','es']);
export function requireThat(condition, code='INVALID_INPUT') { if (!condition) throw new Error(code); }
export function record(value, keys) {
 requireThat(value && Object.getPrototypeOf(value)===Object.prototype && Object.keys(value).every(k=>keys.includes(k)));
 return value;
}
export function text(value, max=8000) {
 requireThat(typeof value==='string' && value.trim().length>0 && value.length<=max && !value.includes('\0'));
 return value.trim().normalize('NFC');
}
export function integer(value, min=1, max=MAX_MINOR) {
 requireThat(Number.isSafeInteger(value) && value>=min && value<=max); return value;
}
export function uuid(value) {
 requireThat(typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
 return value.toLowerCase();
}
export function instant(value) {
 requireThat(typeof value==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value));
 requireThat(Number.isFinite(Date.parse(value)) && new Date(value).toISOString()===value); return value;
}
export function canonical(value) {
 if(value===null || typeof value==='boolean' || typeof value==='string') return JSON.stringify(value);
 if(typeof value==='number') { requireThat(Number.isSafeInteger(value)); return JSON.stringify(value); }
 if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
 requireThat(value && Object.getPrototypeOf(value)===Object.prototype);
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
export const digest = value=>createHash('sha256').update(canonical(value)).digest('hex');
export function money(value, {budget=false}={}) {
 record(value,['minor','currency']);
 requireThat(typeof value.currency==='string' && Object.hasOwn(currencies,value.currency),'INVALID_CURRENCY');
 return {minor:integer(value.minor,budget?0:1),currency:value.currency,digits:currencies[value.currency].digits};
}
export function scope(value) {
 record(value,['service','source','target','description','budget','interpretation','certified']);
 requireThat(translationServices.includes(value.service),'INVALID_SERVICE');
 const source=text(value.source,100),target=text(value.target,100);
 const norm=s=>s.normalize('NFKC').toLowerCase();
 requireThat(norm(source)!==norm(target) && ![source,target].some(s=>norm(s)==='other'),'INVALID_LANGUAGE_PAIR');
 const result={service:value.service,source,target,description:text(value.description)};
 if(value.budget!==undefined) {const {minor,currency}=money(value.budget,{budget:true});result.budget={minor,currency};}
 if(value.service==='Interpretation') {
  const i=record(value.interpretation,['mode','location','startsAt','timeZone','durationMinutes']);
  requireThat(['remote','in_person'].includes(i.mode));
  const timeZone=text(i.timeZone,100);
  requireThat(timeZone==='UTC'||timeZone.includes('/'),'INVALID_TIME_ZONE');
  try {new Intl.DateTimeFormat('en',{timeZone}).format(0);} catch {throw new Error('INVALID_TIME_ZONE');}
  result.interpretation={mode:i.mode,location:text(i.location,500),startsAt:instant(i.startsAt),timeZone,durationMinutes:integer(i.durationMinutes,1,1440)};
 } else requireThat(value.interpretation===undefined);
 if(value.service==='Certified / Sworn Translation') {
  const c=record(value.certified,['receivingAuthority','jurisdiction','requirements']);
  result.certified={receivingAuthority:text(c.receivingAuthority,500),jurisdiction:text(c.jurisdiction,200),requirements:text(c.requirements,2000)};
 } else requireThat(value.certified===undefined);
 return result;
}
export function capabilities(value) {
 record(value,['services','directions','currencies','availability','specialAssessment']);
 requireThat(Array.isArray(value.services)&&value.services.length>0&&value.services.length<=translationServices.length&&value.services.every(s=>translationServices.includes(s)));
 requireThat(Array.isArray(value.directions)&&value.directions.length>0&&value.directions.length<=50);
 const directions=value.directions.map(d=>{record(d,['source','target']);const source=text(d.source,100),target=text(d.target,100);requireThat(source.toLowerCase()!==target.toLowerCase());return {source,target};});
 requireThat(Array.isArray(value.currencies)&&value.currencies.length>0&&value.currencies.length<=20&&value.currencies.every(c=>Object.hasOwn(currencies,c)));
 return {services:[...new Set(value.services)].sort(),directions:directions.sort((a,b)=>canonical(a)<canonical(b)?-1:canonical(a)>canonical(b)?1:0),currencies:[...new Set(value.currencies)].sort(),availability:text(value.availability,1000),specialAssessment:text(value.specialAssessment,2000)};
}
export function offerContent(value, now) {
 record(value,['scope','exclusions','total','turnaround','revisions','expiresAt','policyVersion','policyDigest','taxTreatment','chargesIncluded']);
 const expiresAt=instant(value.expiresAt);
 requireThat(Date.parse(expiresAt)>now,'OFFER_EXPIRED');
 requireThat(value.chargesIncluded===true,'TOTAL_MUST_INCLUDE_CHARGES');
 requireThat(/^[0-9a-f]{64}$/.test(value.policyDigest),'INVALID_POLICY');
 return {scope:text(value.scope),exclusions:text(value.exclusions),total:money(value.total),turnaround:text(value.turnaround,2000),revisions:integer(value.revisions,0,100),expiresAt,policyVersion:text(value.policyVersion,100),policyDigest:value.policyDigest,taxTreatment:text(value.taxTreatment,1000),chargesIncluded:true};
}
export function verified(user) {
 return !!(user?.id && user.email && user.email_confirmed_at && user.is_anonymous===false);
}
// Context MUST be assembled from authoritative stored rows, never command JSON.
export function providerEligible({application:a,user:u,readiness:r,acknowledgement:ack,policy,approvalEvent,excludedApplicationIds=[],excludedUserIds=[]}, requestScope, customerId) {
 if(!a||!r||!verified(u)||a.user_id!==u.id||a.status!=='approved'||a.category!=='translation'||a.email.toLowerCase()!==u.email.toLowerCase()||a.is_test!==false) return false;
 if(excludedApplicationIds.includes(a.id)||excludedUserIds.includes(u.id)||u.id===customerId) return false;
 if(r.applicationId!==a.id||r.applicationRevision!==a.revision||r.providerId!==u.id||r.state!=='enabled'||r.reviewerId===u.id) return false;
 if(!approvalEvent||approvalEvent.id!==r.approvalEventId||approvalEvent.application_id!==a.id||approvalEvent.kind!=='approved') return false;
 if(!ack||ack.providerId!==u.id||ack.readinessId!==r.id||ack.capabilityDigest!==digest(r.capabilities)||ack.policyDigest!==r.policyDigest||ack.policyVersion!==r.policyVersion) return false;
 if(!policy?.approvedAt||policy.kind!=='participation'||policy.version!==r.policyVersion||policy.digest!==r.policyDigest) return false;
 const c=r.capabilities;
 return c.services.includes(requestScope.service)&&c.directions.some(d=>d.source===requestScope.source&&d.target===requestScope.target);
}
export function command(value) {
 record(value,['commandId','action','targetId','expectedRevision','payload']);
 const result={commandId:uuid(value.commandId),action:text(value.action,80),targetId:uuid(value.targetId),expectedRevision:integer(value.expectedRevision),payload:value.payload};
 requireThat(canonical(result).length<=40000,'REQUEST_TOO_LARGE'); return result;
}
export function exactPolicy(policy,kind,version,hash) {
 requireThat(policy?.approvedAt && policy.kind===kind && policy.version===version && policy.digest===hash,'POLICY_NOT_APPROVED');
}
export function visibleRequest(state,requestId,actorId) {
 const r=state.requests[requestId],u=state.users[actorId];
 requireThat(verified(u),'UNAVAILABLE');
 const a=r?.assignment;
 const role=state.staff.includes(actorId)?'staff':r?.customerId===actorId?'customer':a?.providerId===actorId&&['invited','accepted'].includes(a.state)?'provider':null;
 requireThat(r&&role,'UNAVAILABLE');
 const base={id:r.id,state:r.state,revision:r.revision,scopeVersion:r.scopeVersion};
 if(role==='provider'&&a.state==='invited') return {...base,role,invitation:{id:a.id,scopeVersion:a.scopeVersion},service:r.scope.service,source:r.scope.source,target:r.scope.target};
 const offers=r.offers.filter(o=>role!=='provider'||o.assignmentId===a.id).map(o=>({...o,state:o.state==='offered'&&Date.parse(o.content.expiresAt)<=state.now?'expired':o.state}));
 return {...base,role,scope:r.scope,offers,acceptance:r.acceptance,...(role==='staff'?{intakeId:r.intakeId,ownerId:r.ownerId,classification:r.classification,internalNotes:r.internalNotes}:{} )};
}
