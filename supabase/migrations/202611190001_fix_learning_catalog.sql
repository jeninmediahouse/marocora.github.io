-- PREPARED FOR HUMAN REVIEW ONLY. NOT AUTO-APPLIED BY THE APPLICATION.
-- Run diagnose_learning_catalog.sql first, in the intended project.
-- Target: restore the exact zero-argument catalogue RPC from learning_launch.sql.
-- No table creation/seeding, publication changes, table grants, RLS changes,
-- account enrolment, payment/booking changes or migration-004 reapplication.
-- Missing/drifted prerequisites intentionally abort the whole transaction.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

DO $guard$
DECLARE
 relation_name text;
 relation_id regclass;
 routine_id regprocedure;
 expected record;
 inspected record;
 client_role text;
BEGIN
 IF to_regrole('anon') IS NULL OR to_regrole('authenticated') IS NULL THEN
  RAISE EXCEPTION 'LEARNING_CATALOG_ROLES_MISSING';
 END IF;
 IF current_user IN ('anon', 'authenticated', 'authenticator', 'service_role') THEN
  RAISE EXCEPTION 'LEARNING_CATALOG_REQUIRES_REVIEWED_MIGRATION_OWNER';
 END IF;

 FOREACH relation_name IN ARRAY ARRAY[
  'learning_publications', 'learning_instructor_drafts',
  'learning_application_reviews', 'learning_review_exclusions',
  'learning_launch_subjects', 'learning_launch_specialties', 'learning_country_codes'
 ] LOOP
  relation_id := to_regclass('public.' || relation_name);
  IF relation_id IS NULL OR NOT EXISTS (
   SELECT 1 FROM pg_class WHERE oid = relation_id AND relkind = 'r' AND relrowsecurity
  ) THEN
   RAISE EXCEPTION 'LEARNING_CATALOG_PREREQUISITE_MISSING_OR_RLS_DISABLED: %', relation_name;
  END IF;
  -- Drafts legitimately have authenticated owner-only RLS access. The other
  -- relations must stay RPC-only, including column-level privileges.
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
   IF NOT (relation_name = 'learning_instructor_drafts' AND client_role = 'authenticated')
    AND (has_table_privilege(client_role, relation_id, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
         OR has_any_column_privilege(client_role, relation_id, 'SELECT,INSERT,UPDATE,REFERENCES')) THEN
    RAISE EXCEPTION 'LEARNING_CATALOG_UNEXPECTED_DIRECT_TABLE_ACCESS: % / %', relation_name, client_role;
   END IF;
  END LOOP;
 END LOOP;

 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolbypassrls))
  AND EXISTS (SELECT 1 FROM pg_class WHERE oid = ANY(ARRAY[
   to_regclass('public.learning_publications'), to_regclass('public.learning_instructor_drafts'),
   to_regclass('public.learning_application_reviews'), to_regclass('public.learning_review_exclusions')
  ]) AND relowner <> (SELECT oid FROM pg_roles WHERE rolname = current_user)) THEN
  RAISE EXCEPTION 'LEARNING_CATALOG_MIGRATION_OWNER_CANNOT_READ_PRIVATE_RELATIONS';
 END IF;

 -- Hashes are of pg_proc.prosrc from the reviewed canonical learning_launch.sql,
 -- not of any secret. Drift means review it; never overwrite a different guard.
 FOR expected IN SELECT * FROM (VALUES
  ('public.learning_publication_visible(public.learning_publications)', 'f57796bb5b3093f55a1139e11273aa49'),
  ('public.learning_build_publication(uuid,bigint,integer[],uuid)', '7cd0f67f558c2bfc82591a77ded9f189')
 ) AS reviewed(signature, body_md5) LOOP
  routine_id := to_regprocedure(expected.signature);
  SELECT routine.prosecdef, routine.prosrc, routine.proowner, owner.rolsuper,
         owner.rolbypassrls, owner.rolname, routine.proconfig
  INTO inspected
  FROM pg_proc AS routine JOIN pg_roles AS owner ON owner.oid = routine.proowner
  WHERE routine.oid = routine_id;
  IF NOT FOUND OR NOT inspected.prosecdef OR md5(inspected.prosrc) <> expected.body_md5
   OR inspected.rolname IN ('anon', 'authenticated', 'authenticator', 'service_role')
   OR NOT EXISTS (SELECT 1 FROM unnest(inspected.proconfig) AS config(value)
                  WHERE value IN ('search_path=""', 'search_path=')) THEN
   RAISE EXCEPTION 'LEARNING_CATALOG_HELPER_MISSING_OR_CHANGED: %', expected.signature;
  END IF;
  IF NOT (inspected.rolsuper OR inspected.rolbypassrls) AND EXISTS (
   SELECT 1 FROM pg_class WHERE oid = ANY(ARRAY[
    to_regclass('public.learning_publications'), to_regclass('public.learning_instructor_drafts'),
    to_regclass('public.learning_application_reviews'), to_regclass('public.learning_review_exclusions')
   ]) AND relowner <> inspected.proowner
  ) THEN
   RAISE EXCEPTION 'LEARNING_CATALOG_HELPER_OWNER_REQUIRES_REVIEW';
  END IF;
  IF has_function_privilege('anon', routine_id, 'EXECUTE')
   OR has_function_privilege('authenticated', routine_id, 'EXECUTE') THEN
   RAISE EXCEPTION 'LEARNING_CATALOG_INTERNAL_HELPER_IS_EXPOSED';
  END IF;
 END LOOP;

 IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = to_regnamespace('public')
            AND proname = 'learning_public_catalog' AND pronargs <> 0) THEN
  RAISE EXCEPTION 'LEARNING_CATALOG_OVERLOAD_REQUIRES_REVIEW';
 END IF;
 routine_id := to_regprocedure('public.learning_public_catalog()');
 IF routine_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM pg_proc WHERE oid = routine_id AND (
   prorettype <> 'jsonb'::regtype OR NOT prosecdef OR provolatile <> 's'
   OR proowner <> (SELECT oid FROM pg_roles WHERE rolname = current_user)
   OR md5(prosrc) <> 'e0c10d9ae14caca972a07bb49efe06b5'
   OR NOT EXISTS (SELECT 1 FROM unnest(proconfig) AS config(value)
                  WHERE value IN ('search_path=""', 'search_path='))
  )
 ) THEN
  RAISE EXCEPTION 'LEARNING_CATALOG_EXISTING_DEFINITION_REQUIRES_REVIEW';
 END IF;
END;
$guard$;

-- Only the sanitized, staff-published projection is returned. The unchanged
-- helper rechecks consent, latest review, revision, subjects and exclusions.
create or replace function public.learning_public_catalog()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('instructors',coalesce(jsonb_agg(p.data->'instructor'),'[]'),
 'offerings',coalesce((select jsonb_agg(o) from public.learning_publications q cross join lateral jsonb_array_elements(q.data->'offerings') o where public.learning_publication_visible(q)),'[]'),
 'specialties',coalesce((select jsonb_agg(o) from public.learning_publications q cross join lateral jsonb_array_elements(q.data->'specialties') o where public.learning_publication_visible(q)),'[]'))
 from public.learning_publications p where public.learning_publication_visible(p);
$$;

REVOKE ALL ON FUNCTION public.learning_public_catalog() FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_public_catalog() TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
