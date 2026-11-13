// No connection string accepted. Creates, owns and destroys one isolated cluster.
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {digest} from '../../server/quote/contracts.mjs';
import {runTests} from './suite.mjs';
const pgBin=process.env.QUOTE_PG_BIN||'/opt/homebrew/opt/postgresql@17/bin';
const root=resolve(import.meta.dirname,'../..');
const dir=mkdtempSync(join(tmpdir(),'marocora-quote-pg-'));
const data=join(dir,'data'),socket=join(dir,'socket');mkdirSync(socket,{mode:0o700});
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG')&&!['DATABASE_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'].includes(k)));
const tool=(name,args,input)=>execFileSync(join(pgBin,name),args,{input,env,encoding:'utf8',maxBuffer:8*1024*1024,stdio:['pipe','pipe','pipe']});
const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',socket,'-p','55487','-U','quote_fixture_owner','-d','marocora_quote_fixture'];
let started=false;
const start=()=>tool('pg_ctl',['-D',data,'-l',join(dir,'postgres.log'),'-o',`-k ${socket} -p 55487 -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);
const restart=()=>{tool('pg_ctl',['-D',data,'-m','immediate','-w','stop']);start();};
const sql=s=>tool('psql',args,s);
const literal=v=>"'"+String(v).replaceAll("'","''")+"'";
const json=v=>literal(JSON.stringify(v))+'::jsonb';
const as=(actor,query,role='authenticated')=>`begin; set local role ${role}; set local request.jwt.claim.sub=${literal(actor)};set local request.jwt.claim.role=${literal(role)};${query};commit;`;
const query=(actor,q,role)=>sql(as(actor,q,role));
const value=s=>JSON.parse(sql(s).trim());
const commandSQL=(actor,c)=>as(actor,`select quote_fixture.command(${literal(c.commandId)}::uuid,${literal(c.action)},${literal(c.targetId)}::uuid,${c.expectedRevision},${json(c.payload)})`);
const command=(actor,c)=>JSON.parse(sql(commandSQL(actor,c)).trim());
const parallel=s=>new Promise(resolve=>{
 const p=spawn(join(pgBin,'psql'),args,{env,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',x=>stdout+=x);p.stderr.on('data',x=>stderr+=x);p.on('error',e=>resolve({status:1,stderr:e.message,stdout}));p.on('exit',status=>resolve({status,stdout,stderr}));p.stdin.end(s);
});
function draft(name){const s=readFileSync(join(root,'supabase',name),'utf8');assert.match(s,/\nrollback;\s*$/i);return s.replace(/^begin;$/m,'').replace(/^rollback;\s*$/m,'');}
const baseline=['learning_instructor_drafts.sql','learning_staff_review.sql','learning_launch.sql','learning_email_verification.sql','service_intake.sql','vendor_workflow.sql','vendor_workflow_test_fixtures.sql','vendor_workflow_intake_notifications.sql','vendor_workflow_delivery.sql','vendor_workflow_reply_status.sql'];
try {
 tool('initdb',['-D',data,'-U','quote_fixture_owner','--auth-local=trust','--auth-host=reject','--encoding=UTF8','--no-locale']);
 start();started=true;
 tool('createdb',['-h',socket,'-p','55487','-U','quote_fixture_owner','marocora_quote_fixture']);
 sql(readFileSync(join(root,'tests/quote-sql/bootstrap.sql'),'utf8'));
 for(const name of baseline) {sql(readFileSync(join(root,'supabase',name),'utf8'));}
 sql('begin;\n'+draft('quote_workflow.draft.sql')+'\n'+draft('quote_commands.draft.sql')+'\ncommit;');
 sql(readFileSync(join(root,'tests/quote-sql/fixture-shim.sql'),'utf8'));
 const checks=await runTests({sql,query,value,command,commandSQL,parallel,restart,literal,json,as,randomUUID,digest});
 assert.deepEqual(value('select to_jsonb(s) from public.quote_settings s'),{singleton:true,capture_enabled:false,commands_enabled:false,notifications_enabled:false});
 const evidence={project:'Marocora',stage:'Quote Workflow Private SQL Implementation',date:'2026-11-13',postgres:sql('select version()').trim(),baselineFiles:baseline,checksPassed:checks,checksFailed:0,switches:{capture:false,commands:false,notifications:false},isolation:{transport:'Private Unix socket, TCP disabled',database:'Disposable cluster created by runner; no remote URLs accepted',auth:'Synthetic compatibility tables and local NOLOGIN roles; no Supabase credentials',productionConnections:0,emailsSent:0},limitations:['Supabase Auth emulated at SQL claim boundary; no JWT/Edge integration tested','No frontend, Formspree integration, capture trigger or mail dispatcher','Full checkout baseline loaded; external translation register reproduced as its table contract only'],draftHashes:Object.fromEntries(['quote_workflow.draft.sql','quote_commands.draft.sql'].map(n=>[n,digest(readFileSync(join(root,'supabase',n),'utf8'))]))};
 writeFileSync(join(root,'docs/quote/sql-evidence-2026-11-13.json'),JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify({passed:checks.length,failed:0,switches:evidence.switches}));
} catch(e) {console.error(e.stderr?.toString()||e.stack||e.message);process.exitCode=1;}
finally {if(started) {try {tool('pg_ctl',['-D',data,'-m','immediate','-w','stop']);}catch(e){console.error('Cleanup failed:',e.message);process.exitCode=1;}}rmSync(dir,{recursive:true,force:true});}
