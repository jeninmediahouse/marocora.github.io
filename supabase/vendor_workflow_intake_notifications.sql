-- Canonical notifications for NEW verified vendor intakes only; no historical mail.
begin;
create or replace function public.vendor_capture_intake() returns trigger language plpgsql security definer set search_path='' as $$
declare app_id uuid;
begin
 if new.kind not in ('translator','network') then return new; end if;
 insert into public.vendor_applications(id,source,source_key,user_id,email,name,category,fields,is_test,created_at)
 values(new.id,new.kind,'intake:'||new.id,new.user_id,new.email,new.fields->>'full-name',
 case when new.kind='translator' then 'translation' else coalesce(new.fields->>'category','other') end,new.fields,
 (coalesce(new.fields->>'full-name','') ilike '%EMAIL-RULE-%' or coalesce(new.fields->>'full-name','') like 'VENDOR-QA-%'),new.created_at)
 on conflict(source_key) do nothing returning id into app_id;
 if app_id is not null then
  insert into public.vendor_application_events(application_id,actor_id,kind,payload)
  values(app_id,new.user_id,'submitted',jsonb_build_object('message','Your Marocora application has been received. We will email you after review. You can use the link below to check its status.'));
 end if;
 return new;
end; $$;

revoke all on function public.vendor_capture_intake() from public,anon,authenticated;
commit;
