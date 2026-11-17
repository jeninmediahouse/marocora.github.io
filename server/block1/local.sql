-- LOCAL MIGRATION OVERLAY ONLY: never part of Supabase deployment scripts.
do $$ begin
 if current_database()<>'marocora_block1_local' or session_user<>'block1_local_owner' then raise exception 'LOCAL_DATABASE_REQUIRED'; end if;
end $$;
create table public.block1_local_settings(singleton boolean primary key default true check(singleton),owner_id uuid not null references public.learning_review_staff(user_id));
create table public.block1_files(
 id uuid primary key, request_id uuid not null references public.quote_requests(id),
 uploader_id uuid not null references auth.users(id),scope_version integer not null,
 name text not null check(length(name) between 1 and 120),size integer not null check(size between 1 and 1048576),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),created_at timestamptz not null default now()
);
alter table public.block1_local_settings enable row level security;
alter table public.block1_files enable row level security;
revoke all on public.block1_local_settings,public.block1_files from public,anon,authenticated,service_role;
create trigger block1_file_immutable before update or delete on public.block1_files for each row execute function public.quote_append_only();
alter table public.quote_offers add column issued_by uuid references auth.users(id);

-- Staff issues a quote under their own identity, never by impersonating provider.
-- Preserve original draft files; adapt their installed local function explicitly.
do $$ declare body text; needle text;
begin
 body:=pg_get_functiondef('public.quote_command_core(uuid,text,uuid,bigint,jsonb)'::regprocedure);
 needle:='a.provider_id=actor and a.state=''accepted''';
 if position(needle in body)=0 then raise exception 'LOCAL_PATCH_SOURCE_MISMATCH'; end if;
 body:=replace(body,needle,'owner_ok and a.state=''accepted''');
 body:=replace(body,'expires_at,policy_id,digest)','expires_at,policy_id,digest,issued_by)');
 body:=replace(body,'values(new_id,q.id,a.id,actor,q.scope_version','values(new_id,q.id,a.id,a.provider_id,q.scope_version');
 body:=replace(body,'''providerId'',actor,''version''','''providerId'',a.provider_id,''issuedBy'',actor,''version''');
 body:=replace(body,'''content'',content)));','''content'',content)),actor);');
 body:=replace(body,'new_id:=gen_random_uuid();'||chr(10)||'   update public.quote_offers',
 'content:=content||jsonb_build_object(''documents'',coalesce((select jsonb_agg(jsonb_build_object(''id'',id,''name'',name,''size'',size,''sha256'',sha256) order by id) from public.block1_files where request_id=q.id and scope_version=q.scope_version),''[]''::jsonb)); new_id:=gen_random_uuid();'||chr(10)||'   update public.quote_offers');
 body:=replace(body,'''suppressed'',''LOCAL_DRAFT_NO_TRANSPORT''','case when (select notifications_enabled from public.quote_settings) then ''pending'' else ''suppressed'' end,''LOCAL_QUEUE_ONLY_NO_SENDER''');
 body:=replace(body,'''notificationState'',''suppressed''','''notificationState'',case when (select notifications_enabled from public.quote_settings) then ''pending'' else ''suppressed'' end');
 execute body;
end $$;

create function public.block1_freeze_delivery() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.state='pending' then
  select email into new.destination from auth.users where id=new.recipient_id;
  select jsonb_build_object('eventId',e.id,'kind',e.kind,'requestId',e.request_id,'message','A local workspace update is available. No email has been sent.') into new.content from public.quote_events e where e.id=new.event_id;
  new.content_digest:=public.quote_digest(new.content);
 end if;return new;
end $$;
create trigger block1_freeze_delivery before insert on public.quote_deliveries for each row execute function public.block1_freeze_delivery();

create function public.block1_capture(p_id uuid,p_scope jsonb,p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();u auth.users;sc jsonb;h text;prior public.service_intakes;owner uuid;eid uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(788601,1);
 perform public.quote_assert((select capture_enabled and commands_enabled from public.quote_settings),'CAPTURE_DISABLED');
 perform public.quote_assert(public.quote_verified(actor) and not public.quote_excluded(actor),'UNAVAILABLE');
 perform public.quote_assert(p_scope->>'service' in ('Document Translation','Business Translation','Website & Digital Translation','Other Language Service'),'REGULAR_TRANSLATION_ONLY');
 sc:=public.quote_scope(p_scope);
 perform public.quote_object(p_fields,array['name','phone']);perform public.quote_text(p_fields->'name',200);
 if p_fields ? 'phone' then perform public.quote_text(p_fields->'phone',100);end if;
 h:=public.quote_digest(jsonb_build_object('scope',sc,'fields',p_fields));
 select * into prior from public.service_intakes where id=p_id;
 if found then perform public.quote_assert(prior.user_id=actor and prior.request_hash=h,'REQUEST_CONFLICT');return jsonb_build_object('id',p_id);end if;
 perform public.quote_assert((select count(*) from public.service_intakes where user_id=actor and created_at>clock_timestamp()-interval '1 hour')<30,'REQUEST_LIMIT');
 select * into u from auth.users where id=actor;
 select owner_id into owner from public.block1_local_settings;
 perform public.quote_assert(public.quote_staff(owner),'STAFF_OWNER_REQUIRED');
 insert into public.service_intakes(id,user_id,email,email_verified_at,kind,fields,request_hash,delivery)
 values(p_id,actor,u.email,u.email_confirmed_at,'translation',p_fields||jsonb_build_object('quote_scope_v1',sc),h,'uncertain');
 insert into public.quote_intake_classifications(intake_id,classification,source,reason,actor_id) values(p_id,'test','server_rule','Isolated Block 1 synthetic local session',actor);
 insert into public.quote_requests(id,intake_id,customer_id,owner_id,is_test) values(p_id,p_id,actor,owner,true);
 insert into public.quote_request_versions(request_id,version,scope,digest,author_id) values(p_id,1,sc,public.quote_digest(sc),actor);
 insert into public.quote_events(id,aggregate_type,aggregate_id,revision,request_id,actor_id,kind) values(eid,'request',p_id,1,p_id,actor,'capture_request');
 insert into public.quote_deliveries(id,event_id,recipient_id,roles,idempotency_key,state,reason)
 select id,eid,owner,array['staff'],'marocora-quote/'||id::text,case when (select notifications_enabled from public.quote_settings) then 'pending' else 'suppressed' end,'LOCAL_QUEUE_ONLY_NO_SENDER' from (select gen_random_uuid() id) x;
 return jsonb_build_object('id',p_id);
end $$;

create function public.block1_file_allowed(p_request uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare q public.quote_requests;a public.quote_assignments;sc jsonb;
begin
 select * into q from public.quote_requests where id=p_request;
 if not public.quote_verified(auth.uid()) or q.state not in ('open','accepted_pending_activation') then return false;end if;
 if q.owner_id=auth.uid() and public.quote_staff(auth.uid()) then return true;end if;
 select * into a from public.quote_assignments where request_id=q.id and provider_id=auth.uid() and state='accepted' and scope_version=q.scope_version;
 if not found then return false;end if;
 select scope into sc from public.quote_request_versions where request_id=q.id and version=q.scope_version;
 perform public.quote_provider_check(a.readiness_id,sc,q.customer_id);return true;
exception when raise_exception then return false;
end $$;

create function public.block1_register_file(p_id uuid,p_request uuid,p_name text,p_size integer,p_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quote_requests;f public.block1_files;
begin
 perform pg_advisory_xact_lock(788601,1);
 perform public.quote_assert((select capture_enabled and commands_enabled from public.quote_settings),'CAPTURE_DISABLED');
 select * into q from public.quote_requests where id=p_request for update;
 perform public.quote_assert(public.quote_verified(auth.uid()) and q.customer_id=auth.uid() and not public.quote_excluded(auth.uid(),null,q.intake_id),'UNAVAILABLE');
 select * into f from public.block1_files where id=p_id;
 if found then perform public.quote_assert(f.request_id=p_request and f.uploader_id=auth.uid() and f.sha256=p_hash and f.name=p_name and f.size=p_size,'FILE_CONFLICT');return jsonb_build_object('id',f.id);end if;
 perform public.quote_assert(q.state='open' and not exists(select 1 from public.quote_offers where request_id=q.id),'FILES_LOCKED_AFTER_QUOTE');
 perform public.quote_assert((select count(*) from public.block1_files where request_id=q.id)<5,'FILE_LIMIT');
 insert into public.block1_files(id,request_id,uploader_id,scope_version,name,size,sha256) values(p_id,q.id,auth.uid(),q.scope_version,p_name,p_size,p_hash);
 return jsonb_build_object('id',p_id);
end $$;

create function public.block1_file(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.block1_files;
begin
 select * into f from public.block1_files where id=p_id;
 perform public.quote_assert(f.id is not null and public.block1_file_allowed(f.request_id),'UNAVAILABLE');
 return to_jsonb(f);
end $$;
create function public.block1_detail(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quote_requests;d jsonb;
begin
 select * into q from public.quote_requests where id=p_id;
 perform public.quote_assert(q.customer_id=auth.uid() or public.block1_file_allowed(p_id) or exists(select 1 from public.quote_assignments where request_id=p_id and provider_id=auth.uid() and state='invited'),'UNAVAILABLE');
 d:=public.quote_request_detail(p_id);
 d:=d||jsonb_build_object('policies',(select jsonb_object_agg(version,wording) from public.quote_policies where kind='acceptance' and approved_at is not null),'offerIssuer','staff');
 if q.owner_id=auth.uid() then d:=d||jsonb_build_object('customer',(select jsonb_build_object('email',email,'fields',fields-'quote_scope_v1') from public.service_intakes where id=q.intake_id));end if;
 if public.block1_file_allowed(p_id) then d:=d||jsonb_build_object('files',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'size',size,'sha256',sha256)) from public.block1_files where request_id=q.id and scope_version=q.scope_version),'[]'::jsonb));end if;
 return d;
end $$;
create function public.block1_list() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.quote_assert(public.quote_verified(auth.uid()),'UNAVAILABLE');
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'state',state,'revision',revision) order by created_at desc) from
 (select * from public.quote_requests q where customer_id=auth.uid() or owner_id=auth.uid() or exists(select 1 from public.quote_assignments a where a.request_id=q.id and a.provider_id=auth.uid() and a.state in ('invited','accepted')) order by created_at desc,id desc limit 100) rows),'[]'::jsonb);
end $$;

do $$ declare f record;begin
 for f in select oid::regprocedure fn from pg_proc where pronamespace='public'::regnamespace and proname like 'block1_%' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.fn);end loop;
end $$;
grant execute on function public.block1_capture(uuid,jsonb,jsonb),public.block1_register_file(uuid,uuid,text,integer,text),public.block1_file(uuid),public.block1_detail(uuid),public.block1_list() to authenticated;
update public.quote_settings set capture_enabled=true,commands_enabled=true,notifications_enabled=true;
