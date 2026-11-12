// Disposable local PostgreSQL test only; never bootstrap these fixture roles/users live.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);const db=new PGlite();
const staff='10000000-0000-4000-8000-000000000001',owner='10000000-0000-4000-8000-000000000002',other='10000000-0000-4000-8000-000000000003';
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.uid(),auth.role() to anon,authenticated,service_role;
insert into auth.users(id,email,email_confirmed_at) values('${staff}','staff@example.test',now()),('${owner}','owner@example.test',now()),('${other}','other@example.test',now());`);
for(const file of ['learning_instructor_drafts.sql','learning_staff_review.sql','service_intake.sql','vendor_workflow.sql','vendor_workflow_delivery.sql','vendor_workflow_reply_status.sql'])await db.exec(readFileSync(new URL('../supabase/'+file,import.meta.url),'utf8'));
await db.exec(`insert into public.learning_review_staff(user_id) values('${staff}');insert into public.service_intakes(id,user_id,email,email_verified_at,kind,fields,request_hash) values('20000000-0000-4000-8000-000000000001','${owner}','owner@example.test',now(),'network','{"full-name":"Driver Fixture","category":"transportation","email":"owner@example.test"}',repeat('a',64));`);
const id='20000000-0000-4000-8000-000000000001';let checks=0;
async function as(uid,role='authenticated'){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${uid}',false);select set_config('request.jwt.claim.role','${role}',false);set role ${role};`);}
async function fails(sql,match){await assert.rejects(()=>db.query(sql),match);checks++;}
await as(other);assert.equal((await db.query(`select public.vendor_my_applications()`)).rows[0].vendor_my_applications.length,0);checks++;
await fails(`select public.vendor_review_queue()`,/STAFF_REQUIRED/);
await fails(`select * from public.vendor_applications`,/permission denied/);
await fails(`select public.vendor_decide('${id}',1,'approved','Good','[]','[]',gen_random_uuid())`,/STAFF_REQUIRED/);
await as(staff);
await fails(`select public.vendor_decide('${id}',null,'approved','Good','[]','[]',gen_random_uuid())`,/INVALID_DECISION/);
await fails(`select public.vendor_decide('${id}',1,'needs_information','More please','[]','[]',gen_random_uuid())`,/QUESTIONS_REQUIRED/);
const command='30000000-0000-4000-8000-000000000001';
const decide=`select public.vendor_decide('${id}',1,'needs_information','Please provide experience','[{"id":"q1","label":"Relevant experience?"}]','[]','${command}')`;
await db.query(decide);await db.query(decide);checks+=2;
assert.equal((await db.query(`select public.vendor_review_queue('${id}')`)).rows[0].vendor_review_queue[0].history.length,1);checks++;
await fails(`select public.vendor_decide('${id}',1,'declined','No','[]','[]',gen_random_uuid())`,/STALE_REVISION/);
await as(other);await fails(`select public.vendor_reply('${id}',2,'{"q1":"None"}',gen_random_uuid())`,/APPLICATION_NOT_FOUND/);
await as(owner);await fails(`select public.vendor_reply('${id}',2,'{}',gen_random_uuid())`,/INVALID_ANSWERS/);
const replyCommand='30000000-0000-4000-8000-000000000002';
const replySQL=`select public.vendor_reply('${id}',2,'{"q1":"Five years"}','${replyCommand}')`;
await db.query(replySQL);await db.query(replySQL);checks+=2;
let a=(await db.query(`select public.vendor_my_applications('${id}')`)).rows[0].vendor_my_applications[0];assert.equal(a.status,'pending');assert.equal(a.message,'The requested additional information has been received. Your application is awaiting review.');assert.equal(a.history.length,2);checks++;
await as(staff);await db.query(`select public.vendor_decide('${id}',3,'approved','Welcome','[]','[]',gen_random_uuid())`);checks++;
await as(owner,'service_role');let claim=(await db.query(`select public.vendor_claim_mail('${id}','${owner}')`)).rows[0].vendor_claim_mail;assert.ok(claim);checks++;
await db.query(`select public.vendor_finish_mail('${claim.event.id}','sent')`);checks++;
await as(staff);a=(await db.query(`select public.vendor_review_queue('${id}')`)).rows[0].vendor_review_queue[0];assert.equal(a.status,'approved');assert.equal(a.history[0].delivery,'sent');checks++;
await db.exec('reset role');await db.exec(`update auth.users set email_confirmed_at=null where id='${owner}'`);
await as(staff);await fails(`select public.vendor_decide('${id}',4,'approved','Welcome','[]','[]',gen_random_uuid())`,/EMAIL_VERIFICATION_REQUIRED/);

