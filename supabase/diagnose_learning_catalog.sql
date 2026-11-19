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
