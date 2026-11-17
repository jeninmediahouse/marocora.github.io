// Disposable local Unix-socket PostgreSQL only. No URL/credentials are accepted.
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {openLocalDatabase,L,J} from '../server/block1/database.mjs';
export function verifyStagingSql(){
 const dir=mkdtempSync(join(tmpdir(),'marocora-sql-resilience-'));let db;
 const checks=[];
 try{
  db=openLocalDatabase(dir,{forceLocal:true});
  assert.equal(db.sql('show listen_addresses'),'');checks.push('PostgreSQL TCP disabled; private Unix socket only');
  db.sql('drop schema public cascade;create schema public;grant usage on schema public to anon,authenticated,service_role;');
  const migration=readFileSync(new URL('../supabase/migrations/202611140001_translation_workflow.sql',import.meta.url),'utf8');
  const template=readFileSync(new URL('../supabase/migrations/202611140002_translation_seed.sql',import.meta.url),'utf8');
  db.sql(migration);
  const staff=randomUUID(),customer=randomUUID(),outsider=randomUUID();
  db.sql(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values (${L(staff)},'staff@staging.invalid',now(),'{}'),(${L(customer)},'customer@staging.invalid',now(),'{}'),(${L(outsider)},'outsider@staging.invalid',now(),'{"role":"staff"}');`);
  const seed=template.replace('staff_id uuid := NULL;',`staff_id uuid := ${L(staff)};`).replace("customers jsonb := '[]';",`customers jsonb := ${J([customer])};`);
  db.sql(seed);
  const roleSql=(role,query)=>db.sql(`begin;set local role ${role};set local request.jwt.claim.role=${L(role)};${query};rollback;`);
  const denied=fn=>assert.throws(fn,e=>String(e.stderr).includes('permission denied'));
  const tables=JSON.parse(db.sql("select json_agg(relname order by relname) from pg_class where relnamespace='public'::regnamespace and relkind='r'"));
  assert.equal(tables.length,32);
  const columns=JSON.parse(db.sql("select json_object_agg(table_name,column_name) from (select distinct on (table_name) table_name,column_name from information_schema.columns where table_schema='public' order by table_name,ordinal_position) c"));
  for(const table of tables){
   assert.match(table,/^[a-z_]+$/);
   for(const role of ['anon','authenticated','service_role']){
    denied(()=>roleSql(role,`select * from public.${table}`));
    denied(()=>roleSql(role,`insert into public.${table} default values`));
    const column=columns[table];assert.match(column,/^[a-z_]+$/);
    denied(()=>roleSql(role,`update public.${table} set ${column}=${column} where false`));
    denied(()=>roleSql(role,`delete from public.${table} where false`));
   }
  }
  checks.push('32 tables × 3 roles × SELECT/INSERT/UPDATE/DELETE denied by privileges');
  // With temporary SELECT privileges, prove restrictive RLS still hides seeded
  // rows. All grants below are rolled back; service_role intentionally bypasses RLS.
  for(const table of ['quote_settings','translation_staff','translation_staging_accounts'])for(const role of ['anon','authenticated']){
   assert.equal(db.sql(`begin;grant select on public.${table} to ${role};set local role ${role};select count(*) from public.${table};rollback;`),'0');
  }
  assert.equal(db.sql("select count(*) from pg_class where relnamespace='public'::regnamespace and relkind='r' and relrowsecurity"),'32');
  assert.equal(db.sql("select count(*) from pg_policy where polname='translation_rpc_only' and not polpermissive"),'32');
  checks.push('32 restrictive RLS policies; seeded rows invisible even with temporary SELECT grants');
  assert.throws(()=>db.as(outsider,'select public.translation_session_context()'),e=>String(e.stderr).includes('UNAVAILABLE'));
  const cmd=()=>db.as(staff,`select public.quote_command(${L(randomUUID())},'cancel_request',${L(randomUUID())},0,'{}')`);
  assert.throws(cmd,e=>String(e.stderr).includes('COMMANDS_DISABLED'));
  assert.throws(()=>db.as(customer,`select public.translation_cert_capture(${L(randomUUID())},${J({service:'Document Translation',source:'English',target:'French',description:'Synthetic test'})},'{"name":"Synthetic customer"}',false)`),e=>String(e.stderr).includes('CAPTURE_DISABLED'));
  checks.push('Unallowlisted staff metadata denied; OFF blocks capture and commands in real SQL');
  db.sql('update public.quote_settings set capture_enabled=true,commands_enabled=true');
  const request=randomUUID(),file=randomUUID(),hash='0'.repeat(64);
  db.as(customer,`select public.translation_cert_capture(${L(request)},${J({service:'Document Translation',source:'English',target:'French',description:'Synthetic scan test'})},'{"name":"Synthetic customer"}',true)`);
  db.as(customer,`select public.translation_scan_register_file(${L(file)},${L(request)},'synthetic.pdf',100,${L(hash)},'application/pdf')`);
  const scan=`select public.translation_scan_record_scan(${L(file)},${L(hash)},'clean','TEST MOCK','SYNTHETIC_CLEAN',${L(customer)})`;
  denied(()=>roleSql('anon',scan));denied(()=>db.as(customer,scan));
  roleSql('service_role',scan); // rollback first, then exercise a committed record.
  db.sql(`begin;set local role service_role;set local request.jwt.claim.role='service_role';${scan};commit;`);
  assert.equal(db.sql('select count(*) from public.translation_scan_events'),'1');
  for(const fn of ['quote_command_core','quote_command'])denied(()=>roleSql('service_role',`select public.${fn}(${L(randomUUID())},'cancel_request',${L(request)},0,'{}')`));
  checks.push('Only service_role records scan; service_role cannot call command/core or mutate tables');
  db.sql(seed);assert.equal(db.sql('select count(*) from public.quote_settings'),'1');
  assert.equal(db.sql('select capture_enabled or commands_enabled or notifications_enabled from public.quote_settings'),'f');
  const snapshot=()=>db.sql(`select json_build_object('rows',(select json_object_agg(t.name,t.rows) from (${tables.map(table=>`select '${table}' name,(select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') from public.${table} x) rows`).join(' union all ')}) t),'acl',(select jsonb_agg(jsonb_build_array(relname,relacl::text,relrowsecurity) order by relname) from pg_class where relnamespace='public'::regnamespace and relkind='r'),'policies',(select jsonb_agg(to_jsonb(p) order by oid) from pg_policy p))`);
  const before=snapshot();
  assert.throws(()=>db.sql(migration),e=>String(e.stderr).includes('TRANSLATION_SCHEMA_ALREADY_EXISTS_STOP_AND_COMPARE'));
  assert.equal(snapshot(),before);assert.throws(cmd,e=>String(e.stderr).includes('COMMANDS_DISABLED'));
  checks.push('Seed repeat safe and OFF; second migration explicitly refused; rows, ACLs and policies unchanged');
  return checks;
 }finally{if(db)db.stop();rmSync(dir,{recursive:true,force:true,maxRetries:3});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{for(const check of verifyStagingSql())console.log('PASS: '+check);}
 catch(e){console.error('FAIL: local staging SQL resilience',e.message);process.exitCode=1;}
}
