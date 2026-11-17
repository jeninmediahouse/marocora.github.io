-- Translation schema for an owner-managed STAGING project. No accounts or fixture data.
-- Supabase Auth and standard roles must already exist. All runtime switches are seeded OFF.
BEGIN;
DO $preflight$ BEGIN
 IF to_regclass('auth.users') IS NULL THEN RAISE EXCEPTION 'SUPABASE_AUTH_REQUIRED';END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(ARRAY['translation_staff','translation_exclusions','translation_provider_applications','translation_provider_events','translation_intakes','quote_settings','quote_policies','quote_test_registry','quote_intake_classifications','quote_requests','quote_request_versions','quote_provider_readiness','quote_provider_acknowledgements','quote_assignments','quote_offers','quote_acceptances','quote_threads','quote_messages','quote_events','quote_commands','quote_deliveries','quote_delivery_evidence','translation_settings','translation_files','translation_scan_events','translation_cert_submissions','translation_cert_credential_scans','translation_cert_credentials','translation_cert_credential_reviews','translation_cert_fulfillments','translation_cert_mock_mail','translation_staging_accounts'])) THEN RAISE EXCEPTION 'TRANSLATION_SCHEMA_ALREADY_EXISTS_STOP_AND_COMPARE';END IF;
 END;$preflight$;



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = true;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;


CREATE TABLE public.quote_provider_readiness (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    application_id uuid NOT NULL,
    application_revision bigint NOT NULL,
    approval_event_id uuid NOT NULL,
    version integer NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    state text DEFAULT 'proposed'::text NOT NULL,
    capabilities jsonb NOT NULL,
    capability_digest text NOT NULL,
    policy_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    enabled_at timestamp with time zone,
    closed_at timestamp with time zone,
    CONSTRAINT quote_provider_readiness_application_revision_check CHECK ((application_revision > 0)),
    CONSTRAINT quote_provider_readiness_capabilities_check CHECK (((jsonb_typeof(capabilities) = 'object'::text) AND (octet_length((capabilities)::text) <= 20000))),
    CONSTRAINT quote_provider_readiness_capability_digest_check CHECK ((capability_digest ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT quote_provider_readiness_check CHECK ((reviewer_id <> provider_id)),
    CONSTRAINT quote_provider_readiness_revision_check CHECK ((revision > 0)),
    CONSTRAINT quote_provider_readiness_state_check CHECK ((state = ANY (ARRAY['proposed'::text, 'acknowledged'::text, 'enabled'::text, 'closed'::text]))),
    CONSTRAINT quote_provider_readiness_version_check CHECK ((version > 0))
);



CREATE TABLE public.quote_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind text NOT NULL,
    version text NOT NULL,
    digest text NOT NULL,
    wording jsonb NOT NULL,
    approved_at timestamp with time zone,
    approved_by uuid,
    CONSTRAINT quote_policies_check CHECK (((approved_at IS NULL) = (approved_by IS NULL))),
    CONSTRAINT quote_policies_digest_check CHECK ((digest ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT quote_policies_kind_check CHECK ((kind = ANY (ARRAY['participation'::text, 'acceptance'::text]))),
    CONSTRAINT quote_policies_wording_check CHECK (((jsonb_typeof(wording) = 'object'::text) AND (wording ?& ARRAY['en'::text, 'fr'::text, 'ar'::text, 'es'::text])))
);



CREATE TABLE public.translation_provider_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    source_key text NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    fields jsonb NOT NULL,
    source_revision bigint,
    revision bigint DEFAULT 1 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    message text DEFAULT ''::text NOT NULL,
    questions jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_test boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT translation_provider_applications_source_check CHECK ((source = ANY (ARRAY['translator'::text, 'network'::text, 'teacher'::text]))),
    CONSTRAINT translation_provider_applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'needs_information'::text, 'approved'::text, 'declined'::text])))
);



CREATE TABLE public.translation_scan_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id uuid NOT NULL,
    sha256 text NOT NULL,
    status text NOT NULL,
    engine text NOT NULL,
    reason text NOT NULL,
    actor_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT translation_scan_events_sha256_check CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT translation_scan_events_status_check CHECK ((status = ANY (ARRAY['clean'::text, 'quarantined'::text, 'infected'::text, 'error'::text])))
);



CREATE TABLE public.translation_files (
    id uuid NOT NULL,
    request_id uuid NOT NULL,
    uploader_id uuid NOT NULL,
    scope_version integer NOT NULL,
    name text NOT NULL,
    size integer NOT NULL,
    sha256 text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    media_type text DEFAULT 'text/plain'::text NOT NULL,
    CONSTRAINT translation_files_media_type_check CHECK ((media_type = ANY (ARRAY['text/plain'::text, 'application/pdf'::text, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'::text, 'image/jpeg'::text, 'image/png'::text]))),
    CONSTRAINT translation_files_name_check CHECK (((length(name) >= 1) AND (length(name) <= 120))),
    CONSTRAINT translation_files_sha256_check CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT translation_files_size_check CHECK (((size >= 1) AND (size <= 10000000)))
);



CREATE TABLE public.translation_settings (
    singleton boolean DEFAULT true NOT NULL,
    owner_id uuid NOT NULL,
    CONSTRAINT translation_settings_singleton_check CHECK (singleton)
);



CREATE TABLE public.translation_cert_credential_reviews (
    id uuid NOT NULL,
    credential_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    decision text NOT NULL,
    reason text NOT NULL,
    revision bigint NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT translation_cert_credential_reviews_decision_check CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text, 'revoked'::text])))
);



CREATE TABLE public.translation_cert_credential_scans (
    id uuid NOT NULL,
    provider_id uuid NOT NULL,
    sha256 text NOT NULL,
    status text NOT NULL,
    engine text NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT translation_cert_credential_scans_status_check CHECK ((status = ANY (ARRAY['clean'::text, 'infected'::text, 'error'::text])))
);



CREATE TABLE public.translation_cert_credentials (
    id uuid NOT NULL,
    provider_id uuid NOT NULL,
    legal_name text NOT NULL,
    dob text NOT NULL,
    credential_number text NOT NULL,
    name text NOT NULL,
    media_type text NOT NULL,
    size integer NOT NULL,
    sha256 text NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT translation_cert_credentials_media_type_check CHECK ((media_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text]))),
    CONSTRAINT translation_cert_credentials_size_check CHECK (((size >= 1) AND (size <= 10000000)))
);



CREATE TABLE public.translation_cert_fulfillments (
    request_id uuid NOT NULL,
    choice jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);



CREATE TABLE public.translation_cert_mock_mail (
    request_id uuid NOT NULL,
    destination text NOT NULL,
    kind text NOT NULL,
    state text NOT NULL,
    content jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT translation_cert_mock_mail_kind_check CHECK ((kind = ANY (ARRAY['final_file_email_requested'::text, 'usb_password_email_requested'::text]))),
    CONSTRAINT translation_cert_mock_mail_state_check CHECK ((state = ANY (ARRAY['waiting_for_final_file'::text, 'waiting_for_encrypted_usb_preparation'::text, 'suppressed'::text])))
);



CREATE TABLE public.translation_cert_submissions (
    request_id uuid NOT NULL,
    submitted_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);



CREATE TABLE public.translation_exclusions (
    user_id uuid NOT NULL,
    reason text NOT NULL
);



CREATE TABLE public.translation_staff (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.quote_acceptances (
    request_id uuid NOT NULL,
    offer_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    offer_digest text NOT NULL,
    policy_id uuid NOT NULL,
    policy_digest text NOT NULL,
    language text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_acceptances_language_check CHECK ((language = ANY (ARRAY['en'::text, 'fr'::text, 'ar'::text, 'es'::text]))),
    CONSTRAINT quote_acceptances_offer_digest_check CHECK ((offer_digest ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT quote_acceptances_policy_digest_check CHECK ((policy_digest ~ '^[0-9a-f]{64}$'::text))
);



CREATE TABLE public.quote_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    readiness_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    scope_version integer NOT NULL,
    state text DEFAULT 'invited'::text NOT NULL,
    reason text,
    invited_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    CONSTRAINT quote_assignments_state_check CHECK ((state = ANY (ARRAY['invited'::text, 'accepted'::text, 'declined'::text, 'revoked'::text, 'ended'::text])))
);



CREATE TABLE public.quote_commands (
    id uuid NOT NULL,
    actor_id uuid NOT NULL,
    action text NOT NULL,
    target_id uuid NOT NULL,
    expected_revision bigint NOT NULL,
    input_hash text NOT NULL,
    result jsonb NOT NULL,
    event_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_commands_expected_revision_check CHECK ((expected_revision >= 0)),
    CONSTRAINT quote_commands_input_hash_check CHECK ((input_hash ~ '^[0-9a-f]{64}$'::text))
);



CREATE TABLE public.quote_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    roles text[] NOT NULL,
    destination text,
    content jsonb,
    content_digest text,
    idempotency_key text NOT NULL,
    state text NOT NULL,
    reason text,
    claimed_at timestamp with time zone,
    provider_id text,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_deliveries_check CHECK ((idempotency_key = ('marocora-quote/'::text || (id)::text))),
    CONSTRAINT quote_deliveries_check1 CHECK (((state <> ALL (ARRAY['sending'::text, 'accepted'::text, 'uncertain'::text])) OR ((destination IS NOT NULL) AND (content IS NOT NULL) AND (content_digest IS NOT NULL)))),
    CONSTRAINT quote_deliveries_check2 CHECK (((state <> 'accepted'::text) OR ((provider_id IS NOT NULL) AND (accepted_at IS NOT NULL)))),
    CONSTRAINT quote_deliveries_content_digest_check CHECK ((content_digest ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT quote_deliveries_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'sending'::text, 'accepted'::text, 'uncertain'::text, 'failed'::text, 'suppressed'::text])))
);



CREATE TABLE public.quote_delivery_evidence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    delivery_id uuid NOT NULL,
    actor_id uuid,
    source text NOT NULL,
    outcome text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.quote_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id uuid NOT NULL,
    revision bigint NOT NULL,
    request_id uuid,
    actor_id uuid,
    kind text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_events_aggregate_type_check CHECK ((aggregate_type = ANY (ARRAY['request'::text, 'readiness'::text]))),
    CONSTRAINT quote_events_revision_check CHECK ((revision > 0))
);



CREATE TABLE public.quote_intake_classifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    intake_id uuid NOT NULL,
    classification text NOT NULL,
    source text NOT NULL,
    reason text NOT NULL,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_intake_classifications_classification_check CHECK ((classification = ANY (ARRAY['production'::text, 'test'::text]))),
    CONSTRAINT quote_intake_classifications_reason_check CHECK (((length(btrim(reason)) >= 1) AND (length(btrim(reason)) <= 2000))),
    CONSTRAINT quote_intake_classifications_source_check CHECK ((source = ANY (ARRAY['server_rule'::text, 'staff'::text])))
);



CREATE TABLE public.quote_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    kind text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_messages_body_check CHECK (((length(btrim(body)) >= 1) AND (length(btrim(body)) <= 8000))),
    CONSTRAINT quote_messages_kind_check CHECK ((kind = ANY (ARRAY['question'::text, 'answer'::text, 'concern'::text, 'note'::text])))
);



