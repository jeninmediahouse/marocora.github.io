-- Owner-run repair for the existing STAGING schema; not a full migration rerun.
-- Use the staging SQL Editor as postgres/database owner.
-- Does not grant CREATE, table access, extra function EXECUTE or change RLS/gates.
BEGIN;
GRANT USAGE ON SCHEMA public TO authenticated,service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
