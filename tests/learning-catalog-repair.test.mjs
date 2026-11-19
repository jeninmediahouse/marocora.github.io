import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openLocalDatabase,L,J} from '../server/block1/database.mjs';

const repair=readFileSync('supabase/migrations/202611190001_fix_learning_catalog.sql','utf8');
const diagnostic=readFileSync('supabase/diagnose_learning_catalog.sql','utf8');
const source=readFileSync('supabase/learning_launch.sql','utf8');
const canonical=name=>source.match(new RegExp('create or replace function public\\.'+name+'\\([\\s\\S]*?\\$\\$;','i'))[0];

test('Targeted catalogue repair is guarded, repeatable and anonymous without exposing private data',{timeout:60000},()=>{
 const dir=mkdtempSync(join(tmpdir(),'marocora-catalog-repair-'));let db;
 try{
  // Always disposable local PostgreSQL. Never use exported managed credentials.
  db=openLocalDatabase(dir,{forceLocal:true});
  const gates=db.sql('select to_jsonb(s) from public.quote_settings s');
  const diagnosticResult=db.sql(diagnostic);assert.ok(diagnosticResult.includes('learning_public_catalog()'));
  const teacher=randomUUID(),staff=randomUUID();
  db.sql(`insert into auth.users(id,email,email_confirmed_at,is_anonymous) values(${L(teacher)},'teacher@synthetic.invalid',now(),false),(${L(staff)},'staff@synthetic.invalid',now(),false);
   insert into public.learning_review_staff(user_id) values(${L(staff)});`);
  const subjects=[{category:'Languages',subject:'English',qualifications:'Synthetic qualification',offerings:[{title:'Synthetic lesson',currency:'MAD',priceMinor:5000,durationMinutes:30,lessonCount:1,deliveryMode:'online',levels:['Beginner']}]},
   {category:'Science',subject:'Physics',qualifications:'Not approved',offerings:[]}];
  const draft={profile:{displayName:'Synthetic approved teacher',headline:'Synthetic only',bio:'Not real inventory',countryOfResidence:'MA',timezone:'UTC',publicationConsent:true,nativeLanguages:'English',spokenLanguages:'French',privateSecret:'NEVER_PUBLIC'},subjects,privateEmail:'NEVER_PUBLIC'};
  db.sql(`insert into public.learning_instructor_drafts(user_id,data,status) values(${L(teacher)},${J(draft)},'submitted');
   insert into public.learning_application_reviews(user_id,revision,reviewer_id,profile_decision,subject_decisions,feedback,snapshot)
   values(${L(teacher)},1,${L(staff)},'approved',${J(subjects.map((s,i)=>({category:s.category,subject:s.subject,decision:i?'pending':'approved'})))},'NEVER_PUBLIC',${J(draft)});`);
  db.as(staff,`select to_jsonb(public.publish_learning_instructor(${L(teacher)},1,array[0]))`);
  db.sql('drop function public.learning_public_catalog()');
  db.sql(repair);db.sql(repair);
  const anon=()=>JSON.parse(db.sql('begin read only;set local role anon;select public.learning_public_catalog();rollback;'));
  const catalog=anon();assert.equal(catalog.instructors.length,1);assert.equal(catalog.offerings.length,1);
  assert.equal(catalog.instructors[0].subjects[0].subjectId,'english');assert.equal(catalog.offerings[0].bookingEnabled,false);
  assert.ok(!JSON.stringify(catalog).includes('NEVER_PUBLIC'));assert.ok(!JSON.stringify(catalog).includes(teacher));assert.ok(!JSON.stringify(catalog).includes(staff));
  assert.throws(()=>db.sql('begin;set local role anon;select * from public.learning_publications;commit;'),error=>String(error.stderr).includes('permission denied'));
  assert.throws(()=>db.sql('begin;set local role anon;select public.learning_student_dashboard();commit;'),error=>String(error.stderr).includes('permission denied'));
  db.sql(`update public.learning_publications set active=false where user_id=${L(teacher)}`);assert.deepEqual(anon().instructors,[]);
  db.sql(`update public.learning_publications set active=true where user_id=${L(teacher)};insert into public.learning_review_exclusions values(${L(teacher)},'Synthetic exclusion')`);assert.deepEqual(anon().instructors,[]);
  db.sql(`delete from public.learning_review_exclusions where user_id=${L(teacher)};update public.learning_instructor_drafts set data=jsonb_set(data,'{profile,publicationConsent}','false') where user_id=${L(teacher)}`);assert.deepEqual(anon().instructors,[]);
  assert.equal(db.sql('select to_jsonb(s) from public.quote_settings s'),gates);

  db.sql("create or replace function public.learning_public_catalog() returns jsonb language sql stable security definer set search_path='' as $$select '{}'::jsonb$$;");
  assert.throws(()=>db.sql(repair),error=>String(error.stderr).includes('EXISTING_DEFINITION_REQUIRES_REVIEW'));
  assert.deepEqual(anon(),{});db.sql(canonical('learning_public_catalog'));
  db.sql("create function public.learning_public_catalog(filter text) returns jsonb language sql as $$select '{}'::jsonb$$;");
  assert.throws(()=>db.sql(repair),error=>String(error.stderr).includes('OVERLOAD_REQUIRES_REVIEW'));
  db.sql('drop function public.learning_public_catalog(text)');
  db.sql("create or replace function public.learning_publication_visible(p public.learning_publications) returns boolean language sql stable security definer set search_path='' as $$select true$$;");
  assert.throws(()=>db.sql(repair),error=>String(error.stderr).includes('HELPER_MISSING_OR_CHANGED'));
  db.sql(canonical('learning_publication_visible'));
  db.sql('grant select on public.learning_publications to anon');
  assert.throws(()=>db.sql(repair),error=>String(error.stderr).includes('UNEXPECTED_DIRECT_TABLE_ACCESS'));
  db.sql('revoke select on public.learning_publications from anon');db.sql(repair);
  db.sql('drop function public.learning_public_catalog();drop table public.learning_publications cascade;');
  assert.throws(()=>db.sql(repair),error=>String(error.stderr).includes('PREREQUISITE_MISSING_OR_RLS_DISABLED'));
  assert.equal(db.sql("select to_regprocedure('public.learning_public_catalog()') is null"),'t');
 }finally{db?.stop();rmSync(dir,{recursive:true,force:true});}
});
