-- LOCAL READ-ONLY DRAFT; owner runs entire file only with separate authorization.
-- Catalog evidence only, no function invocation, auth data or writes. Any error is STOP.
-- Static reviewed migration changes only this function's teacher video predicate.
BEGIN READ ONLY;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
WITH target AS (
 SELECT p.*, l.lanname FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_language l ON l.oid=p.prolang
 WHERE p.oid=pg_catalog.to_regprocedure('public.supply_valid_profile(text,jsonb)')
), checks(ord,label,ok) AS (
 SELECT 1,'READ_ONLY',current_setting('transaction_read_only')='on'
 UNION ALL SELECT 2,'TRUSTED_OWNER',current_user NOT IN ('anon','authenticated','service_role','authenticator')
 UNION ALL SELECT 3,'EXACT_SIGNATURE_AND_OWNER',EXISTS(SELECT 1 FROM target WHERE prokind='f' AND NOT proretset
  AND prorettype='boolean'::regtype AND pronargs=2 AND proowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))
 UNION ALL SELECT 4,'FUNCTION_ATTRIBUTES',EXISTS(SELECT 1 FROM target WHERE lanname='plpgsql' AND provolatile='s'
  AND NOT prosecdef AND NOT proisstrict AND proparallel='u' AND proconfig=ARRAY['search_path=""'])
 UNION ALL SELECT 5,'APPLIED_OR_ALREADY_UPDATED_BODY',EXISTS(SELECT 1 FROM target WHERE md5(prosrc) IN ('729e55da9a8340e165108eeecc6ba937','189e21de2a3d96555a5fec719aab63cf'))
 UNION ALL SELECT 6,'EXISTING_OWNER_ONLY_ACL',EXISTS(SELECT 1 FROM target WHERE NOT EXISTS(
  SELECT 1 FROM aclexplode(coalesce(proacl,acldefault('f',proowner))) a WHERE a.grantee<>proowner))
 UNION ALL SELECT 7,'OWNER_DDL_PRIVILEGES',has_schema_privilege(current_user,'public','USAGE') AND has_schema_privilege(current_user,'public','CREATE')
  AND has_language_privilege(current_user,'plpgsql','USAGE')
 UNION ALL SELECT 8,'DEPENDENCIES_PRESENT',to_regprocedure('public.supply_text(jsonb,integer)') IS NOT NULL
  AND to_regprocedure('public.supply_strings(jsonb,integer)') IS NOT NULL
  AND to_regclass('public.supply_teacher_profiles') IS NOT NULL
), failed AS (SELECT label FROM checks WHERE ok IS DISTINCT FROM true ORDER BY ord)
SELECT jsonb_build_object('verdict',CASE WHEN EXISTS(SELECT 1 FROM failed) THEN 'STOP' ELSE 'PROCEED' END,
 'failed_check',(SELECT label FROM failed LIMIT 1),'database',current_database(),'actor',current_user,
 'read_only',current_setting('transaction_read_only'),
 'current_body_md5',(SELECT md5(prosrc) FROM target),'original_body_md5','729e55da9a8340e165108eeecc6ba937',
 'replacement_body_md5','189e21de2a3d96555a5fec719aab63cf',
 'state',CASE WHEN (SELECT md5(prosrc) FROM target)='189e21de2a3d96555a5fec719aab63cf' THEN 'ALREADY_UPDATED' ELSE 'ORIGINAL_OR_UNKNOWN' END,
 'planned_replacement','public.supply_valid_profile(text,jsonb)',
 'scope','One CREATE OR REPLACE only; preserves OID, ACL and dependencies; no data/table/policy changes') AS result;
ROLLBACK;
