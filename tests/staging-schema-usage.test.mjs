import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openLocalDatabase,L} from '../server/block1/database.mjs';

test('Migration and repeatable repair support restricted schema USAGE without broadening table/core privileges',{timeout:60000},()=>{
 const directory=mkdtempSync(join(tmpdir(),'marocora-schema-usage-'));let db;
 try{
  db=openLocalDatabase(directory,{forceLocal:true});
  db.sql('drop schema public cascade;create schema public;revoke all on schema public from public,anon,authenticated,service_role;');
  const usage=role=>db.sql(`select has_schema_privilege(${L(role)},'public','usage')`);
  for(const role of ['anon','authenticated','service_role'])assert.equal(usage(role),'f');
  db.sql(readFileSync(new URL('../supabase/migrations/202611140001_translation_workflow.sql',import.meta.url),'utf8'));
  assert.equal(usage('anon'),'f');
  for(const role of ['authenticated','service_role']){
   assert.equal(usage(role),'t');
   assert.equal(db.sql(`select has_schema_privilege(${L(role)},'public','create')`),'f');
   assert.equal(db.sql(`select has_table_privilege(${L(role)},'public.quote_requests','select,insert,update,delete')`),'f');
  }
  const actor=randomUUID();
  db.sql(`insert into auth.users(id,email,email_confirmed_at) values(${L(actor)},'staff@staging.invalid',now());`);
  const seed=readFileSync(new URL('../supabase/migrations/202611140002_translation_seed.sql',import.meta.url),'utf8').replace('staff_id uuid := NULL;',`staff_id uuid := ${L(actor)};`);
  db.sql(seed);
  const session=()=>db.as(actor,'select public.translation_session_context()');
  assert.deepEqual(session(),{actor,role:'staff'});
  db.sql('revoke usage on schema public from authenticated,service_role');
  assert.throws(session,e=>String(e.stderr).includes('permission denied for schema public'));
  const repair=readFileSync(new URL('../supabase/repairs/20261115_translation_schema_usage.sql',import.meta.url),'utf8');
  db.sql(repair);db.sql(repair);
  assert.deepEqual(session(),{actor,role:'staff'});
  assert.throws(()=>db.as(actor,'select to_jsonb(s) from public.quote_settings s'),e=>String(e.stderr).includes('permission denied'));
  assert.equal(db.sql("select has_function_privilege('service_role','public.quote_command_core(uuid,text,uuid,bigint,jsonb)','execute')"),'f');
  assert.equal(db.sql('select capture_enabled or commands_enabled or notifications_enabled from public.quote_settings'),'f');
  assert.equal(usage('anon'),'f');
 }finally{if(db)db.stop();rmSync(directory,{recursive:true,force:true,maxRetries:3});}
});
