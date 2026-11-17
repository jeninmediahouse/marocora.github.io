-- Owner-editable STAGING seed. Fill the existing verified Auth staff UUID below
-- in the SQL Editor. Never place passwords, API keys or real customer data here.
BEGIN;
DO $seed$
DECLARE
 staff_id uuid := NULL; -- REQUIRED: replace NULL with 'your-existing-staff-auth-uuid'::uuid
 -- OPTIONAL: existing confirmed synthetic provider Auth accounts for walkthroughs.
 customers jsonb := '[]'; -- ["existing-confirmed-synthetic-customer-auth-uuid"]
 providers jsonb := '[]'; -- [{"id":"existing-auth-uuid","name":"Synthetic translator"}]
 item jsonb;u auth.users;app_id uuid;approval_id uuid;readiness_id uuid;policy public.quote_policies;
 capabilities jsonb := '{"services":["Document Translation","Business Translation","Website & Digital Translation","Other Language Service","Sworn Translation (Morocco)"],"directions":[{"source":"English","target":"French"},{"source":"Arabic","target":"English"},{"source":"English","target":"Arabic"}],"currencies":["MAD","EUR","USD"],"availability":"Owner staging exercise only","specialAssessment":"Credential review still required for sworn assignments"}';
BEGIN
 IF staff_id IS NULL THEN RAISE EXCEPTION 'SET_STAGING_STAFF_AUTH_UUID_BEFORE_RUNNING_SEED';END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=staff_id AND email IS NOT NULL AND email_confirmed_at IS NOT NULL AND is_anonymous=false) THEN RAISE EXCEPTION 'CONFIRMED_STAGING_STAFF_ACCOUNT_REQUIRED';END IF;
 INSERT INTO public.translation_staging_accounts(user_id) VALUES(staff_id) ON CONFLICT DO NOTHING;
 FOR item IN SELECT value FROM jsonb_array_elements(customers) LOOP
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=(item#>>'{}')::uuid AND email IS NOT NULL AND email_confirmed_at IS NOT NULL AND is_anonymous=false) THEN RAISE EXCEPTION 'CONFIRMED_STAGING_CUSTOMER_REQUIRED';END IF;
  INSERT INTO public.translation_staging_accounts(user_id) VALUES((item#>>'{}')::uuid) ON CONFLICT DO NOTHING;
 END LOOP;
 INSERT INTO public.translation_staff(user_id) VALUES(staff_id) ON CONFLICT DO NOTHING;
 INSERT INTO public.translation_settings(owner_id) VALUES(staff_id) ON CONFLICT(singleton) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM public.translation_settings WHERE owner_id=staff_id) THEN RAISE EXCEPTION 'STAGING_OWNER_MISMATCH';END IF;
 INSERT INTO public.quote_settings DEFAULT VALUES ON CONFLICT(singleton) DO NOTHING;
 UPDATE public.quote_settings SET capture_enabled=false,commands_enabled=false,notifications_enabled=false;
 INSERT INTO public.quote_policies(kind,version,digest,wording,approved_at,approved_by) VALUES
 ('participation','staging-participation-v1',public.quote_digest('"STAGING ONLY: synthetic provider participation; no work or payment."'),'{"en":"STAGING ONLY: synthetic provider participation; no work or payment.","fr":"STAGING ONLY","ar":"STAGING ONLY","es":"STAGING ONLY"}',clock_timestamp(),staff_id),
 ('acceptance','staging-acceptance-v1',public.quote_digest('"STAGING ONLY: acceptance records the exact quote and fulfillment request. No work, payment or real delivery is authorized."'),'{"en":"STAGING ONLY: acceptance records the exact quote and fulfillment request. No work, payment or real delivery is authorized.","fr":"STAGING ONLY","ar":"STAGING ONLY","es":"STAGING ONLY"}',clock_timestamp(),staff_id)
 ON CONFLICT(version) DO NOTHING;
 -- No Auth users are created. Optional provider provisioning is explicit owner
 -- setup, not a client override or an automatic approval of sworn credentials.
 PERFORM set_config('request.jwt.claim.sub',staff_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',staff_id,'role','authenticated')::text,true);
 SELECT * INTO policy FROM public.quote_policies WHERE version='staging-participation-v1';
 FOR item IN SELECT value FROM jsonb_array_elements(providers) LOOP
  SELECT * INTO u FROM auth.users WHERE id=(item->>'id')::uuid;
  IF u.id IS NULL OR u.email IS NULL OR u.email_confirmed_at IS NULL OR u.is_anonymous OR u.id=staff_id THEN RAISE EXCEPTION 'CONFIRMED_DISTINCT_STAGING_PROVIDER_REQUIRED';END IF;
  INSERT INTO public.translation_staging_accounts(user_id) VALUES(u.id) ON CONFLICT DO NOTHING;
  IF EXISTS(SELECT 1 FROM public.translation_provider_applications WHERE source_key='staging:'||u.id) THEN CONTINUE;END IF;
  app_id:=gen_random_uuid();approval_id:=gen_random_uuid();readiness_id:=gen_random_uuid();
  INSERT INTO public.translation_provider_applications(id,source,source_key,user_id,email,name,category,fields,revision,status,is_test) VALUES(app_id,'translator','staging:'||u.id,u.id,u.email,public.quote_text(item->'name',200),'translation','{}',1,'approved',false);
  INSERT INTO public.translation_provider_events(id,application_id,actor_id,kind,delivery) VALUES(approval_id,app_id,staff_id,'approved','external');
  PERFORM public.quote_command_core(gen_random_uuid(),'propose_readiness',readiness_id,0,jsonb_build_object('applicationId',app_id,'capabilities',capabilities,'policyVersion',policy.version,'policyDigest',policy.digest));
  PERFORM set_config('request.jwt.claim.sub',u.id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u.id,'role','authenticated')::text,true);
  PERFORM public.quote_command_core(gen_random_uuid(),'acknowledge_participation',readiness_id,1,jsonb_build_object('capabilityDigest',public.quote_digest(public.quote_capabilities(capabilities)),'policyVersion',policy.version,'policyDigest',policy.digest,'language','en'));
  PERFORM set_config('request.jwt.claim.sub',staff_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',staff_id,'role','authenticated')::text,true);
  PERFORM public.quote_command_core(gen_random_uuid(),'enable_readiness',readiness_id,2,'{}');
 END LOOP;
END;
$seed$;
SELECT capture_enabled,commands_enabled,notifications_enabled FROM public.quote_settings;
COMMIT;
