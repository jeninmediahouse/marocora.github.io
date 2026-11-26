-- Consent for introduction video, and owner-initiated withdrawal.

ALTER TABLE public.supply_intro_videos ADD COLUMN consent_at timestamptz;

DROP FUNCTION IF EXISTS public.supply_intro_begin(uuid, uuid);

CREATE FUNCTION public.supply_intro_begin(p_id uuid, p_video uuid, p_consent boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.supply_applications%rowtype; previous uuid;
BEGIN
  IF NOT public.supply_verified(auth.uid()) THEN RAISE EXCEPTION 'SUPPLY_VERIFIED_ACCOUNT_REQUIRED'; END IF;
  IF p_consent IS NOT TRUE THEN RAISE EXCEPTION 'SUPPLY_INTRO_CONSENT_REQUIRED'; END IF;
  SELECT * INTO a FROM public.supply_applications WHERE id=p_id AND owner_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUPPLY_APPLICATION_NOT_FOUND'; END IF;
  IF a.vendor_type <> 'teacher' THEN RAISE EXCEPTION 'SUPPLY_INTRO_TEACHER_ONLY'; END IF;
  SELECT video_id INTO previous FROM public.supply_intro_videos WHERE application_id=p_id;
  INSERT INTO public.supply_intro_videos(application_id, video_id, status, consent_at, updated_at)
    VALUES(p_id, p_video, 'processing', now(), now())
    ON CONFLICT (application_id) DO UPDATE
      SET video_id=excluded.video_id, status='processing', duration_seconds=NULL, bytes=NULL,
          has_audio=NULL, failure_code=NULL, consent_at=now(), updated_at=now();
  RETURN jsonb_build_object('videoId', p_video, 'previousVideoId', previous);
END;$$;

REVOKE ALL ON FUNCTION public.supply_intro_begin(uuid,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supply_intro_begin(uuid,uuid,boolean) TO authenticated;

-- Returns the video id so the server can delete stored objects, then removes the
-- application. Child rows (profile, reviews, credentials) cascade.
CREATE FUNCTION public.supply_withdraw_application(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.supply_applications%rowtype; video uuid;
BEGIN
  IF NOT public.supply_verified(auth.uid()) THEN RAISE EXCEPTION 'SUPPLY_VERIFIED_ACCOUNT_REQUIRED'; END IF;
  SELECT * INTO a FROM public.supply_applications WHERE id=p_id AND owner_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUPPLY_APPLICATION_NOT_FOUND'; END IF;
  SELECT video_id INTO video FROM public.supply_intro_videos WHERE application_id=p_id;
  DELETE FROM public.supply_applications WHERE id=p_id;
  RETURN jsonb_build_object('withdrawn', true, 'videoId', video);
END;$$;

REVOKE ALL ON FUNCTION public.supply_withdraw_application(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supply_withdraw_application(uuid) TO authenticated;

-- Reconcile objects: is this stored video still the current one for a live row?
CREATE FUNCTION public.supply_intro_object_valid(p_id uuid, p_video uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.supply_intro_videos WHERE application_id=p_id AND video_id=p_video);
$$;

REVOKE ALL ON FUNCTION public.supply_intro_object_valid(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supply_intro_object_valid(uuid,uuid) TO service_role;
