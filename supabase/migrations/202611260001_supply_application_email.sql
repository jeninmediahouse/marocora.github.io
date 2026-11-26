-- Applicant email lookup for decision notifications.
-- Admin-only, single value, no profile content. Exposes nothing to applicants
-- or the public API; used by the server to address the "approved"/"rejected"
-- notification after a decision is recorded.

CREATE OR REPLACE FUNCTION public.supply_application_email(p_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE address text;
BEGIN
  IF NOT public.supply_admin_access() THEN
    RAISE EXCEPTION 'SUPPLY_ADMIN_REQUIRED';
  END IF;
  SELECT u.email INTO address
    FROM public.supply_applications a
    JOIN auth.users u ON u.id = a.owner_id
   WHERE a.id = p_id
     AND u.email IS NOT NULL
     AND u.email_confirmed_at IS NOT NULL;
  IF address IS NULL THEN
    RAISE EXCEPTION 'SUPPLY_APPLICATION_NOT_FOUND';
  END IF;
  RETURN address;
END;$$;

REVOKE ALL ON FUNCTION public.supply_application_email(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.supply_application_email(uuid) TO authenticated;
