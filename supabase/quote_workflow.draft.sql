-- LOCAL REVIEW DRAFT ONLY. Not referenced by a deployment or migration runner.
-- Prerequisites: deployed service_intake, learning_launch, vendor_workflow and
-- vendor_workflow_test_fixtures. No capture trigger, backfill, API grant or mail.
-- This transaction ALWAYS rolls back. Runtime SQL verification is still pending.
begin;

create table public.quote_settings (
 singleton boolean primary key default true check(singleton),
 capture_enabled boolean not null default false,
 commands_enabled boolean not null default false,
 notifications_enabled boolean not null default false
);
insert into public.quote_settings default values;

create table public.quote_policies (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('participation','acceptance')),
 version text not null unique, digest text not null check(digest ~ '^[0-9a-f]{64}$'),
 wording jsonb not null check(jsonb_typeof(wording)='object' and wording ?& array['en','fr','ar','es']),
 approved_at timestamptz, approved_by uuid references auth.users(id),
 check((approved_at is null)=(approved_by is null))
);
create table public.quote_test_registry (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id), intake_id uuid references public.service_intakes(id),
 application_id uuid references public.vendor_applications(id),
 reason text not null check(length(btrim(reason)) between 1 and 2000),
 actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 check(num_nonnulls(user_id,intake_id,application_id)>0)
);
create table public.quote_intake_classifications (
 id uuid primary key default gen_random_uuid(), intake_id uuid not null references public.service_intakes(id),
 classification text not null check(classification in ('production','test')),
 source text not null check(source in ('server_rule','staff')),
 reason text not null check(length(btrim(reason)) between 1 and 2000),
 actor_id uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.quote_requests (
 id uuid primary key default gen_random_uuid(), intake_id uuid not null unique references public.service_intakes(id),
 customer_id uuid not null references auth.users(id), owner_id uuid references public.learning_review_staff(user_id),
 state text not null default 'open' check(state in ('open','accepted_pending_activation','cancelled','closed_unfulfilled')),
 revision bigint not null default 1 check(revision>0), scope_version integer not null default 1 check(scope_version>0),
 is_test boolean not null default false, accepted_offer_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), closed_at timestamptz,
 check(state<>'accepted_pending_activation' or accepted_offer_id is not null)
);
create table public.quote_request_versions (
 request_id uuid not null references public.quote_requests(id), version integer not null check(version>0),
 scope jsonb not null check(jsonb_typeof(scope)='object' and octet_length(scope::text)<=40000),
 digest text not null check(digest ~ '^[0-9a-f]{64}$'),
 author_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 primary key(request_id,version)
);
alter table public.quote_requests add constraint quote_current_scope_fk foreign key(id,scope_version)
 references public.quote_request_versions(request_id,version) deferrable initially deferred;

