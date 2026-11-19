# Marocora — Production Execution Runbook, 19 November 2026

This checklist is for the human owner using authenticated web consoles. Preparing
and publishing this runbook does not execute its SQL or server commands. Keep
credentials out of chat, screenshots, Git and terminal command arguments.

## Step 1: GitHub Verification

- [ ] Open [GitHub Actions](https://github.com/jeninmediahouse/marocora.github.io/actions).
- [ ] Select the latest `main` run for the commit titled
  `ci: build production artifacts before testing, add learning catalogue fix, add key rotation script`.
- [ ] Confirm `pnpm run build:production` succeeds before `pnpm test`, and the
  test summary reports **273 passed, 0 failed, 0 skipped**. Confirm the workflow
  finishes green. If it fails, stop and inspect the failing step.

The workflow build supplies `.pages-dist` and the learning-room browser adapter
inside the test job. The HTTP assertions, network guards and production access
restrictions have not been weakened. GitHub Actions runs on GitHub; no Droplet
restart is necessary to activate this workflow correction.

## Step 2: Supabase Diagnostics

- [ ] Open the Supabase SQL Editor for the exact project used by the production
  browser client and server. Compare the configured project privately.
- [ ] Paste and run this entire read-only diagnostic block, including its final
  `ROLLBACK`. Review all result sets. It selects metadata, not applicant records.

```sql
-- HUMAN-RUN DIAGNOSTIC ONLY. Does not modify data, grants, functions or cache.
-- Run in the SAME Supabase project used by the public browser client AND server.
-- PostgreSQL cannot inspect PostgREST's in-memory cache from a read-only query.
-- These results inspect the database metadata that PostgREST should expose.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT current_database() AS database_name, current_user AS inspecting_role,
       current_setting('transaction_read_only') AS read_only;

SELECT role_name, to_regrole(role_name) IS NOT NULL AS exists
FROM (VALUES ('anon'), ('authenticated'), ('authenticator')) AS roles(role_name);

SELECT routine.oid::regprocedure::text AS signature,
       routine.pronargs AS input_argument_count,
       routine.proargnames AS argument_names,
       pg_get_function_result(routine.oid) AS result_type,
       routine.prosecdef AS security_definer,
       routine.provolatile AS volatility,
       owner.rolname AS owner_role,
       (SELECT value FROM unnest(routine.proconfig) AS config(value)
        WHERE value LIKE 'search_path=%' LIMIT 1) AS search_path_setting,
       md5(routine.prosrc) AS body_md5,
       has_function_privilege(to_regrole('anon'), routine.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege(to_regrole('authenticated'), routine.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc AS routine
JOIN pg_namespace AS schema ON schema.oid = routine.pronamespace
JOIN pg_roles AS owner ON owner.oid = routine.proowner
WHERE schema.nspname = 'public' AND routine.proname IN (
 'learning_public_catalog', 'learning_publication_visible',
 'learning_build_publication', 'learning_public_slots',
 'publish_learning_instructor', 'learning_require_verified_email'
)
ORDER BY routine.proname, routine.oid::regprocedure::text;

SELECT 'public.learning_public_catalog()' AS expected_signature,
       to_regprocedure('public.learning_public_catalog()') IS NOT NULL AS exists,
       has_schema_privilege(to_regrole('anon'), 'public', 'USAGE') AS anon_schema_usage,
       has_schema_privilege(to_regrole('authenticated'), 'public', 'USAGE') AS authenticated_schema_usage;

WITH expected(name) AS (VALUES
 ('learning_publications'), ('learning_instructor_drafts'),
 ('learning_application_reviews'), ('learning_review_exclusions'),
 ('learning_launch_subjects'), ('learning_launch_specialties'), ('learning_country_codes')
)
SELECT expected.name, relation.oid IS NOT NULL AS exists,
       relation.relkind, relation.relrowsecurity AS rls_enabled,
       relation.relforcerowsecurity AS rls_forced,
       has_table_privilege(to_regrole('anon'), relation.oid, 'SELECT') AS anon_table_select,
       has_any_column_privilege(to_regrole('anon'), relation.oid, 'SELECT') AS anon_any_column_select,
       has_table_privilege(to_regrole('authenticated'), relation.oid, 'SELECT') AS authenticated_table_select
FROM expected
LEFT JOIN pg_class AS relation ON relation.oid = to_regclass('public.' || expected.name)
ORDER BY expected.name;

-- Metadata only: no applicant data, emails, publication payloads or auth UUIDs.
SELECT relation.relname AS table_name, attribute.attname AS column_name,
       format_type(attribute.atttypid, attribute.atttypmod) AS column_type
FROM pg_attribute AS attribute
JOIN pg_class AS relation ON relation.oid = attribute.attrelid
WHERE relation.relnamespace = to_regnamespace('public')
  AND relation.relname IN ('learning_publications', 'learning_instructor_drafts',
                          'learning_application_reviews', 'learning_review_exclusions')
  AND attribute.attnum > 0 AND NOT attribute.attisdropped
ORDER BY relation.relname, attribute.attnum;

SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual IS NOT NULL AS has_using_expression,
       with_check IS NOT NULL AS has_check_expression
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN (
 'learning_publications', 'learning_instructor_drafts',
 'learning_application_reviews', 'learning_review_exclusions'
)
ORDER BY tablename, policyname;

-- Show ONLY schema-exposure configuration; never dump arbitrary role settings.
SELECT COALESCE(role.rolname, '(all roles)') AS role_name,
       COALESCE(database.datname, '(all databases)') AS database_name,
       config.value AS schema_setting
FROM pg_db_role_setting AS setting
LEFT JOIN pg_roles AS role ON role.oid = setting.setrole
LEFT JOIN pg_database AS database ON database.oid = setting.setdatabase
CROSS JOIN LATERAL unnest(setting.setconfig) AS config(value)
WHERE config.value LIKE 'pgrst.db_schemas=%'
   OR config.value LIKE 'pgrst.db_extra_search_path=%';

SELECT current_setting('pgrst.db_schemas', true) AS session_exposed_schemas,
       'A NULL value is inconclusive: PostgREST configuration may be supplied outside PostgreSQL. Check Supabase API exposed schemas; public must be exposed.' AS interpretation;

SELECT 'If prerequisites are absent or helper definitions differ from reviewed source, STOP. Do not reapply 004 or all learning SQL. A cache reload is a separate write and is deliberately not issued by this diagnostic.' AS next_step;
ROLLBACK;
```

- [ ] Confirm `public` is an exposed API schema in the Supabase API settings.
  A NULL session schema setting is inconclusive. PostgreSQL cannot directly
  inspect PostgREST's in-memory schema cache with this read-only diagnostic.
- [ ] Confirm `anon` and `authenticated` roles and all seven required tables
  exist, with RLS enabled. Anonymous users must not have direct access to the
  private tables; authenticated owners' existing draft RLS access is expected.
- [ ] Review function signatures, owners, search paths and grants. The trusted
  internal helpers must exist, remain unavailable to clients and match these
  reviewed source-body hashes from `learning_launch.sql`:

  | Function | Expected body MD5 |
  | --- | --- |
  | `learning_publication_visible(public.learning_publications)` | `f57796bb5b3093f55a1139e11273aa49` |
  | `learning_build_publication(uuid,bigint,integer[],uuid)` | `7cd0f67f558c2bfc82591a77ded9f189` |

These hashes describe code, not credentials. The catalogue may be absent; if it
exists, it must be the reviewed zero-argument JSONB function rather than an
unexpected implementation or overload. The correction independently checks these
conditions and refuses drift. Review the separate `learning_public_slots` findings
as well; the targeted catalogue patch does not provision unrelated RPCs.

If prerequisites are missing or definitions differ, **stop for a separate reviewed
plan**. Do not reapply migration 004, execute all SQL files, remove guards, publish
unapproved instructors or grant direct private-table access.

## Step 3: Supabase Fix

- [ ] Proceed only if Step 2 supports this exact targeted correction. Run as the
  trusted migration owner in the same project's SQL Editor.
- [ ] Paste and run the **entire** transaction below. Do not select individual
  statements inside it. If a guard fails, clear/roll back that failed transaction
  and stop for review. Do not bypass the failure.

This creates/replaces only `public.learning_public_catalog()`, restores its
schema-usage/execution grants and requests a PostgREST schema-cache reload on
commit. It does not change table data, RLS policies, staff approvals, publication
consent, payment gates or migration 004. Existing canonical helper functions
continue to enforce public visibility and private-data projection.

```sql
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
```

## Step 4: Supabase Verification

- [ ] Run this exact read-only anonymous-role check after the correction commits:

```sql
BEGIN READ ONLY;
SET LOCAL ROLE anon;
SELECT public.learning_public_catalog();
ROLLBACK;
```

- [ ] Confirm the result contains only the sanitized public catalogue arrays.
  Empty arrays are valid when no instructors satisfy publication requirements.
- [ ] Reload `/learn/` on the production website and confirm its public RPC
  request succeeds. SQL success alone does not verify PostgREST's schema cache.
  If the API still returns `PGRST202`, recheck the project, exposed `public`
  schema, zero-argument request body `{}` and schema-cache reload.
- [ ] Keep workspaces and lessons protected. Do not enable bookings or payments
  while merchant onboarding and the existing launch restrictions remain pending.

## Step 5: Droplet Update

- [ ] Open the DigitalOcean Droplet **Web Console as root**. Run:

```bash
runuser -l marocora -s /bin/bash -c 'cd /srv/marocora/app && git pull --ff-only origin main'
```

- [ ] Confirm the pull succeeds. Stop on dirty-checkout, permission or divergence
  errors; do not reset local work or force a merge.

This retrieves the scripts and documentation into the retained checkout. The
active PM2 application uses a separate release under `/srv/marocora/releases/`.
Do not switch its working directory back to the retained checkout. These changes
do not require a frontend rebuild or application restart merely to retrieve them.
The rotation helper identifies and preserves the active PM2 release.

## Step 6: Cloudmersive Readiness

- [ ] Wait for Cloudmersive support to supply a **distinct replacement key**.
  Keep the old key available until the replacement has passed verification.
- [ ] Ensure Node 24+, installed dependencies and the `marocora` user's existing
  online PM2 process are available. The shared `.env` must be a regular file
  owned by `marocora`. Do not edit it or switch releases concurrently.
- [ ] In the DigitalOcean Web Console **as root**, run:

```bash
bash /srv/marocora/app/scripts/rotate-cloudmersive-key.sh
```

- [ ] Enter the new key only at the hidden prompt. The companion
  `rotate-cloudmersive-key.mjs` must be present beside the shell script.
- [ ] Require `SUCCESS`. The command first creates an in-memory synthetic PDF
  and scans it through the active release's production Cloudmersive adapter,
  with the production scanning restrictions intact. It consumes a scan request.
- [ ] After success, revoke the exposed old key in Cloudmersive, then verify a
  normal protected upload through the application. Revocation is a separate
  provider action; the rotation script does not revoke keys or change plans.

The script runs application changes and PM2 as `marocora`, retains a 0600 backup
inside `/home/marocora/.marocora-env-backups/` (directory 0700), and atomically
updates only the Cloudmersive setting in the shared environment. It explicitly
injects the new value into the PM2 restart environment; `--update-env` alone does
not read `.env`. It checks PM2's stored value privately, checks local health for
both allowed domains and saves PM2 after success. A post-write failure attempts
to restore both the previous file and previous runtime key. If recovery reports
that attention is needed, inspect privately using the retained backup; do not
paste environment contents or raw provider/PM2 diagnostics into chat.

## Preparation evidence and handoff

Local production builds and the full guarded suite passed: **273 passed,
0 failed, 0 skipped**. Disposable PostgreSQL and synthetic rotation tests cover
public/private access, missing/drifted prerequisites, scan-before-write, backup
permissions, rollback and concurrent edits. The credential-rotation CLI was not
run against the production environment. No direct Supabase connection or SSH
session is part of this procedure.

Current artifacts: this runbook, the two SQL sources embedded above, the two
rotation files, regression tests and `.github/workflows/pages.yml`. The human
owns the remaining console execution and the pending Cloudmersive support reply.
Merchant services onboarding remains a separate requirement before paid launch.

Next-task starter prompt: "Marocora — Verify Production Readiness Console Results.
Use EXECUTION-RUNBOOK-20261119.md. Review the GitHub run, Supabase diagnostic and
verification results, Droplet pull outcome, and Cloudmersive support status.
Do not repeat completed investigation or print secrets. Do not execute live SQL
or server changes without explicit authorization. Preserve public pages, protected
workspaces and lessons, scanning, network guards and payment restrictions."
