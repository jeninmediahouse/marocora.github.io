-- LOCAL REVIEW DRAFT. No seeds, staff grants, payments, bookings or provider calls.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $guard$
BEGIN
 IF current_user IN ('anon','authenticated','service_role','authenticator') THEN RAISE EXCEPTION 'SUPPLY_MIGRATION_OWNER_REQUIRED'; END IF;
 IF to_regclass('auth.users') IS NULL OR to_regprocedure('auth.uid()') IS NULL
 OR to_regclass('public.learning_review_staff') IS NULL OR to_regclass('public.learning_review_exclusions') IS NULL
 OR to_regrole('anon') IS NULL OR to_regrole('authenticated') IS NULL OR to_regrole('service_role') IS NULL THEN RAISE EXCEPTION 'SUPPLY_PREREQUISITES_MISSING'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND left(c.relname,7)='supply_')
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND left(p.proname,7)='supply_') THEN RAISE EXCEPTION 'SUPPLY_OBJECTS_ALREADY_EXIST'; END IF;
END;$guard$;
CREATE FUNCTION public.supply_text(v jsonb, maximum integer) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_typeof(v)='string' AND length(btrim(v#>>'{}')) BETWEEN 1 AND maximum,false);
$$;
CREATE FUNCTION public.supply_strings(v jsonb, maximum integer) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v) NOT BETWEEN 1 AND maximum THEN RETURN false; END IF;
 RETURN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v) AS elements(value) WHERE NOT public.supply_text(elements.value,100))
 AND (SELECT count(DISTINCT lower(btrim(elements.value#>>'{}'))) FROM jsonb_array_elements(v) AS elements(value))=jsonb_array_length(v);
END;$$;
CREATE FUNCTION public.supply_valid_profile(t text,p jsonb) RETURNS boolean LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE allowed text[]; profile_item jsonb;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::text)>18000
 OR NOT public.supply_text(p->'displayName',160) OR NOT public.supply_text(p->'bio',4000)
 OR jsonb_typeof(p->'publicationConsent') IS DISTINCT FROM 'boolean' THEN RETURN false; END IF;
 allowed:=ARRAY['displayName','bio','publicationConsent'];
 IF t='teacher' THEN
  allowed:=allowed||ARRAY['languages','hourlyRateMinor','currency','timezone','availability','introVideo'];
  IF NOT public.supply_strings(p->'languages',12) OR jsonb_typeof(p->'hourlyRateMinor') IS DISTINCT FROM 'number' OR (p->>'hourlyRateMinor') !~ '^[0-9]{1,8}$'
  OR coalesce((p->>'hourlyRateMinor')::bigint,0)<1 OR coalesce(p->>'currency','') NOT IN ('MAD','EUR','USD')
  OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p->>'timezone')
  OR jsonb_typeof(p->'availability') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'availability') NOT BETWEEN 1 AND 28
  OR coalesce(p->>'introVideo','') !~ '^https://[A-Za-z0-9.-]+(:443)?(/[^[:space:]<>]*)?$' THEN RETURN false; END IF;
  FOR profile_item IN SELECT value FROM jsonb_array_elements(p->'availability') LOOP
   IF jsonb_typeof(profile_item) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(profile_item))<>3
   OR coalesce(profile_item->>'day','') !~ '^[1-7]$' OR coalesce(profile_item->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   OR coalesce(profile_item->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR profile_item->>'start'>=profile_item->>'end' THEN RETURN false; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'availability') WITH ORDINALITY a(v,n)
    JOIN jsonb_array_elements(p->'availability') WITH ORDINALITY b(v,n) ON a.n<b.n
    WHERE a.v->>'day'=b.v->>'day' AND a.v->>'start'<b.v->>'end' AND b.v->>'start'<a.v->>'end') THEN RETURN false; END IF;
 ELSIF t='translator' THEN
  allowed:=allowed||ARRAY['organizationKind','languagePairs','specialties'];
  IF coalesce(p->>'organizationKind','') NOT IN ('individual','agency') OR jsonb_typeof(p->'languagePairs') IS DISTINCT FROM 'array'
  OR jsonb_array_length(p->'languagePairs') NOT BETWEEN 1 AND 30 OR NOT public.supply_strings(p->'specialties',4)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p->'specialties') AS specialties(value) WHERE specialties.value NOT IN ('Legal','Medical','Technical','Sworn')) THEN RETURN false; END IF;
  FOR profile_item IN SELECT value FROM jsonb_array_elements(p->'languagePairs') LOOP
   IF jsonb_typeof(profile_item) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(profile_item))<>2
   OR NOT public.supply_text(profile_item->'source',100) OR NOT public.supply_text(profile_item->'target',100)
   OR lower(btrim(profile_item->>'source'))=lower(btrim(profile_item->>'target')) THEN RETURN false; END IF;
  END LOOP;
 ELSIF t='transport' THEN
  allowed:=allowed||ARRAY['vehicleTypes','capacity','serviceRegions','baseRateMinor','currency'];
  IF NOT public.supply_strings(p->'vehicleTypes',3) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p->'vehicleTypes') AS vehicles(value) WHERE vehicles.value NOT IN ('sedan','van','bus'))
  OR jsonb_typeof(p->'capacity') IS DISTINCT FROM 'number' OR jsonb_typeof(p->'baseRateMinor') IS DISTINCT FROM 'number' OR coalesce(p->>'capacity','') !~ '^[0-9]{1,4}$' OR coalesce((p->>'capacity')::integer,0) NOT BETWEEN 1 AND 9999
  OR NOT public.supply_strings(p->'serviceRegions',30) OR coalesce(p->>'baseRateMinor','') !~ '^[0-9]{1,8}$'
  OR coalesce((p->>'baseRateMinor')::bigint,0)<1 OR coalesce(p->>'currency','') NOT IN ('MAD','EUR','USD') THEN RETURN false; END IF;
 ELSE RETURN false;
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE NOT k=ANY(allowed)) OR (SELECT count(*) FROM jsonb_object_keys(p))<>cardinality(allowed) THEN RETURN false; END IF;
 RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END;$$;
