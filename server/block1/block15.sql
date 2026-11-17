-- Additive LOCAL ONLY migration. No production credentials or managed SQL runner.
do $$ begin
 if current_database()<>'marocora_block1_local' or session_user<>'block1_local_owner' then raise exception 'LOCAL_DATABASE_REQUIRED';end if;
end $$;
alter table public.block1_files drop constraint block1_files_size_check;
alter table public.block1_files add constraint block1_files_size_check check(size between 1 and 10000000);
alter table public.block1_files add column media_type text not null default 'text/plain'
 check(media_type in ('text/plain','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png'));
create table public.block15_scan_events(
 id uuid primary key default gen_random_uuid(),file_id uuid not null references public.block1_files(id),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 status text not null check(status in ('clean','quarantined','infected','error')),
 engine text not null,reason text not null,actor_id uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp()
);
alter table public.block15_scan_events enable row level security;
revoke all on public.block15_scan_events from public,anon,authenticated,service_role;
create trigger block15_scan_immutable before update or delete on public.block15_scan_events for each row execute function public.quote_append_only();
create index block15_scan_latest on public.block15_scan_events(file_id,created_at desc,id desc);

create function public.block15_scan_status(p_id uuid) returns text language sql security definer set search_path='' as $$
 select coalesce((select s.status from public.block15_scan_events s join public.block1_files f on f.id=s.file_id and f.sha256=s.sha256 where file_id=p_id order by s.created_at desc,s.id desc limit 1),'quarantined');
$$;
create function public.block15_record_scan(p_file uuid,p_hash text,p_status text,p_engine text,p_reason text,p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(788601,1);
 perform public.quote_assert(exists(select 1 from public.block1_files where id=p_file and sha256=p_hash),'FILE_CONFLICT');
 insert into public.block15_scan_events(file_id,sha256,status,engine,reason,actor_id) values(p_file,p_hash,p_status,p_engine,p_reason,p_actor);
 return jsonb_build_object('id',p_file,'scanStatus',p_status);
end $$;
-- This function is OWNER ONLY: no client can assert that a document is clean.

create function public.block15_register_file(p_id uuid,p_request uuid,p_name text,p_size integer,p_hash text,p_mime text) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quote_requests;f public.block1_files;
begin
 perform pg_advisory_xact_lock(788601,1);
 perform public.quote_assert((select capture_enabled and commands_enabled from public.quote_settings),'CAPTURE_DISABLED');
 select * into q from public.quote_requests where id=p_request for update;
 perform public.quote_assert(public.quote_verified(auth.uid()) and q.customer_id=auth.uid() and not public.quote_excluded(auth.uid(),null,q.intake_id),'UNAVAILABLE');
 select * into f from public.block1_files where id=p_id;
 if found then
  perform public.quote_assert(f.request_id=p_request and f.uploader_id=auth.uid() and f.sha256=p_hash and f.name=p_name and f.size=p_size and f.media_type=p_mime,'FILE_CONFLICT');
  return jsonb_build_object('id',f.id,'needsScan',not exists(select 1 from public.block15_scan_events where file_id=f.id),'scanStatus',public.block15_scan_status(f.id));
 end if;
 perform public.quote_assert(q.state='open' and not exists(select 1 from public.quote_offers where request_id=q.id),'FILES_LOCKED_AFTER_QUOTE');
 perform public.quote_assert((select count(*) from public.block1_files where request_id=q.id)<5,'FILE_LIMIT');
 insert into public.block1_files(id,request_id,uploader_id,scope_version,name,size,sha256,media_type) values(p_id,q.id,auth.uid(),q.scope_version,p_name,p_size,p_hash,p_mime);
 return jsonb_build_object('id',p_id,'needsScan',true,'scanStatus','quarantined');
end $$;
create function public.block15_file(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f jsonb;
begin
 f:=public.block1_file(p_id);
 perform public.quote_assert(public.block15_scan_status(p_id)='clean','FILE_QUARANTINED');
 return f;
end $$;
create function public.block15_scan_target(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.block1_files;
begin
 select * into f from public.block1_files where id=p_id;
 perform public.quote_assert(public.block1_file_allowed(f.request_id) and exists(select 1 from public.quote_requests where id=f.request_id and owner_id=auth.uid()) and public.quote_staff(auth.uid()),'STAFF_OWNER_REQUIRED');
 return to_jsonb(f);
end $$;
create function public.block15_detail(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb;
begin
 d:=public.block1_detail(p_id);
 d:=d||jsonb_build_object('documentsHold',exists(select 1 from public.block1_files where request_id=p_id and public.block15_scan_status(id)<>'clean'));
 if d ? 'files' then
  d:=jsonb_set(d,'{files}',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'size',f.size,'sha256',f.sha256,'mediaType',f.media_type,'scanStatus',public.block15_scan_status(f.id),'scanReason',(select reason from public.block15_scan_events where file_id=f.id order by created_at desc,id desc limit 1))) from public.block1_files f where request_id=p_id and scope_version=(d->>'scopeVersion')::integer),'[]'::jsonb));
 end if;
 return d;
end $$;
-- Guard issuance AND acceptance atomically with existing quote/file locks.
do $$ declare body text;needle text;
begin
 body:=pg_get_functiondef('public.quote_command_core(uuid,text,uuid,bigint,jsonb)'::regprocedure);
 needle:='when ''issue_offer'' then';
 if position(needle in body)=0 then raise exception 'LOCAL_PATCH_SOURCE_MISMATCH';end if;
 body:=replace(body,needle,needle||chr(10)||'   perform public.quote_assert(not exists(select 1 from public.block1_files where request_id=q.id and public.block15_scan_status(id)<>''clean''),''DOCUMENTS_QUARANTINED'');');
 needle:='when ''accept_offer'',''decline_offer'',''withdraw_offer'' then';
 if position(needle in body)=0 then raise exception 'LOCAL_PATCH_SOURCE_MISMATCH';end if;
 body:=replace(body,needle,needle||chr(10)||'   if p_action=''accept_offer'' then perform public.quote_assert(not exists(select 1 from public.block1_files where request_id=q.id and public.block15_scan_status(id)<>''clean''),''DOCUMENTS_QUARANTINED'');end if;');
 execute body;
end $$;
do $$ declare f record;begin
 for f in select oid::regprocedure fn from pg_proc where pronamespace='public'::regnamespace and proname like 'block15_%' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.fn);end loop;
end $$;
grant execute on function public.block15_register_file(uuid,uuid,text,integer,text,text),public.block15_file(uuid),public.block15_scan_target(uuid),public.block15_detail(uuid) to authenticated;
