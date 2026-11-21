import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync} from 'node:fs';
import {execFileSync,execFile} from 'node:child_process';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

const root=new URL('../',import.meta.url);
const L=v=>"'"+String(v).replaceAll("'","''")+"'";
const signatures=[
 'supply_text(jsonb,integer)','supply_strings(jsonb,integer)','supply_valid_profile(text,jsonb)',
 'supply_verified(uuid)','supply_admin_access()','supply_profile(public.supply_applications)',
 'supply_private_payload(public.supply_applications)','supply_my_applications()',
 'supply_save_application(text,jsonb,uuid,bigint)','supply_review_queue()',
 'supply_review_application(uuid,bigint,text,text,boolean)','supply_upload_context(uuid)',
 'supply_record_credential(uuid,uuid,jsonb)','supply_credential_file(uuid)',
 'supply_save_payout(uuid,uuid,jsonb,text)','supply_public_profiles(uuid)'
];
const allowed=new Map([
 ['supply_admin_access()',['authenticated']],['supply_my_applications()',['authenticated']],
 ['supply_save_application(text,jsonb,uuid,bigint)',['authenticated']],['supply_review_queue()',['authenticated']],
 ['supply_review_application(uuid,bigint,text,text,boolean)',['authenticated']],['supply_upload_context(uuid)',['authenticated']],
 ['supply_credential_file(uuid)',['authenticated']],['supply_public_profiles(uuid)',['anon','authenticated']],
 ['supply_record_credential(uuid,uuid,jsonb)',['service_role']],['supply_save_payout(uuid,uuid,jsonb,text)',['service_role']]
]);