create table public.quote_provider_readiness (
 id uuid primary key default gen_random_uuid(), provider_id uuid not null references auth.users(id),
 application_id uuid not null references public.vendor_applications(id), application_revision bigint not null check(application_revision>0),
 approval_event_id uuid not null references public.vendor_application_events(id),
 version integer not null check(version>0), revision bigint not null default 1 check(revision>0),
 state text not null default 'proposed' check(state in ('proposed','acknowledged','enabled','closed')),
 capabilities jsonb not null check(jsonb_typeof(capabilities)='object' and octet_length(capabilities::text)<=20000),
 capability_digest text not null check(capability_digest ~ '^[0-9a-f]{64}$'),
 policy_id uuid not null references public.quote_policies(id), reviewer_id uuid not null references public.learning_review_staff(user_id),
 created_at timestamptz not null default now(), enabled_at timestamptz, closed_at timestamptz,
 check(reviewer_id<>provider_id), unique(provider_id,version), unique(id,provider_id)
);
create unique index quote_one_enabled_readiness on public.quote_provider_readiness(provider_id) where state='enabled';
create table public.quote_provider_acknowledgements (
 readiness_id uuid primary key, provider_id uuid not null references auth.users(id),
 capability_digest text not null check(capability_digest ~ '^[0-9a-f]{64}$'),
 policy_id uuid not null references public.quote_policies(id), policy_digest text not null check(policy_digest ~ '^[0-9a-f]{64}$'),
 language text not null check(language in ('en','fr','ar','es')), created_at timestamptz not null default now(),
 foreign key(readiness_id,provider_id) references public.quote_provider_readiness(id,provider_id)
);
create table public.quote_assignments (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.quote_requests(id),
 readiness_id uuid not null, provider_id uuid not null references auth.users(id), scope_version integer not null,
 state text not null default 'invited' check(state in ('invited','accepted','declined','revoked','ended')),
 reason text, invited_at timestamptz not null default now(), responded_at timestamptz,
 foreign key(request_id,scope_version) references public.quote_request_versions(request_id,version),
 foreign key(readiness_id,provider_id) references public.quote_provider_readiness(id,provider_id),
 unique(id,request_id,provider_id,scope_version)
);
create unique index quote_one_active_assignment on public.quote_assignments(request_id) where state in ('invited','accepted');
create table public.quote_offers (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.quote_requests(id),
 assignment_id uuid not null, provider_id uuid not null references auth.users(id), scope_version integer not null,
 version integer not null check(version>0), content jsonb not null check(jsonb_typeof(content)='object' and octet_length(content::text)<=40000),
 total_minor bigint not null check(total_minor between 1 and 999999999999),
 currency text not null check(currency ~ '^[A-Z]{3}$'), currency_digits smallint not null check(currency_digits between 0 and 4),
 expires_at timestamptz not null, policy_id uuid not null references public.quote_policies(id),
 digest text not null check(digest ~ '^[0-9a-f]{64}$'),
 state text not null default 'offered' check(state in ('offered','superseded','withdrawn','declined','accepted')),
 issued_at timestamptz not null default now(), check(expires_at>issued_at),
 unique(request_id,version), unique(id,request_id),
 foreign key(assignment_id,request_id,provider_id,scope_version) references public.quote_assignments(id,request_id,provider_id,scope_version)
);
create unique index quote_one_live_offer on public.quote_offers(request_id) where state='offered';
create unique index quote_one_accepted_offer on public.quote_offers(request_id) where state='accepted';
alter table public.quote_requests add constraint quote_accepted_offer_fk foreign key(accepted_offer_id,id)
 references public.quote_offers(id,request_id) deferrable initially deferred;
create table public.quote_acceptances (
 request_id uuid primary key references public.quote_requests(id), offer_id uuid not null unique,
 actor_id uuid not null references auth.users(id), offer_digest text not null check(offer_digest ~ '^[0-9a-f]{64}$'),
 policy_id uuid not null references public.quote_policies(id), policy_digest text not null check(policy_digest ~ '^[0-9a-f]{64}$'),
 language text not null check(language in ('en','fr','ar','es')), created_at timestamptz not null default now(),
 foreign key(offer_id,request_id) references public.quote_offers(id,request_id)
);
create table public.quote_threads (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.quote_requests(id),
 audience text not null check(audience in ('staff','customer','provider')), participant_id uuid references auth.users(id),
 state text not null default 'open' check(state in ('open','answered','closed')), created_at timestamptz not null default now()
);
create table public.quote_messages (
 id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.quote_threads(id),
 actor_id uuid not null references auth.users(id), kind text not null check(kind in ('question','answer','concern','note')),
 body text not null check(length(btrim(body)) between 1 and 8000), created_at timestamptz not null default now()
);
create table public.quote_events (
 id uuid primary key default gen_random_uuid(), aggregate_type text not null check(aggregate_type in ('request','readiness')),
 aggregate_id uuid not null, revision bigint not null check(revision>0), request_id uuid references public.quote_requests(id),
 actor_id uuid references auth.users(id), kind text not null, payload jsonb not null default '{}', created_at timestamptz not null default now(),
 unique(aggregate_type,aggregate_id,revision)
);
create table public.quote_commands (
 id uuid primary key, actor_id uuid not null references auth.users(id), action text not null, target_id uuid not null,
 expected_revision bigint not null check(expected_revision>0), input_hash text not null check(input_hash ~ '^[0-9a-f]{64}$'),
 result jsonb not null, event_id uuid not null references public.quote_events(id), created_at timestamptz not null default now()
);
create table public.quote_deliveries (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.quote_events(id),
 recipient_id uuid not null references auth.users(id), roles text[] not null,
 destination text, content jsonb, content_digest text check(content_digest ~ '^[0-9a-f]{64}$'),
 idempotency_key text not null unique, state text not null check(state in ('pending','sending','accepted','uncertain','failed','suppressed')),
 reason text, claimed_at timestamptz, provider_id text, accepted_at timestamptz, created_at timestamptz not null default now(),
 unique(event_id,recipient_id), check(idempotency_key='marocora-quote/'||id::text),
 check(state not in ('sending','accepted','uncertain') or (destination is not null and content is not null and content_digest is not null)),
 check(state<>'accepted' or (provider_id is not null and accepted_at is not null))
);
create table public.quote_delivery_evidence (
 id uuid primary key default gen_random_uuid(), delivery_id uuid not null references public.quote_deliveries(id),
 actor_id uuid references auth.users(id), source text not null, outcome text not null,
 evidence jsonb not null default '{}', created_at timestamptz not null default now()
);
create index quote_owner_queue on public.quote_requests(owner_id,state,updated_at desc,id);
create index quote_customer_requests on public.quote_requests(customer_id,created_at desc,id);
create index quote_provider_assignments on public.quote_assignments(provider_id,state,invited_at desc,id);
create index quote_delivery_exceptions on public.quote_deliveries(state,created_at,id);

