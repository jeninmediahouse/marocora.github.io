-- LOCAL REVIEW DRAFT: never bulk-apply this directory. No production authorization.
-- Exact scope: 16 canonical onboarding functions; 10 external entries / 11 pairs.
-- No data/schema/body/RLS change. Preconditions: owner-approved maintenance,
-- settled in-flight requests, correct project and separate action-specific approval.
-- Existing grants do not cancel calls that already passed permission checks.
-- RESTORE additionally requires verified paired forward release and explicit re-grant approval.
-- This file cannot attest external release/maintenance approval. Do not run it early.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $gate$
DECLARE
 spec record; role_name text; table_name text; routine oid; owner_oid oid;
 direct_access boolean; effective_access boolean; pair_count integer:=0;
 expected_pair_count integer:=0;
 restoring boolean := true;
BEGIN
 SELECT oid INTO owner_oid FROM pg_roles WHERE rolname=current_user;
 IF current_user IN ('anon','authenticated','service_role','authenticator') THEN
  RAISE EXCEPTION 'SUPPLY_CONTAINMENT_OWNER_REQUIRED';
 END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role']) r(role_name)
  WHERE NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r.role_name)) THEN
  RAISE EXCEPTION 'SUPPLY_CONTAINMENT_PREREQUISITES_MISSING';
 END IF;
 IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND left(proname,7)='supply_')<>16 THEN
  RAISE EXCEPTION 'SUPPLY_CONTAINMENT_ROUTINE_SET_DRIFT';
 END IF;
 -- Exact, fixed table list. A busy application fails rather than bypassing the gate.
 -- This settles conflicting table operations only, not every pre-authorized RPC.
 LOCK TABLE public.supply_applications,public.supply_teacher_profiles,
  public.supply_translation_profiles,public.supply_transport_profiles,
  public.supply_credentials,public.supply_reviews,public.supply_payouts IN ACCESS EXCLUSIVE MODE;
 FOREACH table_name IN ARRAY ARRAY['supply_applications','supply_teacher_profiles','supply_translation_profiles',
  'supply_transport_profiles','supply_credentials','supply_reviews','supply_payouts'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||table_name)
   AND relkind='r' AND relrowsecurity AND relowner=owner_oid
   AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(relacl,acldefault('r',relowner))) a WHERE a.grantee<>owner_oid))
   OR EXISTS(SELECT 1 FROM pg_attribute c CROSS JOIN LATERAL aclexplode(c.attacl) a
    WHERE c.attrelid=to_regclass('public.'||table_name) AND a.grantee<>owner_oid) THEN
   RAISE EXCEPTION 'SUPPLY_CONTAINMENT_TABLE_DRIFT';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_table_privilege(role_name,to_regclass('public.'||table_name),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_any_column_privilege(role_name,to_regclass('public.'||table_name),'SELECT,INSERT,UPDATE,REFERENCES') THEN
    RAISE EXCEPTION 'SUPPLY_CONTAINMENT_EFFECTIVE_PRIVILEGE_DRIFT';
   END IF;
  END LOOP;
 END LOOP;
 FOR spec IN SELECT * FROM (VALUES
  ('supply_text(jsonb,integer)','5746eae25787c59be2b268fb28cdbacb','sql',false,ARRAY[]::text[]),
  ('supply_strings(jsonb,integer)','60c6ae381e116f0f1a19c31ac2f2db07','plpgsql',false,ARRAY[]::text[]),
  ('supply_valid_profile(text,jsonb)','729e55da9a8340e165108eeecc6ba937','plpgsql',false,ARRAY[]::text[]),
  ('supply_verified(uuid)','0c22d29c9d94d60d2f1484d12cd9a9e7','sql',true,ARRAY[]::text[]),
  ('supply_admin_access()','279ed4d0e9dd3a9a56ddb9540c4921ab','sql',true,ARRAY['authenticated']::text[]),
  ('supply_profile(public.supply_applications)','d7b2c31ffa9cc6eb83f0f7ea2fbac3f1','sql',true,ARRAY[]::text[]),
  ('supply_private_payload(public.supply_applications)','b04d9a0a47dadb2518fb8b76431159c5','sql',true,ARRAY[]::text[]),
  ('supply_my_applications()','328dbd2f01bbdd79a356f98b9c2eb979','plpgsql',true,ARRAY['authenticated']::text[]),
  ('supply_save_application(text,jsonb,uuid,bigint)','2ac32a0ef13c92bc62ebce2584f4699c','plpgsql',true,ARRAY['authenticated']::text[]),
  ('supply_review_queue()','a655d44889be6b13a0722318b04f7fe7','plpgsql',true,ARRAY['authenticated']::text[]),
  ('supply_review_application(uuid,bigint,text,text,boolean)','ef9641e9d1eefc1198de71fd5bf01a28','plpgsql',true,ARRAY['authenticated']::text[]),
  ('supply_upload_context(uuid)','88794be5cecab94f608e83d661110883','plpgsql',true,ARRAY['authenticated']::text[]),
  ('supply_record_credential(uuid,uuid,jsonb)','fe3071a1401b5dd4f6075b6c71317504','plpgsql',true,ARRAY['service_role']::text[]),
  ('supply_credential_file(uuid)','e7343b21446cbafbdabd4651a10da896','plpgsql',true,ARRAY['authenticated']::text[]),
  ('supply_save_payout(uuid,uuid,jsonb,text)','2349befa3e3eb7886a4000c67cdd02bd','plpgsql',true,ARRAY['service_role']::text[]),
  ('supply_public_profiles(uuid)','e56e71714fa4072a81fe3927b94eddb7','sql',true,ARRAY['anon','authenticated']::text[])
 ) expected(signature,body_hash,language_name,definer,allowed_roles) LOOP
  routine:=to_regprocedure('public.'||spec.signature);
  IF routine IS NULL OR NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
   WHERE p.oid=routine AND p.proowner=owner_oid AND p.prokind='f'
    AND p.prosecdef=spec.definer AND p.proconfig=ARRAY['search_path=""']
    AND l.lanname=spec.language_name AND md5(p.prosrc)=spec.body_hash) THEN
   RAISE EXCEPTION 'SUPPLY_CONTAINMENT_DEFINITION_DRIFT';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   WHERE p.oid=routine AND a.grantee<>owner_oid AND
    (a.grantee=0 OR a.is_grantable OR a.privilege_type<>'EXECUTE'
     OR NOT EXISTS(SELECT 1 FROM pg_roles r WHERE r.oid=a.grantee AND r.rolname=ANY(spec.allowed_roles)))) THEN
   RAISE EXCEPTION 'SUPPLY_CONTAINMENT_ACL_DRIFT';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   SELECT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
    JOIN pg_roles r ON r.oid=a.grantee WHERE p.oid=routine AND r.rolname=role_name
     AND a.privilege_type='EXECUTE') INTO direct_access;
   effective_access:=has_function_privilege(role_name,routine,'EXECUTE');
   IF direct_access IS DISTINCT FROM effective_access THEN
    RAISE EXCEPTION 'SUPPLY_CONTAINMENT_EFFECTIVE_PRIVILEGE_DRIFT';
   END IF;
   IF role_name=ANY(spec.allowed_roles) THEN
    expected_pair_count:=expected_pair_count+1;
    IF direct_access THEN pair_count:=pair_count+1; END IF;
   ELSIF direct_access THEN RAISE EXCEPTION 'SUPPLY_CONTAINMENT_ACL_DRIFT';
   END IF;
  END LOOP;
 END LOOP;
 IF expected_pair_count<>11 OR pair_count NOT IN (0,11) THEN
  RAISE EXCEPTION 'SUPPLY_CONTAINMENT_PARTIAL_STATE';
 END IF;
 -- Permit only the exact declared forward baseline or exact full suspension.
 -- Repeating the same action is safe; a partial/drifted state never self-repairs.
 FOR spec IN SELECT * FROM (VALUES
  ('supply_text(jsonb,integer)','5746eae25787c59be2b268fb28cdbacb','sql',false,ARRAY[]::text[]),
  ('supply_strings(jsonb,integer)','60c6ae381e116f0f1a19c31ac2f2db07','plpgsql',false,ARRAY[]::text[]),
  ('supply_valid_profile(text,jsonb)','729e55da9a8340e165108eeecc6ba937','plpgsql',false,ARRAY[]::text[]),
  ('supply_verified(uuid)','0c22d29c9d94d60d2f1484d12cd9a9e7','sql',true,ARRAY[]::text[]),
  ('supply_admin_access()','279ed4d0e9dd3a9a56ddb9540c4921ab','sql',true,ARRAY['authenticated']::text[]),
  ('supply_profile(public.supply_applications)','d7b2c31ffa9cc6eb83f0f7ea2fbac3f1','sql',true,ARRAY[]::text[]),
  ('supply_private_payload(public.supply_applications)','b04d9a0a47dadb2518fb8b76431159c5','sql',true,ARRAY[]::text[]),
  ('supply_my_applications()','328dbd2f01bbdd79a356f98b9c2eb979','plpgsql',true,ARRAY['authenticated']::text[]),
  ('supply_save_application(text,jsonb,uuid,bigint)','2ac32a0ef13c92bc62ebce2584f4699c','plpgsql',true,ARRAY['authenticated']::text[]),
  ('supply_review_queue()','a655d44889be6b13a0722318b04f7fe7','plpgsql',true,ARRAY['authenticated']::text[]),
  ('supply_review_application(uuid,bigint,text,text,boolean)','ef9641e9d1eefc1198de71fd5bf01a28','plpgsql',true,ARRAY['authenticated']::text[]),
  ('supply_upload_context(uuid)','88794be5cecab94f608e83d661110883','plpgsql',true,ARRAY['authenticated']::text[]),
  ('supply_record_credential(uuid,uuid,jsonb)','fe3071a1401b5dd4f6075b6c71317504','plpgsql',true,ARRAY['service_role']::text[]),
  ('supply_credential_file(uuid)','e7343b21446cbafbdabd4651a10da896','plpgsql',true,ARRAY['authenticated']::text[]),
  ('supply_save_payout(uuid,uuid,jsonb,text)','2349befa3e3eb7886a4000c67cdd02bd','plpgsql',true,ARRAY['service_role']::text[]),
  ('supply_public_profiles(uuid)','e56e71714fa4072a81fe3927b94eddb7','sql',true,ARRAY['anon','authenticated']::text[])
 ) expected(signature,body_hash,language_name,definer,allowed_roles) LOOP
  FOREACH role_name IN ARRAY spec.allowed_roles LOOP
   IF restoring THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO %I',spec.signature,role_name);
   ELSE
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM %I',spec.signature,role_name);
   END IF;
  END LOOP;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_function_privilege(role_name,to_regprocedure('public.'||spec.signature),'EXECUTE')
    IS DISTINCT FROM (restoring AND role_name=ANY(spec.allowed_roles)) THEN
    RAISE EXCEPTION 'SUPPLY_CONTAINMENT_POSTCHECK_FAILED';
   END IF;
  END LOOP;
 END LOOP;
END;$gate$;
NOTIFY pgrst,'reload schema';
SELECT jsonb_build_object('status','RESTORED','external_functions',10,'role_function_pairs',11,
 'data_changed',false,'external_release_approval','human-required') AS supply_containment_result;
COMMIT;
