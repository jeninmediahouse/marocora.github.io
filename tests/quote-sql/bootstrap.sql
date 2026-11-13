-- Synthetic Auth compatibility surface; never run against a managed project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
 id uuid primary key, email text, email_confirmed_at timestamptz,
 is_anonymous boolean not null default false, raw_user_meta_data jsonb not null default '{}'
);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on function auth.uid(),auth.role() to anon,authenticated,service_role;
-- External legacy register only: do not enable or import the old marketplace.
create table public.translation_exclusions(user_id uuid primary key references auth.users(id), reason text not null);
revoke all on public.translation_exclusions from public,anon,authenticated,service_role;
