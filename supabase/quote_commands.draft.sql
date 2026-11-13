-- LOCAL REVIEW ONLY. Loaded solely by the disposable fixture runner.
-- Public entry points remain disabled by quote_settings. No capture or mail adapter.
begin;

create function public.quote_assert(ok boolean, code text default 'INVALID_INPUT') returns void
language plpgsql set search_path='' as $$ begin if ok is distinct from true then raise exception '%',code; end if; end; $$;
create function public.quote_object(v jsonb, allowed text[]) returns void
language plpgsql set search_path='' as $$
begin
 perform public.quote_assert(jsonb_typeof(v)='object');
 perform public.quote_assert(not exists(select 1 from jsonb_object_keys(v) k where not k=any(allowed)));
end; $$;
create function public.quote_text(v jsonb, maximum integer default 8000) returns text
language plpgsql immutable set search_path='' as $$
declare t text;
begin
 perform public.quote_assert(jsonb_typeof(v)='string'); t:=btrim(v#>>'{}');
 perform public.quote_assert(length(t) between 1 and maximum); return normalize(t,NFC);
end; $$;
create function public.quote_integer(v jsonb, minimum bigint default 1, maximum bigint default 999999999999) returns bigint
language plpgsql immutable set search_path='' as $$
declare n numeric;
begin
 perform public.quote_assert(jsonb_typeof(v)='number'); n:=(v#>>'{}')::numeric;
 perform public.quote_assert(n=trunc(n) and n between minimum and maximum); return n::bigint;
end; $$;
create function public.quote_canonical(v jsonb) returns text
language plpgsql immutable set search_path='' as $$
declare result text;
begin
 case jsonb_typeof(v)
 when 'object' then select '{'||coalesce(string_agg(to_jsonb(key)::text||':'||public.quote_canonical(value),',' order by key collate "C"),'')||'}' into result from jsonb_each(v);
 when 'array' then select '['||coalesce(string_agg(public.quote_canonical(value),',' order by ord),'')||']' into result from jsonb_array_elements(v) with ordinality as a(value,ord);
 when 'number' then perform public.quote_integer(v,-9007199254740991,9007199254740991); result:=trunc((v#>>'{}')::numeric)::text;
 when 'string' then result:=v::text;
 when 'boolean' then result:=v::text;
 when 'null' then result:='null';
 else raise exception 'INVALID_INPUT';
 end case; return result;
end; $$;
create function public.quote_digest(v jsonb) returns text language sql immutable set search_path='' as $$
 select encode(sha256(convert_to(public.quote_canonical(v),'UTF8')),'hex'); $$;
create function public.quote_instant(v jsonb) returns timestamptz language plpgsql immutable set search_path='' as $$
declare t text; ts timestamptz;
begin
 t:=public.quote_text(v,30);
 perform public.quote_assert(t ~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$');
 ts:=t::timestamptz;
 perform public.quote_assert(to_char(ts at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')=t);
 return ts;
end; $$;

-- Snapshot generated from unchanged learn/currencies.mjs at cc95f5a.
create function public.quote_currency_digits(code text) returns smallint language sql immutable set search_path='' as $$
 select ('{"AED":2,"AFN":2,"ALL":2,"AMD":2,"AOA":2,"ARS":2,"AUD":2,"AWG":2,"AZN":2,"BAM":2,"BBD":2,"BDT":2,"BHD":3,"BIF":0,"BMD":2,"BND":2,"BOB":2,"BOV":2,"BRL":2,"BSD":2,"BTN":2,"BWP":2,"BYN":2,"BZD":2,"CAD":2,"CDF":2,"CHE":2,"CHF":2,"CHW":2,"CLF":4,"CLP":0,"CNY":2,"COP":2,"COU":2,"CRC":2,"CUP":2,"CVE":2,"CZK":2,"DJF":0,"DKK":2,"DOP":2,"DZD":2,"EGP":2,"ERN":2,"ETB":2,"EUR":2,"FJD":2,"FKP":2,"GBP":2,"GEL":2,"GHS":2,"GIP":2,"GMD":2,"GNF":0,"GTQ":2,"GYD":2,"HKD":2,"HNL":2,"HTG":2,"HUF":2,"IDR":2,"ILS":2,"INR":2,"IQD":3,"IRR":2,"ISK":0,"JMD":2,"JOD":3,"JPY":0,"KES":2,"KGS":2,"KHR":2,"KMF":0,"KPW":2,"KRW":0,"KWD":3,"KYD":2,"KZT":2,"LAK":2,"LBP":2,"LKR":2,"LRD":2,"LSL":2,"LYD":3,"MAD":2,"MDL":2,"MGA":2,"MKD":2,"MMK":2,"MNT":2,"MOP":2,"MRU":2,"MUR":2,"MVR":2,"MWK":2,"MXN":2,"MXV":2,"MYR":2,"MZN":2,"NAD":2,"NGN":2,"NIO":2,"NOK":2,"NPR":2,"NZD":2,"OMR":3,"PAB":2,"PEN":2,"PGK":2,"PHP":2,"PKR":2,"PLN":2,"PYG":0,"QAR":2,"RON":2,"RSD":2,"RUB":2,"RWF":0,"SAR":2,"SBD":2,"SCR":2,"SDG":2,"SEK":2,"SGD":2,"SHP":2,"SLE":2,"SOS":2,"SRD":2,"SSP":2,"STN":2,"SVC":2,"SYP":2,"SZL":2,"THB":2,"TJS":2,"TMT":2,"TND":3,"TOP":2,"TRY":2,"TTD":2,"TWD":2,"TZS":2,"UAH":2,"UGX":0,"USD":2,"USN":2,"UYI":0,"UYU":2,"UYW":4,"UZS":2,"VED":2,"VES":2,"VND":0,"VUV":0,"WST":2,"XAD":2,"XAF":0,"XCD":2,"XCG":2,"XOF":0,"XPF":0,"YER":2,"ZAR":2,"ZMW":2,"ZWG":2}'::jsonb ->> code)::smallint; $$;
create function public.quote_money(v jsonb, budget boolean default false) returns jsonb language plpgsql immutable set search_path='' as $$
declare n bigint; c text; d smallint;
begin
 perform public.quote_object(v,array['minor','currency']);
 n:=public.quote_integer(v->'minor',case when budget then 0 else 1 end); c:=public.quote_text(v->'currency',3); d:=public.quote_currency_digits(c);
 perform public.quote_assert(d is not null,'INVALID_CURRENCY'); return jsonb_build_object('minor',n,'currency',c,'digits',d);
end; $$;
create function public.quote_scope(v jsonb) returns jsonb language plpgsql set search_path='' as $$
declare s text; src text; dst text; result jsonb; i jsonb; z text; c jsonb; b jsonb;
begin
 perform public.quote_object(v,array['service','source','target','description','budget','interpretation','certified']);
 s:=public.quote_text(v->'service',100); src:=public.quote_text(v->'source',100); dst:=public.quote_text(v->'target',100);
 perform public.quote_assert(s=any(array['Document Translation','Certified / Sworn Translation','Interpretation','Business Translation','Website & Digital Translation','Other Language Service']),'INVALID_SERVICE');
 perform public.quote_assert(lower(normalize(src,NFKC))<>lower(normalize(dst,NFKC)) and lower(src)<>'other' and lower(dst)<>'other','INVALID_LANGUAGE_PAIR');
 result:=jsonb_build_object('service',s,'source',src,'target',dst,'description',public.quote_text(v->'description'));
 if v ? 'budget' then b:=public.quote_money(v->'budget',true)-'digits'; result:=result||jsonb_build_object('budget',b); end if;
 if s='Interpretation' then
  i:=v->'interpretation'; perform public.quote_object(i,array['mode','location','startsAt','timeZone','durationMinutes']);
  perform public.quote_assert(i->>'mode'=any(array['remote','in_person'])); z:=public.quote_text(i->'timeZone',100);
  perform public.quote_assert((z='UTC' or position('/' in z)>0) and exists(select 1 from pg_catalog.pg_timezone_names where name=z),'INVALID_TIME_ZONE');
  perform public.quote_instant(i->'startsAt'); perform public.quote_integer(i->'durationMinutes',1,1440); perform public.quote_text(i->'location',500);
  result:=result||jsonb_build_object('interpretation',jsonb_build_object('mode',i->>'mode','location',public.quote_text(i->'location',500),'startsAt',i->>'startsAt','timeZone',z,'durationMinutes',public.quote_integer(i->'durationMinutes',1,1440)));
 else perform public.quote_assert(not v ? 'interpretation'); end if;
 if s='Certified / Sworn Translation' then
  c:=v->'certified'; perform public.quote_object(c,array['receivingAuthority','jurisdiction','requirements']);
  perform public.quote_text(c->'receivingAuthority',500); perform public.quote_text(c->'jurisdiction',200); perform public.quote_text(c->'requirements',2000);
  result:=result||jsonb_build_object('certified',jsonb_build_object('receivingAuthority',public.quote_text(c->'receivingAuthority',500),'jurisdiction',public.quote_text(c->'jurisdiction',200),'requirements',public.quote_text(c->'requirements',2000)));
 else perform public.quote_assert(not v ? 'certified'); end if;
 return result;
end; $$;
create function public.quote_capabilities(v jsonb) returns jsonb language plpgsql set search_path='' as $$
declare d jsonb; c text; result jsonb; n integer;
begin
 perform public.quote_object(v,array['services','directions','currencies','availability','specialAssessment']);
 perform public.quote_assert(jsonb_typeof(v->'services')='array' and jsonb_array_length(v->'services') between 1 and 6);
 for c in select jsonb_array_elements_text(v->'services') loop
  perform public.quote_assert(c=any(array['Document Translation','Certified / Sworn Translation','Interpretation','Business Translation','Website & Digital Translation','Other Language Service']));
 end loop;
 perform public.quote_assert(jsonb_typeof(v->'directions')='array' and jsonb_array_length(v->'directions') between 1 and 50);
 for d in select jsonb_array_elements(v->'directions') loop
  perform public.quote_object(d,array['source','target']);
  perform public.quote_assert(lower(normalize(public.quote_text(d->'source',100),NFKC))<>lower(normalize(public.quote_text(d->'target',100),NFKC)));
 end loop;
 perform public.quote_assert(jsonb_typeof(v->'currencies')='array' and jsonb_array_length(v->'currencies') between 1 and 20);
 for c in select jsonb_array_elements_text(v->'currencies') loop perform public.quote_assert(public.quote_currency_digits(c) is not null,'INVALID_CURRENCY'); end loop;
 perform public.quote_text(v->'availability',1000); perform public.quote_text(v->'specialAssessment',2000);
 -- Same canonical ordering as the shared JavaScript capability contract.
 select jsonb_build_object('services',(select jsonb_agg(x order by x collate "C") from (select distinct jsonb_array_elements_text(v->'services') x) a),
 'directions',(select jsonb_agg(x order by public.quote_canonical(x) collate "C") from (select jsonb_build_object('source',public.quote_text(pair.item->'source',100),'target',public.quote_text(pair.item->'target',100)) x from jsonb_array_elements(v->'directions') pair(item)) dirs),
 'currencies',(select jsonb_agg(x order by x collate "C") from (select distinct jsonb_array_elements_text(v->'currencies') x) a),
 'availability',public.quote_text(v->'availability',1000),'specialAssessment',public.quote_text(v->'specialAssessment',2000)) into result;
 return result;
end; $$;
create function public.quote_verified(person uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=person and email is not null and email_confirmed_at is not null and is_anonymous=false); $$;
create function public.quote_staff(person uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.quote_verified(person) and exists(select 1 from public.learning_review_staff where user_id=person); $$;
create function public.quote_excluded(person uuid, application uuid default null, intake uuid default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare excluded boolean;
begin
 if exists(select 1 from public.learning_review_exclusions where user_id=person)
 or exists(select 1 from public.vendor_test_fixtures f join public.vendor_applications a on a.id=f.application_id where a.user_id=person or f.application_id=application)
 or exists(select 1 from public.quote_test_registry t where t.user_id=person or t.application_id=application or t.intake_id=intake
 or exists(select 1 from public.vendor_applications a where a.id=t.application_id and a.user_id=person)) then return true; end if;
 -- The older operational translation register is external to this checkout.
 -- Consult it when installed; malformed/inaccessible installed registers fail closed.
 if to_regclass('public.translation_exclusions') is not null then
  execute 'select exists(select 1 from public.translation_exclusions where user_id=$1)' into excluded using person;
  if excluded then return true; end if;
 end if;
 return false;
end; $$;
create function public.quote_policy(version_name text, hash text, policy_kind text) returns public.quote_policies
language plpgsql security definer set search_path='' as $$
declare p public.quote_policies;
begin
 select * into p from public.quote_policies where version=version_name and digest=hash and kind=policy_kind and approved_at is not null for share;
 perform public.quote_assert(found,'POLICY_NOT_APPROVED'); return p;
end; $$;
create function public.quote_provider_check(readiness uuid, request_scope jsonb default null, customer uuid default null, enabled boolean default true) returns public.quote_provider_readiness
language plpgsql security definer set search_path='' as $$
declare r public.quote_provider_readiness; a public.vendor_applications; u auth.users; ack public.quote_provider_acknowledgements; latest uuid;
begin
 select * into r from public.quote_provider_readiness where id=readiness for update;
 perform public.quote_assert(found,'PROVIDER_INELIGIBLE');
 select * into a from public.vendor_applications where id=r.application_id for share;
 select * into u from auth.users where id=r.provider_id for share;
 perform public.quote_assert(a.status='approved' and a.category='translation' and a.is_test=false and a.revision=r.application_revision
 and a.user_id=r.provider_id and lower(a.email)=lower(u.email) and public.quote_verified(r.provider_id)
 and r.provider_id is distinct from customer and r.reviewer_id<>r.provider_id and not public.quote_excluded(r.provider_id,a.id),'PROVIDER_INELIGIBLE');
 select id into latest from public.vendor_application_events where application_id=a.id order by created_at desc,id desc limit 1;
 perform public.quote_assert(latest=r.approval_event_id and exists(select 1 from public.vendor_application_events where id=latest and kind='approved'),'PROVIDER_INELIGIBLE');
 if enabled then
  perform public.quote_assert(r.state='enabled','PROVIDER_INELIGIBLE');
  select * into ack from public.quote_provider_acknowledgements where readiness_id=r.id;
  perform public.quote_assert(ack.provider_id=r.provider_id and ack.capability_digest=r.capability_digest and ack.policy_id=r.policy_id
   and exists(select 1 from public.quote_policies where id=ack.policy_id and digest=ack.policy_digest and kind='participation' and approved_at is not null),'PROVIDER_INELIGIBLE');
 end if;
 if request_scope is not null then
  perform public.quote_assert(r.capabilities->'services' ? (request_scope->>'service') and exists(select 1 from jsonb_array_elements(r.capabilities->'directions') d where d->>'source'=request_scope->>'source' and d->>'target'=request_scope->>'target'),'PROVIDER_INELIGIBLE');
 end if;
 return r;
end; $$;
create function public.quote_can_read(request uuid, person uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.quote_verified(person) and exists(select 1 from public.quote_requests q where q.id=request and
 (q.customer_id=person or public.quote_staff(person) or exists(select 1 from public.quote_assignments a where a.request_id=q.id and a.provider_id=person and a.state in ('invited','accepted')))); $$;
-- Private transaction core. Only the owner may execute it. A disposable fixture
-- installs its own shim; no production bypass parameter or test flag exists.
create function public.quote_command_core(p_command uuid,p_action text,p_target uuid,p_revision bigint,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); q public.quote_requests; r public.quote_provider_readiness; a public.quote_assignments;
 o public.quote_offers; policy public.quote_policies; app public.vendor_applications; intake public.service_intakes;
 saved public.quote_commands; h text; result jsonb; eid uuid:=gen_random_uuid(); new_id uuid; rev bigint;
 is_readiness boolean; sc jsonb; cap jsonb; content jsonb; total jsonb; expires timestamptz;
 owner_ok boolean; recipient uuid; recipients uuid[]:='{}'; agg text; classification text; old_r public.quote_provider_readiness;
begin
 perform public.quote_assert(p_command is not null and p_target is not null and p_revision>=0 and p_action is not null and jsonb_typeof(p_payload)='object' and octet_length(p_payload::text)<=40000);
 -- Pilot-volume mutex gives a fixed lock order across request/readiness commands.
 -- Existing vendor decisions serialize through their actual vendor row lock below.
 perform pg_catalog.pg_advisory_xact_lock(788601,1);
 perform 1 from public.learning_review_staff where user_id=actor for share;
 perform 1 from auth.users where id=actor for share;
 perform public.quote_assert(public.quote_verified(actor),'UNAVAILABLE');
 is_readiness:=p_action=any(array['propose_readiness','acknowledge_participation','enable_readiness','close_readiness']);
 if is_readiness then
  select * into r from public.quote_provider_readiness where id=p_target for update;
  perform public.quote_assert((r.id is not null and (r.provider_id=actor or public.quote_staff(actor))) or (p_action='propose_readiness' and public.quote_staff(actor)),'UNAVAILABLE');
 elsif p_action='enroll_request' then
  perform public.quote_assert(public.quote_staff(actor),'UNAVAILABLE');
  select * into q from public.quote_requests where id=p_target for update;
 else
  select * into q from public.quote_requests where id=p_target for update;
  perform public.quote_assert(public.quote_can_read(p_target,actor) or (p_action='report_concern' and exists(select 1 from public.quote_assignments where request_id=p_target and provider_id=actor)),'UNAVAILABLE');
 end if;
 h:=public.quote_digest(jsonb_build_object('actorId',actor,'commandId',p_command,'action',p_action,'targetId',p_target,'expectedRevision',p_revision,'payload',p_payload));
 select * into saved from public.quote_commands where id=p_command;
 if found then
  perform public.quote_assert(saved.actor_id=actor and saved.input_hash=h,'COMMAND_CONFLICT'); return saved.result;
 end if;
 perform public.quote_assert(coalesce(case when is_readiness then r.revision else q.revision end,0)=p_revision,'STALE_REVISION');
 if (select count(*) from public.quote_commands where actor_id=actor and created_at>clock_timestamp()-interval '1 minute')>=60 then raise exception 'COMMAND_LIMIT'; end if;
 if is_readiness then
  agg:='readiness';
  case p_action
  when 'propose_readiness' then
   perform public.quote_object(p_payload,array['applicationId','capabilities','policyVersion','policyDigest']);
   perform public.quote_assert(public.quote_staff(actor) and r.id is null,'STAFF_REQUIRED');
   select * into app from public.vendor_applications where id=(p_payload->>'applicationId')::uuid for share;
   perform public.quote_assert(app.id is not null and app.user_id<>actor,'SELF_REVIEW_DENIED');
   policy:=public.quote_policy(p_payload->>'policyVersion',p_payload->>'policyDigest','participation');
   cap:=public.quote_capabilities(p_payload->'capabilities');
   select id into new_id from public.vendor_application_events where application_id=app.id order by created_at desc,id desc limit 1;
   insert into public.quote_provider_readiness(id,provider_id,application_id,application_revision,approval_event_id,version,capabilities,capability_digest,policy_id,reviewer_id)
   values(p_target,app.user_id,app.id,app.revision,new_id,(select coalesce(max(version),0)+1 from public.quote_provider_readiness where provider_id=app.user_id),cap,public.quote_digest(cap),policy.id,actor);
   r:=public.quote_provider_check(p_target,null,null,false); rev:=1;
  when 'acknowledge_participation' then
   perform public.quote_object(p_payload,array['capabilityDigest','policyVersion','policyDigest','language']);
   perform public.quote_assert(actor=r.provider_id and r.state='proposed','UNAVAILABLE');
   r:=public.quote_provider_check(r.id,null,null,false);
   policy:=public.quote_policy(p_payload->>'policyVersion',p_payload->>'policyDigest','participation');
   perform public.quote_assert(policy.id=r.policy_id and p_payload->>'capabilityDigest'=r.capability_digest and p_payload->>'language'=any(array['en','fr','ar','es']),'EXACT_ACKNOWLEDGEMENT_REQUIRED');
   insert into public.quote_provider_acknowledgements(readiness_id,provider_id,capability_digest,policy_id,policy_digest,language)
   values(r.id,actor,r.capability_digest,policy.id,policy.digest,p_payload->>'language');
   update public.quote_provider_readiness set state='acknowledged',revision=revision+1 where id=r.id returning revision into rev;
  when 'enable_readiness' then
   perform public.quote_object(p_payload,array[]::text[]);
   perform public.quote_assert(public.quote_staff(actor) and actor<>r.provider_id,'STAFF_REQUIRED');
   perform public.quote_assert(r.state='acknowledged','INVALID_STATE');
   r:=public.quote_provider_check(r.id,null,null,false);
   -- Replacement closes the old version and records its own revision/event.
   for old_r in select * from public.quote_provider_readiness where provider_id=r.provider_id and state='enabled' and id<>r.id order by id for update loop
    update public.quote_provider_readiness set state='closed',closed_at=clock_timestamp(),revision=revision+1 where id=old_r.id;
    insert into public.quote_events(aggregate_type,aggregate_id,revision,actor_id,kind) values('readiness',old_r.id,old_r.revision+1,actor,'readiness_replaced');
   end loop;
   update public.quote_provider_readiness set state='enabled',enabled_at=clock_timestamp(),revision=revision+1 where id=r.id returning revision into rev;
   r:=public.quote_provider_check(r.id);
  when 'close_readiness' then
   perform public.quote_object(p_payload,array['reason']); perform public.quote_text(p_payload->'reason',2000);
   perform public.quote_assert(public.quote_staff(actor) and actor<>r.provider_id,'STAFF_REQUIRED');
   perform public.quote_assert(r.state in ('proposed','acknowledged','enabled'),'INVALID_STATE');
   update public.quote_provider_readiness set state='closed',closed_at=clock_timestamp(),revision=revision+1 where id=r.id returning revision into rev;
  end case;
  recipients:=array[r.provider_id];
 else
  agg:='request'; owner_ok:=public.quote_staff(actor) and q.owner_id=actor;
  select * into a from public.quote_assignments where request_id=q.id and state in ('invited','accepted') for update;
  if p_action not in ('enroll_request','cancel_request','report_concern') then perform public.quote_assert(q.state='open','INVALID_STATE'); end if;
  case p_action
  when 'enroll_request' then
   perform public.quote_object(p_payload,array['intakeId']);
   perform public.quote_assert(q.id is null and public.quote_staff(actor),'UNAVAILABLE');
   select * into intake from public.service_intakes where id=(p_payload->>'intakeId')::uuid for share;
   perform public.quote_assert(intake.kind='translation' and public.quote_verified(intake.user_id) and exists(select 1 from auth.users where id=intake.user_id and lower(email)=lower(intake.email)),'VERIFIED_REQUEST_REQUIRED');
   select c.classification into classification from public.quote_intake_classifications c where c.intake_id=intake.id order by c.created_at desc,c.id desc limit 1;
   perform public.quote_assert(classification in ('test','production'),'CLASSIFICATION_REQUIRED');
   perform public.quote_assert(jsonb_typeof(intake.fields->'quote_scope_v1')='object','CANONICAL_RECEIPT_SCOPE_REQUIRED');
   sc:=public.quote_scope(intake.fields->'quote_scope_v1');
   insert into public.quote_requests(id,intake_id,customer_id,is_test) values(p_target,intake.id,intake.user_id,classification='test' or public.quote_excluded(intake.user_id,null,intake.id));
   insert into public.quote_request_versions(request_id,version,scope,digest,author_id) values(p_target,1,sc,public.quote_digest(sc),intake.user_id);
   rev:=1; -- Enrollment is not a new receipt and creates no quote email.
  when 'claim_request' then
   perform public.quote_object(p_payload,array[]::text[]); perform public.quote_assert(public.quote_staff(actor) and q.owner_id is null,'STAFF_REQUIRED');
   update public.quote_requests set owner_id=actor where id=q.id;
  when 'transfer_owner' then
   perform public.quote_object(p_payload,array['ownerId']); perform public.quote_assert(owner_ok,'STAFF_OWNER_REQUIRED');
   perform 1 from public.learning_review_staff where user_id=(p_payload->>'ownerId')::uuid for share;
   perform public.quote_assert(public.quote_staff((p_payload->>'ownerId')::uuid),'STAFF_REQUIRED');
   update public.quote_requests set owner_id=(p_payload->>'ownerId')::uuid where id=q.id;
  when 'invite_provider' then
   perform public.quote_object(p_payload,array['readinessId']); perform public.quote_assert(owner_ok,'STAFF_OWNER_REQUIRED');
   select scope into sc from public.quote_request_versions where request_id=q.id and version=q.scope_version;
   r:=public.quote_provider_check((p_payload->>'readinessId')::uuid,sc,q.customer_id);
   update public.quote_assignments set state='revoked',reason='reassigned' where request_id=q.id and state in ('invited','accepted');
   update public.quote_offers set state='withdrawn' where request_id=q.id and state='offered';
   insert into public.quote_assignments(request_id,readiness_id,provider_id,scope_version) values(q.id,r.id,r.provider_id,q.scope_version) returning id into new_id;
   recipients:=array[r.provider_id];
  when 'respond_assignment' then
   perform public.quote_object(p_payload,array['assignmentId','response']);
   perform public.quote_assert(a.id=(p_payload->>'assignmentId')::uuid and a.provider_id=actor and a.state='invited' and a.scope_version=q.scope_version,'UNAVAILABLE');
   perform public.quote_assert(p_payload->>'response' in ('accepted','declined'));
   select scope into sc from public.quote_request_versions where request_id=q.id and version=q.scope_version;
   r:=public.quote_provider_check(a.readiness_id,sc,q.customer_id);
   update public.quote_assignments set state=p_payload->>'response',responded_at=clock_timestamp() where id=a.id;
   recipients:=array[q.owner_id];
  when 'revoke_assignment' then
   perform public.quote_object(p_payload,array['reason']); perform public.quote_assert(owner_ok,'STAFF_OWNER_REQUIRED');
   perform public.quote_assert(a.id is not null,'UNAVAILABLE');
   update public.quote_assignments set state='revoked',reason=public.quote_text(p_payload->'reason',2000) where id=a.id;
   update public.quote_offers set state='withdrawn' where request_id=q.id and state='offered'; recipients:=array[a.provider_id,q.customer_id];
  when 'revise_scope' then
   perform public.quote_object(p_payload,array['scope']); perform public.quote_assert(q.customer_id=actor,'CUSTOMER_REQUIRED'); sc:=public.quote_scope(p_payload->'scope');
   update public.quote_offers set state='withdrawn' where request_id=q.id and state='offered';
   update public.quote_assignments set state='ended',reason='scope_changed' where request_id=q.id and state in ('invited','accepted');
   insert into public.quote_request_versions(request_id,version,scope,digest,author_id) values(q.id,q.scope_version+1,sc,public.quote_digest(sc),actor);
   update public.quote_requests set scope_version=scope_version+1 where id=q.id;
   if a.id is not null then
    begin
     r:=public.quote_provider_check(a.readiness_id,sc,q.customer_id);
     insert into public.quote_assignments(request_id,readiness_id,provider_id,scope_version) values(q.id,r.id,r.provider_id,q.scope_version+1) returning id into new_id;
     recipients:=array[q.owner_id,r.provider_id];
    exception when raise_exception then
     if sqlerrm<>'PROVIDER_INELIGIBLE' then raise; end if;
     recipients:=array[q.owner_id];
    end;
   end if;
  when 'issue_offer' then
   perform public.quote_object(p_payload,array['assignmentId','content']);
   perform public.quote_assert(a.id=(p_payload->>'assignmentId')::uuid and a.provider_id=actor and a.state='accepted' and a.scope_version=q.scope_version,'UNAVAILABLE');
   select scope into sc from public.quote_request_versions where request_id=q.id and version=q.scope_version;
   r:=public.quote_provider_check(a.readiness_id,sc,q.customer_id); content:=p_payload->'content';
   perform public.quote_object(content,array['scope','exclusions','total','turnaround','revisions','expiresAt','policyVersion','policyDigest','taxTreatment','chargesIncluded']);
   perform public.quote_text(content->'scope'); perform public.quote_text(content->'exclusions'); perform public.quote_text(content->'turnaround',2000);
   perform public.quote_text(content->'taxTreatment',1000); perform public.quote_integer(content->'revisions',0,100);
   perform public.quote_assert(content->'chargesIncluded'='true'::jsonb,'TOTAL_MUST_INCLUDE_CHARGES');
   total:=public.quote_money(content->'total'); perform public.quote_assert(r.capabilities->'currencies' ? (total->>'currency'),'INVALID_CURRENCY');
   expires:=public.quote_instant(content->'expiresAt'); perform public.quote_assert(expires>clock_timestamp(),'OFFER_EXPIRED');
   policy:=public.quote_policy(content->>'policyVersion',content->>'policyDigest','acceptance');
   content:=jsonb_build_object('scope',public.quote_text(content->'scope'),'exclusions',public.quote_text(content->'exclusions'),'total',total,'turnaround',public.quote_text(content->'turnaround',2000),'revisions',public.quote_integer(content->'revisions',0,100),'expiresAt',content->>'expiresAt','policyVersion',policy.version,'policyDigest',policy.digest,'taxTreatment',public.quote_text(content->'taxTreatment',1000),'chargesIncluded',true); new_id:=gen_random_uuid();
   update public.quote_offers set state='superseded' where request_id=q.id and state='offered';
   select coalesce(max(version),0)+1 into rev from public.quote_offers where request_id=q.id;
   insert into public.quote_offers(id,request_id,assignment_id,provider_id,scope_version,version,content,total_minor,currency,currency_digits,expires_at,policy_id,digest)
   values(new_id,q.id,a.id,actor,q.scope_version,rev,content,(total->>'minor')::bigint,total->>'currency',(total->>'digits')::smallint,expires,policy.id,
   public.quote_digest(jsonb_build_object('id',new_id,'assignmentId',a.id,'providerId',actor,'version',rev,'scopeVersion',q.scope_version,'content',content)));
   recipients:=array[q.customer_id,q.owner_id];
  when 'accept_offer','decline_offer','withdraw_offer' then
   if p_action='accept_offer' then perform public.quote_object(p_payload,array['offerId','offerDigest','policyVersion','policyDigest','language']);
   elsif p_action='decline_offer' then perform public.quote_object(p_payload,array['offerId']);
   else perform public.quote_object(p_payload,array['offerId','reason']); perform public.quote_text(p_payload->'reason',2000); end if;
   select * into o from public.quote_offers where id=(p_payload->>'offerId')::uuid and request_id=q.id for update;
   perform public.quote_assert(o.state='offered' and o.assignment_id=a.id and a.state='accepted' and o.scope_version=q.scope_version,'OFFER_UNAVAILABLE');
   if p_action='withdraw_offer' then
    perform public.quote_assert(actor=o.provider_id or owner_ok,'UNAVAILABLE');
    update public.quote_offers set state='withdrawn' where id=o.id; recipients:=array[q.customer_id,q.owner_id];
   else
    perform public.quote_assert(actor=q.customer_id,'CUSTOMER_REQUIRED');
    if p_action='decline_offer' then update public.quote_offers set state='declined' where id=o.id; recipients:=array[a.provider_id,q.owner_id];
    else
     perform public.quote_assert(o.digest=p_payload->>'offerDigest' and o.content->>'policyVersion'=p_payload->>'policyVersion'
      and o.content->>'policyDigest'=p_payload->>'policyDigest' and p_payload->>'language' in ('en','fr','ar','es'),'EXACT_ACCEPTANCE_REQUIRED');
     select scope into sc from public.quote_request_versions where request_id=q.id and version=q.scope_version;
     r:=public.quote_provider_check(a.readiness_id,sc,q.customer_id);
     policy:=public.quote_policy(p_payload->>'policyVersion',p_payload->>'policyDigest','acceptance');
     -- clock_timestamp is checked AFTER all eligibility locks, not transaction-start now().
     perform public.quote_assert(o.expires_at>clock_timestamp(),'OFFER_EXPIRED');
     insert into public.quote_acceptances(request_id,offer_id,actor_id,offer_digest,policy_id,policy_digest,language)
      values(q.id,o.id,actor,o.digest,policy.id,policy.digest,p_payload->>'language');
     update public.quote_offers set state='accepted' where id=o.id;
     update public.quote_requests set state='accepted_pending_activation',accepted_offer_id=o.id where id=q.id;
     recipients:=array[q.customer_id,q.owner_id,a.provider_id];
    end if;
   end if;
  when 'cancel_request','close_unfulfilled' then
   perform public.quote_object(p_payload,array['reason','communication']); perform public.quote_text(p_payload->'reason',2000);
   perform public.quote_assert(q.state in ('open','accepted_pending_activation'),'INVALID_STATE');
   if p_action='close_unfulfilled' then perform public.quote_assert(owner_ok and q.state='open','STAFF_OWNER_REQUIRED');
   elsif actor<>q.customer_id then perform public.quote_assert(owner_ok,'STAFF_OWNER_REQUIRED'); perform public.quote_text(p_payload->'communication',2000); end if;
   update public.quote_assignments set state='ended',reason=p_payload->>'reason' where request_id=q.id and state in ('invited','accepted');
   update public.quote_offers set state='withdrawn' where request_id=q.id and state='offered';
   update public.quote_requests set state=case p_action when 'cancel_request' then 'cancelled' else 'closed_unfulfilled' end,closed_at=clock_timestamp() where id=q.id;
   recipients:=array[q.customer_id,q.owner_id,a.provider_id];
  when 'ask_information','reply_information','report_concern' then
   if p_action='ask_information' then
    perform public.quote_object(p_payload,array['audience','body']); perform public.quote_assert(owner_ok,'STAFF_OWNER_REQUIRED');
    perform public.quote_assert(p_payload->>'audience' in ('customer','provider'));
    recipient:=case p_payload->>'audience' when 'customer' then q.customer_id else a.provider_id end;
    perform public.quote_assert(recipient is not null,'UNAVAILABLE');
    insert into public.quote_threads(request_id,audience,participant_id) values(q.id,p_payload->>'audience',recipient) returning id into new_id;
   elsif p_action='reply_information' then
    perform public.quote_object(p_payload,array['threadId','body']);
    select id into new_id from public.quote_threads where id=(p_payload->>'threadId')::uuid and request_id=q.id and participant_id=actor and state='open' and audience<>'staff' for update;
    perform public.quote_assert(new_id is not null,'UNAVAILABLE'); update public.quote_threads set state='answered' where id=new_id; recipient:=q.owner_id;
   else
    perform public.quote_object(p_payload,array['body']);
    insert into public.quote_threads(request_id,audience,participant_id) values(q.id,'staff',actor) returning id into new_id; recipient:=q.owner_id;
   end if;
   insert into public.quote_messages(thread_id,actor_id,kind,body) values(new_id,actor,case p_action when 'ask_information' then 'question' when 'reply_information' then 'answer' else 'concern' end,public.quote_text(p_payload->'body'));
   recipients:=array[recipient];
  else raise exception 'UNSUPPORTED_COMMAND';
  end case;
  if p_action<>'enroll_request' then
   update public.quote_requests set revision=revision+1,updated_at=clock_timestamp() where id=q.id returning revision into rev;
  end if;
 end if;
 insert into public.quote_events(id,aggregate_type,aggregate_id,revision,request_id,actor_id,kind,payload)
 values(eid,agg,p_target,rev,case when agg='request' then p_target end,actor,p_action,jsonb_strip_nulls(jsonb_build_object('recordId',new_id,'reason',p_payload->>'reason','communication',p_payload->>'communication')));
 -- This draft has no dispatcher: all notifications remain suppressed, never pending.
 for recipient in select distinct x from unnest(recipients) x where x is not null loop
  new_id:=gen_random_uuid();
  insert into public.quote_deliveries(id,event_id,recipient_id,roles,idempotency_key,state,reason)
  values(new_id,eid,recipient,array['participant'],'marocora-quote/'||new_id::text,'suppressed','LOCAL_DRAFT_NO_TRANSPORT');
 end loop;
 result:=jsonb_build_object('commandId',p_command,case when is_readiness then 'readinessId' else 'requestId' end,p_target,'revision',rev,'eventId',eid,'result',p_action,'notificationState','suppressed');
 insert into public.quote_commands(id,actor_id,action,target_id,expected_revision,input_hash,result,event_id) values(p_command,actor,p_action,p_target,p_revision,h,result,eid);
 return result;
end; $$;

create function public.quote_command(p_command uuid,p_action text,p_target uuid,p_revision bigint,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.quote_assert(public.quote_verified(auth.uid()),'UNAVAILABLE');
 perform 1 from public.quote_settings where singleton and commands_enabled for share;
 perform public.quote_assert(found,'COMMANDS_DISABLED');
 return public.quote_command_core(p_command,p_action,p_target,p_revision,p_payload);
end; $$;
create function public.quote_classification_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.classification='production' then
  perform public.quote_assert(not exists(select 1 from public.quote_intake_classifications where intake_id=new.intake_id and classification='test')
   and not exists(select 1 from public.service_intakes i where i.id=new.intake_id and public.quote_excluded(i.user_id,null,i.id)),'TEST_CLASSIFICATION_PERMANENT');
 end if;
 return new;
end; $$;
create trigger quote_classification_guard before insert on public.quote_intake_classifications for each row execute function public.quote_classification_guard();
create function public.quote_readiness_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'QUOTE_HISTORY_REQUIRED'; end if;
 if (to_jsonb(new)-array['state','revision','enabled_at','closed_at']) is distinct from (to_jsonb(old)-array['state','revision','enabled_at','closed_at']) then raise exception 'QUOTE_IMMUTABLE_CAPABILITY'; end if;
 if (old.state='closed' and new.state<>'closed') or (old.state='enabled' and new.state not in ('enabled','closed')) then raise exception 'QUOTE_TERMINAL_READINESS'; end if;
 return new;
end; $$;
create trigger quote_readiness_guard before update or delete on public.quote_provider_readiness for each row execute function public.quote_readiness_guard();

create function public.quote_eligibility_hold(request uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare readiness uuid; q public.quote_requests; sc jsonb;
begin
 select * into q from public.quote_requests where id=request;
 select a.readiness_id into readiness from public.quote_assignments a where a.request_id=q.id
 and (a.state in ('invited','accepted') or a.id=(select assignment_id from public.quote_offers where id=q.accepted_offer_id)) order by a.invited_at desc,a.id desc limit 1;
 if readiness is null then return false; end if;
 select scope into sc from public.quote_request_versions where request_id=q.id and version=q.scope_version;
 return not exists(select 1 from public.quote_provider_readiness r
 join public.vendor_applications a on a.id=r.application_id join auth.users u on u.id=r.provider_id
 join public.quote_provider_acknowledgements ack on ack.readiness_id=r.id
 join public.quote_policies p on p.id=r.policy_id
 where r.id=readiness and r.state='enabled' and a.status='approved' and a.category='translation' and a.is_test=false
 and a.revision=r.application_revision and a.user_id=r.provider_id and r.provider_id<>q.customer_id
 and lower(u.email)=lower(a.email) and public.quote_verified(r.provider_id) and not public.quote_excluded(r.provider_id,a.id)
 and ack.provider_id=r.provider_id and ack.capability_digest=r.capability_digest and ack.policy_id=r.policy_id and ack.policy_digest=p.digest and p.kind='participation' and p.approved_at is not null
 and r.approval_event_id=(select id from public.vendor_application_events where application_id=a.id order by created_at desc,id desc limit 1)
 and r.capabilities->'services' ? (sc->>'service') and exists(select 1 from jsonb_array_elements(r.capabilities->'directions') d where d->>'source'=sc->>'source' and d->>'target'=sc->>'target'));
end; $$;

create function public.quote_request_detail(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quote_requests; a public.quote_assignments; actor uuid:=auth.uid(); role_name text; result jsonb;
begin
 perform public.quote_assert(public.quote_can_read(p_id,actor),'UNAVAILABLE');
 select * into q from public.quote_requests where id=p_id;
 select * into a from public.quote_assignments where request_id=q.id and state in ('invited','accepted');
 role_name:=case when public.quote_staff(actor) then 'staff' when q.customer_id=actor then 'customer' else 'provider' end;
 result:=jsonb_build_object('id',q.id,'state',q.state,'revision',q.revision,'scopeVersion',q.scope_version,'role',role_name,'eligibilityHold',public.quote_eligibility_hold(q.id));
 if role_name='provider' and a.state='invited' then
  return result||(select jsonb_build_object('invitation',jsonb_build_object('id',a.id,'scopeVersion',a.scope_version),'service',scope->>'service','source',scope->>'source','target',scope->>'target') from public.quote_request_versions where request_id=q.id and version=q.scope_version);
 end if;
 result:=result||jsonb_build_object('scope',(select scope from public.quote_request_versions where request_id=q.id and version=q.scope_version),
  'assignment',case when a.id is null then null else jsonb_build_object('id',a.id,'state',a.state,'scopeVersion',a.scope_version) end,
  'offers',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'version',o.version,'scopeVersion',o.scope_version,'content',o.content,'digest',o.digest,'state',case when o.state='offered' and o.expires_at<=clock_timestamp() then 'expired' else o.state end) order by o.version)
   from public.quote_offers o where o.request_id=q.id and (role_name<>'provider' or o.assignment_id=a.id)),'[]'::jsonb),
  'closure',(select jsonb_build_object('reason',e.payload->>'reason','at',e.created_at) from public.quote_events e where e.request_id=q.id and e.kind in ('cancel_request','close_unfulfilled') order by e.revision desc limit 1),
  'acceptance',(select jsonb_build_object('offerId',offer_id,'offerDigest',offer_digest,'policyDigest',policy_digest,'language',language,'at',created_at) from public.quote_acceptances where request_id=q.id),
  'threads',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'state',t.state,'audience',t.audience,'messages',coalesce((select jsonb_agg(jsonb_build_object('kind',m.kind,'body',m.body,'at',m.created_at) order by m.created_at,m.id) from public.quote_messages m where m.thread_id=t.id),'[]'::jsonb)) order by t.created_at,t.id)
   from public.quote_threads t where t.request_id=q.id and (role_name='staff' or (t.audience<>'staff' and t.participant_id=actor))),'[]'::jsonb));
 if role_name='staff' then result:=result||jsonb_build_object('intakeId',q.intake_id,'ownerId',q.owner_id,'isTest',q.is_test,'audit',coalesce((select jsonb_agg(jsonb_build_object('kind',e.kind,'revision',e.revision,'actorId',e.actor_id,'payload',e.payload,'at',e.created_at) order by e.revision) from public.quote_events e where e.request_id=q.id),'[]'::jsonb)); end if;
 return result;
end; $$;
create function public.quote_my_requests(p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.quote_assert(public.quote_verified(auth.uid()),'UNAVAILABLE'); perform public.quote_assert(p_limit between 1 and 100 and (p_before is null)=(p_before_id is null));
 return coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'state',q.state,'revision',q.revision,'createdAt',q.created_at) order by q.created_at desc,q.id desc) from
 (select * from public.quote_requests where customer_id=auth.uid() and (p_before is null or (created_at,id)<(p_before,p_before_id)) order by created_at desc,id desc limit p_limit) q),'[]');
end; $$;
create function public.quote_provider_assignments(p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.quote_assert(public.quote_verified(auth.uid()),'UNAVAILABLE'); perform public.quote_assert(p_limit between 1 and 100 and (p_before is null)=(p_before_id is null));
 return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'requestId',a.request_id,'state',a.state,'scopeVersion',a.scope_version,'invitedAt',a.invited_at) order by a.invited_at desc,a.id desc) from
 (select * from public.quote_assignments where provider_id=auth.uid() and state in ('invited','accepted') and (p_before is null or (invited_at,id)<(p_before,p_before_id)) order by invited_at desc,id desc limit p_limit) a),'[]');