CREATE TABLE public.quote_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    assignment_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    scope_version integer NOT NULL,
    version integer NOT NULL,
    content jsonb NOT NULL,
    total_minor bigint NOT NULL,
    currency text NOT NULL,
    currency_digits smallint NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    policy_id uuid NOT NULL,
    digest text NOT NULL,
    state text DEFAULT 'offered'::text NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    issued_by uuid,
    CONSTRAINT quote_offers_check CHECK ((expires_at > issued_at)),
    CONSTRAINT quote_offers_content_check CHECK (((jsonb_typeof(content) = 'object'::text) AND (octet_length((content)::text) <= 40000))),
    CONSTRAINT quote_offers_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT quote_offers_currency_digits_check CHECK (((currency_digits >= 0) AND (currency_digits <= 4))),
    CONSTRAINT quote_offers_digest_check CHECK ((digest ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT quote_offers_state_check CHECK ((state = ANY (ARRAY['offered'::text, 'superseded'::text, 'withdrawn'::text, 'declined'::text, 'accepted'::text]))),
    CONSTRAINT quote_offers_total_minor_check CHECK (((total_minor >= 1) AND (total_minor <= '999999999999'::bigint))),
    CONSTRAINT quote_offers_version_check CHECK ((version > 0))
);



CREATE TABLE public.quote_provider_acknowledgements (
    readiness_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    capability_digest text NOT NULL,
    policy_id uuid NOT NULL,
    policy_digest text NOT NULL,
    language text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_provider_acknowledgements_capability_digest_check CHECK ((capability_digest ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT quote_provider_acknowledgements_language_check CHECK ((language = ANY (ARRAY['en'::text, 'fr'::text, 'ar'::text, 'es'::text]))),
    CONSTRAINT quote_provider_acknowledgements_policy_digest_check CHECK ((policy_digest ~ '^[0-9a-f]{64}$'::text))
);



CREATE TABLE public.quote_request_versions (
    request_id uuid NOT NULL,
    version integer NOT NULL,
    scope jsonb NOT NULL,
    digest text NOT NULL,
    author_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_request_versions_digest_check CHECK ((digest ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT quote_request_versions_scope_check CHECK (((jsonb_typeof(scope) = 'object'::text) AND (octet_length((scope)::text) <= 40000))),
    CONSTRAINT quote_request_versions_version_check CHECK ((version > 0))
);



CREATE TABLE public.quote_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    intake_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    owner_id uuid,
    state text DEFAULT 'open'::text NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    scope_version integer DEFAULT 1 NOT NULL,
    is_test boolean DEFAULT false NOT NULL,
    accepted_offer_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    CONSTRAINT quote_requests_check CHECK (((state <> 'accepted_pending_activation'::text) OR (accepted_offer_id IS NOT NULL))),
    CONSTRAINT quote_requests_revision_check CHECK ((revision > 0)),
    CONSTRAINT quote_requests_scope_version_check CHECK ((scope_version > 0)),
    CONSTRAINT quote_requests_state_check CHECK ((state = ANY (ARRAY['open'::text, 'accepted_pending_activation'::text, 'cancelled'::text, 'closed_unfulfilled'::text])))
);



CREATE TABLE public.quote_settings (
    singleton boolean DEFAULT true NOT NULL,
    capture_enabled boolean DEFAULT false NOT NULL,
    commands_enabled boolean DEFAULT false NOT NULL,
    notifications_enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT quote_settings_singleton_check CHECK (singleton)
);



CREATE TABLE public.quote_test_registry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    intake_id uuid,
    application_id uuid,
    reason text NOT NULL,
    actor_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_test_registry_check CHECK ((num_nonnulls(user_id, intake_id, application_id) > 0)),
    CONSTRAINT quote_test_registry_reason_check CHECK (((length(btrim(reason)) >= 1) AND (length(btrim(reason)) <= 2000)))
);



CREATE TABLE public.quote_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    audience text NOT NULL,
    participant_id uuid,
    state text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_threads_audience_check CHECK ((audience = ANY (ARRAY['staff'::text, 'customer'::text, 'provider'::text]))),
    CONSTRAINT quote_threads_state_check CHECK ((state = ANY (ARRAY['open'::text, 'answered'::text, 'closed'::text])))
);



CREATE TABLE public.translation_intakes (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    email_verified_at timestamp with time zone NOT NULL,
    kind text NOT NULL,
    fields jsonb NOT NULL,
    request_hash text NOT NULL,
    delivery text DEFAULT 'dispatching'::text NOT NULL,
    work_status text DEFAULT 'awaiting_review'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT translation_intakes_delivery_check CHECK ((delivery = ANY (ARRAY['dispatching'::text, 'delivered'::text, 'rejected'::text, 'uncertain'::text]))),
    CONSTRAINT translation_intakes_fields_check CHECK ((jsonb_typeof(fields) = 'object'::text)),
    CONSTRAINT translation_intakes_kind_check CHECK ((kind = ANY (ARRAY['contact'::text, 'translation'::text, 'translator'::text, 'network'::text, 'lesson'::text, 'introduction'::text]))),
    CONSTRAINT translation_intakes_request_hash_check CHECK ((length(request_hash) = 64)),
    CONSTRAINT translation_intakes_work_status_check CHECK ((work_status = ANY (ARRAY['awaiting_review'::text, 'in_progress'::text, 'closed'::text])))
);



CREATE TABLE public.translation_provider_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    command_id uuid,
    actor_id uuid,
    kind text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    delivery text DEFAULT 'pending'::text NOT NULL,
    claimed_at timestamp with time zone,
    sent_at timestamp with time zone,
    CONSTRAINT translation_provider_events_delivery_check CHECK ((delivery = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'uncertain'::text, 'failed'::text, 'external'::text])))
);





