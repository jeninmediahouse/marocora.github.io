-- Apply after learning_instructor_drafts.sql. No staff membership is granted here.
begin;
create table if not exists public.learning_review_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.learning_review_exclusions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null
);
-- Known private QA applications can never be approved.
insert into public.learning_review_exclusions (user_id, reason)
select id, 'Private onboarding QA — do not approve or publish' from auth.users
where id in ('6748d479-b3d6-46a5-aa3c-7516da0b07d2', '5821ea83-6934-4a66-bfff-f0df97f88273')
on conflict (user_id) do nothing;
create table if not exists public.learning_application_reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  reviewer_id uuid references auth.users(id) on delete set null,
  profile_decision text not null check (profile_decision in ('pending','approved','needs_changes','rejected')),
  subject_decisions jsonb not null check (jsonb_typeof(subject_decisions) = 'array'),
  feedback text not null default '' check (length(feedback) <= 4000),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists learning_application_reviews_latest
  on public.learning_application_reviews (user_id, revision, id desc);
alter table public.learning_review_staff enable row level security;
alter table public.learning_review_exclusions enable row level security;
alter table public.learning_application_reviews enable row level security;
revoke all on public.learning_review_staff, public.learning_review_exclusions, public.learning_application_reviews from public, anon, authenticated;

create or replace function public.learning_staff_review_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.learning_review_staff where user_id = (select auth.uid()));
$$;

create or replace function public.learning_staff_review_queue()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.learning_staff_review_access() then raise exception 'STAFF_REQUIRED'; end if;
  return coalesce((select jsonb_agg(item order by submitted_at, user_id) from (
    select d.user_id, d.data, d.status, d.revision, d.submitted_at, d.updated_at,
      exists(select 1 from public.learning_review_exclusions x where x.user_id = d.user_id)
        or coalesce(d.data #>> '{profile,displayName}', '') ilike '%Do Not Publish%' as excluded,
      (select jsonb_build_object('profile_decision', r.profile_decision,
        'subject_decisions', r.subject_decisions, 'feedback', r.feedback, 'created_at', r.created_at)
       from public.learning_application_reviews r where r.user_id = d.user_id and r.revision = d.revision
       order by r.id desc limit 1) as review
    from public.learning_instructor_drafts d where d.status in ('submitted','needs_changes')
  ) item), '[]'::jsonb);
end;
$$;

create or replace function public.review_learning_instructor_application(
  applicant_id uuid, expected_revision bigint, profile_decision text,
  subject_decisions jsonb, feedback text default ''
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  application public.learning_instructor_drafts%rowtype;
  decision jsonb;
  idx integer;
  changes boolean;
begin
  -- Lock membership too: concurrent revocation cannot race a review write.
  perform 1 from public.learning_review_staff where user_id = (select auth.uid()) for share;
  if not found then raise exception 'STAFF_REQUIRED'; end if;
  if applicant_id = (select auth.uid()) then raise exception 'SELF_REVIEW_DENIED'; end if;
  select * into application from public.learning_instructor_drafts where user_id = applicant_id for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
  if application.revision is distinct from expected_revision then raise exception 'STALE_REVISION'; end if;
  if application.status not in ('submitted','needs_changes') then raise exception 'NOT_SUBMITTED'; end if;
  if profile_decision is null or profile_decision not in ('pending','approved','needs_changes','rejected')
     or subject_decisions is null or jsonb_typeof(subject_decisions) is distinct from 'array'
     or feedback is null or length(feedback) > 4000 then raise exception 'INVALID_REVIEW'; end if;
  if jsonb_array_length(subject_decisions) <> jsonb_array_length(application.data -> 'subjects') then
    raise exception 'INVALID_REVIEW';
  end if;
  changes := profile_decision in ('needs_changes','rejected');
  idx := 0;
  for decision in select value from jsonb_array_elements(subject_decisions) loop
    -- Ordered subject decisions bind to this exact revision's subject array.
    if jsonb_typeof(decision) is distinct from 'object'
       or (decision ->> 'decision') is null
       or (decision ->> 'decision') not in ('pending','approved','needs_changes','rejected')
       or (decision ->> 'category') is distinct from (application.data -> 'subjects' -> idx ->> 'category')
       or (decision ->> 'subject') is distinct from (application.data -> 'subjects' -> idx ->> 'subject')
       or decision - 'decision' - 'category' - 'subject' <> '{}'::jsonb then
      raise exception 'INVALID_REVIEW';
    end if;
    changes := changes or (decision ->> 'decision') in ('needs_changes','rejected');
    idx := idx + 1;
  end loop;
  if changes and length(btrim(feedback)) = 0 then raise exception 'FEEDBACK_REQUIRED'; end if;
  if (profile_decision = 'approved' or exists(select 1 from jsonb_array_elements(subject_decisions) s where s ->> 'decision' = 'approved'))
    and (exists(select 1 from public.learning_review_exclusions x where x.user_id = applicant_id)
      or coalesce(application.data #>> '{profile,displayName}', '') ilike '%Do Not Publish%') then
    raise exception 'QA_APPROVAL_DENIED';
  end if;
  insert into public.learning_application_reviews (user_id, revision, reviewer_id, profile_decision, subject_decisions, feedback, snapshot)
    values (applicant_id, expected_revision, (select auth.uid()), profile_decision, subject_decisions, btrim(feedback), application.data);
  update public.learning_instructor_drafts set status = case when changes then 'needs_changes' else 'submitted' end,
    updated_at = now() where user_id = applicant_id;
  return 'reviewed';
end;
$$;

create or replace function public.learning_instructor_review_feedback()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('revision', r.revision, 'profile_decision', r.profile_decision,
    'subject_decisions', r.subject_decisions, 'feedback', r.feedback, 'created_at', r.created_at)
  from public.learning_application_reviews r
  join public.learning_instructor_drafts d on d.user_id = r.user_id and d.revision = r.revision
  where r.user_id = (select auth.uid()) order by r.id desc limit 1;
$$;
revoke all on function public.learning_staff_review_access(), public.learning_staff_review_queue(),
  public.review_learning_instructor_application(uuid,bigint,text,jsonb,text), public.learning_instructor_review_feedback()
  from public, anon, authenticated;
grant execute on function public.learning_staff_review_access(), public.learning_staff_review_queue(),
  public.review_learning_instructor_application(uuid,bigint,text,jsonb,text), public.learning_instructor_review_feedback()
  to authenticated;
commit;
