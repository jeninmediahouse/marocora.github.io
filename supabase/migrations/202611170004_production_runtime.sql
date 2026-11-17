-- Apply ONLY to the intended production project after 001 and 003. No seeds,
-- fake bookings, gate changes, payment confirmation or credentials are created.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.instant_mock_payments) THEN RAISE EXCEPTION 'PRODUCTION_REQUIRES_CLEAN_PAYMENT_STATE';END IF;
 IF EXISTS(SELECT 1 FROM public.quote_settings WHERE capture_enabled OR commands_enabled OR notifications_enabled) THEN RAISE EXCEPTION 'PRODUCTION_REQUIRES_SWITCHES_OFF';END IF;
END;$$;
INSERT INTO public.quote_settings(singleton) VALUES(true) ON CONFLICT(singleton) DO NOTHING;
REVOKE ALL ON FUNCTION public.instant_pay_mock(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.production_translation_accounts (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),enabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.production_translation_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY production_rpc_only ON public.production_translation_accounts AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
REVOKE ALL ON public.production_translation_accounts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_translation_accounts TO service_role;
-- Production uses an explicit real-account allowlist, not the staging registry.
CREATE OR REPLACE FUNCTION public.quote_verified(person uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users u JOIN public.production_translation_accounts a ON a.user_id=u.id
 WHERE u.id=person AND a.enabled AND u.email IS NOT NULL AND u.email_confirmed_at IS NOT NULL AND NOT u.is_anonymous);
$$;
REVOKE ALL ON FUNCTION public.quote_verified(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.production_learning_memberships(
 tenant_id uuid NOT NULL,user_id uuid NOT NULL REFERENCES auth.users(id),PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE public.production_learning_bookings(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL REFERENCES auth.users(id),teacher_id uuid NOT NULL REFERENCES auth.users(id),tenant_id uuid,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','completed')),
 delivery_mode text NOT NULL DEFAULT 'online' CHECK(delivery_mode IN ('online','in_person')),
 teacher_active boolean NOT NULL DEFAULT false,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
 CHECK(student_id<>teacher_id),CHECK(ends_at>starts_at),created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.production_learning_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_learning_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY production_rpc_only ON public.production_learning_memberships AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE POLICY production_rpc_only ON public.production_learning_bookings AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
REVOKE ALL ON public.production_learning_memberships,public.production_learning_bookings FROM PUBLIC,anon,authenticated;
-- Only a trusted backend/payment workflow may populate or confirm bookings.
GRANT SELECT,INSERT,UPDATE,DELETE ON public.production_learning_memberships,public.production_learning_bookings TO service_role;
CREATE FUNCTION public.production_learning_room_context(p_booking uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();b public.production_learning_bookings%rowtype;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=actor AND email IS NOT NULL AND email_confirmed_at IS NOT NULL AND NOT is_anonymous) THEN RAISE EXCEPTION 'ROOM_NOT_AVAILABLE';END IF;
 SELECT * INTO b FROM public.production_learning_bookings WHERE id=p_booking;
 IF b.id IS NULL OR actor NOT IN(b.student_id,b.teacher_id) OR b.status<>'confirmed' OR NOT b.teacher_active OR b.delivery_mode<>'online'
 OR now()<b.starts_at-interval '10 minutes' OR now()>=b.ends_at+interval '10 minutes'
 OR (b.tenant_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.production_learning_memberships WHERE tenant_id=b.tenant_id AND user_id=actor))
 THEN RAISE EXCEPTION 'ROOM_NOT_AVAILABLE';END IF;
 RETURN jsonb_build_object('actor',actor,'bookingId',b.id,'role',CASE WHEN actor=b.teacher_id THEN 'teacher' ELSE 'student' END,
 'studentId',b.student_id,'teacherId',b.teacher_id,'tenantId',b.tenant_id,'status',b.status,'deliveryMode',b.delivery_mode,
 'teacherActive',b.teacher_active,'member',true,'startsAt',b.starts_at,'endsAt',b.ends_at);
END;$$;
REVOKE ALL ON FUNCTION public.production_learning_room_context(uuid) FROM PUBLIC,anon,service_role;
GRANT USAGE ON SCHEMA public TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.production_learning_room_context(uuid) TO authenticated;
CREATE FUNCTION public.production_runtime_status() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('version',4,'mockPayments',false);
$$;
REVOKE ALL ON FUNCTION public.production_runtime_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.production_runtime_status() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
