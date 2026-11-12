-- Keep the current status message aligned with a received applicant reply.
begin;
create or replace function public.vendor_reply(p_id uuid,p_revision bigint,p_answers jsonb,p_command uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.vendor_applications%rowtype; q jsonb; event_id uuid;
begin
 select * into a from public.vendor_applications where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and lower(email)=lower(a.email) and email_confirmed_at is not null and not is_anonymous) then raise exception 'EMAIL_VERIFICATION_REQUIRED'; end if;
 select id into event_id from public.vendor_application_events where command_id=p_command and application_id=p_id and actor_id=auth.uid();
 if event_id is not null then return jsonb_build_object('application_id',p_id,'event_id',event_id); end if;
 if p_command is null or p_revision is null then raise exception 'INVALID_ANSWERS'; end if;
 if a.revision<>p_revision or a.status<>'needs_information' then raise exception 'STALE_REVISION'; end if;
 if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>40000 then raise exception 'INVALID_ANSWERS'; end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>jsonb_array_length(a.questions) then raise exception 'INVALID_ANSWERS'; end if;
 for q in select value from jsonb_array_elements(a.questions) loop
  if jsonb_typeof(p_answers->(q->>'id')) is distinct from 'string' or length(btrim(p_answers->>(q->>'id'))) not between 1 and 6000 then raise exception 'ANSWERS_REQUIRED'; end if;
 end loop;
 update public.vendor_applications set status='pending',message='The requested additional information has been received. Your application is awaiting review.',revision=revision+1,updated_at=now() where id=p_id;
 insert into public.vendor_application_events(application_id,command_id,actor_id,kind,payload)
 values(p_id,p_command,auth.uid(),'information_received',jsonb_build_object('questions',a.questions,'answers',p_answers,'message','The requested additional information has been received. Your application is awaiting review.')) returning id into event_id;
 return jsonb_build_object('application_id',p_id,'event_id',event_id);
end; $$;

commit;