// Teacher submission mirrors into the same queue and keeps existing review guards.
await db.exec('reset role');
await db.exec(`update auth.users set email_confirmed_at=now() where id='${owner}'`);
const draft={profile:{displayName:'Teacher Fixture',headline:'Fixture',bio:'Fixture only',countryOfResidence:'MA',timezone:'Africa/Casablanca'},subjects:[{category:'Languages',subject:'English',qualifications:'Fixture',offerings:[{title:'Fixture',currency:'MAD',priceMinor:5000,durationMinutes:30}]}]};
await db.query('insert into public.learning_instructor_drafts(user_id,data) values($1,$2)',[owner,draft]);
await as(owner);await db.query('select public.submit_learning_instructor_draft()');
a=(await db.query(`select public.vendor_my_applications()`)).rows[0].vendor_my_applications.find(a=>a.source==='teacher');assert.ok(a);assert.equal(a.history.length,1);checks++;
const subjects=[{category:'Languages',subject:'English',decision:'needs_changes'}];
await as(staff);await db.query('select public.vendor_decide($1,$2,$3,$4,$5,$6,$7)',[a.id,a.revision,'needs_information','Please clarify experience',[{id:'q1',label:'Teaching experience?'}],subjects,crypto.randomUUID()]);checks++;
await as(owner);await db.query('select public.vendor_reply($1,$2,$3,$4)',[a.id,a.revision+1,{q1:'Five years'},crypto.randomUUID()]);checks++;
await as(staff);subjects[0].decision='approved';await db.query('select public.vendor_decide($1,$2,$3,$4,$5,$6,$7)',[a.id,a.revision+2,'approved','Welcome',[],subjects,crypto.randomUUID()]);
a=(await db.query('select public.vendor_review_queue($1)',[a.id])).rows[0].vendor_review_queue[0];assert.equal(a.status,'approved');assert.equal(a.history.filter(h=>h.kind==='submitted').length,1);checks++;
const review=(await db.query('select public.learning_staff_review_queue()')).rows[0].learning_staff_review_queue.find(r=>r.user_id===owner);assert.equal(review.review.profile_decision,'approved');checks++;
await db.exec('reset role');await db.exec(`insert into public.learning_review_exclusions(user_id,reason) values('${owner}','fixture')`);
await as(staff);await fails(`select public.vendor_decide('${a.id}',${a.revision},'approved','Again','[]','[{"category":"Languages","subject":"English","decision":"approved"}]',gen_random_uuid())`,/QA_APPROVAL_DENIED/);

await db.exec('reset role');
const previousEvents=(await db.query('select count(*)::int as n from public.vendor_application_events')).rows[0].n;
await db.exec(readFileSync(new URL('../supabase/vendor_workflow_intake_notifications.sql',import.meta.url),'utf8'));
assert.equal((await db.query('select count(*)::int as n from public.vendor_application_events')).rows[0].n,previousEvents);checks++;
await db.exec(`insert into public.service_intakes(id,user_id,email,email_verified_at,kind,fields,request_hash) values('20000000-0000-4000-8000-000000000009','${other}','other@example.test',now(),'network','{"full-name":"VENDOR-QA-notification","category":"transportation"}',repeat('b',64));`);
const captured=(await db.query("select * from public.vendor_application_events where application_id='20000000-0000-4000-8000-000000000009'")).rows;
assert.equal(captured.length,1);assert.equal(captured[0].kind,'submitted');assert.equal(captured[0].delivery,'pending');checks++;
assert.equal((await db.query("select is_test from public.vendor_applications where id='20000000-0000-4000-8000-000000000009'")).rows[0].is_test,true);checks++;

// Test fixtures remain excluded through approval, replies and attempted flag removal.
await db.exec(readFileSync(new URL('../supabase/vendor_workflow_test_fixtures.sql',import.meta.url),'utf8'));
await db.exec(`update auth.users set email='admin+vendorqa@marocora.com' where id='${other}';
update public.vendor_applications set email='admin+vendorqa@marocora.com' where id='20000000-0000-4000-8000-000000000009';
insert into public.vendor_applications(id,source,source_key,user_id,email,name,category,fields,is_test)
values('20000000-0000-4000-8000-000000000010','translator','permanent-fixture','${other}','admin+vendorqa@marocora.com','VENDOR-QA-Tanya','translation','{}',true);
insert into public.vendor_test_fixtures(application_id,delivery_email,reason) values('20000000-0000-4000-8000-000000000010','admin+vendorqa@marocora.com','Owned test fixture');`);
const fixture='20000000-0000-4000-8000-000000000010';
await as(staff);
const beforeSummary=(await db.query('select public.vendor_production_summary()')).rows[0].vendor_production_summary;
const beforeFixture=(await db.query('select public.vendor_review_queue($1)',[fixture])).rows[0].vendor_review_queue[0];
assert.equal(beforeFixture.test_workflow,true);checks++;
await db.query("select public.vendor_decide($1,1,'approved','TEST approval only','[]','[]',gen_random_uuid())",[fixture]);checks++;
assert.deepEqual((await db.query('select public.vendor_production_summary()')).rows[0].vendor_production_summary,beforeSummary);checks++;
await fails(`select public.vendor_decide('20000000-0000-4000-8000-000000000009',1,'approved','Must stay blocked','[]','[]',gen_random_uuid())`,/QA_APPROVAL_BLOCKED/);
await db.exec('reset role');await db.query('update public.vendor_applications set is_test=false where id=$1',[fixture]);
assert.equal((await db.query('select is_test from public.vendor_applications where id=$1',[fixture])).rows[0].is_test,true);checks++;
await fails(`delete from public.vendor_applications where id='${fixture}'`,/PERMANENT_TEST_FIXTURE/);
await fails(`delete from public.vendor_test_fixtures where application_id='${fixture}'`,/PERMANENT_TEST_FIXTURE/);
await fails(`update public.vendor_applications set email='someone@example.test' where id='${fixture}'`,/TEST_FIXTURE_IDENTITY_REQUIRED/);
await as(other);await fails('select public.vendor_production_summary()',/STAFF_REQUIRED/);
await fails('select * from public.vendor_test_fixtures',/permission denied/);

console.log(`PASS ${checks} database assertions: owner isolation, staff guards, validation, state transitions, idempotency, history and mail claims.`);
await db.close();
