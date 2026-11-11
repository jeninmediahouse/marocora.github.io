-- SQL Editor regression test. Uses temporary tables; touches no real applications.
begin;
create temp table learning_instructor_drafts(user_id uuid,status text);
create temp table learning_application_reviews(user_id uuid);
create temp table learning_publications(user_id uuid,active boolean);
create temp table learning_lesson_requests(student_id uuid,status text);
create trigger guard before insert or update on pg_temp.learning_instructor_drafts
 for each row execute function public.learning_require_verified_email();
create trigger guard before insert or update on pg_temp.learning_application_reviews
 for each row execute function public.learning_require_verified_email();
create trigger guard before insert or update on pg_temp.learning_publications
 for each row execute function public.learning_require_verified_email();
create trigger guard before insert or update on pg_temp.learning_lesson_requests
 for each row execute function public.learning_require_verified_email();
do $$
declare verified uuid; unverified uuid; statement text;
begin
 select id into verified from auth.users where email_confirmed_at is not null and email is not null and not is_anonymous limit 1;
 select id into unverified from auth.users where email_confirmed_at is null limit 1;
 if verified is null or unverified is null then raise exception 'TEST_USERS_REQUIRED'; end if;
 foreach statement in array array[
  'insert into pg_temp.learning_instructor_drafts values ($1,''submitted'')',
  'insert into pg_temp.learning_application_reviews values ($1)',
  'insert into pg_temp.learning_publications values ($1,true)',
  'insert into pg_temp.learning_lesson_requests values ($1,''requested'')',
  'insert into pg_temp.learning_lesson_requests values ($1,''acknowledged'')'
 ] loop
  execute statement using verified;
  begin
   execute statement using unverified;
   raise exception 'UNVERIFIED_WAS_ACCEPTED';
  exception when others then
   if sqlerrm <> 'EMAIL_VERIFICATION_REQUIRED' then raise; end if;
  end;
 end loop;
 insert into pg_temp.learning_instructor_drafts values(unverified,'draft');
 insert into pg_temp.learning_publications values(unverified,false);
 insert into pg_temp.learning_lesson_requests values(unverified,'cancelled'),(unverified,'declined');
 if (select count(*) from pg_trigger where tgname='require_verified_email' and tgrelid in (
  'public.learning_instructor_drafts'::regclass,'public.learning_application_reviews'::regclass,
  'public.learning_publications'::regclass,'public.learning_lesson_requests'::regclass))<>4 then
  raise exception 'PRODUCTION_TRIGGERS_MISSING';
 end if;
end;
$$;
select 'PASS: confirmed users accepted; unconfirmed users blocked; drafts and withdrawal allowed' as result;
rollback;