end; $$;
create function public.quote_my_readiness() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.quote_assert(public.quote_verified(auth.uid()),'UNAVAILABLE');
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'revision',r.revision,'version',r.version,'state',r.state,'capabilities',r.capabilities,'capabilityDigest',r.capability_digest,'policyVersion',p.version,'policyDigest',p.digest) order by r.version desc)
 from (select * from public.quote_provider_readiness where provider_id=auth.uid() order by version desc limit 100) r join public.quote_policies p on p.id=r.policy_id),'[]');
end; $$;
create function public.quote_staff_queue(p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.quote_assert(public.quote_staff(auth.uid()),'UNAVAILABLE'); perform public.quote_assert(p_limit between 1 and 100 and (p_before is null)=(p_before_id is null));
 return coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'state',q.state,'revision',q.revision,'ownerId',q.owner_id,'updatedAt',q.updated_at) order by q.updated_at desc,q.id desc) from
 (select * from public.quote_requests where not is_test and not public.quote_excluded(customer_id,null,intake_id)
 and exists(select 1 from public.quote_intake_classifications c where c.intake_id=quote_requests.intake_id and c.classification='production')
 and not exists(select 1 from public.quote_intake_classifications c where c.intake_id=quote_requests.intake_id and c.classification='test')
 and (p_before is null or (updated_at,id)<(p_before,p_before_id)) order by updated_at desc,id desc limit p_limit) q),'[]');
