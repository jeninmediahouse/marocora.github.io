-- Permanent, private translator workflow fixtures. No teacher/publication exceptions.
begin;
create table if not exists public.vendor_test_fixtures (
 application_id uuid primary key references public.vendor_applications(id),
 delivery_email text not null check(delivery_email='admin+vendorqa@marocora.com'),
 reason text not null, created_at timestamptz not null default now()
);
alter table public.vendor_test_fixtures enable row level security;
revoke all on public.vendor_test_fixtures from public,anon,authenticated;
create or replace function public.vendor_test_workflow_allowed(a public.vendor_applications) returns boolean
 language sql stable security definer set search_path='' as $$
 select a.is_test and a.source='translator' and exists(
 select 1 from public.vendor_test_fixtures f join auth.users u on u.id=a.user_id
 where f.application_id=a.id and f.delivery_email=a.email and u.email=a.email
 and u.email_confirmed_at is not null and not u.is_anonymous
 and not exists(select 1 from public.learning_review_staff s where s.user_id=u.id));
$$;
create or replace function public.vendor_preserve_test() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  if exists(select 1 from public.vendor_test_fixtures where application_id=old.id) then raise exception 'PERMANENT_TEST_FIXTURE'; end if;
  return old;
 end if;
 if old.is_test then new.is_test:=true; end if;
 if exists(select 1 from public.vendor_test_fixtures where application_id=new.id) then
  new.is_test:=true;
  if new.source<>'translator' or new.email<>(select delivery_email from public.vendor_test_fixtures where application_id=new.id)
   or new.name not like 'VENDOR-QA-%' then raise exception 'TEST_FIXTURE_IDENTITY_REQUIRED'; end if;
 end if;
 return new;
end; $$;
create or replace trigger vendor_preserve_test before update or delete on public.vendor_applications
 for each row execute function public.vendor_preserve_test();
create or replace function public.vendor_lock_fixture() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'PERMANENT_TEST_FIXTURE'; end; $$;
create or replace trigger vendor_lock_fixture before update or delete on public.vendor_test_fixtures
 for each row execute function public.vendor_lock_fixture();
create or replace function public.vendor_application_payload(a public.vendor_applications) returns jsonb
 language sql stable security definer set search_path='' as $$
 select to_jsonb(a)||jsonb_build_object('test_workflow',public.vendor_test_workflow_allowed(a),'history',coalesce((select jsonb_agg(jsonb_build_object(
 'id',e.id,'kind',e.kind,'payload',e.payload,'created_at',e.created_at,'delivery',
 case when e.delivery='sending' and e.claimed_at<now()-interval '2 minutes' then 'uncertain' else e.delivery end)
 order by e.created_at) from public.vendor_application_events e where e.application_id=a.id),'[]'::jsonb));
$$;
create or replace function public.vendor_decide(p_id uuid,p_revision bigint,p_decision text,p_message text,p_questions jsonb,p_subjects jsonb,p_command uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.vendor_applications%rowtype; event_id uuid; q jsonb; teacher_decision text;
begin
 perform 1 from public.learning_review_staff where user_id=auth.uid() for share;
 if not found then raise exception 'STAFF_REQUIRED'; end if;
 select * into a from public.vendor_applications where id=p_id for update;
 if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
 select id into event_id from public.vendor_application_events where command_id=p_command and application_id=p_id and actor_id=auth.uid();
 if event_id is not null then return jsonb_build_object('application_id',a.id,'event_id',event_id); end if;
 if p_command is null or p_revision is null then raise exception 'INVALID_DECISION'; end if;
 if a.revision<>p_revision then raise exception 'STALE_REVISION'; end if;
 if p_decision not in ('approved','declined','needs_information') or p_decision is null or p_message is null or length(btrim(p_message)) not between 1 and 4000 then raise exception 'INVALID_DECISION'; end if;
 if not exists(select 1 from auth.users where id=a.user_id and lower(email)=lower(a.email) and email_confirmed_at is not null and not is_anonymous) then raise exception 'EMAIL_VERIFICATION_REQUIRED'; end if;
 if a.is_test and p_decision='approved' and not public.vendor_test_workflow_allowed(a) then raise exception 'QA_APPROVAL_BLOCKED'; end if;
 if jsonb_typeof(p_questions) is distinct from 'array' or jsonb_array_length(p_questions)>12 then raise exception 'INVALID_QUESTIONS'; end if;
 if p_decision='needs_information' then
  if jsonb_array_length(p_questions)=0 then raise exception 'QUESTIONS_REQUIRED'; end if;
  for q in select value from jsonb_array_elements(p_questions) loop
   if q->>'id' is null or q->>'id' !~ '^q[0-9]{1,2}$' or length(btrim(q->>'label')) not between 1 and 500 or q->>'label' is null then raise exception 'INVALID_QUESTIONS'; end if;
  end loop;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_questions))<>jsonb_array_length(p_questions) then raise exception 'INVALID_QUESTIONS'; end if;
 else p_questions:='[]'; end if;
 if a.source='teacher' then
  teacher_decision:=case p_decision when 'declined' then 'rejected' when 'needs_information' then 'needs_changes' else 'approved' end;
  -- Reuse existing teacher review, subject, self-review and QA safeguards.
  perform public.review_learning_instructor_application(a.user_id,a.source_revision,teacher_decision,p_subjects,p_message);
 end if;
 update public.vendor_applications set status=p_decision,message=btrim(p_message),questions=p_questions,
 revision=revision+1,updated_at=now() where id=p_id;
 insert into public.vendor_application_events(application_id,command_id,actor_id,kind,payload)
 values(p_id,p_command,auth.uid(),p_decision,jsonb_build_object('message',btrim(p_message),'questions',p_questions)) returning id into event_id;
 return jsonb_build_object('application_id',p_id,'event_id',event_id);
end; $$;


-- Staff-only reporting is computed from non-test rows at the database boundary.
create or replace function public.vendor_production_summary() returns jsonb
 language plpgsql stable security definer set search_path='' as $$
begin
 if not public.learning_staff_review_access() then raise exception 'STAFF_REQUIRED'; end if;
 return (select jsonb_build_object('pending',count(*) filter(where status='pending'),
 'needs_information',count(*) filter(where status='needs_information'),
 'approved',count(*) filter(where status='approved'),'declined',count(*) filter(where status='declined'))
 from public.vendor_applications where not is_test);
end; $$;
revoke all on function public.vendor_test_workflow_allowed(public.vendor_applications),public.vendor_preserve_test(),public.vendor_lock_fixture(),public.vendor_production_summary() from public,anon,authenticated;
grant execute on function public.vendor_production_summary() to authenticated;
commit;
