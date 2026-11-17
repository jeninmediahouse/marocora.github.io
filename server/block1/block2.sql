-- LOCAL ONLY additive Block 2 overlay. Never a managed/production migration.
do $$ begin
 if current_database()<>'marocora_block1_local' or session_user<>'block1_local_owner' then raise exception 'LOCAL_DATABASE_REQUIRED';end if;
end $$;

create table public.block2_submissions(request_id uuid primary key references public.quote_requests(id),submitted_at timestamptz not null default clock_timestamp());
create table public.block2_credential_scans(id uuid primary key,provider_id uuid not null references auth.users(id),sha256 text not null,status text not null check(status in ('clean','infected','error')),engine text not null,reason text not null,created_at timestamptz not null default clock_timestamp());
create table public.block2_credentials(id uuid primary key references public.block2_credential_scans(id),provider_id uuid not null references auth.users(id),legal_name text not null,dob text not null,credential_number text not null,name text not null,media_type text not null check(media_type in ('image/jpeg','image/png')),size integer not null check(size between 1 and 10000000),sha256 text not null,created_at timestamptz not null default clock_timestamp());
create table public.block2_credential_reviews(id uuid primary key,credential_id uuid not null references public.block2_credentials(id),actor_id uuid not null references auth.users(id),decision text not null check(decision in ('approved','rejected','revoked')),reason text not null,revision bigint not null,created_at timestamptz not null default clock_timestamp(),unique(credential_id,revision));
create table public.block2_fulfillments(request_id uuid primary key references public.quote_acceptances(request_id),choice jsonb not null,created_at timestamptz not null default clock_timestamp());
create table public.block2_mock_mail(request_id uuid primary key references public.block2_fulfillments(request_id),destination text not null,kind text not null check(kind in ('final_file_email_requested','usb_password_email_requested')),state text not null check(state in ('waiting_for_final_file','waiting_for_encrypted_usb_preparation','suppressed')),content jsonb not null,created_at timestamptz not null default clock_timestamp());
do $$ declare t text;begin
 foreach t in array array['block2_submissions','block2_credential_scans','block2_credentials','block2_credential_reviews','block2_fulfillments','block2_mock_mail'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('create trigger block2_immutable before update or delete on public.%I for each row execute function public.quote_append_only()',t);
 end loop;
end $$;

create function public.block2_dob(v text) returns text language plpgsql set search_path='' as $$
declare m text[]:=array['January','February','March','April','May','June','July','August','September','October','November','December'];p text[];d date;
begin
 p:=regexp_match(v,'^(January|February|March|April|May|June|July|August|September|October|November|December) ([1-9]|[12][0-9]|3[01]) ([0-9]{4})$');
 perform public.quote_assert(p is not null,'DOB_FORMAT');
 perform public.quote_assert(v=p[1]||' '||p[2]||' '||p[3],'DOB_FORMAT');
 begin d:=make_date(p[3]::integer,array_position(m,p[1]),p[2]::integer);exception when others then raise exception 'DOB_INVALID';end;
 perform public.quote_assert(d<=current_date,'DOB_INVALID');return v;
end $$;
create function public.block2_staff_owner() returns boolean language sql stable security definer set search_path='' as $$
 select public.quote_staff(auth.uid()) and exists(select 1 from public.block1_local_settings where owner_id=auth.uid());
$$;
create function public.block2_current_credential(p_provider uuid) returns uuid language sql stable security definer set search_path='' as $$
 select c.id from public.block2_credentials c where c.provider_id=p_provider order by c.created_at desc,c.id desc limit 1;
$$;
create function public.block2_credential_approved(p_provider uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select decision='approved' from public.block2_credential_reviews where credential_id=public.block2_current_credential(p_provider) order by revision desc limit 1),false);
$$;
-- Owner-only scanner result recording; no authenticated actor can assert clean.
create function public.block2_record_credential(p_id uuid,p_provider uuid,p_fields jsonb,p_file jsonb,p_result jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(788601,1);
 perform public.quote_assert((select capture_enabled and commands_enabled from public.quote_settings),'CAPTURE_DISABLED');
 perform public.quote_assert(public.quote_verified(p_provider) and not public.quote_excluded(p_provider) and exists(select 1 from public.vendor_applications where user_id=p_provider and category='translation' and status='approved' and not is_test),'PROVIDER_INELIGIBLE');
 perform public.quote_object(p_fields,array['legalName','dob','credentialNumber']);
 perform public.quote_text(p_fields->'legalName',200);perform public.block2_dob(p_fields->>'dob');perform public.quote_text(p_fields->'credentialNumber',100);
 perform public.quote_assert(p_file->>'mediaType' in ('image/jpeg','image/png'),'CREDENTIAL_IMAGE_REQUIRED');
 insert into public.block2_credential_scans(id,provider_id,sha256,status,engine,reason) values(p_id,p_provider,p_file->>'sha256',p_result->>'status',p_result->>'engine',p_result->>'reason');
 if p_result->>'status'='clean' then
  insert into public.block2_credentials(id,provider_id,legal_name,dob,credential_number,name,media_type,size,sha256) values(p_id,p_provider,public.quote_text(p_fields->'legalName',200),p_fields->>'dob',public.quote_text(p_fields->'credentialNumber',100),p_file->>'name',p_file->>'mediaType',(p_file->>'size')::integer,p_file->>'sha256');
 end if;
 return jsonb_build_object('id',p_id,'scanStatus',p_result->>'status','reviewState',case when p_result->>'status'='clean' then 'pending' else 'not_submitted' end);
end $$;
create function public.block2_credentials_list() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.quote_assert(public.quote_verified(auth.uid()),'UNAVAILABLE');
 return coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('reviewState',coalesce((select decision from public.block2_credential_reviews where credential_id=c.id order by revision desc limit 1),'pending'),'revision',coalesce((select max(revision) from public.block2_credential_reviews where credential_id=c.id),0),'isCurrent',c.id=public.block2_current_credential(c.provider_id)) order by c.created_at desc) from public.block2_credentials c where c.provider_id=auth.uid() or public.block2_staff_owner()),'[]');
