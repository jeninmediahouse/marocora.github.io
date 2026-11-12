-- Production-safe rollback test: creates a temporary application record only.
-- Sends no emails and never reviews a real vendor/teacher profile.
begin;
do $$
declare owner_id uuid; staff_id uuid; test_id uuid:=gen_random_uuid(); cmd uuid:=gen_random_uuid(); a jsonb;
begin
 select id into owner_id from auth.users where lower(email)='computersplusnc@gmail.com' and email_confirmed_at is not null and not is_anonymous;
 select s.user_id into staff_id from public.learning_review_staff s join auth.users u on u.id=s.user_id where u.email_confirmed_at is not null and not u.is_anonymous limit 1;
 if owner_id is null or staff_id is null or owner_id=staff_id then raise exception 'TEST_IDENTITIES_REQUIRED'; end if;
 insert into public.vendor_applications(id,source,source_key,user_id,email,name,category,fields)
 values(test_id,'network','rollback-qa:'||test_id,owner_id,'computersplusnc@gmail.com','ROLLBACK QA — not an applicant','transportation','{"note":"Rollback test only"}');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 begin perform public.vendor_review_queue(test_id);raise exception 'NONSTAFF_ACCEPTED';exception when others then if sqlerrm<>'STAFF_REQUIRED' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',staff_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff_id,'role','authenticated')::text,true);
 perform public.vendor_decide(test_id,1,'needs_information','Please describe your experience.','[{"id":"q1","label":"Relevant experience?"}]','[]',cmd);
 perform public.vendor_decide(test_id,1,'needs_information','Please describe your experience.','[{"id":"q1","label":"Relevant experience?"}]','[]',cmd);
 if (select count(*) from public.vendor_application_events where application_id=test_id)<>1 then raise exception 'DUPLICATE_DECISION';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 perform public.vendor_reply(test_id,2,'{"q1":"Controlled rollback test answer"}',gen_random_uuid());
 a:=public.vendor_my_applications(test_id)->0;
 if a->>'status'<>'pending' or jsonb_array_length(a->'history')<>2 then raise exception 'FOLLOWUP_NOT_RECORDED';end if;
 perform set_config('request.jwt.claim.sub',staff_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff_id,'role','authenticated')::text,true);
 perform public.vendor_decide(test_id,3,'approved','Controlled rollback test approval only.','[]','[]',gen_random_uuid());
 a:=public.vendor_review_queue(test_id)->0;
 if a->>'status'<>'approved' then raise exception 'APPROVAL_NOT_RECORDED';end if;
 perform public.vendor_decide(test_id,4,'declined','Controlled rollback test decline only.','[]','[]',gen_random_uuid());
 a:=public.vendor_review_queue(test_id)->0;
 if a->>'status'<>'declined' then raise exception 'DECLINE_NOT_RECORDED';end if;
end; $$;
select 'PASS: nonstaff denied; decision deduplicated; tailored follow-up returned to pending; approval and decline saved; all rolled back' as result;
rollback;
