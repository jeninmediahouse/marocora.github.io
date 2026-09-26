-- Marocora Teaching & Learning instructor onboarding.
-- Run in the Marocora Supabase project's SQL Editor before enabling the client.
-- A draft is private. Publishing an instructor requires a separate staff process.

create table if not exists public.learning_instructor_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"profile":{},"subjects":[]}'::jsonb,
  status text not null default 'draft' check (status in ('draft','submitted','needs_changes')),
  revision bigint not null default 1,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint learning_instructor_draft_object check (jsonb_typeof(data) = 'object'),
  constraint learning_instructor_draft_size check (octet_length(data::text) <= 65536)
);

alter table public.learning_instructor_drafts enable row level security;
revoke all on public.learning_instructor_drafts from public, anon, authenticated;
grant select on public.learning_instructor_drafts to authenticated;
grant insert (user_id, data) on public.learning_instructor_drafts to authenticated;
grant update (data) on public.learning_instructor_drafts to authenticated;

create policy "Instructor reads own learning draft"
  on public.learning_instructor_drafts for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Instructor creates own learning draft"
  on public.learning_instructor_drafts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Instructor edits own learning draft"
  on public.learning_instructor_drafts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.touch_learning_instructor_draft()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.data is distinct from old.data then
    new.revision := old.revision + 1;
    new.status := 'draft';
    new.submitted_at := null;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger touch_learning_instructor_draft
  before update on public.learning_instructor_drafts
  for each row execute function public.touch_learning_instructor_draft();

create or replace function public.submit_learning_instructor_draft()
returns text language plpgsql security definer set search_path = '' as $$
declare
  application public.learning_instructor_drafts%rowtype;
  subject jsonb;
  offering jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  select * into application from public.learning_instructor_drafts
    where user_id = (select auth.uid()) for update;
  if not found then raise exception 'DRAFT_NOT_FOUND'; end if;
  if coalesce(length(btrim(application.data #>> '{profile,displayName}')),0) = 0
     or coalesce(length(btrim(application.data #>> '{profile,headline}')),0) = 0
     or coalesce(length(btrim(application.data #>> '{profile,bio}')),0) = 0
     or coalesce(length(btrim(application.data #>> '{profile,countryOfResidence}')),0) = 0
     or coalesce(length(btrim(application.data #>> '{profile,timezone}')),0) = 0 then
    raise exception 'DRAFT_INCOMPLETE';
  end if;
  if jsonb_typeof(application.data -> 'subjects') is distinct from 'array' then
    raise exception 'DRAFT_INCOMPLETE';
  end if;
  if jsonb_array_length(application.data -> 'subjects') = 0 then
    raise exception 'DRAFT_INCOMPLETE';
  end if;
  for subject in select value from jsonb_array_elements(application.data -> 'subjects') loop
    if coalesce(length(btrim(subject ->> 'category')),0) = 0
       or coalesce(length(btrim(subject ->> 'subject')),0) = 0
       or coalesce(length(btrim(subject ->> 'qualifications')),0) = 0 then
      raise exception 'DRAFT_INCOMPLETE';
    end if;
    if jsonb_typeof(subject -> 'offerings') is distinct from 'array' then
      raise exception 'DRAFT_INCOMPLETE';
    end if;
    if jsonb_array_length(subject -> 'offerings') = 0 then
      raise exception 'DRAFT_INCOMPLETE';
    end if;
    for offering in select value from jsonb_array_elements(subject -> 'offerings') loop
      if coalesce(length(btrim(offering ->> 'title')),0) = 0
         or coalesce(length(btrim(offering ->> 'currency')),0) != 3
         or jsonb_typeof(offering -> 'priceMinor') is distinct from 'number'
         or jsonb_typeof(offering -> 'durationMinutes') is distinct from 'number' then
        raise exception 'DRAFT_INCOMPLETE';
      end if;
      if (offering ->> 'priceMinor')::numeric < 0
         or (offering ->> 'durationMinutes')::numeric < 15 then
        raise exception 'DRAFT_INCOMPLETE';
      end if;
    end loop;
  end loop;
  update public.learning_instructor_drafts
    set status = 'submitted', submitted_at = coalesce(submitted_at, now()), updated_at = now()
    where user_id = (select auth.uid());
  return 'submitted';
end;
$$;

revoke all on function public.submit_learning_instructor_draft() from public, anon;
grant execute on function public.submit_learning_instructor_draft() to authenticated;