end $$;
create function public.block2_credential_file(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.block2_credentials;begin
 select * into c from public.block2_credentials where id=p_id;
 perform public.quote_assert(public.quote_verified(auth.uid()) and (c.provider_id=auth.uid() or public.block2_staff_owner()),'UNAVAILABLE');
 perform public.quote_assert(exists(select 1 from public.block2_credential_scans where id=p_id and status='clean' and sha256=c.sha256),'FILE_QUARANTINED');return to_jsonb(c);
end $$;
create function public.block2_review_credential(p_id uuid,p_review uuid,p_revision bigint,p_decision text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.block2_credentials;prior public.block2_credential_reviews;rev bigint;
begin
 perform pg_advisory_xact_lock(788601,1);
 perform public.quote_assert((select commands_enabled from public.quote_settings),'COMMANDS_DISABLED');perform public.quote_assert(public.block2_staff_owner(),'STAFF_OWNER_REQUIRED');
 select * into c from public.block2_credentials where id=p_id;
 perform public.quote_assert(c.id is not null and c.provider_id<>auth.uid() and c.id=public.block2_current_credential(c.provider_id),'UNAVAILABLE');
 perform public.quote_assert(p_decision in ('approved','rejected','revoked') and length(btrim(p_reason)) between 1 and 2000,'INVALID_REVIEW');
 select * into prior from public.block2_credential_reviews where id=p_review;
 if found then perform public.quote_assert(prior.credential_id=p_id and prior.actor_id=auth.uid() and prior.decision=p_decision and prior.reason=p_reason and prior.revision=p_revision+1,'COMMAND_CONFLICT');return jsonb_build_object('revision',prior.revision,'reviewState',prior.decision);end if;
 select coalesce(max(revision),0) into rev from public.block2_credential_reviews where credential_id=p_id;
 perform public.quote_assert(rev=p_revision,'STALE_REVISION');
 insert into public.block2_credential_reviews(id,credential_id,actor_id,decision,reason,revision) values(p_review,p_id,auth.uid(),p_decision,p_reason,rev+1);
 return jsonb_build_object('revision',rev+1,'reviewState',p_decision);
end $$;

-- Expand the local typed contract, retaining the original draft files.
do $$ declare b text;begin
 b:=pg_get_functiondef('public.quote_scope(jsonb)'::regprocedure);
 b:=replace(b,'''Certified / Sworn Translation''','''Sworn Translation (Morocco)''');
 b:=replace(b,$fragment$array['receivingAuthority','jurisdiction','requirements']$fragment$,$fragment$array['receivingAuthority','jurisdiction','requirements','country','missingInstructions']$fragment$);
 b:=replace(b,$fragment$c:=v->'certified';$fragment$,$fragment$c:=v->'certified'; perform public.quote_assert(c->>'country'='Morocco' and c->>'jurisdiction'='Morocco','MOROCCO_ONLY'); perform public.quote_assert(jsonb_typeof(c->'missingInstructions')='boolean','INVALID_INSTRUCTIONS');$fragment$);
 b:=replace(b,$fragment$'requirements',public.quote_text(c->'requirements',2000))$fragment$,$fragment$'requirements',public.quote_text(c->'requirements',2000),'country','Morocco','missingInstructions',(c->>'missingInstructions')::boolean)$fragment$);execute b;
 b:=pg_get_functiondef('public.quote_capabilities(jsonb)'::regprocedure);b:=replace(b,'''Certified / Sworn Translation''','''Sworn Translation (Morocco)''');execute b;
 b:=pg_get_functiondef('public.block1_capture(uuid,jsonb,jsonb)'::regprocedure);b:=replace(b,'''Other Language Service'')','''Other Language Service'',''Sworn Translation (Morocco)'')');execute b;