CREATE TABLE public.translation_staging_accounts(user_id uuid PRIMARY KEY REFERENCES auth.users(id),enabled boolean NOT NULL DEFAULT true); ALTER TABLE public.translation_staging_accounts ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.quote_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin raise exception 'QUOTE_IMMUTABLE_HISTORY'; end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_offer_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if tg_op='DELETE' then raise exception 'QUOTE_IMMUTABLE_OFFER'; end if;
 if (to_jsonb(new)-'state') is distinct from (to_jsonb(old)-'state') then raise exception 'QUOTE_IMMUTABLE_OFFER'; end if;
 if old.state<>'offered' and new.state<>old.state then raise exception 'QUOTE_TERMINAL_OFFER'; end if;
 return new;
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_request_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if tg_op='DELETE' then raise exception 'QUOTE_HISTORY_REQUIRED'; end if;
 if old.is_test then new.is_test:=true; end if;
 if (new.id,new.intake_id,new.customer_id) is distinct from (old.id,old.intake_id,old.customer_id) then raise exception 'QUOTE_IDENTITY_IMMUTABLE'; end if;
 if old.accepted_offer_id is not null and new.accepted_offer_id is distinct from old.accepted_offer_id then raise exception 'QUOTE_ACCEPTANCE_IMMUTABLE'; end if;
 if (old.state in ('cancelled','closed_unfulfilled') and new.state<>old.state)
 or (old.state='accepted_pending_activation' and new.state not in ('accepted_pending_activation','cancelled')) then raise exception 'QUOTE_TERMINAL_REQUEST'; end if;
 return new;
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_assert(ok boolean, code text DEFAULT 'INVALID_INPUT'::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin if ok is distinct from true then raise exception '%',code; end if; end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_object(v jsonb, allowed text[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 perform public.quote_assert(jsonb_typeof(v)='object');
 perform public.quote_assert(not exists(select 1 from jsonb_object_keys(v) k where not k=any(allowed)));
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_text(v jsonb, maximum integer DEFAULT 8000)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare t text;
begin
 perform public.quote_assert(jsonb_typeof(v)='string'); t:=btrim(v#>>'{}');
 perform public.quote_assert(length(t) between 1 and maximum); return normalize(t,NFC);
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_integer(v jsonb, minimum bigint DEFAULT 1, maximum bigint DEFAULT '999999999999'::bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare n numeric;
begin
 perform public.quote_assert(jsonb_typeof(v)='number'); n:=(v#>>'{}')::numeric;
 perform public.quote_assert(n=trunc(n) and n between minimum and maximum); return n::bigint;
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_canonical(v jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare result text;
begin
 case jsonb_typeof(v)
 when 'object' then select '{'||coalesce(string_agg(to_jsonb(key)::text||':'||public.quote_canonical(value),',' order by key collate "C"),'')||'}' into result from jsonb_each(v);
 when 'array' then select '['||coalesce(string_agg(public.quote_canonical(value),',' order by ord),'')||']' into result from jsonb_array_elements(v) with ordinality as a(value,ord);
 when 'number' then perform public.quote_integer(v,-9007199254740991,9007199254740991); result:=trunc((v#>>'{}')::numeric)::text;
 when 'string' then result:=v::text;
 when 'boolean' then result:=v::text;
 when 'null' then result:='null';
 else raise exception 'INVALID_INPUT';
 end case; return result;
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_digest(v jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select encode(sha256(convert_to(public.quote_canonical(v),'UTF8')),'hex'); $function$
;
CREATE OR REPLACE FUNCTION public.quote_instant(v jsonb)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare t text; ts timestamptz;
begin
 t:=public.quote_text(v,30);
 perform public.quote_assert(t ~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$');
 ts:=t::timestamptz;
 perform public.quote_assert(to_char(ts at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')=t);
 return ts;
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_currency_digits(code text)
 RETURNS smallint
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select ('{"AED":2,"AFN":2,"ALL":2,"AMD":2,"AOA":2,"ARS":2,"AUD":2,"AWG":2,"AZN":2,"BAM":2,"BBD":2,"BDT":2,"BHD":3,"BIF":0,"BMD":2,"BND":2,"BOB":2,"BOV":2,"BRL":2,"BSD":2,"BTN":2,"BWP":2,"BYN":2,"BZD":2,"CAD":2,"CDF":2,"CHE":2,"CHF":2,"CHW":2,"CLF":4,"CLP":0,"CNY":2,"COP":2,"COU":2,"CRC":2,"CUP":2,"CVE":2,"CZK":2,"DJF":0,"DKK":2,"DOP":2,"DZD":2,"EGP":2,"ERN":2,"ETB":2,"EUR":2,"FJD":2,"FKP":2,"GBP":2,"GEL":2,"GHS":2,"GIP":2,"GMD":2,"GNF":0,"GTQ":2,"GYD":2,"HKD":2,"HNL":2,"HTG":2,"HUF":2,"IDR":2,"ILS":2,"INR":2,"IQD":3,"IRR":2,"ISK":0,"JMD":2,"JOD":3,"JPY":0,"KES":2,"KGS":2,"KHR":2,"KMF":0,"KPW":2,"KRW":0,"KWD":3,"KYD":2,"KZT":2,"LAK":2,"LBP":2,"LKR":2,"LRD":2,"LSL":2,"LYD":3,"MAD":2,"MDL":2,"MGA":2,"MKD":2,"MMK":2,"MNT":2,"MOP":2,"MRU":2,"MUR":2,"MVR":2,"MWK":2,"MXN":2,"MXV":2,"MYR":2,"MZN":2,"NAD":2,"NGN":2,"NIO":2,"NOK":2,"NPR":2,"NZD":2,"OMR":3,"PAB":2,"PEN":2,"PGK":2,"PHP":2,"PKR":2,"PLN":2,"PYG":0,"QAR":2,"RON":2,"RSD":2,"RUB":2,"RWF":0,"SAR":2,"SBD":2,"SCR":2,"SDG":2,"SEK":2,"SGD":2,"SHP":2,"SLE":2,"SOS":2,"SRD":2,"SSP":2,"STN":2,"SVC":2,"SYP":2,"SZL":2,"THB":2,"TJS":2,"TMT":2,"TND":3,"TOP":2,"TRY":2,"TTD":2,"TWD":2,"TZS":2,"UAH":2,"UGX":0,"USD":2,"USN":2,"UYI":0,"UYU":2,"UYW":4,"UZS":2,"VED":2,"VES":2,"VND":0,"VUV":0,"WST":2,"XAD":2,"XAF":0,"XCD":2,"XCG":2,"XOF":0,"XPF":0,"YER":2,"ZAR":2,"ZMW":2,"ZWG":2}'::jsonb ->> code)::smallint; $function$
;
CREATE OR REPLACE FUNCTION public.quote_money(v jsonb, budget boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare n bigint; c text; d smallint;
begin
 perform public.quote_object(v,array['minor','currency']);
 n:=public.quote_integer(v->'minor',case when budget then 0 else 1 end); c:=public.quote_text(v->'currency',3); d:=public.quote_currency_digits(c);
 perform public.quote_assert(d is not null,'INVALID_CURRENCY'); return jsonb_build_object('minor',n,'currency',c,'digits',d);
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_scope(v jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare s text; src text; dst text; result jsonb; i jsonb; z text; c jsonb; b jsonb;
begin
 perform public.quote_object(v,array['service','source','target','description','budget','interpretation','certified']);
 s:=public.quote_text(v->'service',100); src:=public.quote_text(v->'source',100); dst:=public.quote_text(v->'target',100);
 perform public.quote_assert(s=any(array['Document Translation','Sworn Translation (Morocco)','Interpretation','Business Translation','Website & Digital Translation','Other Language Service']),'INVALID_SERVICE');
 perform public.quote_assert(lower(normalize(src,NFKC))<>lower(normalize(dst,NFKC)) and lower(src)<>'other' and lower(dst)<>'other','INVALID_LANGUAGE_PAIR');
 result:=jsonb_build_object('service',s,'source',src,'target',dst,'description',public.quote_text(v->'description'));
 if v ? 'budget' then b:=public.quote_money(v->'budget',true)-'digits'; result:=result||jsonb_build_object('budget',b); end if;
 if s='Interpretation' then
  i:=v->'interpretation'; perform public.quote_object(i,array['mode','location','startsAt','timeZone','durationMinutes']);
  perform public.quote_assert(i->>'mode'=any(array['remote','in_person'])); z:=public.quote_text(i->'timeZone',100);
  perform public.quote_assert((z='UTC' or position('/' in z)>0) and exists(select 1 from pg_catalog.pg_timezone_names where name=z),'INVALID_TIME_ZONE');
  perform public.quote_instant(i->'startsAt'); perform public.quote_integer(i->'durationMinutes',1,1440); perform public.quote_text(i->'location',500);
  result:=result||jsonb_build_object('interpretation',jsonb_build_object('mode',i->>'mode','location',public.quote_text(i->'location',500),'startsAt',i->>'startsAt','timeZone',z,'durationMinutes',public.quote_integer(i->'durationMinutes',1,1440)));
 else perform public.quote_assert(not v ? 'interpretation'); end if;
 if s='Sworn Translation (Morocco)' then
  c:=v->'certified'; perform public.quote_assert(c->>'country'='Morocco' and c->>'jurisdiction'='Morocco','MOROCCO_ONLY'); perform public.quote_assert(jsonb_typeof(c->'missingInstructions')='boolean','INVALID_INSTRUCTIONS'); perform public.quote_object(c,array['receivingAuthority','jurisdiction','requirements','country','missingInstructions']);
  perform public.quote_text(c->'receivingAuthority',500); perform public.quote_text(c->'jurisdiction',200); perform public.quote_text(c->'requirements',2000);
  result:=result||jsonb_build_object('certified',jsonb_build_object('receivingAuthority',public.quote_text(c->'receivingAuthority',500),'jurisdiction',public.quote_text(c->'jurisdiction',200),'requirements',public.quote_text(c->'requirements',2000),'country','Morocco','missingInstructions',(c->>'missingInstructions')::boolean));
 else perform public.quote_assert(not v ? 'certified'); end if;
 return result;
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_capabilities(v jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare d jsonb; c text; result jsonb; n integer;
begin
 perform public.quote_object(v,array['services','directions','currencies','availability','specialAssessment']);
 perform public.quote_assert(jsonb_typeof(v->'services')='array' and jsonb_array_length(v->'services') between 1 and 6);
 for c in select jsonb_array_elements_text(v->'services') loop
  perform public.quote_assert(c=any(array['Document Translation','Sworn Translation (Morocco)','Interpretation','Business Translation','Website & Digital Translation','Other Language Service']));
 end loop;
 perform public.quote_assert(jsonb_typeof(v->'directions')='array' and jsonb_array_length(v->'directions') between 1 and 50);
 for d in select jsonb_array_elements(v->'directions') loop
  perform public.quote_object(d,array['source','target']);
  perform public.quote_assert(lower(normalize(public.quote_text(d->'source',100),NFKC))<>lower(normalize(public.quote_text(d->'target',100),NFKC)));
 end loop;
 perform public.quote_assert(jsonb_typeof(v->'currencies')='array' and jsonb_array_length(v->'currencies') between 1 and 20);
 for c in select jsonb_array_elements_text(v->'currencies') loop perform public.quote_assert(public.quote_currency_digits(c) is not null,'INVALID_CURRENCY'); end loop;
 perform public.quote_text(v->'availability',1000); perform public.quote_text(v->'specialAssessment',2000);
 -- Same canonical ordering as the shared JavaScript capability contract.
 select jsonb_build_object('services',(select jsonb_agg(x order by x collate "C") from (select distinct jsonb_array_elements_text(v->'services') x) a),
 'directions',(select jsonb_agg(x order by public.quote_canonical(x) collate "C") from (select jsonb_build_object('source',public.quote_text(pair.item->'source',100),'target',public.quote_text(pair.item->'target',100)) x from jsonb_array_elements(v->'directions') pair(item)) dirs),
 'currencies',(select jsonb_agg(x order by x collate "C") from (select distinct jsonb_array_elements_text(v->'currencies') x) a),
 'availability',public.quote_text(v->'availability',1000),'specialAssessment',public.quote_text(v->'specialAssessment',2000)) into result;
 return result;
end; $function$
;
CREATE FUNCTION public.quote_verified(person uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$ SELECT EXISTS(SELECT 1 FROM auth.users u JOIN public.translation_staging_accounts a ON a.user_id=u.id WHERE u.id=person AND u.email IS NOT NULL AND u.email_confirmed_at IS NOT NULL AND u.is_anonymous=false AND a.enabled);$body$;
CREATE OR REPLACE FUNCTION public.quote_staff(person uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select public.quote_verified(person) and exists(select 1 from public.translation_staff where user_id=person); $function$
;
CREATE FUNCTION public.quote_excluded(person uuid, application uuid DEFAULT NULL, intake uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$
 SELECT EXISTS(SELECT 1 FROM public.translation_exclusions WHERE user_id=person)
 OR EXISTS(SELECT 1 FROM public.translation_provider_applications WHERE user_id=person AND is_test)
 OR EXISTS(SELECT 1 FROM public.quote_test_registry t WHERE t.user_id=person OR t.application_id=application OR t.intake_id=intake OR EXISTS(SELECT 1 FROM public.translation_provider_applications a WHERE a.id=t.application_id AND a.user_id=person));
 $body$;
CREATE OR REPLACE FUNCTION public.quote_policy(version_name text, hash text, policy_kind text)
 RETURNS public.quote_policies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.quote_policies;
begin
 select * into p from public.quote_policies where version=version_name and digest=hash and kind=policy_kind and approved_at is not null for share;
 perform public.quote_assert(found,'POLICY_NOT_APPROVED'); return p;
end; $function$
;
CREATE OR REPLACE FUNCTION public.translation_cert_base_provider_check(readiness uuid, request_scope jsonb DEFAULT NULL::jsonb, customer uuid DEFAULT NULL::uuid, enabled boolean DEFAULT true)
 RETURNS public.quote_provider_readiness
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.quote_provider_readiness; a public.translation_provider_applications; u auth.users; ack public.quote_provider_acknowledgements; latest uuid;
begin
 select * into r from public.quote_provider_readiness where id=readiness for update;
 perform public.quote_assert(found,'PROVIDER_INELIGIBLE');
 select * into a from public.translation_provider_applications where id=r.application_id for share;
 select * into u from auth.users where id=r.provider_id for share;
 perform public.quote_assert(a.status='approved' and a.category='translation' and a.is_test=false and a.revision=r.application_revision
 and a.user_id=r.provider_id and lower(a.email)=lower(u.email) and public.quote_verified(r.provider_id)
 and r.provider_id is distinct from customer and r.reviewer_id<>r.provider_id and not public.quote_excluded(r.provider_id,a.id),'PROVIDER_INELIGIBLE');
 select id into latest from public.translation_provider_events where application_id=a.id order by created_at desc,id desc limit 1;
 perform public.quote_assert(latest=r.approval_event_id and exists(select 1 from public.translation_provider_events where id=latest and kind='approved'),'PROVIDER_INELIGIBLE');
 if enabled then
  perform public.quote_assert(r.state='enabled','PROVIDER_INELIGIBLE');
  select * into ack from public.quote_provider_acknowledgements where readiness_id=r.id;
  perform public.quote_assert(ack.provider_id=r.provider_id and ack.capability_digest=r.capability_digest and ack.policy_id=r.policy_id
   and exists(select 1 from public.quote_policies where id=ack.policy_id and digest=ack.policy_digest and kind='participation' and approved_at is not null),'PROVIDER_INELIGIBLE');
 end if;
 if request_scope is not null then
  perform public.quote_assert(r.capabilities->'services' ? (request_scope->>'service') and exists(select 1 from jsonb_array_elements(r.capabilities->'directions') d where d->>'source'=request_scope->>'source' and d->>'target'=request_scope->>'target'),'PROVIDER_INELIGIBLE');
 end if;
 return r;
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_can_read(request uuid, person uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select public.quote_verified(person) and exists(select 1 from public.quote_requests q where q.id=request and
 (q.customer_id=person or public.quote_staff(person) or exists(select 1 from public.quote_assignments a where a.request_id=q.id and a.provider_id=person and a.state in ('invited','accepted')))); $function$
;
CREATE OR REPLACE FUNCTION public.translation_cert_base_command_core(p_command uuid, p_action text, p_target uuid, p_revision bigint, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); q public.quote_requests; r public.quote_provider_readiness; a public.quote_assignments;
 o public.quote_offers; policy public.quote_policies; app public.translation_provider_applications; intake public.translation_intakes;
 saved public.quote_commands; h text; result jsonb; eid uuid:=gen_random_uuid(); new_id uuid; rev bigint;
 is_readiness boolean; sc jsonb; cap jsonb; content jsonb; total jsonb; expires timestamptz;
 owner_ok boolean; recipient uuid; recipients uuid[]:='{}'; agg text; classification text; old_r public.quote_provider_readiness;
begin
 perform public.quote_assert(p_command is not null and p_target is not null and p_revision>=0 and p_action is not null and jsonb_typeof(p_payload)='object' and octet_length(p_payload::text)<=40000);
 -- Pilot-volume mutex gives a fixed lock order across request/readiness commands.
 -- Existing vendor decisions serialize through their actual vendor row lock below.
 perform pg_catalog.pg_advisory_xact_lock(788601,1);
 perform 1 from public.translation_staff where user_id=actor for share;
 perform 1 from auth.users where id=actor for share;
 perform public.quote_assert(public.quote_verified(actor),'UNAVAILABLE');
 is_readiness:=p_action=any(array['propose_readiness','acknowledge_participation','enable_readiness','close_readiness']);
 if is_readiness then
  select * into r from public.quote_provider_readiness where id=p_target for update;
  perform public.quote_assert((r.id is not null and (r.provider_id=actor or public.quote_staff(actor))) or (p_action='propose_readiness' and public.quote_staff(actor)),'UNAVAILABLE');
 elsif p_action='enroll_request' then
  perform public.quote_assert(public.quote_staff(actor),'UNAVAILABLE');
  select * into q from public.quote_requests where id=p_target for update;
 else
  select * into q from public.quote_requests where id=p_target for update;
  perform public.quote_assert(public.quote_can_read(p_target,actor) or (p_action='report_concern' and exists(select 1 from public.quote_assignments where request_id=p_target and provider_id=actor)),'UNAVAILABLE');
 end if;
 h:=public.quote_digest(jsonb_build_object('actorId',actor,'commandId',p_command,'action',p_action,'targetId',p_target,'expectedRevision',p_revision,'payload',p_payload));
 select * into saved from public.quote_commands where id=p_command;
 if found then
  perform public.quote_assert(saved.actor_id=actor and saved.input_hash=h,'COMMAND_CONFLICT'); return saved.result;
 end if;
 perform public.quote_assert(coalesce(case when is_readiness then r.revision else q.revision end,0)=p_revision,'STALE_REVISION');
 if (select count(*) from public.quote_commands where actor_id=actor and created_at>clock_timestamp()-interval '1 minute')>=60 then raise exception 'COMMAND_LIMIT'; end if;
 if is_readiness then
  agg:='readiness';
  case p_action
  when 'propose_readiness' then
   perform public.quote_object(p_payload,array['applicationId','capabilities','policyVersion','policyDigest']);
   perform public.quote_assert(public.quote_staff(actor) and r.id is null,'STAFF_REQUIRED');
   select * into app from public.translation_provider_applications where id=(p_payload->>'applicationId')::uuid for share;
   perform public.quote_assert(app.id is not null and app.user_id<>actor,'SELF_REVIEW_DENIED');
   policy:=public.quote_policy(p_payload->>'policyVersion',p_payload->>'policyDigest','participation');
   cap:=public.quote_capabilities(p_payload->'capabilities');
   select id into new_id from public.translation_provider_events where application_id=app.id order by created_at desc,id desc limit 1;
   insert into public.quote_provider_readiness(id,provider_id,application_id,application_revision,approval_event_id,version,capabilities,capability_digest,policy_id,reviewer_id)
   values(p_target,app.user_id,app.id,app.revision,new_id,(select coalesce(max(version),0)+1 from public.quote_provider_readiness where provider_id=app.user_id),cap,public.quote_digest(cap),policy.id,actor);
   r:=public.quote_provider_check(p_target,null,null,false); rev:=1;
  when 'acknowledge_participation' then
   perform public.quote_object(p_payload,array['capabilityDigest','policyVersion','policyDigest','language']);
   perform public.quote_assert(actor=r.provider_id and r.state='proposed','UNAVAILABLE');
   r:=public.quote_provider_check(r.id,null,null,false);
   policy:=public.quote_policy(p_payload->>'policyVersion',p_payload->>'policyDigest','participation');
   perform public.quote_assert(policy.id=r.policy_id and p_payload->>'capabilityDigest'=r.capability_digest and p_payload->>'language'=any(array['en','fr','ar','es']),'EXACT_ACKNOWLEDGEMENT_REQUIRED');
   insert into public.quote_provider_acknowledgements(readiness_id,provider_id,capability_digest,policy_id,policy_digest,language)
   values(r.id,actor,r.capability_digest,policy.id,policy.digest,p_payload->>'language');
   update public.quote_provider_readiness set state='acknowledged',revision=revision+1 where id=r.id returning revision into rev;
  when 'enable_readiness' then
   perform public.quote_object(p_payload,array[]::text[]);
   perform public.quote_assert(public.quote_staff(actor) and actor<>r.provider_id,'STAFF_REQUIRED');
   perform public.quote_assert(r.state='acknowledged','INVALID_STATE');
   r:=public.quote_provider_check(r.id,null,null,false);
   -- Replacement closes the old version and records its own revision/event.
   for old_r in select * from public.quote_provider_readiness where provider_id=r.provider_id and state='enabled' and id<>r.id order by id for update loop
    update public.quote_provider_readiness set state='closed',closed_at=clock_timestamp(),revision=revision+1 where id=old_r.id;
    insert into public.quote_events(aggregate_type,aggregate_id,revision,actor_id,kind) values('readiness',old_r.id,old_r.revision+1,actor,'readiness_replaced');
   end loop;
   update public.quote_provider_readiness set state='enabled',enabled_at=clock_timestamp(),revision=revision+1 where id=r.id returning revision into rev;
   r:=public.quote_provider_check(r.id);
  when 'close_readiness' then
   perform public.quote_object(p_payload,array['reason']); perform public.quote_text(p_payload->'reason',2000);
   perform public.quote_assert(public.quote_staff(actor) and actor<>r.provider_id,'STAFF_REQUIRED');
   perform public.quote_assert(r.state in ('proposed','acknowledged','enabled'),'INVALID_STATE');
   update public.quote_provider_readiness set state='closed',closed_at=clock_timestamp(),revision=revision+1 where id=r.id returning revision into rev;
  end case;
  recipients:=array[r.provider_id];
 else
  agg:='request'; owner_ok:=public.quote_staff(actor) and q.owner_id=actor;
  select * into a from public.quote_assignments where request_id=q.id and state in ('invited','accepted') for update;
  if p_action not in ('enroll_request','cancel_request','report_concern') then perform public.quote_assert(q.state='open','INVALID_STATE'); end if;
  case p_action
  when 'enroll_request' then
   perform public.quote_object(p_payload,array['intakeId']);
   perform public.quote_assert(q.id is null and public.quote_staff(actor),'UNAVAILABLE');
   select * into intake from public.translation_intakes where id=(p_payload->>'intakeId')::uuid for share;
   perform public.quote_assert(intake.kind='translation' and public.quote_verified(intake.user_id) and exists(select 1 from auth.users where id=intake.user_id and lower(email)=lower(intake.email)),'VERIFIED_REQUEST_REQUIRED');
   select c.classification into classification from public.quote_intake_classifications c where c.intake_id=intake.id order by c.created_at desc,c.id desc limit 1;
   perform public.quote_assert(classification in ('test','production'),'CLASSIFICATION_REQUIRED');
   perform public.quote_assert(jsonb_typeof(intake.fields->'quote_scope_v1')='object','CANONICAL_RECEIPT_SCOPE_REQUIRED');
   sc:=public.quote_scope(intake.fields->'quote_scope_v1');
   insert into public.quote_requests(id,intake_id,customer_id,is_test) values(p_target,intake.id,intake.user_id,classification='test' or public.quote_excluded(intake.user_id,null,intake.id));
   insert into public.quote_request_versions(request_id,version,scope,digest,author_id) values(p_target,1,sc,public.quote_digest(sc),intake.user_id);
   rev:=1; -- Enrollment is not a new receipt and creates no quote email.
  when 'claim_request' then
   perform public.quote_object(p_payload,array[]::text[]); perform public.quote_assert(public.quote_staff(actor) and q.owner_id is null,'STAFF_REQUIRED');
   update public.quote_requests set owner_id=actor where id=q.id;
  when 'transfer_owner' then
   perform public.quote_object(p_payload,array['ownerId']); perform public.quote_assert(owner_ok,'STAFF_OWNER_REQUIRED');
   perform 1 from public.translation_staff where user_id=(p_payload->>'ownerId')::uuid for share;
   perform public.quote_assert(public.quote_staff((p_payload->>'ownerId')::uuid),'STAFF_REQUIRED');
   update public.quote_requests set owner_id=(p_payload->>'ownerId')::uuid where id=q.id;
  when 'invite_provider' then
   perform public.quote_object(p_payload,array['readinessId']); perform public.quote_assert(owner_ok,'STAFF_OWNER_REQUIRED');
   select scope into sc from public.quote_request_versions where request_id=q.id and version=q.scope_version;
   r:=public.quote_provider_check((p_payload->>'readinessId')::uuid,sc,q.customer_id);
   update public.quote_assignments set state='revoked',reason='reassigned' where request_id=q.id and state in ('invited','accepted');
   update public.quote_offers set state='withdrawn' where request_id=q.id and state='offered';
   insert into public.quote_assignments(request_id,readiness_id,provider_id,scope_version) values(q.id,r.id,r.provider_id,q.scope_version) returning id into new_id;
   recipients:=array[r.provider_id];
  when 'respond_assignment' then
   perform public.quote_object(p_payload,array['assignmentId','response']);
   perform public.quote_assert(a.id=(p_payload->>'assignmentId')::uuid and a.provider_id=actor and a.state='invited' and a.scope_version=q.scope_version,'UNAVAILABLE');
   perform public.quote_assert(p_payload->>'response' in ('accepted','declined'));
   select scope into sc from public.quote_request_versions where request_id=q.id and version=q.scope_version;
   r:=public.quote_provider_check(a.readiness_id,sc,q.customer_id);
   update public.quote_assignments set state=p_payload->>'response',responded_at=clock_timestamp() where id=a.id;
   recipients:=array[q.owner_id];
  when 'revoke_assignment' then
   perform public.quote_object(p_payload,array['reason']); perform public.quote_assert(owner_ok,'STAFF_OWNER_REQUIRED');
   perform public.quote_assert(a.id is not null,'UNAVAILABLE');
   update public.quote_assignments set state='revoked',reason=public.quote_text(p_payload->'reason',2000) where id=a.id;
   update public.quote_offers set state='withdrawn' where request_id=q.id and state='offered'; recipients:=array[a.provider_id,q.customer_id];
  when 'revise_scope' then
   perform public.quote_object(p_payload,array['scope']); perform public.quote_assert(q.customer_id=actor,'CUSTOMER_REQUIRED'); sc:=public.quote_scope(p_payload->'scope');
   update public.quote_offers set state='withdrawn' where request_id=q.id and state='offered';
   update public.quote_assignments set state='ended',reason='scope_changed' where request_id=q.id and state in ('invited','accepted');
   insert into public.quote_request_versions(request_id,version,scope,digest,author_id) values(q.id,q.scope_version+1,sc,public.quote_digest(sc),actor);
   update public.quote_requests set scope_version=scope_version+1 where id=q.id;
   if a.id is not null then
    begin
     r:=public.quote_provider_check(a.readiness_id,sc,q.customer_id);
     insert into public.quote_assignments(request_id,readiness_id,provider_id,scope_version) values(q.id,r.id,r.provider_id,q.scope_version+1) returning id into new_id;
     recipients:=array[q.owner_id,r.provider_id];
    exception when raise_exception then
     if sqlerrm<>'PROVIDER_INELIGIBLE' then raise; end if;
     recipients:=array[q.owner_id];
    end;
   end if;
  when 'issue_offer' then
   perform public.quote_assert(not exists(select 1 from public.translation_files where request_id=q.id and public.translation_scan_scan_status(id)<>'clean'),'DOCUMENTS_QUARANTINED');
   perform public.quote_object(p_payload,array['assignmentId','content']);
   perform public.quote_assert(a.id=(p_payload->>'assignmentId')::uuid and owner_ok and a.state='accepted' and a.scope_version=q.scope_version,'UNAVAILABLE');
   select scope into sc from public.quote_request_versions where request_id=q.id and version=q.scope_version;
   r:=public.quote_provider_check(a.readiness_id,sc,q.customer_id); content:=p_payload->'content';
   perform public.quote_object(content,array['scope','exclusions','total','turnaround','revisions','expiresAt','policyVersion','policyDigest','taxTreatment','chargesIncluded']);
   perform public.quote_text(content->'scope'); perform public.quote_text(content->'exclusions'); perform public.quote_text(content->'turnaround',2000);
   perform public.quote_text(content->'taxTreatment',1000); perform public.quote_integer(content->'revisions',0,100);
   perform public.quote_assert(content->'chargesIncluded'='true'::jsonb,'TOTAL_MUST_INCLUDE_CHARGES');
   total:=public.quote_money(content->'total'); perform public.quote_assert(r.capabilities->'currencies' ? (total->>'currency'),'INVALID_CURRENCY');
   expires:=public.quote_instant(content->'expiresAt'); perform public.quote_assert(expires>clock_timestamp(),'OFFER_EXPIRED');
   policy:=public.quote_policy(content->>'policyVersion',content->>'policyDigest','acceptance');
   content:=jsonb_build_object('scope',public.quote_text(content->'scope'),'exclusions',public.quote_text(content->'exclusions'),'total',total,'turnaround',public.quote_text(content->'turnaround',2000),'revisions',public.quote_integer(content->'revisions',0,100),'expiresAt',content->>'expiresAt','policyVersion',policy.version,'policyDigest',policy.digest,'taxTreatment',public.quote_text(content->'taxTreatment',1000),'chargesIncluded',true); content:=content||jsonb_build_object('documents',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'size',size,'sha256',sha256) order by id) from public.translation_files where request_id=q.id and scope_version=q.scope_version),'[]'::jsonb)); content:=content||jsonb_build_object('fulfillmentTerms',public.translation_cert_terms(sc->>'service'='Sworn Translation (Morocco)')); new_id:=gen_random_uuid();
   update public.quote_offers set state='superseded' where request_id=q.id and state='offered';
   select coalesce(max(version),0)+1 into rev from public.quote_offers where request_id=q.id;
   insert into public.quote_offers(id,request_id,assignment_id,provider_id,scope_version,version,content,total_minor,currency,currency_digits,expires_at,policy_id,digest,issued_by)
   values(new_id,q.id,a.id,a.provider_id,q.scope_version,rev,content,(total->>'minor')::bigint,total->>'currency',(total->>'digits')::smallint,expires,policy.id,
   public.quote_digest(jsonb_build_object('id',new_id,'assignmentId',a.id,'providerId',a.provider_id,'issuedBy',actor,'version',rev,'scopeVersion',q.scope_version,'content',content)),actor);
   recipients:=array[q.customer_id,q.owner_id];
  when 'accept_offer','decline_offer','withdraw_offer' then
   if p_action='accept_offer' then perform public.quote_assert(not exists(select 1 from public.translation_files where request_id=q.id and public.translation_scan_scan_status(id)<>'clean'),'DOCUMENTS_QUARANTINED');end if;
   if p_action='accept_offer' then perform public.quote_object(p_payload,array['offerId','offerDigest','policyVersion','policyDigest','language','fulfillment']);
   elsif p_action='decline_offer' then perform public.quote_object(p_payload,array['offerId']);
   else perform public.quote_object(p_payload,array['offerId','reason']); perform public.quote_text(p_payload->'reason',2000); end if;
   select * into o from public.quote_offers where id=(p_payload->>'offerId')::uuid and request_id=q.id for update;
   perform public.quote_assert(o.state='offered' and o.assignment_id=a.id and a.state='accepted' and o.scope_version=q.scope_version,'OFFER_UNAVAILABLE');
   if p_action='withdraw_offer' then
    perform public.quote_assert(actor=o.provider_id or owner_ok,'UNAVAILABLE');
    update public.quote_offers set state='withdrawn' where id=o.id; recipients:=array[q.customer_id,q.owner_id];
   else
    perform public.quote_assert(actor=q.customer_id,'CUSTOMER_REQUIRED');
    if p_action='decline_offer' then update public.quote_offers set state='declined' where id=o.id; recipients:=array[a.provider_id,q.owner_id];
    else
     perform public.quote_assert(o.digest=p_payload->>'offerDigest' and o.content->>'policyVersion'=p_payload->>'policyVersion'
      and o.content->>'policyDigest'=p_payload->>'policyDigest' and p_payload->>'language' in ('en','fr','ar','es'),'EXACT_ACCEPTANCE_REQUIRED');
     select scope into sc from public.quote_request_versions where request_id=q.id and version=q.scope_version;
     r:=public.quote_provider_check(a.readiness_id,sc,q.customer_id);
     policy:=public.quote_policy(p_payload->>'policyVersion',p_payload->>'policyDigest','acceptance');
     -- clock_timestamp is checked AFTER all eligibility locks, not transaction-start now().
     perform public.quote_assert(o.expires_at>clock_timestamp(),'OFFER_EXPIRED');
     insert into public.quote_acceptances(request_id,offer_id,actor_id,offer_digest,policy_id,policy_digest,language)
      values(q.id,o.id,actor,o.digest,policy.id,policy.digest,p_payload->>'language');
     update public.quote_offers set state='accepted' where id=o.id;
     update public.quote_requests set state='accepted_pending_activation',accepted_offer_id=o.id where id=q.id;
     recipients:=array[q.customer_id,q.owner_id,a.provider_id];
    end if;
   end if;
  when 'cancel_request','close_unfulfilled' then
   perform public.quote_object(p_payload,array['reason','communication']); perform public.quote_text(p_payload->'reason',2000);
   perform public.quote_assert(q.state in ('open','accepted_pending_activation'),'INVALID_STATE');
   if p_action='close_unfulfilled' then perform public.quote_assert(owner_ok and q.state='open','STAFF_OWNER_REQUIRED');
   elsif actor<>q.customer_id then perform public.quote_assert(owner_ok,'STAFF_OWNER_REQUIRED'); perform public.quote_text(p_payload->'communication',2000); end if;
   update public.quote_assignments set state='ended',reason=p_payload->>'reason' where request_id=q.id and state in ('invited','accepted');
   update public.quote_offers set state='withdrawn' where request_id=q.id and state='offered';
   update public.quote_requests set state=case p_action when 'cancel_request' then 'cancelled' else 'closed_unfulfilled' end,closed_at=clock_timestamp() where id=q.id;
   recipients:=array[q.customer_id,q.owner_id,a.provider_id];
  when 'ask_information','reply_information','report_concern' then
   if p_action='ask_information' then
    perform public.quote_object(p_payload,array['audience','body']); perform public.quote_assert(owner_ok,'STAFF_OWNER_REQUIRED');
    perform public.quote_assert(p_payload->>'audience' in ('customer','provider'));
    recipient:=case p_payload->>'audience' when 'customer' then q.customer_id else a.provider_id end;
    perform public.quote_assert(recipient is not null,'UNAVAILABLE');
    insert into public.quote_threads(request_id,audience,participant_id) values(q.id,p_payload->>'audience',recipient) returning id into new_id;
   elsif p_action='reply_information' then
    perform public.quote_object(p_payload,array['threadId','body']);
    select id into new_id from public.quote_threads where id=(p_payload->>'threadId')::uuid and request_id=q.id and participant_id=actor and state='open' and audience<>'staff' for update;
    perform public.quote_assert(new_id is not null,'UNAVAILABLE'); update public.quote_threads set state='answered' where id=new_id; recipient:=q.owner_id;
   else
    perform public.quote_object(p_payload,array['body']);
    insert into public.quote_threads(request_id,audience,participant_id) values(q.id,'staff',actor) returning id into new_id; recipient:=q.owner_id;
   end if;
   insert into public.quote_messages(thread_id,actor_id,kind,body) values(new_id,actor,case p_action when 'ask_information' then 'question' when 'reply_information' then 'answer' else 'concern' end,public.quote_text(p_payload->'body'));
   recipients:=array[recipient];
  else raise exception 'UNSUPPORTED_COMMAND';
  end case;
  if p_action<>'enroll_request' then
   update public.quote_requests set revision=revision+1,updated_at=clock_timestamp() where id=q.id returning revision into rev;
  end if;
 end if;
 insert into public.quote_events(id,aggregate_type,aggregate_id,revision,request_id,actor_id,kind,payload)
 values(eid,agg,p_target,rev,case when agg='request' then p_target end,actor,p_action,jsonb_strip_nulls(jsonb_build_object('recordId',new_id,'reason',p_payload->>'reason','communication',p_payload->>'communication')));
 -- This draft has no dispatcher: all notifications remain suppressed, never pending.
 for recipient in select distinct x from unnest(recipients) x where x is not null loop
  new_id:=gen_random_uuid();
  insert into public.quote_deliveries(id,event_id,recipient_id,roles,idempotency_key,state,reason)
  values(new_id,eid,recipient,array['participant'],'marocora-quote/'||new_id::text,case when (select notifications_enabled from public.quote_settings) then 'pending' else 'suppressed' end,'STAGING_MOCK_QUEUE_NO_SENDER');
 end loop;
 result:=jsonb_build_object('commandId',p_command,case when is_readiness then 'readinessId' else 'requestId' end,p_target,'revision',rev,'eventId',eid,'result',p_action,'notificationState',case when (select notifications_enabled from public.quote_settings) then 'pending' else 'suppressed' end);
 insert into public.quote_commands(id,actor_id,action,target_id,expected_revision,input_hash,result,event_id) values(p_command,actor,p_action,p_target,p_revision,h,result,eid);
 return result;
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_command(p_command uuid, p_action text, p_target uuid, p_revision bigint, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform public.quote_assert(public.quote_verified(auth.uid()),'UNAVAILABLE');
 perform 1 from public.quote_settings where singleton and commands_enabled for share;
 perform public.quote_assert(found,'COMMANDS_DISABLED');
 return public.quote_command_core(p_command,p_action,p_target,p_revision,p_payload);
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_classification_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if new.classification='production' then
  perform public.quote_assert(not exists(select 1 from public.quote_intake_classifications where intake_id=new.intake_id and classification='test')
   and not exists(select 1 from public.translation_intakes i where i.id=new.intake_id and public.quote_excluded(i.user_id,null,i.id)),'TEST_CLASSIFICATION_PERMANENT');
 end if;
 return new;
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_readiness_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if tg_op='DELETE' then raise exception 'QUOTE_HISTORY_REQUIRED'; end if;
 if (to_jsonb(new)-array['state','revision','enabled_at','closed_at']) is distinct from (to_jsonb(old)-array['state','revision','enabled_at','closed_at']) then raise exception 'QUOTE_IMMUTABLE_CAPABILITY'; end if;
 if (old.state='closed' and new.state<>'closed') or (old.state='enabled' and new.state not in ('enabled','closed')) then raise exception 'QUOTE_TERMINAL_READINESS'; end if;
 return new;
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_eligibility_hold(request uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare readiness uuid; q public.quote_requests; sc jsonb;
begin
 select * into q from public.quote_requests where id=request;
 select a.readiness_id into readiness from public.quote_assignments a where a.request_id=q.id
 and (a.state in ('invited','accepted') or a.id=(select assignment_id from public.quote_offers where id=q.accepted_offer_id)) order by a.invited_at desc,a.id desc limit 1;
 if readiness is null then return false; end if;
 select scope into sc from public.quote_request_versions where request_id=q.id and version=q.scope_version;
 return not exists(select 1 from public.quote_provider_readiness r
 join public.translation_provider_applications a on a.id=r.application_id join auth.users u on u.id=r.provider_id
 join public.quote_provider_acknowledgements ack on ack.readiness_id=r.id
 join public.quote_policies p on p.id=r.policy_id
 where r.id=readiness and r.state='enabled' and a.status='approved' and a.category='translation' and a.is_test=false
 and a.revision=r.application_revision and a.user_id=r.provider_id and r.provider_id<>q.customer_id
 and lower(u.email)=lower(a.email) and public.quote_verified(r.provider_id) and not public.quote_excluded(r.provider_id,a.id)
 and ack.provider_id=r.provider_id and ack.capability_digest=r.capability_digest and ack.policy_id=r.policy_id and ack.policy_digest=p.digest and p.kind='participation' and p.approved_at is not null
 and r.approval_event_id=(select id from public.translation_provider_events where application_id=a.id order by created_at desc,id desc limit 1)
 and r.capabilities->'services' ? (sc->>'service') and exists(select 1 from jsonb_array_elements(r.capabilities->'directions') d where d->>'source'=sc->>'source' and d->>'target'=sc->>'target'));
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_request_detail(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quote_requests; a public.quote_assignments; actor uuid:=auth.uid(); role_name text; result jsonb;
begin
 perform public.quote_assert(public.quote_can_read(p_id,actor),'UNAVAILABLE');
 select * into q from public.quote_requests where id=p_id;
 select * into a from public.quote_assignments where request_id=q.id and state in ('invited','accepted');
 role_name:=case when public.quote_staff(actor) then 'staff' when q.customer_id=actor then 'customer' else 'provider' end;
 result:=jsonb_build_object('id',q.id,'state',q.state,'revision',q.revision,'scopeVersion',q.scope_version,'role',role_name,'eligibilityHold',public.quote_eligibility_hold(q.id));
 if role_name='provider' and a.state='invited' then
  return result||(select jsonb_build_object('invitation',jsonb_build_object('id',a.id,'scopeVersion',a.scope_version),'service',scope->>'service','source',scope->>'source','target',scope->>'target') from public.quote_request_versions where request_id=q.id and version=q.scope_version);
 end if;
 result:=result||jsonb_build_object('scope',(select scope from public.quote_request_versions where request_id=q.id and version=q.scope_version),
  'assignment',case when a.id is null then null else jsonb_build_object('id',a.id,'state',a.state,'scopeVersion',a.scope_version) end,
  'offers',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'version',o.version,'scopeVersion',o.scope_version,'content',o.content,'digest',o.digest,'state',case when o.state='offered' and o.expires_at<=clock_timestamp() then 'expired' else o.state end) order by o.version)
   from public.quote_offers o where o.request_id=q.id and (role_name<>'provider' or o.assignment_id=a.id)),'[]'::jsonb),
  'closure',(select jsonb_build_object('reason',e.payload->>'reason','at',e.created_at) from public.quote_events e where e.request_id=q.id and e.kind in ('cancel_request','close_unfulfilled') order by e.revision desc limit 1),
  'acceptance',(select jsonb_build_object('offerId',offer_id,'offerDigest',offer_digest,'policyDigest',policy_digest,'language',language,'at',created_at) from public.quote_acceptances where request_id=q.id),
  'threads',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'state',t.state,'audience',t.audience,'messages',coalesce((select jsonb_agg(jsonb_build_object('kind',m.kind,'body',m.body,'at',m.created_at) order by m.created_at,m.id) from public.quote_messages m where m.thread_id=t.id),'[]'::jsonb)) order by t.created_at,t.id)
   from public.quote_threads t where t.request_id=q.id and (role_name='staff' or (t.audience<>'staff' and t.participant_id=actor))),'[]'::jsonb));
 if role_name='staff' then result:=result||jsonb_build_object('intakeId',q.intake_id,'ownerId',q.owner_id,'isTest',q.is_test,'audit',coalesce((select jsonb_agg(jsonb_build_object('kind',e.kind,'revision',e.revision,'actorId',e.actor_id,'payload',e.payload,'at',e.created_at) order by e.revision) from public.quote_events e where e.request_id=q.id),'[]'::jsonb)); end if;
 return result;
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_my_requests(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform public.quote_assert(public.quote_verified(auth.uid()),'UNAVAILABLE'); perform public.quote_assert(p_limit between 1 and 100 and (p_before is null)=(p_before_id is null));
 return coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'state',q.state,'revision',q.revision,'createdAt',q.created_at) order by q.created_at desc,q.id desc) from
 (select * from public.quote_requests where customer_id=auth.uid() and (p_before is null or (created_at,id)<(p_before,p_before_id)) order by created_at desc,id desc limit p_limit) q),'[]');
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_provider_assignments(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform public.quote_assert(public.quote_verified(auth.uid()),'UNAVAILABLE'); perform public.quote_assert(p_limit between 1 and 100 and (p_before is null)=(p_before_id is null));
 return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'requestId',a.request_id,'state',a.state,'scopeVersion',a.scope_version,'invitedAt',a.invited_at) order by a.invited_at desc,a.id desc) from
 (select * from public.quote_assignments where provider_id=auth.uid() and state in ('invited','accepted') and (p_before is null or (invited_at,id)<(p_before,p_before_id)) order by invited_at desc,id desc limit p_limit) a),'[]');
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_my_readiness()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform public.quote_assert(public.quote_verified(auth.uid()),'UNAVAILABLE');
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'revision',r.revision,'version',r.version,'state',r.state,'capabilities',r.capabilities,'capabilityDigest',r.capability_digest,'policyVersion',p.version,'policyDigest',p.digest) order by r.version desc)
 from (select * from public.quote_provider_readiness where provider_id=auth.uid() order by version desc limit 100) r join public.quote_policies p on p.id=r.policy_id),'[]');
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_staff_queue(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform public.quote_assert(public.quote_staff(auth.uid()),'UNAVAILABLE'); perform public.quote_assert(p_limit between 1 and 100 and (p_before is null)=(p_before_id is null));
 return coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'state',q.state,'revision',q.revision,'ownerId',q.owner_id,'updatedAt',q.updated_at) order by q.updated_at desc,q.id desc) from
 (select * from public.quote_requests where not is_test and not public.quote_excluded(customer_id,null,intake_id)
 and exists(select 1 from public.quote_intake_classifications c where c.intake_id=quote_requests.intake_id and c.classification='production')
 and not exists(select 1 from public.quote_intake_classifications c where c.intake_id=quote_requests.intake_id and c.classification='test')
 and (p_before is null or (updated_at,id)<(p_before,p_before_id)) order by updated_at desc,id desc limit p_limit) q),'[]');