test('supply RPC containment drafts on disposable PostgreSQL without TCP',{timeout:60000},async t=>{
 const bin=process.env.QUOTE_PG_BIN||'/opt/homebrew/opt/postgresql@17/bin';
 const dir=mkdtempSync('/private/tmp/msrpc-'),data=join(dir,'pg'),socket=join(dir,'sock');
 mkdirSync(socket,{mode:0o700});
 const env={PATH:'/usr/bin:/bin:/opt/homebrew/bin',LANG:'C',LC_ALL:'C'};
 const owner='supply_containment_fixture_owner',database='supply_containment_fixture';
 const tool=(name,args,input)=>execFileSync(join(bin,name),args,{input,env,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']});
 const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',socket,'-p','55489','-U',owner,'-d',database];
 const sql=q=>tool('psql',args,q).trim();
 const value=q=>JSON.parse(sql(q));
 const denied=(fn,code)=>assert.throws(fn,e=>String(e.stderr||e.message).includes(code));
 const as=(role,actor,q)=>`BEGIN; SET LOCAL ROLE ${role}; SET LOCAL request.jwt.claim.sub=${L(actor)}; SET LOCAL request.jwt.claim.role=${L(role)}; ${q}; COMMIT;`;
 const suspend=readFileSync(new URL('supabase/rollback/20261121_supply_rpc_suspend.sql',root),'utf8');
 const restore=readFileSync(new URL('supabase/rollback/20261121_supply_rpc_restore.sql',root),'utf8');
 const permissions=()=>value(`SELECT jsonb_agg(jsonb_build_object('signature',signature,'role',role_name,'allowed',has_function_privilege(role_name,('public.'||signature)::regprocedure,'EXECUTE')) ORDER BY signature,role_name)
  FROM unnest(ARRAY[${signatures.map(L).join(',')}]) s(signature) CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) r(role_name)`);
 const acl=()=>sql("SELECT jsonb_agg(jsonb_build_object('signature',oid::regprocedure::text,'acl',proacl::text) ORDER BY oid::regprocedure::text) FROM pg_proc WHERE pronamespace='public'::regnamespace AND left(proname,7)='supply_'");
 const snapshot=()=>{
  const tables=['supply_applications','supply_teacher_profiles','supply_translation_profiles','supply_transport_profiles','supply_credentials','supply_reviews','supply_payouts'];
  return tables.map(name=>sql(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') FROM public.${name} t`))
   .concat(sql("SELECT jsonb_agg(jsonb_build_object('signature',oid::regprocedure::text,'body',prosrc,'config',proconfig,'definer',prosecdef) ORDER BY oid::regprocedure::text) FROM pg_proc WHERE pronamespace='public'::regnamespace AND left(proname,7)='supply_'"),
    sql("SELECT jsonb_agg(jsonb_build_object('name',relname,'rls',relrowsecurity,'acl',relacl::text) ORDER BY relname) FROM pg_class WHERE relnamespace='public'::regnamespace AND left(relname,7)='supply_'"),
    sql("SELECT jsonb_agg(jsonb_build_object('name',polname,'table',polrelid::regclass::text,'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) ORDER BY polrelid,polname) FROM pg_policy WHERE polrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND left(relname,7)='supply_')"),
    sql("SELECT jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid)) ORDER BY conrelid,conname) FROM pg_constraint WHERE conrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND left(relname,7)='supply_')"));
 };
 const actor=randomUUID(),reviewer=randomUUID();let started=false;
 try{
  tool('initdb',['-D',data,'-U',owner,'--auth-local=trust','--auth-host=reject','--encoding=UTF8','--no-locale']);
  tool('pg_ctl',['-D',data,'-l',join(dir,'pg.log'),'-o',`-k ${socket} -p 55489 -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);started=true;
  tool('createdb',['-h',socket,'-p','55489','-U',owner,database]);
  sql(readFileSync(new URL('tests/quote-sql/bootstrap.sql',root),'utf8'));
  sql('CREATE TABLE public.learning_review_staff(user_id uuid PRIMARY KEY REFERENCES auth.users(id)); CREATE TABLE public.learning_review_exclusions(user_id uuid PRIMARY KEY REFERENCES auth.users(id),reason text NOT NULL);');

  await t.test('missing onboarding routines fail closed without creating any',()=>{
   denied(()=>sql(suspend),'SUPPLY_CONTAINMENT_ROUTINE_SET_DRIFT');
   denied(()=>sql(restore),'SUPPLY_CONTAINMENT_ROUTINE_SET_DRIFT');
   assert.equal(sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND left(proname,7)='supply_'"),'0');
  });
  sql(readFileSync(new URL('supabase/migrations/202611200001_supply_onboarding.sql',root),'utf8'));
  sql(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(${L(actor)},'owner@fixture.invalid',now()),(${L(reviewer)},'reviewer@fixture.invalid',now()); INSERT INTO public.learning_review_staff VALUES(${L(reviewer)});`);
  const profile={displayName:'Synthetic Transport',bio:'SYNTHETIC_PRIVATE_PROFILE',publicationConsent:true,vehicleTypes:['van'],capacity:8,serviceRegions:['Rabat'],baseRateMinor:10000,currency:'MAD'};
  const application=value(as('authenticated',actor,`SELECT public.supply_save_application('transport',${L(JSON.stringify(profile))}::jsonb)`));
  sql(as('authenticated',reviewer,`SELECT public.supply_review_application(${L(application.id)},1,'approved','SYNTHETIC_REVIEW',false)`));
  // Synthetic opaque envelope and private metadata: never real documents/banking.
  sql(`INSERT INTO public.supply_payouts(application_id,envelope,iban_last_four) VALUES(${L(application.id)},'{"synthetic":"SYNTHETIC_ENVELOPE"}','1234');
   INSERT INTO public.supply_credentials(application_id,file,scan_status) VALUES(${L(application.id)},'{"synthetic":"SYNTHETIC_PRIVATE_OBJECT"}','clean');
   CREATE FUNCTION public.production_runtime_status() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"version":4,"mockPayments":false}'::jsonb $$;
   REVOKE ALL ON FUNCTION public.production_runtime_status() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.production_runtime_status() TO service_role;`);
  const original=snapshot(),originalAcl=acl(),originalPermissions=permissions();
  const unchanged=()=>assert.deepEqual(snapshot(),original);

  await t.test('exact baseline has ten external functions and eleven role/function grants',()=>{
   assert.equal(allowed.size,10);assert.equal(originalPermissions.filter(p=>p.allowed).length,11);
   for(const row of originalPermissions)assert.equal(row.allowed,allowed.get(row.signature)?.includes(row.role)||false);
  });
  await t.test('client role cannot execute the owner-only draft',()=>{
   denied(()=>sql('SET ROLE authenticated;'+suspend),'SUPPLY_CONTAINMENT_OWNER_REQUIRED');
   assert.equal(acl(),originalAcl);unchanged();
  });
  await t.test('definition drift aborts both actions without changing ACLs',()=>{
   const canonical=sql("SELECT pg_get_functiondef('public.supply_verified(uuid)'::regprocedure)");
   sql("CREATE OR REPLACE FUNCTION public.supply_verified(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT false $$");
   denied(()=>sql(suspend),'SUPPLY_CONTAINMENT_DEFINITION_DRIFT');
   denied(()=>sql(restore),'SUPPLY_CONTAINMENT_DEFINITION_DRIFT');
   assert.equal(acl(),originalAcl);sql(canonical);unchanged();
  });
  await t.test('unexpected helper grant is rejected rather than silently repaired',()=>{
   sql('GRANT EXECUTE ON FUNCTION public.supply_verified(uuid) TO PUBLIC');
   const driftAcl=acl();denied(()=>sql(suspend),'SUPPLY_CONTAINMENT_ACL_DRIFT');assert.equal(acl(),driftAcl);
   sql('REVOKE EXECUTE ON FUNCTION public.supply_verified(uuid) FROM PUBLIC');assert.equal(acl(),originalAcl);
  });
  await t.test('table access drift is rejected and left unchanged',()=>{
   sql('GRANT SELECT ON public.supply_applications TO anon');
   denied(()=>sql(suspend),'SUPPLY_CONTAINMENT_TABLE_DRIFT');
   assert.equal(sql("SELECT has_table_privilege('anon','public.supply_applications','SELECT')"),'t');
   sql('REVOKE SELECT ON public.supply_applications FROM anon');unchanged();
  });
  await t.test('partial grant state is rejected by suspension and restoration',()=>{
   sql('REVOKE EXECUTE ON FUNCTION public.supply_admin_access() FROM authenticated');
   const partial=acl();denied(()=>sql(suspend),'SUPPLY_CONTAINMENT_PARTIAL_STATE');
   denied(()=>sql(restore),'SUPPLY_CONTAINMENT_PARTIAL_STATE');assert.equal(acl(),partial);
   sql('GRANT EXECUTE ON FUNCTION public.supply_admin_access() TO authenticated');assert.equal(acl(),originalAcl);
  });
  await t.test('inherited client access fails closed',()=>{
   sql('GRANT service_role TO authenticated');
   denied(()=>sql(suspend),'SUPPLY_CONTAINMENT_EFFECTIVE_PRIVILEGE_DRIFT');
   sql('REVOKE service_role FROM authenticated');assert.equal(acl(),originalAcl);unchanged();
  });
  await t.test('unexpected supply routines stop the package including a later mail extension',()=>{
   sql('CREATE FUNCTION public.supply_unexpected_fixture() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$');
   denied(()=>sql(suspend),'SUPPLY_CONTAINMENT_ROUTINE_SET_DRIFT');
   sql('DROP FUNCTION public.supply_unexpected_fixture()');assert.equal(acl(),originalAcl);unchanged();
  });
  await t.test('suspension revokes all role capabilities while preserving data and shared version RPC',()=>{
   assert.equal(JSON.parse(sql(suspend)).status,'SUSPENDED');
   for(const row of permissions())assert.equal(row.allowed,false);
   const calls=[
    "supply_text(NULL::jsonb,1)","supply_strings(NULL::jsonb,1)","supply_valid_profile(NULL::text,NULL::jsonb)",
    'supply_verified(NULL::uuid)','supply_admin_access()',
    'supply_profile(NULL::public.supply_applications)','supply_private_payload(NULL::public.supply_applications)',
    'supply_my_applications()',"supply_save_application(NULL::text,NULL::jsonb,NULL::uuid,0::bigint)",
    'supply_review_queue()',"supply_review_application(NULL::uuid,1::bigint,'approved','',false)",
    'supply_upload_context(NULL::uuid)','supply_record_credential(NULL::uuid,NULL::uuid,NULL::jsonb)',
    'supply_credential_file(NULL::uuid)','supply_save_payout(NULL::uuid,NULL::uuid,NULL::jsonb,NULL::text)',
    'supply_public_profiles(NULL::uuid)'
   ];
   for(const role of ['anon','authenticated','service_role'])for(const call of calls){
    denied(()=>sql(as(role,actor,'SELECT public.'+call)),'permission denied');
   }
   assert.deepEqual(value(as('service_role',actor,'SELECT public.production_runtime_status()')),{version:4,mockPayments:false});
   unchanged();
  });
  await t.test('repeating suspension keeps exact closed state and immutable fixtures',()=>{
   const closedAcl=acl();assert.equal(JSON.parse(sql(suspend)).status,'SUSPENDED');assert.equal(acl(),closedAcl);unchanged();
  });
  await t.test('restore requires unchanged definitions even while fully suspended',()=>{
   const canonical=sql("SELECT pg_get_functiondef('public.supply_verified(uuid)'::regprocedure)");
   sql("CREATE OR REPLACE FUNCTION public.supply_verified(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT false $$");
   const closedAcl=acl();denied(()=>sql(restore),'SUPPLY_CONTAINMENT_DEFINITION_DRIFT');assert.equal(acl(),closedAcl);
   sql(canonical);unchanged();
  });
  await t.test('restoration returns the exact original ACL matrix and owner/public reads',()=>{
   assert.equal(JSON.parse(sql(restore)).status,'RESTORED');
   assert.deepEqual(permissions(),originalPermissions);assert.equal(acl(),originalAcl);unchanged();
   assert.equal(value(as('authenticated',actor,'SELECT public.supply_my_applications()'))[0].id,application.id);
   assert.equal(value(as('anon','',`SELECT public.supply_public_profiles(${L(application.id)})`))[0].id,application.id);
   assert.equal(sql("SELECT has_function_privilege('anon','public.supply_verified(uuid)','EXECUTE')"),'f');
   assert.equal(JSON.parse(sql(restore)).status,'RESTORED');assert.equal(acl(),originalAcl);unchanged();
  });
  await t.test('busy-table timeout aborts suspension atomically instead of weakening its lock',async()=>{
   let child,held;
   const locked=new Promise((resolve,reject)=>{
    child=execFile(join(bin,'psql'),args,{env,encoding:'utf8'},error=>{if(error)reject(error);});
    held=new Promise((done,fail)=>{let output='';child.once('error',fail);child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('SYNTHETIC_LOCK_HELD'))done();});child.once('exit',()=>{if(!output.includes('SYNTHETIC_LOCK_HELD'))fail(Error('SYNTHETIC_LOCK_NOT_ACQUIRED'));});});
    child.once('exit',code=>code===0?resolve():reject(Error('SYNTHETIC_LOCK_PROCESS_FAILED')));
    child.stdin.end("BEGIN; LOCK TABLE public.supply_applications IN ACCESS EXCLUSIVE MODE; SELECT 'SYNTHETIC_LOCK_HELD'; SELECT pg_sleep(10); ROLLBACK;");
   });
   await held;
   try{denied(()=>sql(suspend),'lock timeout');}
   finally{await locked;}
   assert.equal(acl(),originalAcl);unchanged();
  });
 }finally{if(started)tool('pg_ctl',['-D',data,'-m','fast','-w','stop']);}
});
