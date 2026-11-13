-- Only installed by the disposable test runner. Never bundled with application SQL.
create schema quote_fixture;
create function quote_fixture.command(p_command uuid,p_action text,p_target uuid,p_revision bigint,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if current_database()<>'marocora_quote_fixture' or session_user<>'quote_fixture_owner'
 or exists(select 1 from public.quote_settings where capture_enabled or commands_enabled or notifications_enabled) then raise exception 'FIXTURE_DATABASE_REQUIRED'; end if;
 return public.quote_command_core(p_command,p_action,p_target,p_revision,p_payload);
end; $$;
revoke all on function quote_fixture.command(uuid,text,uuid,bigint,jsonb) from public,anon,service_role;
grant usage on schema quote_fixture to authenticated;
grant execute on function quote_fixture.command(uuid,text,uuid,bigint,jsonb) to authenticated;
