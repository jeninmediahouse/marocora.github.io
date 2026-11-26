-- Teacher introduction video is mandatory before approval.
-- Replaces the review function to add one check; every other rule is unchanged.

CREATE OR REPLACE FUNCTION public.supply_review_application(p_id uuid,p_revision bigint,p_decision text,p_reason text,p_credentials_reviewed boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.supply_applications%rowtype; p jsonb;
BEGIN
 PERFORM 1 FROM public.learning_review_staff WHERE user_id=auth.uid() FOR SHARE;
 IF NOT FOUND OR NOT public.supply_verified(auth.uid()) THEN RAISE EXCEPTION 'SUPPLY_ADMIN_REQUIRED'; END IF;
 SELECT * INTO a FROM public.supply_applications WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SUPPLY_APPLICATION_NOT_FOUND'; END IF;
 IF a.owner_id=auth.uid() THEN RAISE EXCEPTION 'SUPPLY_SELF_REVIEW_DENIED'; END IF;
 IF a.revision IS DISTINCT FROM p_revision OR a.status<>'pending_review' THEN RAISE EXCEPTION 'SUPPLY_STALE_REVISION'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected') OR p_reason IS NULL OR length(p_reason)>2000 OR (p_decision='rejected' AND length(btrim(p_reason))=0) OR p_credentials_reviewed IS NULL THEN RAISE EXCEPTION 'SUPPLY_INVALID_DECISION'; END IF;
 p:=public.supply_profile(a);
 IF p_decision='approved' AND a.vendor_type='teacher' THEN
  IF NOT EXISTS(SELECT 1 FROM public.supply_intro_videos WHERE application_id=a.id AND status='ready') THEN
   RAISE EXCEPTION 'SUPPLY_INTRO_VIDEO_REQUIRED';
  END IF;
 END IF;
 IF p_decision='approved' THEN
  IF NOT public.supply_verified(a.owner_id) OR EXISTS(SELECT 1 FROM public.learning_review_exclusions WHERE user_id=a.owner_id) OR p->>'displayName' ILIKE '%Do Not Publish%' THEN RAISE EXCEPTION 'SUPPLY_PUBLICATION_BLOCKED'; END IF;
  IF a.vendor_type='translator' AND p->'specialties' ? 'Sworn' AND (NOT p_credentials_reviewed OR NOT EXISTS(SELECT 1 FROM public.supply_credentials WHERE application_id=a.id AND scan_status='clean')) THEN RAISE EXCEPTION 'SUPPLY_CREDENTIAL_REVIEW_REQUIRED'; END IF;
 END IF;
 INSERT INTO public.supply_reviews(application_id,revision,reviewer_id,decision,reason,credentials_reviewed) VALUES(a.id,a.revision,auth.uid(),p_decision,p_reason,p_credentials_reviewed);
 UPDATE public.supply_applications SET status=p_decision,reviewed_revision=revision,updated_at=now() WHERE id=a.id RETURNING * INTO a;
 RETURN public.supply_private_payload(a);
END;$$;