end; $$;
create function public.quote_staff_summary() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.quote_assert(public.quote_staff(auth.uid()),'UNAVAILABLE');
 return (with eligible as (select q.* from public.quote_requests q where not q.is_test and not public.quote_excluded(q.customer_id,null,q.intake_id)
 and exists(select 1 from public.quote_intake_classifications c where c.intake_id=q.intake_id and c.classification='production')
 and not exists(select 1 from public.quote_intake_classifications c where c.intake_id=q.intake_id and c.classification='test'))
 select jsonb_build_object('open',count(*) filter(where state='open'),'acceptedPendingActivation',count(*) filter(where state='accepted_pending_activation'),
 'closedUnfulfilled',count(*) filter(where state='closed_unfulfilled'),
 'awaitingCustomerResponse',count(*) filter(where state='open' and (exists(select 1 from public.quote_offers o where o.request_id=eligible.id and o.state='offered' and o.expires_at>clock_timestamp())
 or exists(select 1 from public.quote_threads t where t.request_id=eligible.id and t.audience='customer' and t.state='open'))),
 'mailExceptions',(select count(*) from public.quote_deliveries d join public.quote_events e on e.id=d.event_id join eligible q on q.id=e.request_id where d.state in ('uncertain','failed')))
 from eligible);
end; $$;

-- No direct table grants. Helpers and core are owner-only, including for service_role.
do $$ declare f record;
begin
 for f in select p.oid::regprocedure signature from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'quote\_%' escape '\' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end; $$;
grant execute on function public.quote_command(uuid,text,uuid,bigint,jsonb),public.quote_request_detail(uuid),
 public.quote_my_requests(timestamptz,uuid,integer),public.quote_provider_assignments(timestamptz,uuid,integer),public.quote_my_readiness(),
 public.quote_staff_queue(timestamptz,uuid,integer),public.quote_staff_summary() to authenticated;
rollback;
