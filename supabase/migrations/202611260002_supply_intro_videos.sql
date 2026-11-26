-- Teacher introduction videos (step 1: storage state only).
-- One video per application. Rows are written by the server, never by a browser.

CREATE TABLE public.supply_intro_videos(
  application_id uuid PRIMARY KEY REFERENCES public.supply_applications(id) ON DELETE CASCADE,
  video_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('processing','ready','failed')),
  duration_seconds numeric(6,2),
  bytes bigint,
  has_audio boolean,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supply_intro_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY supply_intro_rpc_only ON public.supply_intro_videos
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING(false) WITH CHECK(false);
REVOKE ALL ON public.supply_intro_videos FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.supply_intro_begin(p_id uuid, p_video uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.supply_applications%rowtype; previous uuid;
BEGIN
  IF NOT public.supply_verified(auth.uid()) THEN RAISE EXCEPTION 'SUPPLY_VERIFIED_ACCOUNT_REQUIRED'; END IF;
  SELECT * INTO a FROM public.supply_applications WHERE id=p_id AND owner_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUPPLY_APPLICATION_NOT_FOUND'; END IF;
  IF a.vendor_type <> 'teacher' THEN RAISE EXCEPTION 'SUPPLY_INTRO_TEACHER_ONLY'; END IF;
  SELECT video_id INTO previous FROM public.supply_intro_videos WHERE application_id=p_id;
  INSERT INTO public.supply_intro_videos(application_id, video_id, status, duration_seconds, bytes, has_audio, failure_code, updated_at)
    VALUES(p_id, p_video, 'processing', NULL, NULL, NULL, NULL, now())
    ON CONFLICT (application_id) DO UPDATE
      SET video_id=excluded.video_id, status='processing', duration_seconds=NULL, bytes=NULL,
          has_audio=NULL, failure_code=NULL, updated_at=now();
  RETURN jsonb_build_object('videoId', p_video, 'previousVideoId', previous);
END;$$;

CREATE FUNCTION public.supply_intro_ready(p_id uuid, p_video uuid, p_duration numeric, p_bytes bigint, p_audio boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_duration IS NULL OR p_duration <= 0 OR p_duration > 180 OR p_bytes IS NULL OR p_bytes < 1 THEN
    RAISE EXCEPTION 'SUPPLY_INTRO_INVALID_RESULT';
  END IF;
  UPDATE public.supply_intro_videos
     SET status='ready', duration_seconds=p_duration, bytes=p_bytes, has_audio=p_audio,
         failure_code=NULL, updated_at=now()
   WHERE application_id=p_id AND video_id=p_video;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUPPLY_INTRO_NOT_FOUND'; END IF;
  RETURN jsonb_build_object('status','ready');
END;$$;

CREATE FUNCTION public.supply_intro_failed(p_id uuid, p_video uuid, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.supply_intro_videos
     SET status='failed', failure_code=coalesce(nullif(left(p_code,40),''),'UNKNOWN'), updated_at=now()
   WHERE application_id=p_id AND video_id=p_video;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUPPLY_INTRO_NOT_FOUND'; END IF;
  RETURN jsonb_build_object('status','failed');
END;$$;

CREATE FUNCTION public.supply_intro_get(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.supply_intro_videos%rowtype; a public.supply_applications%rowtype;
BEGIN
  SELECT * INTO a FROM public.supply_applications WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUPPLY_APPLICATION_NOT_FOUND'; END IF;
  IF a.owner_id <> auth.uid() AND NOT public.supply_admin_access() THEN
    RAISE EXCEPTION 'SUPPLY_APPLICATION_NOT_FOUND';
  END IF;
  SELECT * INTO v FROM public.supply_intro_videos WHERE application_id=p_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','none'); END IF;
  RETURN jsonb_build_object(
    'status', v.status,
    'videoId', v.video_id,
    'durationSeconds', v.duration_seconds,
    'bytes', v.bytes,
    'hasAudio', v.has_audio,
    'failureCode', v.failure_code,
    'updatedAt', v.updated_at
  );
END;$$;

REVOKE ALL ON FUNCTION public.supply_intro_begin(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.supply_intro_ready(uuid,uuid,numeric,bigint,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.supply_intro_failed(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.supply_intro_get(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.supply_intro_begin(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supply_intro_get(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supply_intro_ready(uuid,uuid,numeric,bigint,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.supply_intro_failed(uuid,uuid,text) TO service_role;
