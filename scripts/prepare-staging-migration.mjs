// Export final translation objects from a disposable LOCAL compilation only.
import '../tests/fixtures/block16-network-guard.mjs';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {openLocalDatabase,root} from '../server/block1/database.mjs';
const dir=mkdtempSync(join(tmpdir(),'marocora-schema-export-'));let db;
const tables=['learning_review_staff','learning_review_exclusions','vendor_applications','vendor_application_events','service_intakes','quote_settings','quote_policies','quote_test_registry','quote_intake_classifications','quote_requests','quote_request_versions','quote_provider_readiness','quote_provider_acknowledgements','quote_assignments','quote_offers','quote_acceptances','quote_threads','quote_messages','quote_events','quote_commands','quote_deliveries','quote_delivery_evidence','block1_local_settings','block1_files','block15_scan_events','block2_submissions','block2_credential_scans','block2_credentials','block2_credential_reviews','block2_fulfillments','block2_mock_mail'];
const names={learning_review_staff:'translation_staff',learning_review_exclusions:'translation_exclusions',vendor_application_events:'translation_provider_events',vendor_applications:'translation_provider_applications',service_intakes:'translation_intakes',block1_local_settings:'translation_settings',block1_files:'translation_files',block15_scan_events:'translation_scan_events'};
const migrationTables=[...tables,'translation_staging_accounts'];
function rename(s){for(const [from,to] of Object.entries(names))s=s.replaceAll(from,to);return s.replaceAll('block1_','translation_').replaceAll('block15_','translation_scan_').replaceAll('block2_','translation_cert_').replaceAll('Isolated Block 1 synthetic local session','Owner staging exercise').replaceAll('LOCAL_QUEUE_ONLY_NO_SENDER','STAGING_MOCK_QUEUE_NO_SENDER').replaceAll('A local workspace update is available. No email has been sent.','A staging workspace update is available. No email has been sent.');}
try{
 db=openLocalDatabase(dir,{block2:true,forceLocal:true});
 const socket=db.sql('show unix_socket_directories');
 const dump=section=>rename(execFileSync('/opt/homebrew/opt/postgresql@17/bin/pg_dump',['--schema-only','--no-owner','--no-privileges','--no-comments','--section='+section,'-h',socket,'-p','55489','-U','block1_local_owner','-d','marocora_block1_local',...tables.flatMap(t=>['-t','public.'+t])],{encoding:'utf8',env:{PATH:'/usr/bin:/bin',LC_ALL:'C'},maxBuffer:8e6}).split('\n').filter(line=>!line.startsWith('\\')&&!line.startsWith('--')&&!line.includes('SET transaction_timeout')).join('\n').replace('SET check_function_bodies = false;','SET check_function_bodies = true;'));
 const functions=JSON.parse(db.sql("set search_path='';select jsonb_agg(jsonb_build_object('name',proname,'body',pg_get_functiondef(oid)) order by oid) from pg_proc where pronamespace='public'::regnamespace and (proname like 'quote_%' or proname like 'block1_%' or proname like 'block15_%' or proname like 'block2_%')"));
 const bodies=functions.map(f=>{
  if(f.name==='quote_verified')return `CREATE FUNCTION public.quote_verified(person uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$ SELECT EXISTS(SELECT 1 FROM auth.users u JOIN public.translation_staging_accounts a ON a.user_id=u.id WHERE u.id=person AND u.email IS NOT NULL AND u.email_confirmed_at IS NOT NULL AND u.is_anonymous=false AND a.enabled);$body$;`;
  if(f.name==='quote_excluded')return `CREATE FUNCTION public.quote_excluded(person uuid, application uuid DEFAULT NULL, intake uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$
 SELECT EXISTS(SELECT 1 FROM public.translation_exclusions WHERE user_id=person)
 OR EXISTS(SELECT 1 FROM public.translation_provider_applications WHERE user_id=person AND is_test)
 OR EXISTS(SELECT 1 FROM public.quote_test_registry t WHERE t.user_id=person OR t.application_id=application OR t.intake_id=intake OR EXISTS(SELECT 1 FROM public.translation_provider_applications a WHERE a.id=t.application_id AND a.user_id=person));
 $body$;`;
  let body=rename(f.body);
  if(f.name==='block15_record_scan')body=body.replace('BEGIN',"BEGIN\n perform public.quote_assert(auth.role()='service_role' and public.quote_verified(p_actor) and exists(select 1 from public.translation_files f join public.quote_requests q on q.id=f.request_id where f.id=p_file and (q.customer_id=p_actor or (q.owner_id=p_actor and public.quote_staff(p_actor)))),'SERVER_REQUIRED');");
  if(f.name==='block2_record_credential')body=body.replace('BEGIN',"BEGIN\n perform public.quote_assert(auth.role()='service_role','SERVER_REQUIRED');");
  // pg_get_functiondef preserves lowercase BEGIN from these source bodies.
  if(f.name==='block15_record_scan'&&!body.includes("auth.role()='service_role'"))body=body.replace('begin',"begin\n perform public.quote_assert(auth.role()='service_role' and public.quote_verified(p_actor) and exists(select 1 from public.translation_files f join public.quote_requests q on q.id=f.request_id where f.id=p_file and (q.customer_id=p_actor or (q.owner_id=p_actor and public.quote_staff(p_actor)))),'SERVER_REQUIRED');");
  if(f.name==='block2_record_credential'&&!body.includes("auth.role()='service_role'"))body=body.replace('begin',"begin\n perform public.quote_assert(auth.role()='service_role','SERVER_REQUIRED');");
  return body.endsWith(';\n')?body:body+';';
 }).join('\n');
 const extra=`
CREATE FUNCTION public.translation_session_context() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE actor uuid:=auth.uid();role_name text;BEGIN
 PERFORM public.quote_assert(public.quote_verified(actor),'UNAVAILABLE');
 role_name:=CASE WHEN public.quote_staff(actor) THEN 'staff' WHEN EXISTS(SELECT 1 FROM public.translation_provider_applications WHERE user_id=actor AND category='translation') THEN 'provider' ELSE 'customer' END;
 RETURN jsonb_build_object('actor',actor,'role',role_name);
END;$body$;
CREATE FUNCTION public.translation_runtime_settings() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN PERFORM public.quote_assert(public.quote_verified(auth.uid()),'UNAVAILABLE');RETURN (SELECT to_jsonb(s) FROM public.quote_settings s);END;$body$;
CREATE FUNCTION public.translation_workspace_options() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN PERFORM public.quote_assert(public.quote_staff(auth.uid()),'STAFF_OWNER_REQUIRED');
 RETURN jsonb_build_object('readiness',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'label',a.name)) FROM public.quote_provider_readiness r JOIN public.translation_provider_applications a ON a.id=r.application_id WHERE r.state='enabled' AND NOT a.is_test),'[]'::jsonb),'policy',(SELECT jsonb_build_object('version',version,'digest',digest,'wording',wording) FROM public.quote_policies WHERE kind='acceptance' AND approved_at IS NOT NULL ORDER BY approved_at DESC LIMIT 1));
END;$body$;
DO $permissions$ DECLARE f record;t text;BEGIN
 FOR f IN SELECT oid::regprocedure fn FROM pg_proc WHERE pronamespace='public'::regnamespace AND (proname LIKE 'quote\\_%' ESCAPE '\\' OR proname LIKE 'translation\\_%' ESCAPE '\\') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.fn);END LOOP;
 FOREACH t IN ARRAY ARRAY[${migrationTables.map(t=>"'"+rename(t)+"'").join(',')}] LOOP
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('CREATE POLICY translation_rpc_only ON public.%I AS RESTRICTIVE FOR ALL TO anon,authenticated USING (false) WITH CHECK (false)',t);
 END LOOP;
END;$permissions$;
-- Function EXECUTE also requires schema USAGE; managed projects may revoke it.
GRANT USAGE ON SCHEMA public TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.translation_session_context(),public.translation_runtime_settings(),public.translation_workspace_options(),
 public.translation_list(),public.translation_detail(uuid),public.translation_scan_detail(uuid),
 public.translation_cert_capture(uuid,jsonb,jsonb,boolean),public.translation_cert_submit(uuid),public.translation_cert_upload_check(uuid),
 public.translation_scan_register_file(uuid,uuid,text,integer,text,text),public.translation_scan_file(uuid),public.translation_scan_scan_target(uuid),
 public.translation_cert_credentials_list(),public.translation_cert_credential_file(uuid),public.translation_cert_review_credential(uuid,uuid,bigint,text,text),
 public.quote_command(uuid,text,uuid,bigint,jsonb),public.quote_my_readiness() TO authenticated;
GRANT EXECUTE ON FUNCTION public.translation_scan_record_scan(uuid,text,text,text,text,uuid),public.translation_cert_record_credential(uuid,uuid,jsonb,jsonb,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
`;
 const preflight=`DO $preflight$ BEGIN
 IF to_regclass('auth.users') IS NULL THEN RAISE EXCEPTION 'SUPABASE_AUTH_REQUIRED';END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(ARRAY[${migrationTables.map(t=>"'"+rename(t)+"'").join(',')}])) THEN RAISE EXCEPTION 'TRANSLATION_SCHEMA_ALREADY_EXISTS_STOP_AND_COMPARE';END IF;
 END;$preflight$;`;
 const allowlist="CREATE TABLE public.translation_staging_accounts(user_id uuid PRIMARY KEY REFERENCES auth.users(id),enabled boolean NOT NULL DEFAULT true); ALTER TABLE public.translation_staging_accounts ENABLE ROW LEVEL SECURITY;";
 const post=dump('post-data').replace(/CREATE TRIGGER[\s\S]*?;/g,block=>/EXECUTE FUNCTION public\.(quote_|translation_)/.test(block)?block:'');
 const output='-- Translation schema for an owner-managed STAGING project. No accounts or fixture data.\n-- Supabase Auth and standard roles must already exist. All runtime switches are seeded OFF.\nBEGIN;\n'+preflight+'\n'+dump('pre-data')+'\n'+allowlist+'\n'+bodies+'\n'+post+'\n'+extra+'\nCOMMIT;\n';
 if(/\bROLLBACK\b|vendor_test_fixtures|CREATE SCHEMA auth|CREATE ROLE|pg_get_functiondef|block[0-9]_/.test(output))throw Error('EXPORT_CONTAINS_LOCAL_ONLY_ARTIFACT');
 mkdirSync(join(root,'supabase/migrations'),{recursive:true});writeFileSync(join(root,'supabase/migrations/202611140001_translation_workflow.sql'),output);
 console.log('Prepared unified schema:',migrationTables.length,'tables;',functions.length,'compiled functions; no accounts/fixture rows or local patches exported.');
}finally{if(db)db.stop();rmSync(dir,{recursive:true,force:true,maxRetries:3});}
