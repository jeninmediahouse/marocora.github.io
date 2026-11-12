-- Unified vendor applications. Apply after service_intake.sql and learning_launch.sql.
begin;
create table if not exists public.vendor_applications (
 id uuid primary key default gen_random_uuid(), source text not null check(source in ('translator','network','teacher')),
 source_key text not null unique, user_id uuid not null references auth.users(id), email text not null,
 name text not null, category text not null, fields jsonb not null, source_revision bigint,
 revision bigint not null default 1, status text not null default 'pending' check(status in ('pending','needs_information','approved','declined')),
 message text not null default '', questions jsonb not null default '[]', is_test boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.vendor_application_events (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.vendor_applications(id),
 command_id uuid unique, actor_id uuid references auth.users(id), kind text not null,
 payload jsonb not null default '{}', created_at timestamptz not null default now(),
 delivery text not null default 'pending' check(delivery in ('pending','sending','sent','uncertain','failed','external')),
 claimed_at timestamptz, sent_at timestamptz
);
create index if not exists vendor_applications_owner on public.vendor_applications(user_id,created_at desc);
create index if not exists vendor_events_application on public.vendor_application_events(application_id,created_at);
alter table public.vendor_applications enable row level security;
alter table public.vendor_application_events enable row level security;
revoke all on public.vendor_applications,public.vendor_application_events from public,anon,authenticated;

create or replace function public.vendor_capture_intake() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind not in ('translator','network') then return new; end if;
 insert into public.vendor_applications(id,source,source_key,user_id,email,name,category,fields,is_test,created_at)
 values(new.id,new.kind,'intake:'||new.id,new.user_id,new.email,new.fields->>'full-name',
 case when new.kind='translator' then 'translation' else coalesce(new.fields->>'category','other') end,new.fields,
 coalesce(new.fields->>'full-name','') ilike '%EMAIL-RULE-%',new.created_at)
 on conflict(source_key) do nothing;
 return new;
end; $$;
create or replace trigger vendor_capture_intake after insert on public.service_intakes
 for each row execute function public.vendor_capture_intake();

create or replace function public.vendor_capture_teacher() returns trigger language plpgsql security definer set search_path='' as $$
declare u auth.users%rowtype; app_id uuid; qa_excluded boolean;
begin
 if new.status <> 'submitted' then return new; end if;
 if exists(select 1 from public.vendor_applications where source_key='teacher:'||new.user_id and source_revision=new.revision) then return new; end if;
 select * into u from auth.users where id=new.user_id and email_confirmed_at is not null and email is not null and not is_anonymous;
 if not found then raise exception 'EMAIL_VERIFICATION_REQUIRED'; end if;
 qa_excluded:=exists(select 1 from public.learning_review_exclusions where user_id=new.user_id)
 or coalesce(new.data #>> '{profile,displayName}','') ilike '%Do Not Publish%';
 insert into public.vendor_applications(source,source_key,user_id,email,name,category,fields,source_revision,is_test)
 values('teacher','teacher:'||new.user_id,new.user_id,u.email,new.data #>> '{profile,displayName}','teacher',new.data,new.revision,qa_excluded)
 on conflict(source_key) do update set fields=excluded.fields,source_revision=excluded.source_revision,
 name=excluded.name,email=excluded.email,status='pending',message='',questions='[]',
 revision=public.vendor_applications.revision+1,updated_at=now()
 returning id into app_id;
 insert into public.vendor_application_events(application_id,actor_id,kind,payload)
 values(app_id,new.user_id,'submitted',jsonb_build_object('message','Your teacher application has been received. We will email you when it has been reviewed.'));
 return new;
end; $$;
-- Fire after the email guard and existing draft revision touch trigger.
create or replace trigger vendor_capture_teacher after insert or update on public.learning_instructor_drafts
 for each row execute function public.vendor_capture_teacher();

create or replace function public.vendor_application_payload(a public.vendor_applications) returns jsonb
 language sql stable security definer set search_path='' as $$
 select to_jsonb(a)||jsonb_build_object('history',coalesce((select jsonb_agg(jsonb_build_object(
 'id',e.id,'kind',e.kind,'payload',e.payload,'created_at',e.created_at,'delivery',
 case when e.delivery='sending' and e.claimed_at<now()-interval '2 minutes' then 'uncertain' else e.delivery end)
 order by e.created_at) from public.vendor_application_events e where e.application_id=a.id),'[]'::jsonb));
$$;
create or replace function public.vendor_review_queue(p_id uuid default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
begin
 if not public.learning_staff_review_access() then raise exception 'STAFF_REQUIRED'; end if;
 return coalesce((select jsonb_agg(public.vendor_application_payload(a) order by a.updated_at desc)
 from (select * from public.vendor_applications where p_id is null or id=p_id order by updated_at desc limit 500) a),'[]');
end; $$;
create or replace function public.vendor_my_applications(p_id uuid default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and not is_anonymous) then raise exception 'EMAIL_VERIFICATION_REQUIRED'; end if;
 return coalesce((select jsonb_agg(public.vendor_application_payload(a) order by a.updated_at desc)
 from public.vendor_applications a where a.user_id=auth.uid() and (p_id is null or a.id=p_id)),'[]');
end; $$;

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
 if a.is_test and p_decision='approved' then raise exception 'QA_APPROVAL_BLOCKED'; end if;
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

create or replace function public.vendor_reply(p_id uuid,p_revision bigint,p_answers jsonb,p_command uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.vendor_applications%rowtype; q jsonb; event_id uuid;
begin
 select * into a from public.vendor_applications where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and lower(email)=lower(a.email) and email_confirmed_at is not null and not is_anonymous) then raise exception 'EMAIL_VERIFICATION_REQUIRED'; end if;
 select id into event_id from public.vendor_application_events where command_id=p_command and application_id=p_id and actor_id=auth.uid();
 if event_id is not null then return jsonb_build_object('application_id',p_id,'event_id',event_id); end if;
 if p_command is null or p_revision is null then raise exception 'INVALID_ANSWERS'; end if;
 if a.revision<>p_revision or a.status<>'needs_information' then raise exception 'STALE_REVISION'; end if;
 if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>40000 then raise exception 'INVALID_ANSWERS'; end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>jsonb_array_length(a.questions) then raise exception 'INVALID_ANSWERS'; end if;
 for q in select value from jsonb_array_elements(a.questions) loop
  if jsonb_typeof(p_answers->(q->>'id')) is distinct from 'string' or length(btrim(p_answers->>(q->>'id'))) not between 1 and 6000 then raise exception 'ANSWERS_REQUIRED'; end if;
 end loop;
 update public.vendor_applications set status='pending',revision=revision+1,updated_at=now() where id=p_id;
 insert into public.vendor_application_events(application_id,command_id,actor_id,kind,payload)
 values(p_id,p_command,auth.uid(),'information_received',jsonb_build_object('questions',a.questions,'answers',p_answers,'message','The requested additional information has been received. Your application is awaiting review.')) returning id into event_id;
 return jsonb_build_object('application_id',p_id,'event_id',event_id);
end; $$;

-- Delivery claims are durable and at most once: ambiguous sends need explicit staff handling.
create or replace function public.vendor_claim_mail(p_id uuid,p_user uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare a public.vendor_applications%rowtype; e public.vendor_application_events%rowtype;
begin
 if auth.role()<>'service_role' then raise exception 'SERVER_REQUIRED'; end if;
 select * into a from public.vendor_applications where id=p_id;
 if not found or not (a.user_id=p_user or exists(select 1 from public.learning_review_staff where user_id=p_user)) then raise exception 'ACCESS_DENIED'; end if;
 select * into e from public.vendor_application_events where application_id=p_id and delivery='pending' order by created_at for update skip locked limit 1;
 if not found then return null; end if;
 update public.vendor_application_events set delivery='sending',claimed_at=now() where id=e.id;
 return jsonb_build_object('event',to_jsonb(e),'application',to_jsonb(a));
end; $$;
create or replace function public.vendor_finish_mail(p_event uuid,p_delivery text) returns void
 language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' or p_delivery not in ('sent','uncertain','failed') then raise exception 'SERVER_REQUIRED'; end if;
 update public.vendor_application_events set delivery=p_delivery,sent_at=case when p_delivery='sent' then now() else null end where id=p_event and delivery='sending';
end; $$;

-- Import existing verified vendor receipts and submitted teacher applications without sending historical emails.
insert into public.vendor_applications(id,source,source_key,user_id,email,name,category,fields,is_test,created_at)
 select id,kind,'intake:'||id,user_id,email,fields->>'full-name',case when kind='translator' then 'translation' else coalesce(fields->>'category','other') end,fields,
 coalesce(fields->>'full-name','') ilike '%EMAIL-RULE-%',created_at from public.service_intakes where kind in ('translator','network') on conflict(source_key) do nothing;
insert into public.vendor_applications(source,source_key,user_id,email,name,category,fields,source_revision,is_test,created_at)
 select 'teacher','teacher:'||d.user_id,d.user_id,u.email,d.data #>> '{profile,displayName}','teacher',d.data,d.revision,
 exists(select 1 from public.learning_review_exclusions x where x.user_id=d.user_id) or coalesce(d.data #>> '{profile,displayName}','') ilike '%Do Not Publish%',coalesce(d.submitted_at,d.updated_at)
 from public.learning_instructor_drafts d join auth.users u on u.id=d.user_id where d.status in ('submitted','needs_changes') and u.email_confirmed_at is not null on conflict(source_key) do nothing;

revoke all on function public.vendor_capture_intake(),public.vendor_capture_teacher(),public.vendor_application_payload(public.vendor_applications),public.vendor_review_queue(uuid),public.vendor_my_applications(uuid),public.vendor_decide(uuid,bigint,text,text,jsonb,jsonb,uuid),public.vendor_reply(uuid,bigint,jsonb,uuid),public.vendor_claim_mail(uuid,uuid),public.vendor_finish_mail(uuid,text) from public,anon,authenticated;
grant execute on function public.vendor_review_queue(uuid),public.vendor_my_applications(uuid),public.vendor_decide(uuid,bigint,text,text,jsonb,jsonb,uuid),public.vendor_reply(uuid,bigint,jsonb,uuid) to authenticated;
grant execute on function public.vendor_claim_mail(uuid,uuid),public.vendor_finish_mail(uuid,text) to service_role;
commit;
