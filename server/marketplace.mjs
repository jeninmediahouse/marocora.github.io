import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DomainError } from './errors.mjs';
import { normalizeInstructorDraft, requireCompleteInstructorDraft } from './instructor-draft.mjs';
export { DomainError } from './errors.mjs';
const fail = (code,status) => { throw new DomainError(code,status); };
const parse = JSON.parse;
const json = JSON.stringify;
const requireText = (value,max=2000) => typeof value === 'string' && value.trim().length && value.length <= max ? value.trim() : fail('INVALID_TEXT');
const utcInstant = value => {
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) fail('INVALID_SLOT');
  const time=Date.parse(value);
  if(!Number.isFinite(time) || ![new Date(time).toISOString(),new Date(time).toISOString().replace('.000Z','Z')].includes(value)) fail('INVALID_SLOT');
  return time;
};
export class Marketplace {
 constructor(filename=':memory:', { clock=Date.now, fees=null, payments=null, notifications=null, holdMinutes=15 }={}) {
  this.db = new DatabaseSync(filename); this.db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  this.db.exec('PRAGMA busy_timeout=5000');
  this.clock=clock; this.fees=fees; this.payments=payments; this.notifications=notifications; this.holdMinutes=holdMinutes;
 }
 close() { this.db.close(); }
 one(sql,...args) { return this.db.prepare(sql).get(...args); }
 all(sql,...args) { return this.db.prepare(sql).all(...args); }
 run(sql,...args) { return this.db.prepare(sql).run(...args); }
 tx(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const result=fn(); this.db.exec('COMMIT'); return result; } catch(error) { this.db.exec('ROLLBACK'); throw error; } }
 account(id,role) { const actor=this.one('SELECT * FROM accounts WHERE id=?',id || ''); if(!actor) fail('AUTH_REQUIRED',401); if(role && actor.role!==role) fail('FORBIDDEN',403); return actor; }
 // Called by trusted provisioning tooling, never exposed as public HTTP mutations.
 addAccount(account) { this.run('INSERT INTO accounts(id,role,auth_subject,locale) VALUES(?,?,?,?)',account.id,account.role,account.authSubject,account.locale || 'en'); }
 // Call only after a sign-in adapter has verified the provider subject.
 provisionInstructorAccount(authSubject, locale='en') {
  if(typeof authSubject!=='string' || !authSubject.trim() || authSubject.length>255) fail('INVALID_AUTH_SUBJECT');
  if(!['en','fr'].includes(locale)) fail('INVALID_LOCALE');
  return this.tx(()=> {
   const existing=this.one('SELECT id,role FROM accounts WHERE auth_subject=?',authSubject);
   if(existing) {
    if(existing.role!=='instructor') fail('ACCOUNT_ROLE_CONFLICT',409);
    return {id:existing.id,role:existing.role,created:false};
   }
   const id=randomUUID();
   this.addAccount({id,role:'instructor',authSubject,locale});
   return {id,role:'instructor',created:true};
  });
 }
 instructorDraft(accountId) {
  this.account(accountId,'instructor');
  const row=this.one('SELECT data,status,revision,submitted_at,updated_at FROM instructor_drafts WHERE account_id=?',accountId);
  return row ? { data:parse(row.data),status:row.status,revision:row.revision,submittedAt:row.submitted_at,updatedAt:row.updated_at } : null;
 }
 saveInstructorDraft(accountId,input) {
  this.account(accountId,'instructor');
  const draft=normalizeInstructorDraft(input);
  this.run(`INSERT INTO instructor_drafts(account_id,data,status,updated_at) VALUES(?,?,'draft',?)
    ON CONFLICT(account_id) DO UPDATE SET data=excluded.data,status='draft',revision=revision+1,submitted_at=NULL,updated_at=excluded.updated_at`,
    accountId,json(draft),this.clock());
  return this.instructorDraft(accountId);
 }
 submitInstructorDraft(accountId) {
  this.account(accountId,'instructor');
  return this.tx(()=> {
   const row=this.instructorDraft(accountId);
   if(!row) fail('INSTRUCTOR_DRAFT_NOT_FOUND',404);
   requireCompleteInstructorDraft(row.data);
   if(row.status!=='submitted') this.run("UPDATE instructor_drafts SET status='submitted',submitted_at=?,updated_at=? WHERE account_id=?",this.clock(),this.clock(),accountId);
   return this.instructorDraft(accountId);
  });
 }
 importCatalog(catalog) {
  this.tx(() => {
   for(const c of catalog.categories) this.run('INSERT INTO categories VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',c.id,json(c));
   for(const s of catalog.subjects) this.run('INSERT INTO subjects VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',s.id,s.categoryId,json(s));
   for(const s of catalog.specialties) this.run('INSERT INTO specialties VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',s.id,json(s));
   for(const i of catalog.instructors) {
    this.run('INSERT INTO instructors VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,account_id=excluded.account_id',i.id,i.accountId || null,json(i));
    for(const s of i.subjects) this.run('INSERT INTO instructor_subjects VALUES(?,?,?,?,?) ON CONFLICT(instructor_id,subject_id) DO UPDATE SET approval=excluded.approval,qualifications=excluded.qualifications,metadata=excluded.metadata',i.id,s.subjectId,s.approval,json(s.qualifications),json(s.categoryMetadata || {}));
   }
   for(const o of catalog.offerings) {
    if(!Number.isSafeInteger(o.priceMinor) || o.priceMinor<0 || !Number.isInteger(o.durationMinutes) || o.durationMinutes<=0) fail('INVALID_OFFERING');
    this.run('INSERT INTO offerings VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET policy_id=excluded.policy_id,data=excluded.data',o.id,o.instructorId,o.subjectId,o.policyId || null,json(o));
   }
  });
 }
 addPolicy(p) { this.run('INSERT INTO policies VALUES(?,?,?,?)',p.id,p.version,p.approved ? 1:0,json(p)); }
 addSlot(s) {
  const start=utcInstant(s.startsAt),end=utcInstant(s.endsAt); if(end<=start) fail('INVALID_SLOT');
  new Intl.DateTimeFormat('en',{timeZone:s.timezone});
  this.tx(() => { this.run('INSERT INTO slots(id,instructor_id,starts_at,ends_at,timezone) VALUES(?,?,?,?,?)',s.id,s.instructorId,start,end,s.timezone); for(const offeringId of s.offeringIds) { const o=this.one('SELECT * FROM offerings WHERE id=?',offeringId); if(o?.instructor_id!==s.instructorId || parse(o.data).durationMinutes*60000>end-start) fail('INVALID_SLOT_OFFERING'); this.run('INSERT INTO slot_offerings VALUES(?,?)',s.id,offeringId); } });
 }
 publishedSubject(subjectId) {
  const subject=this.one('SELECT data,category_id FROM subjects WHERE id=?',subjectId || '');
  if(!subject || parse(subject.data).active===false) return false;
  const category=this.one('SELECT data FROM categories WHERE id=?',subject.category_id);
  return !!category && parse(category.data).active===true;
 }
 expire() { this.run("UPDATE bookings SET status='expired' WHERE status='held' AND expires_at<=?",this.clock()); }
 overlapping(instructor,start,end) { return this.one("SELECT id FROM bookings WHERE instructor_id=? AND starts_at<? AND ends_at>? AND (status IN ('confirmed','completed') OR (status='held' AND expires_at>?))",instructor,end,start,this.clock()); }
 slots(instructorId) {
  if(!this.fees?.approved || !this.payments) return [];
  const record=this.one('SELECT data FROM instructors WHERE id=?',instructorId);
  if(!record || parse(record.data).status!=='active') return [];
  return this.all('SELECT * FROM slots WHERE instructor_id=? AND active=1 AND starts_at>? ORDER BY starts_at',instructorId,this.clock()).filter(s => !this.overlapping(instructorId,s.starts_at,s.ends_at)).flatMap(s => {
   const offeringIds=this.all(`SELECT o.id,o.data FROM slot_offerings so JOIN offerings o ON o.id=so.offering_id
     JOIN instructor_subjects i ON i.instructor_id=o.instructor_id AND i.subject_id=o.subject_id
     JOIN policies p ON p.id=o.policy_id WHERE so.slot_id=? AND i.approval='approved' AND p.approved=1`,s.id)
     .filter(r => { const o=parse(r.data); return this.publishedSubject(o.subjectId) && o.active && o.bookingEnabled && o.lessonCount===1 && o.deliveryMode==='online' && o.durationMinutes*60000<=s.ends_at-s.starts_at; })
     .map(r=>r.id);
   return offeringIds.length ? [{id:s.id,instructorId,startsAt:new Date(s.starts_at).toISOString(),endsAt:new Date(s.ends_at).toISOString(),timezone:s.timezone,offeringIds}] : [];
  });
 }
 quote({offeringId,slotId}) {
  if(!this.fees?.approved || !this.payments) fail('CHECKOUT_NOT_CONFIGURED',503);
  const record=this.one('SELECT * FROM offerings WHERE id=?',offeringId || ''); if(!record) fail('OFFERING_NOT_FOUND',404);
  const o=parse(record.data); const instructor=parse(this.one('SELECT data FROM instructors WHERE id=?',o.instructorId).data);
  const approval=this.one('SELECT approval FROM instructor_subjects WHERE instructor_id=? AND subject_id=?',o.instructorId,o.subjectId);
  if(!o.active || !o.bookingEnabled || !this.publishedSubject(o.subjectId) || instructor.status!=='active' || approval?.approval!=='approved') fail('OFFERING_NOT_BOOKABLE',409);
  // Packages require a multi-lesson allocation policy before activation.
  if(o.lessonCount!==1 || o.deliveryMode!=='online') fail('OFFERING_NOT_ENABLED',409);
  const slot=this.one('SELECT * FROM slots WHERE id=? AND active=1',slotId || '');
  if(!slot || slot.instructor_id!==o.instructorId || slot.starts_at<=this.clock() || o.durationMinutes*60000>slot.ends_at-slot.starts_at || !this.one('SELECT 1 FROM slot_offerings WHERE slot_id=? AND offering_id=?',slot.id,o.id)) fail('SLOT_UNAVAILABLE',409);
  if(this.overlapping(o.instructorId,slot.starts_at,slot.ends_at)) fail('SLOT_UNAVAILABLE',409);
  const policy=this.one('SELECT * FROM policies WHERE id=? AND approved=1',record.policy_id);
  if(!policy) fail('POLICY_NOT_APPROVED',503);
  const feeResult=this.fees.calculate(o);
  const subtotal=o.priceMinor; const {fee,tax,discount}=feeResult;
  if(![fee,tax,discount].every(n=>Number.isSafeInteger(n)&&n>=0) || discount>subtotal+fee+tax) fail('INVALID_PRICE_CONFIGURATION',503);
  const total=subtotal+fee+tax-discount;
  if(!Number.isSafeInteger(total)) fail('INVALID_TOTAL',503);
  return {subtotal,fee,tax,discount,total,currency:o.currency,feeVersion:this.fees.version,policy:parse(policy.data),slot:{id:slot.id,startsAt:new Date(slot.starts_at).toISOString(),endsAt:new Date(slot.ends_at).toISOString(),timezone:slot.timezone},offering:o};
 }
 reserve(studentId,input) {
  this.account(studentId,'student'); requireText(input.idempotencyKey,120); const goal=requireText(input.goal);
  if(input.policyAccepted!==true) fail('POLICY_ACCEPTANCE_REQUIRED');
  try { new Intl.DateTimeFormat('en',{timeZone:input.timezone}); } catch { fail('INVALID_TIMEZONE'); }
  return this.tx(() => {
   this.expire(); const prior=this.one('SELECT * FROM bookings WHERE student_id=? AND idempotency_key=?',studentId,input.idempotencyKey);
   if(prior) { if(prior.offering_id!==input.offeringId || prior.slot_id!==input.slotId || prior.goal!==goal) fail('IDEMPOTENCY_CONFLICT',409); return prior; }
   const q=this.quote(input); if(q.policy.version!==input.policyVersion) fail('POLICY_CHANGED',409);
   // Free introduction is retained; eligibility must be explicitly configured server-side.
   if(q.total===0 && !this.fees.freeIntroEligibility?.(studentId,q.offering,this)) fail('INTRO_ELIGIBILITY_NOT_CONFIGURED',503);
   const id=randomUUID(), now=this.clock();
   this.run(`INSERT INTO bookings(id,student_id,instructor_id,offering_id,slot_id,status,starts_at,ends_at,expires_at,goal,timezone,locale,quote,policy_snapshot,offering_snapshot,idempotency_key,created_at) VALUES(?,?,?,?,?,'held',?,?,?,?,?,?,?,?,?,?,?)`,id,studentId,q.offering.instructorId,input.offeringId,input.slotId,Date.parse(q.slot.startsAt),Date.parse(q.slot.startsAt)+q.offering.durationMinutes*60000,now+this.holdMinutes*60000,goal,input.timezone,input.locale==='fr'?'fr':'en',json(q),json(q.policy),json(q.offering),input.idempotencyKey,now);
   this.event(id,'reservation_created',{},studentId);
   return this.one('SELECT * FROM bookings WHERE id=?',id);
  });
 }
 event(id,kind,data={},actor=null) { this.run('INSERT INTO booking_events VALUES(?,?,?,?,?,?)',randomUUID(),id,actor,kind,json(data),this.clock()); }
 async checkout(studentId,input) {
  const b=this.reserve(studentId,input); if(b.status==='confirmed') return {bookingId:b.id};
  if(b.status!=='held') fail('RESERVATION_EXPIRED',409);
  const q=parse(b.quote);
  if(q.total===0) { this.tx(()=>this.confirm(b)); return {bookingId:b.id}; }
  // Provider must use booking ID as its idempotency key and honor expiration.
  // On network uncertainty keep the hold until expiration; do not free a potentially paid slot.
  const session=await this.payments.createCheckout({bookingId:b.id,idempotencyKey:b.id,amountMinor:q.total,currency:q.currency,expiresAt:b.expires_at,locale:b.locale});
  if(!session?.id || !/^https:\/\//.test(session.url)) fail('INVALID_PAYMENT_SESSION',502);
  this.run('UPDATE bookings SET provider_session=? WHERE id=?',session.id,b.id);
  return {bookingId:b.id,redirectURL:session.url};
 }
 confirm(b) {
  this.run("UPDATE bookings SET status='confirmed' WHERE id=?",b.id); this.event(b.id,'booking_confirmed');
  const instructor=this.one('SELECT account_id FROM instructors WHERE id=?',b.instructor_id);
  for(const id of [b.student_id,instructor.account_id].filter(Boolean)) { const account=this.account(id); this.run('INSERT OR IGNORE INTO outbox(id,booking_id,recipient_id,kind,locale) VALUES(?,?,?,?,?)',randomUUID(),b.id,id,'booking_confirmed',account.locale); }
  this.run('INSERT OR IGNORE INTO payouts(id,booking_id,instructor_id) VALUES(?,?,?)',randomUUID(),b.id,b.instructor_id);
 }
 // Only the payment adapter may call this after verifying the raw webhook signature.
 applyVerifiedPayment(event) {
  if(!['paid','failed'].includes(event.kind) || !event.id || !event.bookingId || !event.sessionId) fail('INVALID_PAYMENT_EVENT');
  return this.tx(()=> {
   if(this.one('SELECT 1 FROM payment_events WHERE provider_event_id=?',event.id)) return {duplicate:true};
   const b=this.one('SELECT * FROM bookings WHERE id=?',event.bookingId); if(!b) fail('BOOKING_NOT_FOUND',404);
   const q=parse(b.quote);
   if(event.sessionId!==b.provider_session || event.amountMinor!==q.total || event.currency!==q.currency || (event.kind==='paid' && !event.transactionId)) fail('PAYMENT_MISMATCH',409);
   if(event.kind==='paid') {
    const prior=this.one("SELECT booking_id FROM payment_events WHERE transaction_id=? AND kind='paid'",event.transactionId);
    if(prior) {
     if(prior.booking_id!==b.id) fail('PAYMENT_MISMATCH',409);
     return {duplicate:true,status:b.status};
    }
   }
   this.run('INSERT INTO payment_events VALUES(?,?,?,?,?,?,?)',event.id,b.id,event.kind,event.amountMinor,event.currency,event.transactionId || null,this.clock());
   if(event.kind==='failed') {
    if(b.status==='held') this.run("UPDATE bookings SET status='payment_failed' WHERE id=?",b.id);
    this.event(b.id,'payment_failure_received');
    return {status:b.status==='held'?'payment_failed':b.status};
   }
   if(b.status==='held' && b.expires_at>this.clock()) { this.confirm(b); return {status:'confirmed'}; }
   // Late money is real, but must never displace another student's reservation.
   this.run("UPDATE bookings SET status='reconciliation' WHERE id=? AND status NOT IN ('confirmed','completed')",b.id);
   this.event(b.id,'payment_requires_reconciliation',{transactionId:event.transactionId});
   return ['confirmed','completed'].includes(b.status)
    ? {status:b.status,reconciliationRequired:true}
    : {status:'reconciliation',reconciliationRequired:true};
  });
 }
 booking(actorId,id) {
  const actor=this.account(actorId); const b=this.one('SELECT * FROM bookings WHERE id=?',id || ''); if(!b) fail('BOOKING_NOT_FOUND',404);
  const instructor=this.one('SELECT account_id FROM instructors WHERE id=?',b.instructor_id);
  if(actor.id!==b.student_id && actor.id!==instructor.account_id && actor.role!=='admin') fail('FORBIDDEN',403);
  return {id:b.id,status:b.status,startsAt:new Date(b.starts_at).toISOString(),goal:b.goal,timezone:b.timezone,quote:parse(b.quote),reviewEligible:actor.id===b.student_id && this.reviewEligible(b)};
 }
 reviewEligible(b) { return b.status==='completed' && !!this.one("SELECT 1 FROM payment_events WHERE booking_id=? AND kind='paid'",b.id) && !this.one('SELECT 1 FROM reviews WHERE booking_id=?',b.id); }
 complete(adminId,id) { this.account(adminId,'admin'); return this.tx(()=> { const b=this.one('SELECT * FROM bookings WHERE id=?',id); if(!b || b.status!=='confirmed' || b.ends_at>this.clock()) fail('LESSON_NOT_COMPLETABLE',409); this.run("UPDATE bookings SET status='completed' WHERE id=?",id); this.event(id,'lesson_completed',{},adminId); }); }
 review(studentId,{bookingId,rating,body}) {
  this.account(studentId,'student'); body=requireText(body,4000); if(!Number.isInteger(rating)||rating<1||rating>5) fail('INVALID_RATING');
  return this.tx(()=> { const b=this.one('SELECT * FROM bookings WHERE id=?',bookingId); if(!b || b.student_id!==studentId) fail('FORBIDDEN',403); if(!this.reviewEligible(b)) fail('REVIEW_NOT_ELIGIBLE',409); const id=randomUUID(); this.run('INSERT INTO reviews(id,booking_id,student_id,instructor_id,rating,body,created_at) VALUES(?,?,?,?,?,?,?)',id,b.id,studentId,b.instructor_id,rating,body,this.clock()); return {id,moderation:'pending'}; });
 }
 reply(actorId,{reviewId,body}) {
  this.account(actorId,'instructor'); body=requireText(body,4000);
  return this.tx(()=> { const r=this.one('SELECT r.* FROM reviews r JOIN instructors i ON i.id=r.instructor_id WHERE r.id=? AND i.account_id=?',reviewId,actorId); if(!r || r.moderation!=='published') fail('FORBIDDEN',403); if(this.one('SELECT 1 FROM review_replies WHERE review_id=?',reviewId)) fail('REPLY_EXISTS',409); const id=randomUUID(); this.run('INSERT INTO review_replies(id,review_id,instructor_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?)',id,r.id,r.instructor_id,body,this.clock(),this.clock()); return {id,moderation:'pending'}; });
 }
 moderate(adminId,kind,id,status) {
  this.account(adminId,'admin'); if(!['review','reply'].includes(kind) || !['published','hidden'].includes(status)) fail('INVALID_MODERATION');
  this.run(`UPDATE ${kind==='review'?'reviews':'review_replies'} SET moderation=? WHERE id=?`,status,id);
 }
 publicCatalog() {
  const result={}; for(const key of ['categories','subjects','specialties']) result[key]=this.all(`SELECT data FROM ${key}`).map(r=>parse(r.data));
  result.categories=result.categories.filter(c=>c.active===true);
  const categoryIds=new Set(result.categories.map(c=>c.id));
  result.subjects=result.subjects.filter(s=>s.active!==false && categoryIds.has(s.categoryId));
  const subjectIds=new Set(result.subjects.map(s=>s.id));
  result.specialties=result.specialties.filter(s=>s.subjectIds?.some(id=>subjectIds.has(id)));
  result.instructors=this.all('SELECT data FROM instructors').map(r=>parse(r.data)).filter(i=>['active','sample'].includes(i.status)).map(i=>{
   delete i.accountId;
   i.subjects=this.all('SELECT subject_id,approval,qualifications,metadata FROM instructor_subjects WHERE instructor_id=? AND approval=?',i.id,i.status==='sample'?'sample':'approved')
    .filter(s=>subjectIds.has(s.subject_id)).map(s=>({subjectId:s.subject_id,approval:s.approval,qualifications:parse(s.qualifications),categoryMetadata:parse(s.metadata)}));
   i.reviews=this.all("SELECT id,rating,body,created_at FROM reviews WHERE instructor_id=? AND moderation='published' ORDER BY created_at DESC",i.id).map(r=>({...r,reply:this.one("SELECT body,created_at,updated_at FROM review_replies WHERE review_id=? AND moderation='published'",r.id)||null}));
   const count=i.reviews.length; i.performance={...(i.performance || {}),reviewCount:count,rating:count ? i.reviews.reduce((n,r)=>n+r.rating,0)/count : null}; return i; });
  const published=new Map(result.instructors.map(i=>[i.id,new Set(i.subjects.map(s=>s.subjectId))]));
  result.offerings=this.all('SELECT data FROM offerings').map(r=>parse(r.data)).filter(o=>o.active && subjectIds.has(o.subjectId) && published.get(o.instructorId)?.has(o.subjectId));
  const offeredIds=new Set(result.offerings.map(o=>o.instructorId));
  result.instructors=result.instructors.filter(i=>offeredIds.has(i.id));
  return result;
 }
 async flushNotifications() {
  if(!this.notifications) fail('EMAIL_NOT_CONFIGURED',503);
  for(const message of this.all("SELECT * FROM outbox WHERE status='pending'")) {
   try { await this.notifications.send({...message,idempotencyKey:message.id,booking:this.booking(message.recipient_id,message.booking_id)}); this.run("UPDATE outbox SET status='sent',attempts=attempts+1,last_error=NULL WHERE id=?",message.id); }
   catch { this.run("UPDATE outbox SET attempts=attempts+1,last_error='DELIVERY_FAILED' WHERE id=?",message.id); }
  }
 }
}
