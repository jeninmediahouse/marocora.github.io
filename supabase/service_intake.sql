-- Additive migration. No new staff memberships or public data access.
begin;
create table if not exists public.service_intakes (
 id uuid primary key,
 user_id uuid not null references auth.users(id),
 email text not null,
 email_verified_at timestamptz not null,
 kind text not null check(kind in ('contact','translation','translator','network','lesson','introduction')),
 fields jsonb not null check(jsonb_typeof(fields)='object'),
 request_hash text not null check(length(request_hash)=64),
 delivery text not null default 'dispatching' check(delivery in ('dispatching','delivered','rejected','uncertain')),
 work_status text not null default 'awaiting_review' check(work_status in ('awaiting_review','in_progress','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists service_intakes_user_time on public.service_intakes(user_id,created_at desc);
alter table public.service_intakes enable row level security;
revoke all on public.service_intakes from public,anon,authenticated;

create or replace function public.service_intake_reserve(p_id uuid,p_user uuid,p_kind text,p_fields jsonb,p_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u auth.users%rowtype; r public.service_intakes%rowtype;
begin
 -- Only the backend service role can execute this function. Recheck the actual
 -- auth.users record, never a caller-provided verified flag or email metadata.
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVER_REQUIRED'; end if;
 select * into u from auth.users where id=p_user and email_confirmed_at is not null and email is not null and not is_anonymous;
 if not found then raise exception 'EMAIL_VERIFICATION_REQUIRED'; end if;
 if lower(btrim(p_fields->>'email')) is distinct from lower(btrim(u.email)) then raise exception 'EMAIL_MISMATCH'; end if;
 if p_kind not in ('contact','translation','translator','network','lesson','introduction') or jsonb_typeof(p_fields) is distinct from 'object'
 or octet_length(p_fields::text)>50000 or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_REQUEST'; end if;
 -- Serialize submissions per user; limits and idempotency cannot race.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,0));
 select * into r from public.service_intakes where id=p_id;
 if found then
  if r.user_id<>p_user or r.request_hash<>p_hash or r.kind<>p_kind then raise exception 'REQUEST_CONFLICT'; end if;
  return jsonb_build_object('dispatch',false,'delivery',r.delivery,'verified_at',r.email_verified_at);
 end if;
 if (select count(*) from public.service_intakes where user_id=p_user and created_at>now()-interval '1 hour')>=10
 or (select count(*) from public.service_intakes where user_id=p_user and created_at>now()-interval '24 hours')>=30 then raise exception 'REQUEST_LIMIT'; end if;
 insert into public.service_intakes(id,user_id,email,email_verified_at,kind,fields,request_hash)
 values(p_id,p_user,u.email,u.email_confirmed_at,p_kind,p_fields,p_hash);
 return jsonb_build_object('dispatch',true,'delivery','dispatching','verified_at',u.email_confirmed_at);
end; $$;

create or replace function public.service_intake_delivery(p_id uuid,p_user uuid,p_delivery text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVER_REQUIRED'; end if;
 if p_delivery not in ('delivered','rejected','uncertain') then raise exception 'INVALID_DELIVERY'; end if;
 update public.service_intakes set delivery=p_delivery,updated_at=now() where id=p_id and user_id=p_user and delivery='dispatching';
 return found;
end; $$;

create or replace function public.service_intake_review_queue()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.learning_staff_review_access() then raise exception 'STAFF_REQUIRED'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r)-'request_hash' order by r.created_at desc) from
  (select * from public.service_intakes order by created_at desc limit 200) r),'[]');
end; $$;

create or replace function public.service_intake_set_work_status(p_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.learning_review_staff where user_id=auth.uid() for share;
 if not found then raise exception 'STAFF_REQUIRED'; end if;
 if p_status not in ('awaiting_review','in_progress','closed') then raise exception 'INVALID_STATUS'; end if;
 -- An arbitrary Formspree submission cannot create a work-ready record.
 update public.service_intakes r set work_status=p_status,updated_at=now()
 where r.id=p_id and exists(select 1 from auth.users u where u.id=r.user_id and u.email_confirmed_at is not null and lower(u.email)=lower(r.email));
 if not found then raise exception 'VERIFIED_REQUEST_REQUIRED'; end if;
 return true;
end; $$;

revoke all on function public.service_intake_reserve(uuid,uuid,text,jsonb,text),public.service_intake_delivery(uuid,uuid,text),public.service_intake_review_queue(),public.service_intake_set_work_status(uuid,text) from public,anon,authenticated;
grant execute on function public.service_intake_reserve(uuid,uuid,text,jsonb,text),public.service_intake_delivery(uuid,uuid,text) to service_role;
grant execute on function public.service_intake_review_queue(),public.service_intake_set_work_status(uuid,text) to authenticated;
commit;
