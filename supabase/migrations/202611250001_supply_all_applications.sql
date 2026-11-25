-- Admin-only inventory of every supply application, including approved and rejected.
-- Never returns credentials, payout envelopes, date of birth, ID numbers or review notes.
create or replace function public.supply_all_applications() returns jsonb
language sql stable security definer set search_path='' as $$
 select case when public.supply_admin_access() then coalesce(jsonb_agg(jsonb_build_object(
   'id', a.id,
   'type', a.vendor_type,
   'status', a.status,
   'revision', a.revision,
   'createdAt', a.created_at,
   'updatedAt', a.updated_at,
   'ownerEmail', u.email,
   'displayName', public.supply_profile(a)->>'displayName',
   'publicationConsent', coalesce((public.supply_profile(a)->>'publicationConsent')::boolean, false),
   'public', (
     a.status = 'approved'
     and coalesce((public.supply_profile(a)->>'publicationConsent')::boolean, false)
     and public.supply_verified(a.owner_id)
     and not exists (
       select 1 from public.learning_review_exclusions e where e.user_id = a.owner_id
     )
   )
 ) order by a.created_at desc), '[]'::jsonb) else null end
 from public.supply_applications a
 join auth.users u on u.id = a.owner_id;
$$;
revoke all on function public.supply_all_applications() from public, anon, authenticated;
grant execute on function public.supply_all_applications() to authenticated;