CREATE TABLE public.supply_applications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 vendor_type text NOT NULL CHECK(vendor_type IN ('teacher','translator','transport')),
 status text NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review','approved','rejected')),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),reviewed_revision bigint,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(owner_id,vendor_type)
);
CREATE TABLE public.supply_teacher_profiles(application_id uuid PRIMARY KEY REFERENCES public.supply_applications(id) ON DELETE CASCADE,data jsonb NOT NULL CHECK(public.supply_valid_profile('teacher',data)));
CREATE TABLE public.supply_translation_profiles(application_id uuid PRIMARY KEY REFERENCES public.supply_applications(id) ON DELETE CASCADE,data jsonb NOT NULL CHECK(public.supply_valid_profile('translator',data)));
CREATE TABLE public.supply_transport_profiles(application_id uuid PRIMARY KEY REFERENCES public.supply_applications(id) ON DELETE CASCADE,data jsonb NOT NULL CHECK(public.supply_valid_profile('transport',data)));
CREATE TABLE public.supply_credentials(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),application_id uuid NOT NULL REFERENCES public.supply_applications(id) ON DELETE CASCADE,
 file jsonb NOT NULL CHECK(jsonb_typeof(file)='object'),scan_status text NOT NULL CHECK(scan_status='clean'),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.supply_reviews(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,application_id uuid NOT NULL REFERENCES public.supply_applications(id) ON DELETE CASCADE,
 revision bigint NOT NULL,reviewer_id uuid NOT NULL REFERENCES auth.users(id),decision text NOT NULL CHECK(decision IN ('approved','rejected')),
 reason text NOT NULL CHECK(length(reason)<=2000),credentials_reviewed boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.supply_payouts(
 application_id uuid PRIMARY KEY REFERENCES public.supply_applications(id) ON DELETE CASCADE,
 connection_status text NOT NULL DEFAULT 'pending' CHECK(connection_status='pending'),
 envelope jsonb NOT NULL CHECK(jsonb_typeof(envelope)='object'),iban_last_four text NOT NULL CHECK(iban_last_four ~ '^[A-Z0-9]{4}$'),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX supply_pending ON public.supply_applications(status,updated_at);
CREATE INDEX supply_credential_application ON public.supply_credentials(application_id);
CREATE INDEX supply_review_application ON public.supply_reviews(application_id,id DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['supply_applications','supply_teacher_profiles','supply_translation_profiles','supply_transport_profiles','supply_credentials','supply_reviews','supply_payouts'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY supply_rpc_only ON public.%I AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false)',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END;$$;
CREATE FUNCTION public.supply_verified(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users WHERE id=u AND email IS NOT NULL AND email_confirmed_at IS NOT NULL AND NOT is_anonymous);
$$;
CREATE FUNCTION public.supply_admin_access() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.supply_verified(auth.uid()) AND EXISTS(SELECT 1 FROM public.learning_review_staff WHERE user_id=auth.uid());
$$;
CREATE FUNCTION public.supply_profile(a public.supply_applications) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE a.vendor_type WHEN 'teacher' THEN (SELECT data FROM public.supply_teacher_profiles WHERE application_id=a.id)
 WHEN 'translator' THEN (SELECT data FROM public.supply_translation_profiles WHERE application_id=a.id)
 ELSE (SELECT data FROM public.supply_transport_profiles WHERE application_id=a.id) END;
$$;
CREATE FUNCTION public.supply_private_payload(a public.supply_applications) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',a.id,'type',a.vendor_type,'status',a.status,'revision',a.revision,'profile',public.supply_profile(a),
 'payout',jsonb_build_object('status','pending','configured',EXISTS(SELECT 1 FROM public.supply_payouts WHERE application_id=a.id),'lastFour',(SELECT iban_last_four FROM public.supply_payouts WHERE application_id=a.id)),
 'credentials',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'status',scan_status,'createdAt',created_at) ORDER BY created_at) FROM public.supply_credentials WHERE application_id=a.id),'[]'),
 'reviews',coalesce((SELECT jsonb_agg(jsonb_build_object('revision',revision,'decision',decision,'reason',reason,'createdAt',created_at) ORDER BY id DESC) FROM public.supply_reviews WHERE application_id=a.id),'[]'),
 'earnings',jsonb_build_object('minor',0,'currency','USD'));
