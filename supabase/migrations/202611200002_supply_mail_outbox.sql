-- LOCAL REVIEW DRAFT: no deployment, sends, provider configuration or historical backfill.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $guard$
DECLARE f record; t text;
BEGIN
 IF current_user IN ('anon','authenticated','service_role','authenticator') THEN RAISE EXCEPTION 'SUPPLY_MAIL_OWNER_REQUIRED'; END IF;
 IF to_regprocedure('auth.role()') IS NULL OR to_regprocedure('public.supply_verified(uuid)') IS NULL THEN RAISE EXCEPTION 'SUPPLY_MAIL_PREREQUISITES_MISSING'; END IF;
 FOR f IN SELECT * FROM (VALUES
 ('supply_save_application(text,jsonb,uuid,bigint)', '2ac32a0ef13c92bc62ebce2584f4699c', 'authenticated'),
 ('supply_review_application(uuid,bigint,text,text,boolean)', 'ef9641e9d1eefc1198de71fd5bf01a28', 'authenticated'),
 ('supply_record_credential(uuid,uuid,jsonb)', 'fe3071a1401b5dd4f6075b6c71317504', 'service_role')
 ) AS expected(signature,body_hash,allowed_role) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.'||f.signature)
   AND proowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND prosecdef
   AND proconfig=ARRAY['search_path=""'] AND md5(prosrc)=f.body_hash
   AND has_function_privilege(f.allowed_role,oid,'EXECUTE')
   AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(proacl,acldefault('f',proowner))) acl
    WHERE acl.grantee NOT IN (proowner,(SELECT oid FROM pg_roles WHERE rolname=f.allowed_role))
    OR (acl.grantee<>proowner AND acl.is_grantable))) THEN RAISE EXCEPTION 'SUPPLY_MAIL_PREREQUISITE_DRIFT'; END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['supply_applications','supply_teacher_profiles','supply_translation_profiles','supply_transport_profiles','supply_reviews'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||t) AND relrowsecurity
   AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)
   AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(relacl,acldefault('r',relowner))) acl WHERE acl.grantee<>relowner)) THEN RAISE EXCEPTION 'SUPPLY_MAIL_PREREQUISITE_DRIFT'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relname LIKE 'supply_mail_%')
 OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'supply_mail_%')
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'supply_mail_%') THEN RAISE EXCEPTION 'SUPPLY_MAIL_OBJECTS_ALREADY_EXIST'; END IF;
END;$guard$;
-- Only routing metadata is stored. No profiles, feedback, banking or credential data.
CREATE TABLE public.supply_mail_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id uuid NOT NULL REFERENCES public.supply_applications(id) ON DELETE CASCADE,
 revision bigint NOT NULL CHECK(revision>0),
 kind text NOT NULL CHECK(kind IN ('submitted','approved','rejected')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','retry','sent','failed','uncertain','cancelled')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 recipient text, claim_token uuid, claimed_at timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),accepted_at timestamptz,
 UNIQUE(application_id,revision,kind)
);
ALTER TABLE public.supply_mail_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY supply_mail_rpc_only ON public.supply_mail_events AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
REVOKE ALL ON public.supply_mail_events FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX supply_mail_due ON public.supply_mail_events(application_id,next_attempt_at) WHERE state IN ('pending','retry','sending');

CREATE FUNCTION public.supply_mail_capture() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE application uuid; rev bigint; event_kind text;
BEGIN
 IF TG_TABLE_NAME='supply_reviews' THEN
  application:=NEW.application_id; rev:=NEW.revision; event_kind:=NEW.decision;
 ELSE
  application:=NEW.application_id;
  SELECT revision INTO STRICT rev FROM public.supply_applications WHERE id=application;
  event_kind:='submitted';
 END IF;
 INSERT INTO public.supply_mail_events(application_id,revision,kind) VALUES(application,rev,event_kind)
 ON CONFLICT(application_id,revision,kind) DO NOTHING;
 RETURN NEW;
END;$$;
CREATE TRIGGER supply_mail_teacher AFTER INSERT OR UPDATE ON public.supply_teacher_profiles FOR EACH ROW EXECUTE FUNCTION public.supply_mail_capture();
CREATE TRIGGER supply_mail_translation AFTER INSERT OR UPDATE ON public.supply_translation_profiles FOR EACH ROW EXECUTE FUNCTION public.supply_mail_capture();
CREATE TRIGGER supply_mail_transport AFTER INSERT OR UPDATE ON public.supply_transport_profiles FOR EACH ROW EXECUTE FUNCTION public.supply_mail_capture();
CREATE TRIGGER supply_mail_review AFTER INSERT ON public.supply_reviews FOR EACH ROW EXECUTE FUNCTION public.supply_mail_capture();