-- Generic history protection. Mutable aggregate/assignment/offer state transitions
-- additionally need controlled command functions; none are granted in this draft.
create function public.quote_append_only() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'QUOTE_IMMUTABLE_HISTORY'; end; $$;
create function public.quote_offer_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'QUOTE_IMMUTABLE_OFFER'; end if;
 if (to_jsonb(new)-'state') is distinct from (to_jsonb(old)-'state') then raise exception 'QUOTE_IMMUTABLE_OFFER'; end if;
 if old.state<>'offered' and new.state<>old.state then raise exception 'QUOTE_TERMINAL_OFFER'; end if;
 return new;
end; $$;
create trigger quote_offer_immutable before update or delete on public.quote_offers for each row execute function public.quote_offer_immutable();
create function public.quote_request_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'QUOTE_HISTORY_REQUIRED'; end if;
 if old.is_test then new.is_test:=true; end if;
 if (new.id,new.intake_id,new.customer_id) is distinct from (old.id,old.intake_id,old.customer_id) then raise exception 'QUOTE_IDENTITY_IMMUTABLE'; end if;
 if old.accepted_offer_id is not null and new.accepted_offer_id is distinct from old.accepted_offer_id then raise exception 'QUOTE_ACCEPTANCE_IMMUTABLE'; end if;
 if (old.state in ('cancelled','closed_unfulfilled') and new.state<>old.state)
 or (old.state='accepted_pending_activation' and new.state not in ('accepted_pending_activation','cancelled')) then raise exception 'QUOTE_TERMINAL_REQUEST'; end if;
 return new;
end; $$;
create trigger quote_request_guard before update or delete on public.quote_requests for each row execute function public.quote_request_guard();

do $$
declare table_name text;
begin
 foreach table_name in array array['quote_settings','quote_policies','quote_test_registry','quote_intake_classifications','quote_requests','quote_request_versions','quote_provider_readiness','quote_provider_acknowledgements','quote_assignments','quote_offers','quote_acceptances','quote_threads','quote_messages','quote_events','quote_commands','quote_deliveries','quote_delivery_evidence'] loop
  execute format('alter table public.%I enable row level security',table_name);
  execute format('revoke all on public.%I from public, anon, authenticated, service_role',table_name);
 end loop;
 foreach table_name in array array['quote_policies','quote_test_registry','quote_intake_classifications','quote_request_versions','quote_provider_acknowledgements','quote_acceptances','quote_messages','quote_events','quote_commands','quote_delivery_evidence'] loop
  execute format('create trigger quote_append_only before update or delete on public.%I for each row execute function public.quote_append_only()',table_name);
 end loop;
end; $$;
revoke all on function public.quote_append_only(),public.quote_offer_immutable(),public.quote_request_guard() from public,anon,authenticated,service_role;

-- No API functions yet: do NOT grant direct access as a substitute. Next stage
-- must enforce verified actors, current vendor/readiness/exclusions under locks,
-- exact policies/digests, sticky classifications, canonical enums/currency data,
-- command replay atomicity, narrow reads and notification suppression in SQL.
-- Do not remove ROLLBACK to deploy this draft.
rollback;
