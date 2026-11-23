-- LOCAL DRAFT: optional teacher introduction link only. Owner applies separately.
-- Existing identity, owner, privileges, policies and data are retained.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
CREATE OR REPLACE FUNCTION public.supply_valid_profile(t text,p jsonb) RETURNS boolean LANGUAGE plpgsql STABLE SET search_path='' AS $$
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
  OR (coalesce(p->>'introVideo','')<>'' AND coalesce(p->>'introVideo','')
     !~ '^https://[A-Za-z0-9.-]+(:443)?(/[^[:space:]<>]*)?$') THEN RETURN false; END IF;
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
COMMIT;
