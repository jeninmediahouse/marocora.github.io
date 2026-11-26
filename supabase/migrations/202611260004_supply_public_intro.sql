-- Public availability of a teacher introduction video.
-- Mirrors every condition of supply_public_profiles: approved at the current
-- revision, verified owner, not excluded, publication consent given, and a
-- processed video. Returns NULL when anything is missing.

CREATE FUNCTION public.supply_public_intro(p_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT v.video_id
   FROM public.supply_applications a
   JOIN public.supply_intro_videos v ON v.application_id = a.id AND v.status = 'ready'
  WHERE a.id = p_id
    AND a.status = 'approved'
    AND a.reviewed_revision = a.revision
    AND public.supply_verified(a.owner_id)
    AND NOT EXISTS(SELECT 1 FROM public.learning_review_exclusions WHERE user_id = a.owner_id)
    AND public.supply_profile(a)->'publicationConsent' = 'true'::jsonb
    AND public.supply_profile(a)->>'displayName' NOT ILIKE '%Do Not Publish%'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.supply_public_intro(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supply_public_intro(uuid) TO service_role;