-- Server-only, explicitly scoped to an authenticated owner or current reviewer.
-- No scheduler or endpoint calls this automatically. Expired/ambiguous claims never retry.
CREATE FUNCTION public.supply_mail_claim(p_id uuid,p_actor uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.supply_applications%rowtype; e public.supply_mail_events%rowtype; address text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'SUPPLY_MAIL_SERVER_REQUIRED'; END IF;
 IF NOT public.supply_verified(p_actor) THEN RAISE EXCEPTION 'SUPPLY_MAIL_ACCESS_DENIED'; END IF;
 SELECT * INTO a FROM public.supply_applications WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SUPPLY_MAIL_ACCESS_DENIED'; END IF;
 IF a.owner_id<>p_actor THEN
  PERFORM 1 FROM public.learning_review_staff WHERE user_id=p_actor FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUPPLY_MAIL_ACCESS_DENIED'; END IF;
 END IF;
 SELECT email INTO address FROM auth.users WHERE id=a.owner_id AND email_confirmed_at IS NOT NULL AND NOT is_anonymous FOR SHARE;
 -- An interrupted send may have been accepted. Never auto-reclaim its lease.
 UPDATE public.supply_mail_events SET state='uncertain' WHERE application_id=p_id AND state='sending' AND claimed_at<=clock_timestamp()-interval '2 minutes';
 -- A credential upload advances revision but must not erase the receipt for a
 -- profile submission. Only a newer profile submission supersedes that receipt.
 UPDATE public.supply_mail_events AS pending SET state='cancelled' WHERE pending.application_id=p_id AND pending.state IN ('pending','retry')
 AND ((pending.kind<>'submitted' AND pending.revision<>a.revision)
 OR (pending.kind='submitted' AND EXISTS(SELECT 1 FROM public.supply_mail_events newer WHERE newer.application_id=p_id AND newer.kind='submitted' AND newer.revision>pending.revision))
 OR address IS NULL OR length(address)>320 OR address !~ '^[^[:space:]<>@,;]+@[^[:space:]<>@,;]+$'
 OR (pending.recipient IS NOT NULL AND pending.recipient IS DISTINCT FROM address));
 SELECT * INTO e FROM public.supply_mail_events WHERE application_id=p_id AND state IN ('pending','retry')
 AND attempts<3 AND next_attempt_at<=clock_timestamp() ORDER BY revision,CASE kind WHEN 'submitted' THEN 0 ELSE 1 END,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE public.supply_mail_events SET state='sending',recipient=address,attempts=attempts+1,
 claim_token=gen_random_uuid(),claimed_at=clock_timestamp() WHERE id=e.id RETURNING * INTO e;
 RETURN jsonb_build_object('event',jsonb_build_object('id',e.id,'kind',e.kind,'revision',e.revision),
 'application',jsonb_build_object('id',a.id,'email',e.recipient),'claimToken',e.claim_token,
 'idempotencyKey','marocora-supply/'||e.id::text);
END;$$;

CREATE FUNCTION public.supply_mail_finish(p_event uuid,p_claim uuid,p_result text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.supply_mail_events%rowtype; outcome text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'SUPPLY_MAIL_SERVER_REQUIRED'; END IF;
 IF p_result IS NULL OR p_result NOT IN ('sent','retry','failed','uncertain') THEN RAISE EXCEPTION 'SUPPLY_MAIL_INVALID_RESULT'; END IF;
 SELECT * INTO e FROM public.supply_mail_events WHERE id=p_event FOR UPDATE;
 IF NOT FOUND OR e.state<>'sending' OR e.claim_token IS DISTINCT FROM p_claim THEN RETURN NULL; END IF;
 IF e.claimed_at<=clock_timestamp()-interval '2 minutes' THEN
  UPDATE public.supply_mail_events SET state='uncertain' WHERE id=e.id;
  RETURN NULL;
 END IF;
 outcome:=CASE WHEN p_result='retry' AND e.attempts>=3 THEN 'failed' ELSE p_result END;
 UPDATE public.supply_mail_events SET state=outcome,
 next_attempt_at=clock_timestamp()+CASE WHEN e.attempts=1 THEN interval '1 minute' ELSE interval '5 minutes' END,
 accepted_at=CASE WHEN outcome='sent' THEN clock_timestamp() ELSE NULL END WHERE id=e.id;
 RETURN outcome;
END;$$;
REVOKE ALL ON FUNCTION public.supply_mail_capture(),public.supply_mail_claim(uuid,uuid),public.supply_mail_finish(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.supply_mail_claim(uuid,uuid),public.supply_mail_finish(uuid,uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
