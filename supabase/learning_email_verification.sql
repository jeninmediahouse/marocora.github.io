-- Apply after learning_launch.sql. Enforce the same email rule on existing
-- database-backed teaching and learning services, including privileged RPCs.
begin;
create or replace function public.learning_require_verified_email()
returns trigger language plpgsql security definer set search_path='' as $$
declare person uuid;
begin
 if tg_table_name='learning_instructor_drafts' then
  if new.status not in ('submitted','needs_changes') then return new; end if;
  person:=new.user_id;
 elsif tg_table_name='learning_application_reviews' then
  person:=new.user_id;
 elsif tg_table_name='learning_publications' then
  -- Always permit removing a public profile.
  if not new.active then return new; end if;
  person:=new.user_id;
 elsif tg_table_name='learning_lesson_requests' then
  -- Always permit cancellation/decline, including old requests.
  if new.status not in ('requested','acknowledged') then return new; end if;
  person:=new.student_id;
 else raise exception 'INVALID_VERIFICATION_TARGET';
 end if;
 perform 1 from auth.users where id=person and email is not null
  and email_confirmed_at is not null and not is_anonymous for share;
 if not found then raise exception 'EMAIL_VERIFICATION_REQUIRED'; end if;
 return new;
end;
$$;
revoke all on function public.learning_require_verified_email() from public,anon,authenticated;
create or replace trigger require_verified_email before insert or update on public.learning_instructor_drafts
 for each row execute function public.learning_require_verified_email();
create or replace trigger require_verified_email before insert or update on public.learning_application_reviews
 for each row execute function public.learning_require_verified_email();
create or replace trigger require_verified_email before insert or update on public.learning_publications
 for each row execute function public.learning_require_verified_email();
create or replace trigger require_verified_email before insert or update on public.learning_lesson_requests
 for each row execute function public.learning_require_verified_email();
commit;
