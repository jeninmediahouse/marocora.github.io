// Isolated PostgreSQL only. Never bootstrap fixtures against a live project.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href),db=new PGlite();
const staff='10000000-0000-0000-0000-000000000001',teacher='10000000-0000-0000-0000-000000000002',student='10000000-0000-0000-0000-000000000003',other='10000000-0000-0000-0000-000000000004',qa='5821ea83-6934-4a66-bfff-f0df97f88273';
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;insert into auth.users values('${staff}'),('${teacher}'),('${student}'),('${other}'),('${qa}');`);
for(const file of ['learning_instructor_drafts','learning_staff_review','learning_launch','learning_launch'])await db.exec(readFileSync(new URL(`../supabase/${file}.sql`,import.meta.url),'utf8'));
let checks=0;
const q=(sql,args=[])=>db.query(sql,args);
async function as(role,id,sql,args=[]){await db.exec(`set role ${role}`);await q("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);try{return await q(sql,args);}finally{await db.exec('reset role');}}
async function rpc(id,name,args=[]){checks++;return (await as('authenticated',id,`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value;}
async function denied(id,name,args,code){checks++;await assert.rejects(rpc(id,name,args),e=>e.message.includes(code));}
async function anon(name,args=[]){checks++;return(await as('anon',null,`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value;}
const offer={title:'Isolated fixture lesson',currency:'MAD',priceMinor:5500,durationMinutes:30,lessonCount:1,deliveryMode:'online',levels:['Beginner','High school']};
const draft={profile:{displayName:'Isolated launch fixture',headline:'Isolated fixture',bio:'Fixture only, not real inventory',countryOfResidence:'MA',city:'Fixture',timezone:'Africa/Casablanca',yearsExperience:null,publicationConsent:false,nativeLanguages:'Darija',spokenLanguages:'English, French',education:'Self-reported fixture',photoURL:'',introductionVideo:'',privateSecret:'NEVER_PUBLIC'},subjects:[{category:'Languages',subject:'English',qualifications:'Fixture qualification',specialties:['Conversation'],offerings:[offer]},{category:'Mathematics',subject:'Algebra',qualifications:'Fixture algebra',offerings:[{...offer,priceMinor:12000}]},{category:'Science',subject:'Physics',qualifications:'Fixture physics',offerings:[offer]}],privateEmail:'NEVER_PUBLIC'};
for(const id of [teacher,qa])await q('insert into public.learning_instructor_drafts(user_id,data) values($1,$2)',[id,draft]);
await q('insert into public.learning_review_staff values($1,now())',[staff]);
assert.deepEqual((await anon('learning_public_catalog')).instructors,[]);
await assert.rejects(as('anon',null,'select * from public.learning_publications'),/permission denied/);
await assert.rejects(as('authenticated',student,'select * from public.learning_student_profiles'),/permission denied/);
await assert.rejects(as('authenticated',student,'insert into public.learning_review_staff(user_id) values($1)',[student]),/permission denied/);
await assert.rejects(anon('learning_student_dashboard'),/permission denied/);
await denied(student,'publish_learning_instructor',[teacher,1,[0]],'STAFF_REQUIRED');
await rpc(teacher,'submit_learning_instructor_draft');await rpc(qa,'submit_learning_instructor_draft');
const decisions=draft.subjects.map((s,i)=>({category:s.category,subject:s.subject,decision:i===2?'pending':'approved'}));
const review=(rev=1)=>rpc(staff,'review_learning_instructor_application',[teacher,rev,'approved',decisions,'']);
await review();await denied(staff,'publish_learning_instructor',[teacher,1,[0]],'PUBLICATION_CONSENT_REQUIRED');
await denied(staff,'publish_learning_instructor',[qa,1,[0]],'QA_PUBLICATION_DENIED');
const consent=structuredClone(draft);consent.profile.publicationConsent=true;
await as('authenticated',teacher,'update public.learning_instructor_drafts set data=$1 where user_id=$2',[consent,teacher]);await rpc(teacher,'submit_learning_instructor_draft');await review(2);
await denied(staff,'publish_learning_instructor',[teacher,2,[2]],'SUBJECT_NOT_APPROVED');
await denied(staff,'publish_learning_instructor',[teacher,2,[0,0]],'INVALID_SUBJECT_SELECTION');
const preview=await rpc(staff,'learning_staff_publication_preview',[teacher,2,[0,1]]);assert.equal(preview.instructor.verifications.length,0);assert.ok(!JSON.stringify(preview).includes('NEVER_PUBLIC'));
const pid=await rpc(staff,'publish_learning_instructor',[teacher,2,[0,1]]);
let catalog=await anon('learning_public_catalog');assert.equal(catalog.instructors.length,1);assert.equal(catalog.offerings.length,2);assert.deepEqual(catalog.instructors[0].subjects.map(s=>s.subjectId),['english','algebra']);assert.ok(!JSON.stringify(catalog).includes(teacher));assert.ok(!JSON.stringify(catalog).includes('NEVER_PUBLIC'));assert.equal(catalog.offerings[0].bookingEnabled,false);assert.equal(catalog.offerings[0].specialtyIds[0],'conversation');assert.deepEqual(catalog.offerings[0].levels,['beginner','high-school']);
assert.equal(await rpc(staff,'publish_learning_instructor',[teacher,2,[0,1]]),pid);
await rpc(student,'learning_save_student_profile',['Fixture Student','Europe/Paris','fr','Fixture goal',['english','geometry']]);
await denied(other,'learning_save_student_profile',['Name','Bad/Zone','en','',[]],'INVALID_STUDENT_PROFILE');
assert.equal((await rpc(other,'learning_student_dashboard')).profile,null);
await rpc(student,'learning_set_favorite',[pid,true]);assert.equal((await rpc(student,'learning_student_dashboard')).favorites[0],pid);assert.equal((await rpc(other,'learning_student_dashboard')).favorites.length,0);
const start=new Date(Date.now()+86400000).toISOString(),end=new Date(Date.now()+86400000+3600000).toISOString(),ids=catalog.offerings.map(o=>o.id);
const sid=await rpc(teacher,'learning_save_availability',[start,end,ids]);
await denied(teacher,'learning_save_availability',[start,end,ids],'OVERLAPPING_AVAILABILITY');
await denied(student,'learning_save_availability',[start,end,ids],'PUBLICATION_REQUIRED');
await denied(teacher,'learning_save_availability',[new Date(Date.now()+172800000).toISOString(),new Date(Date.now()+172800000+600000).toISOString(),ids],'INVALID_AVAILABILITY');
assert.equal((await anon('learning_public_slots',[pid])).length,1);
await denied(other,'learning_request_lesson',[sid,ids[0],'Goal','UTC'],'STUDENT_PROFILE_REQUIRED');
const rid=await rpc(student,'learning_request_lesson',[sid,ids[0],'Fixture goal','Europe/Paris']);assert.equal(await rpc(student,'learning_request_lesson',[sid,ids[0],'Fixture goal','Europe/Paris']),rid);
assert.equal((await rpc(other,'learning_student_dashboard')).requests.length,0);
let inbox=await rpc(teacher,'learning_instructor_dashboard');assert.equal(inbox.requests[0].studentName,'Fixture Student');assert.ok(!JSON.stringify(inbox).includes(student));
await denied(other,'learning_update_lesson_request',[rid,'declined'],'REQUEST_ACTION_DENIED');
await denied(student,'learning_update_lesson_request',[rid,'acknowledged'],'REQUEST_ACTION_DENIED');
await rpc(teacher,'learning_update_lesson_request',[rid,'acknowledged']);assert.equal((await rpc(student,'learning_student_dashboard')).requests[0].status,'acknowledged');
await rpc(student,'learning_update_lesson_request',[rid,'cancelled']);assert.equal((await rpc(student,'learning_student_dashboard')).requests[0].status,'cancelled');
await denied(student,'learning_request_lesson',[sid,ids[0],'Fixture goal','Europe/Paris'],'REQUEST_ALREADY_CLOSED');
await denied(other,'learning_staff_publications',[],'STAFF_REQUIRED');
await assert.rejects(as('authenticated',student,'select * from public.learning_publication_events'),/permission denied/);
assert.ok((await q('select count(*)::int as n from public.learning_publication_events')).rows[0].n>=2);
await rpc(other,'learning_remove_availability',[sid]);assert.equal((await anon('learning_public_slots',[pid])).length,1);
// Any new review hides publication, even before content changes; republish explicitly.
await review(2);assert.equal((await anon('learning_public_catalog')).instructors.length,0);await rpc(staff,'publish_learning_instructor',[teacher,2,[0,1]]);
await rpc(staff,'unpublish_learning_instructor',[teacher]);assert.equal((await anon('learning_public_catalog')).instructors.length,0);await rpc(staff,'publish_learning_instructor',[teacher,2,[0,1]]);
// Changed draft hides public data and time slots; historical request remains private.
const edited=structuredClone(consent);edited.profile.headline='Edited fixture';await as('authenticated',teacher,'update public.learning_instructor_drafts set data=$1 where user_id=$2',[edited,teacher]);assert.equal((await anon('learning_public_catalog')).instructors.length,0);assert.equal((await anon('learning_public_slots',[pid])).length,0);
await denied(student,'learning_request_lesson',[sid,ids[1],'Goal','UTC'],'SLOT_UNAVAILABLE');await denied(staff,'publish_learning_instructor',[teacher,2,[0]],'STALE_REVISION');
// QA exclusion survives even a trusted test removal of the exclusion row.
await q('delete from public.learning_review_exclusions where user_id=$1',[qa]);
await denied(staff,'publish_learning_instructor',[qa,1,[0]],'QA_PUBLICATION_DENIED');
await q('delete from public.learning_review_staff where user_id=$1',[staff]);await denied(staff,'unpublish_learning_instructor',[teacher],'STAFF_REQUIRED');
await db.close();console.log(`Launch PostgreSQL QA passed (${checks} RPC/permission checks): private profiles, explicit consent/publication, independent subject selection, QA exclusion, allowlisted output, favorites isolation, schedule validation, request ownership/idempotency, review/edit hiding and staff revocation.`);
