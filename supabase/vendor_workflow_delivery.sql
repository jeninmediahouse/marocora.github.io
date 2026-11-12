-- Ensure retries never report a previous failed notification as delivered.
begin;
create or replace function public.vendor_mail_health(p_id uuid,p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'SERVER_REQUIRED';end if;
 if not exists(select 1 from public.vendor_applications a where a.id=p_id and (a.user_id=p_user or exists(select 1 from public.learning_review_staff s where s.user_id=p_user))) then raise exception 'ACCESS_DENIED';end if;
 return jsonb_build_object('needs_attention',exists(select 1 from public.vendor_application_events where application_id=p_id and delivery in ('pending','sending','uncertain','failed')));
end; $$;
revoke all on function public.vendor_mail_health(uuid,uuid) from public,anon,authenticated;
grant execute on function public.vendor_mail_health(uuid,uuid) to service_role;
commit;