end $$;

create function public.block2_submit(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quote_requests;s jsonb;begin
 perform pg_advisory_xact_lock(788601,1);
 perform public.quote_assert((select capture_enabled and commands_enabled from public.quote_settings),'CAPTURE_DISABLED');
 select * into q from public.quote_requests where id=p_id for update;
 perform public.quote_assert(q.customer_id=auth.uid() and public.quote_verified(auth.uid()),'CUSTOMER_REQUIRED');
 if exists(select 1 from public.block2_submissions where request_id=q.id) then return jsonb_build_object('id',q.id,'submitted',true);end if;
 perform public.quote_assert(q.state='open','INVALID_STATE');
 select scope into s from public.quote_request_versions where request_id=q.id and version=q.scope_version;
 if s->>'service'='Sworn Translation (Morocco)' then
  perform public.quote_assert(exists(select 1 from public.block1_files where request_id=q.id and media_type in ('application/pdf','image/jpeg','image/png')),'ORIGINAL_SCAN_REQUIRED');
 end if;
 insert into public.block2_submissions(request_id) values(q.id);return jsonb_build_object('id',q.id,'submitted',true);
end $$;
create function public.block2_capture(p_id uuid,p_scope jsonb,p_fields jsonb,p_draft boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 result:=public.block1_capture(p_id,p_scope,p_fields);
 if not p_draft then result:=public.block2_submit(p_id);end if;return result;
end $$;
-- A submitted request is locked before reading/storing any new upload bytes.
create function public.block2_upload_check(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare q public.quote_requests;begin
 select * into q from public.quote_requests where id=p_id;
 perform public.quote_assert(q.customer_id=auth.uid() and public.quote_verified(auth.uid()),'CUSTOMER_REQUIRED');
 perform public.quote_assert((select capture_enabled and commands_enabled from public.quote_settings),'CAPTURE_DISABLED');
 perform public.quote_assert(q.state='open' and not exists(select 1 from public.block2_submissions where request_id=p_id) and not exists(select 1 from public.quote_offers where request_id=p_id),'REQUEST_SUBMITTED');return true;
end $$;
do $$ declare b text;begin
 b:=pg_get_functiondef('public.block15_register_file(uuid,uuid,text,integer,text,text)'::regprocedure);
 b:=replace(b,'select * into f from public.block1_files where id=p_id;','perform public.block2_upload_check(p_request); select * into f from public.block1_files where id=p_id;');execute b;
end $$;

alter function public.quote_provider_check(uuid,jsonb,uuid,boolean) rename to block2_base_provider_check;
create function public.quote_provider_check(readiness uuid,request_scope jsonb default null,customer uuid default null,enabled boolean default true) returns public.quote_provider_readiness language plpgsql security definer set search_path='' as $$
declare r public.quote_provider_readiness;begin
 r:=public.block2_base_provider_check(readiness,request_scope,customer,enabled);
 if request_scope->>'service'='Sworn Translation (Morocco)' then perform public.quote_assert(public.block2_credential_approved(r.provider_id),'SWORN_CREDENTIAL_REQUIRED');end if;return r;
end $$;

create function public.block2_terms(p_sworn boolean) returns jsonb language sql immutable set search_path='' as $$
 select case when p_sworn then jsonb_build_object('method','in_person','inPerson','This is an in-person hand-off. The translator will validate the physical original document in person before handing over the stamped and notarized translation.','guarantee','Marocora stands by our sworn translations. If any Moroccan government authority rejects this translation and demands changes, we will amend or redo it for you.')
 else jsonb_build_object('email','Email Delivery','shipping','Shipping charges are extra.','usbCosts','Shipping plus the cost of the flash drive is extra.','usbSecurity','The flash drive will be encrypted for your security. The decryption password will be sent to your email address. Do not lose the password.') end;
$$;
create function public.block2_choice(v jsonb,p_sworn boolean) returns jsonb language plpgsql set search_path='' as $$
declare method text;begin
 perform public.quote_object(v,array['method','extraCostsAccepted','encryptionAccepted','originalCheckAccepted','guaranteeAccepted']);method:=v->>'method';
 if p_sworn then
  perform public.quote_assert(method='in_person' and v->'originalCheckAccepted'='true'::jsonb and v->'guaranteeAccepted'='true'::jsonb,'IN_PERSON_REQUIRED');
 else
  perform public.quote_assert(method in ('email','shipping','usb'),'FULFILLMENT_REQUIRED');
  if method in ('shipping','usb') then perform public.quote_assert(v->'extraCostsAccepted'='true'::jsonb,'EXTRA_COSTS_ACK_REQUIRED');end if;
  if method='usb' then perform public.quote_assert(v->'encryptionAccepted'='true'::jsonb,'ENCRYPTION_ACK_REQUIRED');end if;
 end if;
 return v||jsonb_build_object('terms',public.block2_terms(p_sworn));
end $$;

-- Add the new acceptance input and digest-covered quote terms before preserving
-- the existing core as the underlying transaction. Scan gates remain in it.
do $$ declare b text;begin
 b:=pg_get_functiondef('public.quote_command_core(uuid,text,uuid,bigint,jsonb)'::regprocedure);
 b:=replace(b,$fragment$array['offerId','offerDigest','policyVersion','policyDigest','language']$fragment$,$fragment$array['offerId','offerDigest','policyVersion','policyDigest','language','fulfillment']$fragment$);
 b:=replace(b,'new_id:=gen_random_uuid();'||chr(10)||'   update public.quote_offers','content:=content||jsonb_build_object(''fulfillmentTerms'',public.block2_terms(sc->>''service''=''Sworn Translation (Morocco)'')); new_id:=gen_random_uuid();'||chr(10)||'   update public.quote_offers');execute b;
end $$;
alter function public.quote_command_core(uuid,text,uuid,bigint,jsonb) rename to block2_base_command_core;
create function public.quote_command_core(p_command uuid,p_action text,p_target uuid,p_revision bigint,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;q public.quote_requests;s jsonb;choice jsonb;sworn boolean;prior jsonb;begin
 perform pg_advisory_xact_lock(788601,1);
 select * into q from public.quote_requests where id=p_target;
 select scope into s from public.quote_request_versions where request_id=p_target and version=q.scope_version;
 sworn:=coalesce(s->>'service'='Sworn Translation (Morocco)',false);
 if p_action in ('issue_offer','accept_offer') then
  perform public.quote_assert(public.quote_can_read(p_target,auth.uid()),'UNAVAILABLE');
  perform public.quote_assert(exists(select 1 from public.block2_submissions where request_id=p_target),'REQUEST_NOT_SUBMITTED');
  if sworn then perform public.quote_assert(exists(select 1 from public.block1_files where request_id=p_target and media_type in ('application/pdf','image/jpeg','image/png')),'ORIGINAL_SCAN_REQUIRED');end if;
 end if;
 if p_action='accept_offer' then choice:=public.block2_choice(p_payload->'fulfillment',sworn);end if;
 result:=public.block2_base_command_core(p_command,p_action,p_target,p_revision,p_payload);
 if p_action='accept_offer' then
  select f.choice into prior from public.block2_fulfillments f where request_id=p_target;
  if found then perform public.quote_assert(prior=choice,'COMMAND_CONFLICT');else
   insert into public.block2_fulfillments(request_id,choice) values(p_target,choice);
   if choice->>'method' in ('email','usb') then
    insert into public.block2_mock_mail(request_id,destination,kind,state,content)
    select p_target,email,case choice->>'method' when 'email' then 'final_file_email_requested' else 'usb_password_email_requested' end,
      case when not (select notifications_enabled from public.quote_settings) then 'suppressed' when choice->>'method'='email' then 'waiting_for_final_file' else 'waiting_for_encrypted_usb_preparation' end,
      jsonb_build_object('mockOnly',true,'requestId',p_target,'fulfillment',choice,'fileAttached',false,'passwordGenerated',false,'sent',false)
    from auth.users where id=q.customer_id;
   end if;
  end if;
 end if;return result;
end $$;
alter function public.block15_detail(uuid) rename to block2_base_detail;
create function public.block15_detail(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb;begin
 d:=public.block2_base_detail(p_id);
 d:=d||jsonb_build_object('submitted',exists(select 1 from public.block2_submissions where request_id=p_id),'fulfillment',(select choice from public.block2_fulfillments where request_id=p_id));
 return d;
end $$;
do $$ declare f record;begin
 for f in select oid::regprocedure fn from pg_proc where pronamespace='public'::regnamespace and proname like 'block2_%' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.fn);end loop;
end $$;
grant execute on function public.block2_capture(uuid,jsonb,jsonb,boolean),public.block2_submit(uuid),public.block2_upload_check(uuid),public.block2_credentials_list(),public.block2_credential_file(uuid),public.block2_review_credential(uuid,uuid,bigint,text,text),public.block15_detail(uuid) to authenticated;
revoke all on function public.quote_command_core(uuid,text,uuid,bigint,jsonb),public.quote_provider_check(uuid,jsonb,uuid,boolean) from public,anon,authenticated,service_role;