end; $function$
;
CREATE OR REPLACE FUNCTION public.quote_staff_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform public.quote_assert(public.quote_staff(auth.uid()),'UNAVAILABLE');
 return (with eligible as (select q.* from public.quote_requests q where not q.is_test and not public.quote_excluded(q.customer_id,null,q.intake_id)
 and exists(select 1 from public.quote_intake_classifications c where c.intake_id=q.intake_id and c.classification='production')
 and not exists(select 1 from public.quote_intake_classifications c where c.intake_id=q.intake_id and c.classification='test'))
 select jsonb_build_object('open',count(*) filter(where state='open'),'acceptedPendingActivation',count(*) filter(where state='accepted_pending_activation'),
 'closedUnfulfilled',count(*) filter(where state='closed_unfulfilled'),
 'awaitingCustomerResponse',count(*) filter(where state='open' and (exists(select 1 from public.quote_offers o where o.request_id=eligible.id and o.state='offered' and o.expires_at>clock_timestamp())
 or exists(select 1 from public.quote_threads t where t.request_id=eligible.id and t.audience='customer' and t.state='open'))),
 'mailExceptions',(select count(*) from public.quote_deliveries d join public.quote_events e on e.id=d.event_id join eligible q on q.id=e.request_id where d.state in ('uncertain','failed')))
 from eligible);