$$;
CREATE FUNCTION public.supply_my_applications() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.supply_verified(auth.uid()) THEN RAISE EXCEPTION 'SUPPLY_VERIFIED_ACCOUNT_REQUIRED'; END IF;
 RETURN coalesce((SELECT jsonb_agg(public.supply_private_payload(a) ORDER BY created_at) FROM public.supply_applications a WHERE owner_id=auth.uid()),'[]');
END;$$;
CREATE FUNCTION public.supply_save_application(p_type text,p_profile jsonb,p_id uuid DEFAULT NULL,p_revision bigint DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.supply_applications%rowtype;
BEGIN
 IF NOT public.supply_verified(auth.uid()) THEN RAISE EXCEPTION 'SUPPLY_VERIFIED_ACCOUNT_REQUIRED'; END IF;
 IF NOT public.supply_valid_profile(p_type,p_profile) THEN RAISE EXCEPTION 'SUPPLY_INVALID_PROFILE'; END IF;
 IF p_id IS NULL THEN
  IF p_revision IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'SUPPLY_STALE_REVISION'; END IF;
  INSERT INTO public.supply_applications(owner_id,vendor_type) VALUES(auth.uid(),p_type) RETURNING * INTO a;
 ELSE
  SELECT * INTO a FROM public.supply_applications WHERE id=p_id AND owner_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUPPLY_APPLICATION_NOT_FOUND'; END IF;
  IF a.revision IS DISTINCT FROM p_revision OR a.vendor_type IS DISTINCT FROM p_type THEN RAISE EXCEPTION 'SUPPLY_STALE_REVISION'; END IF;
  UPDATE public.supply_applications SET revision=revision+1,status='pending_review',reviewed_revision=NULL,updated_at=now() WHERE id=a.id RETURNING * INTO a;
 END IF;
 IF p_type='teacher' THEN INSERT INTO public.supply_teacher_profiles VALUES(a.id,p_profile) ON CONFLICT(application_id) DO UPDATE SET data=excluded.data;
 ELSIF p_type='translator' THEN INSERT INTO public.supply_translation_profiles VALUES(a.id,p_profile) ON CONFLICT(application_id) DO UPDATE SET data=excluded.data;
 ELSE INSERT INTO public.supply_transport_profiles VALUES(a.id,p_profile) ON CONFLICT(application_id) DO UPDATE SET data=excluded.data; END IF;
 RETURN public.supply_private_payload(a);
END;$$;
CREATE FUNCTION public.supply_review_queue() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.supply_admin_access() THEN RAISE EXCEPTION 'SUPPLY_ADMIN_REQUIRED'; END IF;
 RETURN coalesce((SELECT jsonb_agg(public.supply_private_payload(a) ORDER BY updated_at) FROM (SELECT * FROM public.supply_applications WHERE status='pending_review' ORDER BY updated_at LIMIT 100) a),'[]');
END;$$;
CREATE FUNCTION public.supply_review_application(p_id uuid,p_revision bigint,p_decision text,p_reason text,p_credentials_reviewed boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.supply_applications%rowtype; p jsonb;
BEGIN
 PERFORM 1 FROM public.learning_review_staff WHERE user_id=auth.uid() FOR SHARE;
 IF NOT FOUND OR NOT public.supply_verified(auth.uid()) THEN RAISE EXCEPTION 'SUPPLY_ADMIN_REQUIRED'; END IF;
 SELECT * INTO a FROM public.supply_applications WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SUPPLY_APPLICATION_NOT_FOUND'; END IF;
 IF a.owner_id=auth.uid() THEN RAISE EXCEPTION 'SUPPLY_SELF_REVIEW_DENIED'; END IF;
 IF a.revision IS DISTINCT FROM p_revision OR a.status<>'pending_review' THEN RAISE EXCEPTION 'SUPPLY_STALE_REVISION'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected') OR p_reason IS NULL OR length(p_reason)>2000 OR (p_decision='rejected' AND length(btrim(p_reason))=0) OR p_credentials_reviewed IS NULL THEN RAISE EXCEPTION 'SUPPLY_INVALID_DECISION'; END IF;
 p:=public.supply_profile(a);
 IF p_decision='approved' THEN
  IF NOT public.supply_verified(a.owner_id) OR EXISTS(SELECT 1 FROM public.learning_review_exclusions WHERE user_id=a.owner_id) OR p->>'displayName' ILIKE '%Do Not Publish%' THEN RAISE EXCEPTION 'SUPPLY_PUBLICATION_BLOCKED'; END IF;
  IF a.vendor_type='translator' AND p->'specialties' ? 'Sworn' AND (NOT p_credentials_reviewed OR NOT EXISTS(SELECT 1 FROM public.supply_credentials WHERE application_id=a.id AND scan_status='clean')) THEN RAISE EXCEPTION 'SUPPLY_CREDENTIAL_REVIEW_REQUIRED'; END IF;
 END IF;
 INSERT INTO public.supply_reviews(application_id,revision,reviewer_id,decision,reason,credentials_reviewed) VALUES(a.id,a.revision,auth.uid(),p_decision,p_reason,p_credentials_reviewed);
 UPDATE public.supply_applications SET status=p_decision,reviewed_revision=revision,updated_at=now() WHERE id=a.id RETURNING * INTO a;
 RETURN public.supply_private_payload(a);
END;$$;
CREATE FUNCTION public.supply_upload_context(p_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.supply_verified(auth.uid()) OR NOT EXISTS(SELECT 1 FROM public.supply_applications WHERE id=p_id AND owner_id=auth.uid() AND vendor_type='translator') THEN RAISE EXCEPTION 'SUPPLY_APPLICATION_NOT_FOUND'; END IF;
 IF (SELECT count(*) FROM public.supply_credentials WHERE application_id=p_id)>=5 THEN RAISE EXCEPTION 'SUPPLY_CREDENTIAL_LIMIT'; END IF;
 RETURN true;
END;$$;
CREATE FUNCTION public.supply_record_credential(p_actor uuid,p_id uuid,p_file jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.supply_applications%rowtype; c uuid;
BEGIN
 SELECT * INTO a FROM public.supply_applications WHERE id=p_id AND owner_id=p_actor AND vendor_type='translator' FOR UPDATE;
 IF NOT FOUND OR NOT public.supply_verified(p_actor) THEN RAISE EXCEPTION 'SUPPLY_APPLICATION_NOT_FOUND'; END IF;
 IF jsonb_typeof(p_file) IS DISTINCT FROM 'object' OR p_file->>'backend' IS DISTINCT FROM 'spaces'
 OR coalesce(p_file->>'mime','') NOT IN ('application/pdf','image/jpeg','image/png') OR coalesce(p_file->>'sha256','') !~ '^[a-f0-9]{64}$'
 OR coalesce(p_file->>'size','') !~ '^[0-9]{1,8}$' OR (p_file->>'size')::bigint NOT BETWEEN 1 AND 5242880 THEN RAISE EXCEPTION 'SUPPLY_INVALID_CREDENTIAL'; END IF;
 IF (SELECT count(*) FROM public.supply_credentials WHERE application_id=a.id)>=5 THEN RAISE EXCEPTION 'SUPPLY_CREDENTIAL_LIMIT'; END IF;
 INSERT INTO public.supply_credentials(application_id,file,scan_status) VALUES(a.id,p_file,'clean') RETURNING id INTO c;
 UPDATE public.supply_applications SET status='pending_review',reviewed_revision=NULL,revision=revision+1,updated_at=now() WHERE id=a.id;
 RETURN jsonb_build_object('id',c,'status','clean');
END;$$;
CREATE FUNCTION public.supply_credential_file(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE f jsonb;
BEGIN
 IF NOT public.supply_verified(auth.uid()) THEN RAISE EXCEPTION 'SUPPLY_VERIFIED_ACCOUNT_REQUIRED'; END IF;
 SELECT c.file INTO f FROM public.supply_credentials c JOIN public.supply_applications a ON a.id=c.application_id WHERE c.id=p_id AND (a.owner_id=auth.uid() OR public.supply_admin_access());
 IF f IS NULL THEN RAISE EXCEPTION 'SUPPLY_CREDENTIAL_NOT_FOUND'; END IF;
 RETURN f;
END;$$;
CREATE FUNCTION public.supply_save_payout(p_actor uuid,p_id uuid,p_envelope jsonb,p_last_four text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.supply_applications WHERE id=p_id AND owner_id=p_actor FOR UPDATE;
 IF NOT FOUND OR NOT public.supply_verified(p_actor) THEN RAISE EXCEPTION 'SUPPLY_APPLICATION_NOT_FOUND'; END IF;
 IF jsonb_typeof(p_envelope) IS DISTINCT FROM 'object' OR p_envelope->>'v' IS DISTINCT FROM '1' OR (SELECT count(*) FROM jsonb_object_keys(p_envelope))<>4
 OR coalesce(p_envelope->>'nonce','') !~ '^[A-Za-z0-9+/]{16}$' OR coalesce(p_envelope->>'tag','') !~ '^[A-Za-z0-9+/]{22}==$'
 OR length(coalesce(p_envelope->>'ciphertext','')) NOT BETWEEN 16 AND 8192
 OR coalesce(p_envelope->>'ciphertext','') !~ '^[A-Za-z0-9+/=]+$' OR coalesce(p_last_four,'') !~ '^[A-Z0-9]{4}$' THEN RAISE EXCEPTION 'SUPPLY_INVALID_PAYOUT'; END IF;
 INSERT INTO public.supply_payouts(application_id,envelope,iban_last_four) VALUES(p_id,p_envelope,p_last_four)
 ON CONFLICT(application_id) DO UPDATE SET envelope=excluded.envelope,iban_last_four=excluded.iban_last_four,updated_at=now();
 RETURN jsonb_build_object('status','pending','configured',true,'lastFour',p_last_four);
END;$$;
CREATE FUNCTION public.supply_public_profiles(p_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'type',a.vendor_type,'profile',public.supply_profile(a)-'publicationConsent') ORDER BY a.id),'[]') FROM
 (SELECT * FROM public.supply_applications s WHERE status='approved' AND reviewed_revision=revision AND (p_id IS NULL OR id=p_id)
 AND public.supply_verified(owner_id) AND NOT EXISTS(SELECT 1 FROM public.learning_review_exclusions WHERE user_id=s.owner_id)
 AND public.supply_profile(s)->'publicationConsent'='true'::jsonb AND public.supply_profile(s)->>'displayName' NOT ILIKE '%Do Not Publish%'
 ORDER BY id LIMIT 100) a;
$$;
-- No table access and no internal-helper execution for client or service roles.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND left(p.proname,7)='supply_' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
 END LOOP;
END;$$;
GRANT EXECUTE ON FUNCTION public.supply_admin_access(),public.supply_my_applications(),public.supply_save_application(text,jsonb,uuid,bigint),public.supply_review_queue(),public.supply_review_application(uuid,bigint,text,text,boolean),public.supply_upload_context(uuid),public.supply_credential_file(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supply_public_profiles(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.supply_record_credential(uuid,uuid,jsonb),public.supply_save_payout(uuid,uuid,jsonb,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
