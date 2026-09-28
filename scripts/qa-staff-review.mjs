// Isolated PostgreSQL QA. Pass an installed @electric-sql/pglite ESM module path.
// Never run the fixture bootstrap against a live database.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const staff = '10000000-0000-0000-0000-000000000001';
const applicant = '10000000-0000-0000-0000-000000000002';
const other = '10000000-0000-0000-0000-000000000003';
const qa = '5821ea83-6934-4a66-bfff-f0df97f88273';
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
insert into auth.users values ('${staff}'),('${applicant}'),('${other}'),('${qa}');`);
await db.exec(readFileSync(new URL('../supabase/learning_instructor_drafts.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../supabase/learning_staff_review.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../supabase/learning_staff_review.sql',import.meta.url),'utf8')); // rerunnable
const draft = {profile:{displayName:'Isolated QA fixture',headline:'Fixture',bio:'Fixture only',countryOfResidence:'MA',timezone:'Africa/Casablanca'},subjects:[
  {category:'Languages',subject:'Darija',qualifications:'Fixture only',offerings:[{title:'Fixture',currency:'MAD',priceMinor:5000,durationMinutes:30}]},
  {category:'Music',subject:'Piano',qualifications:'Fixture only',offerings:[{title:'Fixture',currency:'MAD',priceMinor:12500,durationMinutes:60}]}
]};
for (const id of [staff,applicant,other,qa]) await db.query('insert into public.learning_instructor_drafts(user_id,data) values($1,$2)',[id,draft]);
async function as(role,id,fn) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id || '']);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
const call = (sql,args=[]) => db.query(sql,args);
const denied = async (role,id,sql,args,code) => assert.rejects(as(role,id,()=>call(sql,args)), e=>e.message.includes(code));
const decisions = ['approved','needs_changes'].map((decision,i)=>({category:draft.subjects[i].category,subject:draft.subjects[i].subject,decision}));
const reviewSQL = 'select public.review_learning_instructor_application($1,$2,$3,$4,$5)';
const reviewArgs = (id,revision=1,profile='approved',subjects=decisions,feedback='Please clarify piano experience.') => [id,revision,profile,subjects,feedback];
assert.equal((await call('select count(*)::int as n from public.learning_review_staff')).rows[0].n,0);
await denied('anon',null,'select public.learning_staff_review_queue()',[],'permission denied');
await denied('authenticated',other,'select public.learning_staff_review_queue()',[],'STAFF_REQUIRED');
await denied('authenticated',other,'insert into public.learning_review_staff(user_id) values($1)',[other],'permission denied');
await denied('authenticated',other,'select * from public.learning_application_reviews',[],'permission denied');
await denied('authenticated',other,'update public.learning_instructor_drafts set status=\'submitted\' where user_id=$1',[other],'permission denied');
assert.equal((await as('authenticated',other,()=>call('select user_id from public.learning_instructor_drafts'))).rows.length,1);
for (const id of [staff,applicant,other,qa]) await as('authenticated',id,()=>call('select public.submit_learning_instructor_draft()'));
await denied('authenticated',other,reviewSQL,reviewArgs(applicant),'STAFF_REQUIRED');
await call('insert into public.learning_review_staff(user_id) values($1)',[staff]);
assert.equal((await as('authenticated',staff,()=>call('select public.learning_staff_review_queue() as q'))).rows[0].q.length,4);
await denied('authenticated',staff,reviewSQL,reviewArgs(staff),'SELF_REVIEW_DENIED');
await denied('authenticated',staff,reviewSQL,reviewArgs(qa),'QA_APPROVAL_DENIED');
await denied('authenticated',staff,reviewSQL,reviewArgs(applicant,99),'STALE_REVISION');
await denied('authenticated',staff,reviewSQL,reviewArgs(applicant,1,'approved',decisions,''),'FEEDBACK_REQUIRED');
await denied('authenticated',staff,reviewSQL,reviewArgs(applicant,1,'approved',decisions.slice(0,1)),'INVALID_REVIEW');
await denied('authenticated',staff,reviewSQL,reviewArgs(applicant,1,'approved',[...decisions].reverse()),'INVALID_REVIEW');
await denied('authenticated',staff,reviewSQL,reviewArgs(applicant,1,'verified'),'INVALID_REVIEW');
await as('authenticated',staff,()=>call(reviewSQL,reviewArgs(applicant)));
let feedback = (await as('authenticated',applicant,()=>call('select public.learning_instructor_review_feedback() as f'))).rows[0].f;
assert.equal(feedback.profile_decision,'approved');
assert.equal(feedback.subject_decisions[1].decision,'needs_changes');
assert.equal(feedback.reviewer_id,undefined);
assert.equal((await as('authenticated',other,()=>call('select public.learning_instructor_review_feedback() as f'))).rows[0].f,null);
assert.equal((await call('select status from public.learning_instructor_drafts where user_id=$1',[applicant])).rows[0].status,'needs_changes');
await as('authenticated',applicant,()=>call('update public.learning_instructor_drafts set data=$1 where user_id=$2',[draft,applicant]));
assert.equal((await call('select revision from public.learning_instructor_drafts where user_id=$1',[applicant])).rows[0].revision,1);
const edited = structuredClone(draft); edited.profile.headline = 'Edited fixture';
await as('authenticated',applicant,()=>call('update public.learning_instructor_drafts set data=$1 where user_id=$2',[edited,applicant]));
assert.equal((await as('authenticated',applicant,()=>call('select public.learning_instructor_review_feedback() as f'))).rows[0].f,null);
await denied('authenticated',staff,reviewSQL,reviewArgs(applicant),'STALE_REVISION');
await denied('authenticated',staff,reviewSQL,reviewArgs(applicant,2),'NOT_SUBMITTED');
await as('authenticated',applicant,()=>call('select public.submit_learning_instructor_draft()'));
const approved = decisions.map(s=>({...s,decision:'approved'}));
await as('authenticated',staff,()=>call(reviewSQL,reviewArgs(applicant,2,'approved',approved,'')));
assert.equal((await call('select count(*)::int as n from public.learning_application_reviews where user_id=$1',[applicant])).rows[0].n,2);
assert.equal((await call('select status from public.learning_instructor_drafts where user_id=$1',[applicant])).rows[0].status,'submitted');
await call('delete from public.learning_review_staff where user_id=$1',[staff]);
await denied('authenticated',staff,reviewSQL,reviewArgs(applicant,2),'STAFF_REQUIRED');
await denied('authenticated',staff,'select public.learning_staff_review_queue()',[],'STAFF_REQUIRED');
await db.close();
console.log('PostgreSQL review QA passed: permissions, explicit membership, QA/self exclusion, independent subject decisions, feedback isolation, revision invalidation, private approvals, revocation, migration rerun.');