end; $function$
;
CREATE OR REPLACE FUNCTION public.translation_freeze_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if new.state='pending' then
  select email into new.destination from auth.users where id=new.recipient_id;
  select jsonb_build_object('eventId',e.id,'kind',e.kind,'requestId',e.request_id,'message','A staging workspace update is available. No email has been sent.') into new.content from public.quote_events e where e.id=new.event_id;
  new.content_digest:=public.quote_digest(new.content);
 end if;return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_capture(p_id uuid, p_scope jsonb, p_fields jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid();u auth.users;sc jsonb;h text;prior public.translation_intakes;owner uuid;eid uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(788601,1);
 perform public.quote_assert((select capture_enabled and commands_enabled from public.quote_settings),'CAPTURE_DISABLED');
 perform public.quote_assert(public.quote_verified(actor) and not public.quote_excluded(actor),'UNAVAILABLE');
 perform public.quote_assert(p_scope->>'service' in ('Document Translation','Business Translation','Website & Digital Translation','Other Language Service','Sworn Translation (Morocco)'),'REGULAR_TRANSLATION_ONLY');
 sc:=public.quote_scope(p_scope);
 perform public.quote_object(p_fields,array['name','phone']);perform public.quote_text(p_fields->'name',200);
 if p_fields ? 'phone' then perform public.quote_text(p_fields->'phone',100);end if;
 h:=public.quote_digest(jsonb_build_object('scope',sc,'fields',p_fields));
 select * into prior from public.translation_intakes where id=p_id;
 if found then perform public.quote_assert(prior.user_id=actor and prior.request_hash=h,'REQUEST_CONFLICT');return jsonb_build_object('id',p_id);end if;
 perform public.quote_assert((select count(*) from public.translation_intakes where user_id=actor and created_at>clock_timestamp()-interval '1 hour')<30,'REQUEST_LIMIT');
 select * into u from auth.users where id=actor;
 select owner_id into owner from public.translation_settings;
 perform public.quote_assert(public.quote_staff(owner),'STAFF_OWNER_REQUIRED');
 insert into public.translation_intakes(id,user_id,email,email_verified_at,kind,fields,request_hash,delivery)
 values(p_id,actor,u.email,u.email_confirmed_at,'translation',p_fields||jsonb_build_object('quote_scope_v1',sc),h,'uncertain');
 insert into public.quote_intake_classifications(intake_id,classification,source,reason,actor_id) values(p_id,'test','server_rule','Owner staging exercise',actor);
 insert into public.quote_requests(id,intake_id,customer_id,owner_id,is_test) values(p_id,p_id,actor,owner,true);
 insert into public.quote_request_versions(request_id,version,scope,digest,author_id) values(p_id,1,sc,public.quote_digest(sc),actor);
 insert into public.quote_events(id,aggregate_type,aggregate_id,revision,request_id,actor_id,kind) values(eid,'request',p_id,1,p_id,actor,'capture_request');
 insert into public.quote_deliveries(id,event_id,recipient_id,roles,idempotency_key,state,reason)
 select id,eid,owner,array['staff'],'marocora-quote/'||id::text,case when (select notifications_enabled from public.quote_settings) then 'pending' else 'suppressed' end,'STAGING_MOCK_QUEUE_NO_SENDER' from (select gen_random_uuid() id) x;
 return jsonb_build_object('id',p_id);
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_file_allowed(p_request uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quote_requests;a public.quote_assignments;sc jsonb;
begin
 select * into q from public.quote_requests where id=p_request;
 if not public.quote_verified(auth.uid()) or q.state not in ('open','accepted_pending_activation') then return false;end if;
 if q.owner_id=auth.uid() and public.quote_staff(auth.uid()) then return true;end if;
 select * into a from public.quote_assignments where request_id=q.id and provider_id=auth.uid() and state='accepted' and scope_version=q.scope_version;
 if not found then return false;end if;
 select scope into sc from public.quote_request_versions where request_id=q.id and version=q.scope_version;
 perform public.quote_provider_check(a.readiness_id,sc,q.customer_id);return true;
exception when raise_exception then return false;
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_register_file(p_id uuid, p_request uuid, p_name text, p_size integer, p_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quote_requests;f public.translation_files;
begin
 perform pg_advisory_xact_lock(788601,1);
 perform public.quote_assert((select capture_enabled and commands_enabled from public.quote_settings),'CAPTURE_DISABLED');
 select * into q from public.quote_requests where id=p_request for update;
 perform public.quote_assert(public.quote_verified(auth.uid()) and q.customer_id=auth.uid() and not public.quote_excluded(auth.uid(),null,q.intake_id),'UNAVAILABLE');
 select * into f from public.translation_files where id=p_id;
 if found then perform public.quote_assert(f.request_id=p_request and f.uploader_id=auth.uid() and f.sha256=p_hash and f.name=p_name and f.size=p_size,'FILE_CONFLICT');return jsonb_build_object('id',f.id);end if;
 perform public.quote_assert(q.state='open' and not exists(select 1 from public.quote_offers where request_id=q.id),'FILES_LOCKED_AFTER_QUOTE');
 perform public.quote_assert((select count(*) from public.translation_files where request_id=q.id)<5,'FILE_LIMIT');
 insert into public.translation_files(id,request_id,uploader_id,scope_version,name,size,sha256) values(p_id,q.id,auth.uid(),q.scope_version,p_name,p_size,p_hash);
 return jsonb_build_object('id',p_id);
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_file(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f public.translation_files;
begin
 select * into f from public.translation_files where id=p_id;
 perform public.quote_assert(f.id is not null and public.translation_file_allowed(f.request_id),'UNAVAILABLE');
 return to_jsonb(f);
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_detail(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quote_requests;d jsonb;
begin
 select * into q from public.quote_requests where id=p_id;
 perform public.quote_assert(q.customer_id=auth.uid() or public.translation_file_allowed(p_id) or exists(select 1 from public.quote_assignments where request_id=p_id and provider_id=auth.uid() and state='invited'),'UNAVAILABLE');
 d:=public.quote_request_detail(p_id);
 d:=d||jsonb_build_object('policies',(select jsonb_object_agg(version,wording) from public.quote_policies where kind='acceptance' and approved_at is not null),'offerIssuer','staff');
 if q.owner_id=auth.uid() then d:=d||jsonb_build_object('customer',(select jsonb_build_object('email',email,'fields',fields-'quote_scope_v1') from public.translation_intakes where id=q.intake_id));end if;
 if public.translation_file_allowed(p_id) then d:=d||jsonb_build_object('files',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'size',size,'sha256',sha256)) from public.translation_files where request_id=q.id and scope_version=q.scope_version),'[]'::jsonb));end if;
 return d;
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform public.quote_assert(public.quote_verified(auth.uid()),'UNAVAILABLE');
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'state',state,'revision',revision) order by created_at desc) from
 (select * from public.quote_requests q where customer_id=auth.uid() or owner_id=auth.uid() or exists(select 1 from public.quote_assignments a where a.request_id=q.id and a.provider_id=auth.uid() and a.state in ('invited','accepted')) order by created_at desc,id desc limit 100) rows),'[]'::jsonb);
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_scan_scan_status(p_id uuid)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce((select s.status from public.translation_scan_events s join public.translation_files f on f.id=s.file_id and f.sha256=s.sha256 where file_id=p_id order by s.created_at desc,s.id desc limit 1),'quarantined');
$function$
;
CREATE OR REPLACE FUNCTION public.translation_scan_record_scan(p_file uuid, p_hash text, p_status text, p_engine text, p_reason text, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform public.quote_assert(auth.role()='service_role' and public.quote_verified(p_actor) and exists(select 1 from public.translation_files f join public.quote_requests q on q.id=f.request_id where f.id=p_file and (q.customer_id=p_actor or (q.owner_id=p_actor and public.quote_staff(p_actor)))),'SERVER_REQUIRED');
 perform pg_advisory_xact_lock(788601,1);
 perform public.quote_assert(exists(select 1 from public.translation_files where id=p_file and sha256=p_hash),'FILE_CONFLICT');
 insert into public.translation_scan_events(file_id,sha256,status,engine,reason,actor_id) values(p_file,p_hash,p_status,p_engine,p_reason,p_actor);
 return jsonb_build_object('id',p_file,'scanStatus',p_status);
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_scan_register_file(p_id uuid, p_request uuid, p_name text, p_size integer, p_hash text, p_mime text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quote_requests;f public.translation_files;
begin
 perform pg_advisory_xact_lock(788601,1);
 perform public.quote_assert((select capture_enabled and commands_enabled from public.quote_settings),'CAPTURE_DISABLED');
 select * into q from public.quote_requests where id=p_request for update;
 perform public.quote_assert(public.quote_verified(auth.uid()) and q.customer_id=auth.uid() and not public.quote_excluded(auth.uid(),null,q.intake_id),'UNAVAILABLE');
 perform public.translation_cert_upload_check(p_request); select * into f from public.translation_files where id=p_id;
 if found then
  perform public.quote_assert(f.request_id=p_request and f.uploader_id=auth.uid() and f.sha256=p_hash and f.name=p_name and f.size=p_size and f.media_type=p_mime,'FILE_CONFLICT');
  return jsonb_build_object('id',f.id,'needsScan',not exists(select 1 from public.translation_scan_events where file_id=f.id),'scanStatus',public.translation_scan_scan_status(f.id));
 end if;
 perform public.quote_assert(q.state='open' and not exists(select 1 from public.quote_offers where request_id=q.id),'FILES_LOCKED_AFTER_QUOTE');
 perform public.quote_assert((select count(*) from public.translation_files where request_id=q.id)<5,'FILE_LIMIT');
 insert into public.translation_files(id,request_id,uploader_id,scope_version,name,size,sha256,media_type) values(p_id,q.id,auth.uid(),q.scope_version,p_name,p_size,p_hash,p_mime);
 return jsonb_build_object('id',p_id,'needsScan',true,'scanStatus','quarantined');
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_scan_file(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f jsonb;
begin
 f:=public.translation_file(p_id);
 perform public.quote_assert(public.translation_scan_scan_status(p_id)='clean','FILE_QUARANTINED');
 return f;
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_scan_scan_target(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f public.translation_files;
begin
 select * into f from public.translation_files where id=p_id;
 perform public.quote_assert(public.translation_file_allowed(f.request_id) and exists(select 1 from public.quote_requests where id=f.request_id and owner_id=auth.uid()) and public.quote_staff(auth.uid()),'STAFF_OWNER_REQUIRED');
 return to_jsonb(f);
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_cert_base_detail(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d jsonb;
begin
 d:=public.translation_detail(p_id);
 d:=d||jsonb_build_object('documentsHold',exists(select 1 from public.translation_files where request_id=p_id and public.translation_scan_scan_status(id)<>'clean'));
 if d ? 'files' then
  d:=jsonb_set(d,'{files}',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'size',f.size,'sha256',f.sha256,'mediaType',f.media_type,'scanStatus',public.translation_scan_scan_status(f.id),'scanReason',(select reason from public.translation_scan_events where file_id=f.id order by created_at desc,id desc limit 1))) from public.translation_files f where request_id=p_id and scope_version=(d->>'scopeVersion')::integer),'[]'::jsonb));
 end if;
 return d;
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_cert_dob(v text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare m text[]:=array['January','February','March','April','May','June','July','August','September','October','November','December'];p text[];d date;
begin
 p:=regexp_match(v,'^(January|February|March|April|May|June|July|August|September|October|November|December) ([1-9]|[12][0-9]|3[01]) ([0-9]{4})$');
 perform public.quote_assert(p is not null,'DOB_FORMAT');
 perform public.quote_assert(v=p[1]||' '||p[2]||' '||p[3],'DOB_FORMAT');
 begin d:=make_date(p[3]::integer,array_position(m,p[1]),p[2]::integer);exception when others then raise exception 'DOB_INVALID';end;
 perform public.quote_assert(d<=current_date,'DOB_INVALID');return v;
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_cert_staff_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select public.quote_staff(auth.uid()) and exists(select 1 from public.translation_settings where owner_id=auth.uid());
$function$
;
CREATE OR REPLACE FUNCTION public.translation_cert_current_credential(p_provider uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select c.id from public.translation_cert_credentials c where c.provider_id=p_provider order by c.created_at desc,c.id desc limit 1;
$function$
;
CREATE OR REPLACE FUNCTION public.translation_cert_credential_approved(p_provider uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce((select decision='approved' from public.translation_cert_credential_reviews where credential_id=public.translation_cert_current_credential(p_provider) order by revision desc limit 1),false);
$function$
;
CREATE OR REPLACE FUNCTION public.translation_cert_record_credential(p_id uuid, p_provider uuid, p_fields jsonb, p_file jsonb, p_result jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform public.quote_assert(auth.role()='service_role','SERVER_REQUIRED');
 perform pg_advisory_xact_lock(788601,1);
 perform public.quote_assert((select capture_enabled and commands_enabled from public.quote_settings),'CAPTURE_DISABLED');
 perform public.quote_assert(public.quote_verified(p_provider) and not public.quote_excluded(p_provider) and exists(select 1 from public.translation_provider_applications where user_id=p_provider and category='translation' and status='approved' and not is_test),'PROVIDER_INELIGIBLE');
 perform public.quote_object(p_fields,array['legalName','dob','credentialNumber']);
 perform public.quote_text(p_fields->'legalName',200);perform public.translation_cert_dob(p_fields->>'dob');perform public.quote_text(p_fields->'credentialNumber',100);
 perform public.quote_assert(p_file->>'mediaType' in ('image/jpeg','image/png'),'CREDENTIAL_IMAGE_REQUIRED');
 insert into public.translation_cert_credential_scans(id,provider_id,sha256,status,engine,reason) values(p_id,p_provider,p_file->>'sha256',p_result->>'status',p_result->>'engine',p_result->>'reason');
 if p_result->>'status'='clean' then
  insert into public.translation_cert_credentials(id,provider_id,legal_name,dob,credential_number,name,media_type,size,sha256) values(p_id,p_provider,public.quote_text(p_fields->'legalName',200),p_fields->>'dob',public.quote_text(p_fields->'credentialNumber',100),p_file->>'name',p_file->>'mediaType',(p_file->>'size')::integer,p_file->>'sha256');
 end if;
 return jsonb_build_object('id',p_id,'scanStatus',p_result->>'status','reviewState',case when p_result->>'status'='clean' then 'pending' else 'not_submitted' end);
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_cert_credentials_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform public.quote_assert(public.quote_verified(auth.uid()),'UNAVAILABLE');
 return coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('reviewState',coalesce((select decision from public.translation_cert_credential_reviews where credential_id=c.id order by revision desc limit 1),'pending'),'revision',coalesce((select max(revision) from public.translation_cert_credential_reviews where credential_id=c.id),0),'isCurrent',c.id=public.translation_cert_current_credential(c.provider_id)) order by c.created_at desc) from public.translation_cert_credentials c where c.provider_id=auth.uid() or public.translation_cert_staff_owner()),'[]');
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_cert_credential_file(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.translation_cert_credentials;begin
 select * into c from public.translation_cert_credentials where id=p_id;
 perform public.quote_assert(public.quote_verified(auth.uid()) and (c.provider_id=auth.uid() or public.translation_cert_staff_owner()),'UNAVAILABLE');
 perform public.quote_assert(exists(select 1 from public.translation_cert_credential_scans where id=p_id and status='clean' and sha256=c.sha256),'FILE_QUARANTINED');return to_jsonb(c);
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_cert_review_credential(p_id uuid, p_review uuid, p_revision bigint, p_decision text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.translation_cert_credentials;prior public.translation_cert_credential_reviews;rev bigint;
begin
 perform pg_advisory_xact_lock(788601,1);
 perform public.quote_assert((select commands_enabled from public.quote_settings),'COMMANDS_DISABLED');perform public.quote_assert(public.translation_cert_staff_owner(),'STAFF_OWNER_REQUIRED');
 select * into c from public.translation_cert_credentials where id=p_id;
 perform public.quote_assert(c.id is not null and c.provider_id<>auth.uid() and c.id=public.translation_cert_current_credential(c.provider_id),'UNAVAILABLE');
 perform public.quote_assert(p_decision in ('approved','rejected','revoked') and length(btrim(p_reason)) between 1 and 2000,'INVALID_REVIEW');
 select * into prior from public.translation_cert_credential_reviews where id=p_review;
 if found then perform public.quote_assert(prior.credential_id=p_id and prior.actor_id=auth.uid() and prior.decision=p_decision and prior.reason=p_reason and prior.revision=p_revision+1,'COMMAND_CONFLICT');return jsonb_build_object('revision',prior.revision,'reviewState',prior.decision);end if;
 select coalesce(max(revision),0) into rev from public.translation_cert_credential_reviews where credential_id=p_id;
 perform public.quote_assert(rev=p_revision,'STALE_REVISION');
 insert into public.translation_cert_credential_reviews(id,credential_id,actor_id,decision,reason,revision) values(p_review,p_id,auth.uid(),p_decision,p_reason,rev+1);
 return jsonb_build_object('revision',rev+1,'reviewState',p_decision);
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_cert_submit(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quote_requests;s jsonb;begin
 perform pg_advisory_xact_lock(788601,1);
 perform public.quote_assert((select capture_enabled and commands_enabled from public.quote_settings),'CAPTURE_DISABLED');
 select * into q from public.quote_requests where id=p_id for update;
 perform public.quote_assert(q.customer_id=auth.uid() and public.quote_verified(auth.uid()),'CUSTOMER_REQUIRED');
 if exists(select 1 from public.translation_cert_submissions where request_id=q.id) then return jsonb_build_object('id',q.id,'submitted',true);end if;
 perform public.quote_assert(q.state='open','INVALID_STATE');
 select scope into s from public.quote_request_versions where request_id=q.id and version=q.scope_version;
 if s->>'service'='Sworn Translation (Morocco)' then
  perform public.quote_assert(exists(select 1 from public.translation_files where request_id=q.id and media_type in ('application/pdf','image/jpeg','image/png')),'ORIGINAL_SCAN_REQUIRED');
 end if;
 insert into public.translation_cert_submissions(request_id) values(q.id);return jsonb_build_object('id',q.id,'submitted',true);
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_cert_capture(p_id uuid, p_scope jsonb, p_fields jsonb, p_draft boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;begin
 result:=public.translation_capture(p_id,p_scope,p_fields);
 if not p_draft then result:=public.translation_cert_submit(p_id);end if;return result;
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_cert_upload_check(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quote_requests;begin
 select * into q from public.quote_requests where id=p_id;
 perform public.quote_assert(q.customer_id=auth.uid() and public.quote_verified(auth.uid()),'CUSTOMER_REQUIRED');
 perform public.quote_assert((select capture_enabled and commands_enabled from public.quote_settings),'CAPTURE_DISABLED');
 perform public.quote_assert(q.state='open' and not exists(select 1 from public.translation_cert_submissions where request_id=p_id) and not exists(select 1 from public.quote_offers where request_id=p_id),'REQUEST_SUBMITTED');return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.quote_provider_check(readiness uuid, request_scope jsonb DEFAULT NULL::jsonb, customer uuid DEFAULT NULL::uuid, enabled boolean DEFAULT true)
 RETURNS public.quote_provider_readiness
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.quote_provider_readiness;begin
 r:=public.translation_cert_base_provider_check(readiness,request_scope,customer,enabled);
 if request_scope->>'service'='Sworn Translation (Morocco)' then perform public.quote_assert(public.translation_cert_credential_approved(r.provider_id),'SWORN_CREDENTIAL_REQUIRED');end if;return r;
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_cert_terms(p_sworn boolean)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select case when p_sworn then jsonb_build_object('method','in_person','inPerson','This is an in-person hand-off. The translator will validate the physical original document in person before handing over the stamped and notarized translation.','guarantee','Marocora stands by our sworn translations. If any Moroccan government authority rejects this translation and demands changes, we will amend or redo it for you.')
 else jsonb_build_object('email','Email Delivery','shipping','Shipping charges are extra.','usbCosts','Shipping plus the cost of the flash drive is extra.','usbSecurity','The flash drive will be encrypted for your security. The decryption password will be sent to your email address. Do not lose the password.') end;
$function$
;
CREATE OR REPLACE FUNCTION public.translation_cert_choice(v jsonb, p_sworn boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare method text;begin
 perform public.quote_object(v,array['method','extraCostsAccepted','encryptionAccepted','originalCheckAccepted','guaranteeAccepted']);method:=v->>'method';
 if p_sworn then
  perform public.quote_assert(method='in_person' and v->'originalCheckAccepted'='true'::jsonb and v->'guaranteeAccepted'='true'::jsonb,'IN_PERSON_REQUIRED');
 else
  perform public.quote_assert(method in ('email','shipping','usb'),'FULFILLMENT_REQUIRED');
  if method in ('shipping','usb') then perform public.quote_assert(v->'extraCostsAccepted'='true'::jsonb,'EXTRA_COSTS_ACK_REQUIRED');end if;
  if method='usb' then perform public.quote_assert(v->'encryptionAccepted'='true'::jsonb,'ENCRYPTION_ACK_REQUIRED');end if;
 end if;
 return v||jsonb_build_object('terms',public.translation_cert_terms(p_sworn));
end $function$
;
CREATE OR REPLACE FUNCTION public.quote_command_core(p_command uuid, p_action text, p_target uuid, p_revision bigint, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;q public.quote_requests;s jsonb;choice jsonb;sworn boolean;prior jsonb;begin
 perform pg_advisory_xact_lock(788601,1);
 select * into q from public.quote_requests where id=p_target;
 select scope into s from public.quote_request_versions where request_id=p_target and version=q.scope_version;
 sworn:=coalesce(s->>'service'='Sworn Translation (Morocco)',false);
 if p_action in ('issue_offer','accept_offer') then
  perform public.quote_assert(public.quote_can_read(p_target,auth.uid()),'UNAVAILABLE');
  perform public.quote_assert(exists(select 1 from public.translation_cert_submissions where request_id=p_target),'REQUEST_NOT_SUBMITTED');
  if sworn then perform public.quote_assert(exists(select 1 from public.translation_files where request_id=p_target and media_type in ('application/pdf','image/jpeg','image/png')),'ORIGINAL_SCAN_REQUIRED');end if;
 end if;
 if p_action='accept_offer' then choice:=public.translation_cert_choice(p_payload->'fulfillment',sworn);end if;
 result:=public.translation_cert_base_command_core(p_command,p_action,p_target,p_revision,p_payload);
 if p_action='accept_offer' then
  select f.choice into prior from public.translation_cert_fulfillments f where request_id=p_target;
  if found then perform public.quote_assert(prior=choice,'COMMAND_CONFLICT');else
   insert into public.translation_cert_fulfillments(request_id,choice) values(p_target,choice);
   if choice->>'method' in ('email','usb') then
    insert into public.translation_cert_mock_mail(request_id,destination,kind,state,content)
    select p_target,email,case choice->>'method' when 'email' then 'final_file_email_requested' else 'usb_password_email_requested' end,
      case when not (select notifications_enabled from public.quote_settings) then 'suppressed' when choice->>'method'='email' then 'waiting_for_final_file' else 'waiting_for_encrypted_usb_preparation' end,
      jsonb_build_object('mockOnly',true,'requestId',p_target,'fulfillment',choice,'fileAttached',false,'passwordGenerated',false,'sent',false)
    from auth.users where id=q.customer_id;
   end if;
  end if;
 end if;return result;
end $function$
;
CREATE OR REPLACE FUNCTION public.translation_scan_detail(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d jsonb;begin
 d:=public.translation_cert_base_detail(p_id);
 d:=d||jsonb_build_object('submitted',exists(select 1 from public.translation_cert_submissions where request_id=p_id),'fulfillment',(select choice from public.translation_cert_fulfillments where request_id=p_id));
 return d;
end $function$
;



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = true;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';


ALTER TABLE ONLY public.translation_scan_events
    ADD CONSTRAINT translation_scan_events_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.translation_files
    ADD CONSTRAINT translation_files_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.translation_settings
    ADD CONSTRAINT translation_settings_pkey PRIMARY KEY (singleton);



ALTER TABLE ONLY public.translation_cert_credential_reviews
    ADD CONSTRAINT translation_cert_credential_reviews_credential_id_revision_key UNIQUE (credential_id, revision);



ALTER TABLE ONLY public.translation_cert_credential_reviews
    ADD CONSTRAINT translation_cert_credential_reviews_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.translation_cert_credential_scans
    ADD CONSTRAINT translation_cert_credential_scans_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.translation_cert_credentials
    ADD CONSTRAINT translation_cert_credentials_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.translation_cert_fulfillments
    ADD CONSTRAINT translation_cert_fulfillments_pkey PRIMARY KEY (request_id);



ALTER TABLE ONLY public.translation_cert_mock_mail
    ADD CONSTRAINT translation_cert_mock_mail_pkey PRIMARY KEY (request_id);



ALTER TABLE ONLY public.translation_cert_submissions
    ADD CONSTRAINT translation_cert_submissions_pkey PRIMARY KEY (request_id);



ALTER TABLE ONLY public.translation_exclusions
    ADD CONSTRAINT translation_exclusions_pkey PRIMARY KEY (user_id);



ALTER TABLE ONLY public.translation_staff
    ADD CONSTRAINT translation_staff_pkey PRIMARY KEY (user_id);



ALTER TABLE ONLY public.quote_acceptances
    ADD CONSTRAINT quote_acceptances_offer_id_key UNIQUE (offer_id);



ALTER TABLE ONLY public.quote_acceptances
    ADD CONSTRAINT quote_acceptances_pkey PRIMARY KEY (request_id);



ALTER TABLE ONLY public.quote_assignments
    ADD CONSTRAINT quote_assignments_id_request_id_provider_id_scope_version_key UNIQUE (id, request_id, provider_id, scope_version);



ALTER TABLE ONLY public.quote_assignments
    ADD CONSTRAINT quote_assignments_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.quote_commands
    ADD CONSTRAINT quote_commands_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.quote_deliveries
    ADD CONSTRAINT quote_deliveries_event_id_recipient_id_key UNIQUE (event_id, recipient_id);



ALTER TABLE ONLY public.quote_deliveries
    ADD CONSTRAINT quote_deliveries_idempotency_key_key UNIQUE (idempotency_key);



ALTER TABLE ONLY public.quote_deliveries
    ADD CONSTRAINT quote_deliveries_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.quote_delivery_evidence
    ADD CONSTRAINT quote_delivery_evidence_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.quote_events
    ADD CONSTRAINT quote_events_aggregate_type_aggregate_id_revision_key UNIQUE (aggregate_type, aggregate_id, revision);



ALTER TABLE ONLY public.quote_events
    ADD CONSTRAINT quote_events_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.quote_intake_classifications
    ADD CONSTRAINT quote_intake_classifications_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.quote_messages
    ADD CONSTRAINT quote_messages_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.quote_offers
    ADD CONSTRAINT quote_offers_id_request_id_key UNIQUE (id, request_id);



ALTER TABLE ONLY public.quote_offers
    ADD CONSTRAINT quote_offers_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.quote_offers
    ADD CONSTRAINT quote_offers_request_id_version_key UNIQUE (request_id, version);



ALTER TABLE ONLY public.quote_policies
    ADD CONSTRAINT quote_policies_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.quote_policies
    ADD CONSTRAINT quote_policies_version_key UNIQUE (version);



ALTER TABLE ONLY public.quote_provider_acknowledgements
    ADD CONSTRAINT quote_provider_acknowledgements_pkey PRIMARY KEY (readiness_id);



ALTER TABLE ONLY public.quote_provider_readiness
    ADD CONSTRAINT quote_provider_readiness_id_provider_id_key UNIQUE (id, provider_id);



ALTER TABLE ONLY public.quote_provider_readiness
    ADD CONSTRAINT quote_provider_readiness_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.quote_provider_readiness
    ADD CONSTRAINT quote_provider_readiness_provider_id_version_key UNIQUE (provider_id, version);



ALTER TABLE ONLY public.quote_request_versions
    ADD CONSTRAINT quote_request_versions_pkey PRIMARY KEY (request_id, version);



ALTER TABLE ONLY public.quote_requests
    ADD CONSTRAINT quote_requests_intake_id_key UNIQUE (intake_id);



ALTER TABLE ONLY public.quote_requests
    ADD CONSTRAINT quote_requests_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.quote_settings
    ADD CONSTRAINT quote_settings_pkey PRIMARY KEY (singleton);



ALTER TABLE ONLY public.quote_test_registry
    ADD CONSTRAINT quote_test_registry_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.quote_threads
    ADD CONSTRAINT quote_threads_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.translation_intakes
    ADD CONSTRAINT translation_intakes_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.translation_provider_events
    ADD CONSTRAINT translation_provider_events_command_id_key UNIQUE (command_id);



ALTER TABLE ONLY public.translation_provider_events
    ADD CONSTRAINT translation_provider_events_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.translation_provider_applications
    ADD CONSTRAINT translation_provider_applications_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.translation_provider_applications
    ADD CONSTRAINT translation_provider_applications_source_key_key UNIQUE (source_key);



CREATE INDEX translation_scan_scan_latest ON public.translation_scan_events USING btree (file_id, created_at DESC, id DESC);



CREATE INDEX quote_customer_requests ON public.quote_requests USING btree (customer_id, created_at DESC, id);



CREATE INDEX quote_delivery_exceptions ON public.quote_deliveries USING btree (state, created_at, id);



CREATE UNIQUE INDEX quote_one_accepted_offer ON public.quote_offers USING btree (request_id) WHERE (state = 'accepted'::text);



CREATE UNIQUE INDEX quote_one_active_assignment ON public.quote_assignments USING btree (request_id) WHERE (state = ANY (ARRAY['invited'::text, 'accepted'::text]));



CREATE UNIQUE INDEX quote_one_enabled_readiness ON public.quote_provider_readiness USING btree (provider_id) WHERE (state = 'enabled'::text);



CREATE UNIQUE INDEX quote_one_live_offer ON public.quote_offers USING btree (request_id) WHERE (state = 'offered'::text);



CREATE INDEX quote_owner_queue ON public.quote_requests USING btree (owner_id, state, updated_at DESC, id);



CREATE INDEX quote_provider_assignments ON public.quote_assignments USING btree (provider_id, state, invited_at DESC, id);



CREATE INDEX translation_intakes_user_time ON public.translation_intakes USING btree (user_id, created_at DESC);



CREATE INDEX translation_provider_applications_owner ON public.translation_provider_applications USING btree (user_id, created_at DESC);



CREATE INDEX vendor_events_application ON public.translation_provider_events USING btree (application_id, created_at);



CREATE TRIGGER translation_scan_scan_immutable BEFORE DELETE OR UPDATE ON public.translation_scan_events FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER translation_file_immutable BEFORE DELETE OR UPDATE ON public.translation_files FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER translation_freeze_delivery BEFORE INSERT ON public.quote_deliveries FOR EACH ROW EXECUTE FUNCTION public.translation_freeze_delivery();



CREATE TRIGGER translation_cert_immutable BEFORE DELETE OR UPDATE ON public.translation_cert_credential_reviews FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER translation_cert_immutable BEFORE DELETE OR UPDATE ON public.translation_cert_credential_scans FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER translation_cert_immutable BEFORE DELETE OR UPDATE ON public.translation_cert_credentials FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER translation_cert_immutable BEFORE DELETE OR UPDATE ON public.translation_cert_fulfillments FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER translation_cert_immutable BEFORE DELETE OR UPDATE ON public.translation_cert_mock_mail FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER translation_cert_immutable BEFORE DELETE OR UPDATE ON public.translation_cert_submissions FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER quote_append_only BEFORE DELETE OR UPDATE ON public.quote_acceptances FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER quote_append_only BEFORE DELETE OR UPDATE ON public.quote_commands FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER quote_append_only BEFORE DELETE OR UPDATE ON public.quote_delivery_evidence FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER quote_append_only BEFORE DELETE OR UPDATE ON public.quote_events FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER quote_append_only BEFORE DELETE OR UPDATE ON public.quote_intake_classifications FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER quote_append_only BEFORE DELETE OR UPDATE ON public.quote_messages FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER quote_append_only BEFORE DELETE OR UPDATE ON public.quote_policies FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER quote_append_only BEFORE DELETE OR UPDATE ON public.quote_provider_acknowledgements FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER quote_append_only BEFORE DELETE OR UPDATE ON public.quote_request_versions FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER quote_append_only BEFORE DELETE OR UPDATE ON public.quote_test_registry FOR EACH ROW EXECUTE FUNCTION public.quote_append_only();



CREATE TRIGGER quote_classification_guard BEFORE INSERT ON public.quote_intake_classifications FOR EACH ROW EXECUTE FUNCTION public.quote_classification_guard();



CREATE TRIGGER quote_offer_immutable BEFORE DELETE OR UPDATE ON public.quote_offers FOR EACH ROW EXECUTE FUNCTION public.quote_offer_immutable();



CREATE TRIGGER quote_readiness_guard BEFORE DELETE OR UPDATE ON public.quote_provider_readiness FOR EACH ROW EXECUTE FUNCTION public.quote_readiness_guard();



CREATE TRIGGER quote_request_guard BEFORE DELETE OR UPDATE ON public.quote_requests FOR EACH ROW EXECUTE FUNCTION public.quote_request_guard();











ALTER TABLE ONLY public.translation_scan_events
    ADD CONSTRAINT translation_scan_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.translation_scan_events
    ADD CONSTRAINT translation_scan_events_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.translation_files(id);



ALTER TABLE ONLY public.translation_files
    ADD CONSTRAINT translation_files_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.quote_requests(id);



ALTER TABLE ONLY public.translation_files
    ADD CONSTRAINT translation_files_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.translation_settings
    ADD CONSTRAINT translation_settings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.translation_staff(user_id);



ALTER TABLE ONLY public.translation_cert_credential_reviews
    ADD CONSTRAINT translation_cert_credential_reviews_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.translation_cert_credential_reviews
    ADD CONSTRAINT translation_cert_credential_reviews_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.translation_cert_credentials(id);



ALTER TABLE ONLY public.translation_cert_credential_scans
    ADD CONSTRAINT translation_cert_credential_scans_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.translation_cert_credentials
    ADD CONSTRAINT translation_cert_credentials_id_fkey FOREIGN KEY (id) REFERENCES public.translation_cert_credential_scans(id);



ALTER TABLE ONLY public.translation_cert_credentials
    ADD CONSTRAINT translation_cert_credentials_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.translation_cert_fulfillments
    ADD CONSTRAINT translation_cert_fulfillments_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.quote_acceptances(request_id);



ALTER TABLE ONLY public.translation_cert_mock_mail
    ADD CONSTRAINT translation_cert_mock_mail_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.translation_cert_fulfillments(request_id);



ALTER TABLE ONLY public.translation_cert_submissions
    ADD CONSTRAINT translation_cert_submissions_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.quote_requests(id);



ALTER TABLE ONLY public.translation_exclusions
    ADD CONSTRAINT translation_exclusions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.translation_staff
    ADD CONSTRAINT translation_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.quote_acceptances
    ADD CONSTRAINT quote_acceptances_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_acceptances
    ADD CONSTRAINT quote_acceptances_offer_id_request_id_fkey FOREIGN KEY (offer_id, request_id) REFERENCES public.quote_offers(id, request_id);



ALTER TABLE ONLY public.quote_acceptances
    ADD CONSTRAINT quote_acceptances_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.quote_policies(id);



ALTER TABLE ONLY public.quote_acceptances
    ADD CONSTRAINT quote_acceptances_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.quote_requests(id);



ALTER TABLE ONLY public.quote_requests
    ADD CONSTRAINT quote_accepted_offer_fk FOREIGN KEY (accepted_offer_id, id) REFERENCES public.quote_offers(id, request_id) DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY public.quote_assignments
    ADD CONSTRAINT quote_assignments_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_assignments
    ADD CONSTRAINT quote_assignments_readiness_id_provider_id_fkey FOREIGN KEY (readiness_id, provider_id) REFERENCES public.quote_provider_readiness(id, provider_id);



ALTER TABLE ONLY public.quote_assignments
    ADD CONSTRAINT quote_assignments_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.quote_requests(id);



ALTER TABLE ONLY public.quote_assignments
    ADD CONSTRAINT quote_assignments_request_id_scope_version_fkey FOREIGN KEY (request_id, scope_version) REFERENCES public.quote_request_versions(request_id, version);



ALTER TABLE ONLY public.quote_commands
    ADD CONSTRAINT quote_commands_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_commands
    ADD CONSTRAINT quote_commands_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.quote_events(id);



ALTER TABLE ONLY public.quote_requests
    ADD CONSTRAINT quote_current_scope_fk FOREIGN KEY (id, scope_version) REFERENCES public.quote_request_versions(request_id, version) DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY public.quote_deliveries
    ADD CONSTRAINT quote_deliveries_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.quote_events(id);



ALTER TABLE ONLY public.quote_deliveries
    ADD CONSTRAINT quote_deliveries_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_delivery_evidence
    ADD CONSTRAINT quote_delivery_evidence_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_delivery_evidence
    ADD CONSTRAINT quote_delivery_evidence_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.quote_deliveries(id);



ALTER TABLE ONLY public.quote_events
    ADD CONSTRAINT quote_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_events
    ADD CONSTRAINT quote_events_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.quote_requests(id);



ALTER TABLE ONLY public.quote_intake_classifications
    ADD CONSTRAINT quote_intake_classifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_intake_classifications
    ADD CONSTRAINT quote_intake_classifications_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES public.translation_intakes(id);



ALTER TABLE ONLY public.quote_messages
    ADD CONSTRAINT quote_messages_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_messages
    ADD CONSTRAINT quote_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.quote_threads(id);



ALTER TABLE ONLY public.quote_offers
    ADD CONSTRAINT quote_offers_assignment_id_request_id_provider_id_scope_ve_fkey FOREIGN KEY (assignment_id, request_id, provider_id, scope_version) REFERENCES public.quote_assignments(id, request_id, provider_id, scope_version);



ALTER TABLE ONLY public.quote_offers
    ADD CONSTRAINT quote_offers_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_offers
    ADD CONSTRAINT quote_offers_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.quote_policies(id);



ALTER TABLE ONLY public.quote_offers
    ADD CONSTRAINT quote_offers_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_offers
    ADD CONSTRAINT quote_offers_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.quote_requests(id);



ALTER TABLE ONLY public.quote_policies
    ADD CONSTRAINT quote_policies_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_provider_acknowledgements
    ADD CONSTRAINT quote_provider_acknowledgements_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.quote_policies(id);



ALTER TABLE ONLY public.quote_provider_acknowledgements
    ADD CONSTRAINT quote_provider_acknowledgements_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_provider_acknowledgements
    ADD CONSTRAINT quote_provider_acknowledgements_readiness_id_provider_id_fkey FOREIGN KEY (readiness_id, provider_id) REFERENCES public.quote_provider_readiness(id, provider_id);



ALTER TABLE ONLY public.quote_provider_readiness
    ADD CONSTRAINT quote_provider_readiness_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.translation_provider_applications(id);



ALTER TABLE ONLY public.quote_provider_readiness
    ADD CONSTRAINT quote_provider_readiness_approval_event_id_fkey FOREIGN KEY (approval_event_id) REFERENCES public.translation_provider_events(id);



ALTER TABLE ONLY public.quote_provider_readiness
    ADD CONSTRAINT quote_provider_readiness_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.quote_policies(id);



ALTER TABLE ONLY public.quote_provider_readiness
    ADD CONSTRAINT quote_provider_readiness_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_provider_readiness
    ADD CONSTRAINT quote_provider_readiness_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.translation_staff(user_id);



ALTER TABLE ONLY public.quote_request_versions
    ADD CONSTRAINT quote_request_versions_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_request_versions
    ADD CONSTRAINT quote_request_versions_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.quote_requests(id);



ALTER TABLE ONLY public.quote_requests
    ADD CONSTRAINT quote_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_requests
    ADD CONSTRAINT quote_requests_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES public.translation_intakes(id);



ALTER TABLE ONLY public.quote_requests
    ADD CONSTRAINT quote_requests_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.translation_staff(user_id);



ALTER TABLE ONLY public.quote_test_registry
    ADD CONSTRAINT quote_test_registry_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_test_registry
    ADD CONSTRAINT quote_test_registry_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.translation_provider_applications(id);



ALTER TABLE ONLY public.quote_test_registry
    ADD CONSTRAINT quote_test_registry_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES public.translation_intakes(id);



ALTER TABLE ONLY public.quote_test_registry
    ADD CONSTRAINT quote_test_registry_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_threads
    ADD CONSTRAINT quote_threads_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.quote_threads
    ADD CONSTRAINT quote_threads_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.quote_requests(id);



ALTER TABLE ONLY public.translation_intakes
    ADD CONSTRAINT translation_intakes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.translation_provider_events
    ADD CONSTRAINT translation_provider_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);



ALTER TABLE ONLY public.translation_provider_events
    ADD CONSTRAINT translation_provider_events_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.translation_provider_applications(id);



ALTER TABLE ONLY public.translation_provider_applications
    ADD CONSTRAINT translation_provider_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);



ALTER TABLE public.translation_scan_events ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.translation_files ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.translation_settings ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.translation_cert_credential_reviews ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.translation_cert_credential_scans ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.translation_cert_credentials ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.translation_cert_fulfillments ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.translation_cert_mock_mail ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.translation_cert_submissions ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.translation_exclusions ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.translation_staff ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_acceptances ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_assignments ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_commands ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_deliveries ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_delivery_evidence ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_events ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_intake_classifications ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_messages ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_offers ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_policies ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_provider_acknowledgements ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_provider_readiness ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_request_versions ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_settings ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_test_registry ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.quote_threads ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.translation_intakes ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.translation_provider_events ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.translation_provider_applications ENABLE ROW LEVEL SECURITY;





CREATE FUNCTION public.translation_session_context() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE actor uuid:=auth.uid();role_name text;BEGIN
 PERFORM public.quote_assert(public.quote_verified(actor),'UNAVAILABLE');
 role_name:=CASE WHEN public.quote_staff(actor) THEN 'staff' WHEN EXISTS(SELECT 1 FROM public.translation_provider_applications WHERE user_id=actor AND category='translation') THEN 'provider' ELSE 'customer' END;
 RETURN jsonb_build_object('actor',actor,'role',role_name);
END;$body$;
CREATE FUNCTION public.translation_runtime_settings() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN PERFORM public.quote_assert(public.quote_verified(auth.uid()),'UNAVAILABLE');RETURN (SELECT to_jsonb(s) FROM public.quote_settings s);END;$body$;
CREATE FUNCTION public.translation_workspace_options() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN PERFORM public.quote_assert(public.quote_staff(auth.uid()),'STAFF_OWNER_REQUIRED');
 RETURN jsonb_build_object('readiness',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'label',a.name)) FROM public.quote_provider_readiness r JOIN public.translation_provider_applications a ON a.id=r.application_id WHERE r.state='enabled' AND NOT a.is_test),'[]'::jsonb),'policy',(SELECT jsonb_build_object('version',version,'digest',digest,'wording',wording) FROM public.quote_policies WHERE kind='acceptance' AND approved_at IS NOT NULL ORDER BY approved_at DESC LIMIT 1));
END;$body$;
DO $permissions$ DECLARE f record;t text;BEGIN
 FOR f IN SELECT oid::regprocedure fn FROM pg_proc WHERE pronamespace='public'::regnamespace AND (proname LIKE 'quote\_%' ESCAPE '\' OR proname LIKE 'translation\_%' ESCAPE '\') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.fn);END LOOP;
 FOREACH t IN ARRAY ARRAY['translation_staff','translation_exclusions','translation_provider_applications','translation_provider_events','translation_intakes','quote_settings','quote_policies','quote_test_registry','quote_intake_classifications','quote_requests','quote_request_versions','quote_provider_readiness','quote_provider_acknowledgements','quote_assignments','quote_offers','quote_acceptances','quote_threads','quote_messages','quote_events','quote_commands','quote_deliveries','quote_delivery_evidence','translation_settings','translation_files','translation_scan_events','translation_cert_submissions','translation_cert_credential_scans','translation_cert_credentials','translation_cert_credential_reviews','translation_cert_fulfillments','translation_cert_mock_mail','translation_staging_accounts'] LOOP
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('CREATE POLICY translation_rpc_only ON public.%I AS RESTRICTIVE FOR ALL TO anon,authenticated USING (false) WITH CHECK (false)',t);
 END LOOP;
END;$permissions$;
-- Function EXECUTE also requires schema USAGE; managed projects may revoke it.
GRANT USAGE ON SCHEMA public TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.translation_session_context(),public.translation_runtime_settings(),public.translation_workspace_options(),
 public.translation_list(),public.translation_detail(uuid),public.translation_scan_detail(uuid),
 public.translation_cert_capture(uuid,jsonb,jsonb,boolean),public.translation_cert_submit(uuid),public.translation_cert_upload_check(uuid),
 public.translation_scan_register_file(uuid,uuid,text,integer,text,text),public.translation_scan_file(uuid),public.translation_scan_scan_target(uuid),
 public.translation_cert_credentials_list(),public.translation_cert_credential_file(uuid),public.translation_cert_review_credential(uuid,uuid,bigint,text,text),
 public.quote_command(uuid,text,uuid,bigint,jsonb),public.quote_my_readiness() TO authenticated;
GRANT EXECUTE ON FUNCTION public.translation_scan_record_scan(uuid,text,text,text,text,uuid),public.translation_cert_record_credential(uuid,uuid,jsonb,jsonb,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';

COMMIT;
