import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync} from 'node:fs';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {supplyEmailBatch} from '../server/vendor-mail.mjs';
import {createSupplyMailDispatcher} from '../server/vendor-workflow.mjs';
const root=new URL('../',import.meta.url),L=v=>"'"+String(v).replaceAll("'","''")+"'",J=v=>L(JSON.stringify(v))+'::jsonb';
const profile={displayName:'Synthetic <script> profile',bio:'SYNTHETIC_PRIVATE_BIO',publicationConsent:false,vehicleTypes:['van'],capacity:8,serviceRegions:['Rabat'],baseRateMinor:10000,currency:'MAD'};
const fixture=()=>{const id=randomUUID();return {application:{id:randomUUID(),email:'owner@fixture.invalid',profile,credentials:'SYNTHETIC_PRIVATE_CREDENTIAL',payout:'SYNTHETIC_PRIVATE_BANK'},event:{id,kind:'submitted',revision:1,payload:{message:'SYNTHETIC_PRIVATE_FEEDBACK'}},claimToken:randomUUID(),idempotencyKey:'marocora-supply/'+id};};
test('supply templates project only stored routing metadata and fixed dashboard links',()=>{
 for(const kind of ['submitted','approved','rejected']){
  const item=fixture();item.event.kind=kind;const messages=supplyEmailBatch(item);assert.equal(messages.length,1);assert.deepEqual(messages[0].to,['owner@fixture.invalid']);
  const output=JSON.stringify(messages);for(const secret of ['SYNTHETIC_PRIVATE','<script>','vendor-review.html','application.html#'])assert.equal(output.includes(secret),false);
  assert.match(messages[0].html,/https:\/\/marocora.com\/supply-dashboard.html/);assert.match(messages[0].text,/revision 1/);
 }
 for(const mutate of [i=>i.application.email='bad\r\nBcc:attacker@fixture.invalid',i=>i.event.kind='__proto__',i=>i.application.id='"><img>',i=>i.event.revision=0]){const item=fixture();mutate(item);assert.throws(()=>supplyEmailBatch(item),/INVALID_EVENT/);}
});
test('supply dispatcher requires explicit adapters and bounds each invocation',async()=>{
 assert.throws(()=>createSupplyMailDispatcher({}),/ADAPTER_REQUIRED/);
 let calls=0;const dispatch=createSupplyMailDispatcher({serviceRpc:async()=>{calls++;return null;},sendMail:async()=>{throw Error('SYNTHETIC_UNEXPECTED_SEND');}});
 for(const input of [{applicationId:randomUUID(),actorId:randomUUID(),limit:6},{applicationId:'bad',actorId:randomUUID()}])await assert.rejects(dispatch(input),/INVALID_REQUEST/);
 assert.equal(calls,0);
});
test('supply dispatcher sends only rendered projection and forwards stable idempotency key',async()=>{
 const item=fixture(),calls=[];let claimed=false,sent;
 const dispatch=createSupplyMailDispatcher({serviceRpc:async(name,args)=>{calls.push({name,args});if(name==='supply_mail_claim'){if(claimed)return null;claimed=true;return item;}return 'sent';},sendMail:async(messages,meta)=>{sent={messages,meta};return {state:'sent'};}});
 assert.deepEqual(await dispatch({applicationId:item.application.id,actorId:randomUUID()}),[{eventId:item.event.id,state:'sent'}]);
 assert.deepEqual(sent.meta,{idempotencyKey:item.idempotencyKey});assert.equal(JSON.stringify(sent).includes('SYNTHETIC_PRIVATE'),false);assert.equal(calls[1].args.p_claim,item.claimToken);
});
test('supply dispatcher treats exceptions and unknown results as uncertain, records retry exhaustion truthfully',async()=>{
 for(const [send,finished,expected] of [[async()=>{throw Error('SYNTHETIC_TIMEOUT');},'uncertain','uncertain'],[async()=>({state:'invented'}),'uncertain','uncertain'],[async()=>({state:'retry'}),'failed','failed']]){
  const item=fixture();let claims=0,result;
  const dispatch=createSupplyMailDispatcher({serviceRpc:async(name,args)=>{if(name==='supply_mail_claim'){claims++;return item;}result=args.p_result;return finished;},sendMail:send});
  assert.equal((await dispatch({applicationId:item.application.id,actorId:randomUUID()}))[0].state,expected);assert.equal(claims,1);assert.equal(result,finished==='failed'?'retry':'uncertain');
 }
});
test('supply dispatcher rejects mismatched claim routing and never sends malformed messages',async()=>{
 for(const mutate of [i=>i.application.id=randomUUID(),i=>i.idempotencyKey='forged',i=>i.claimToken='bad']){
  const item=fixture(),applicationId=item.application.id;mutate(item);let sends=0;const dispatch=createSupplyMailDispatcher({serviceRpc:async()=>item,sendMail:async()=>{sends++;}});
  await assert.rejects(dispatch({applicationId,actorId:randomUUID()}),/INVALID_CLAIM/);assert.equal(sends,0);
 }
 const item=fixture();item.application.email='injected\nrecipient@fixture.invalid';let sends=0,finish;
 const dispatch=createSupplyMailDispatcher({serviceRpc:async(name,args)=>{if(name==='supply_mail_claim')return item;finish=args;return 'failed';},sendMail:async()=>{sends++;}});
 await dispatch({applicationId:item.application.id,actorId:randomUUID()});assert.equal(sends,0);assert.equal(finish.p_result,'failed');
});

test('supply dispatcher caps batches and stops after a lost completion acknowledgement',async()=>{
 let claims=0,sends=0;
 const item=fixture(),actorId=randomUUID();
 const dispatch=createSupplyMailDispatcher({serviceRpc:async name=>{if(name==='supply_mail_claim'){claims++;const next=fixture();next.application.id=item.application.id;return next;}return 'sent';},sendMail:async()=>{sends++;return {state:'sent'};}});
 assert.equal((await dispatch({applicationId:item.application.id,actorId})).length,5);assert.equal(claims,5);assert.equal(sends,5);
 let completions=0;
 const lost=createSupplyMailDispatcher({serviceRpc:async name=>{if(name==='supply_mail_claim')return item;completions++;throw Error('SYNTHETIC_DB_ACK_LOST');},sendMail:async()=>({state:'sent'})});
 await assert.rejects(lost({applicationId:item.application.id,actorId}),/SYNTHETIC_DB_ACK_LOST/);assert.equal(completions,1);
});

test('supply outbox transactional lifecycle on disposable PostgreSQL with no TCP',async t=>{
 const bin=process.env.QUOTE_PG_BIN||'/opt/homebrew/opt/postgresql@17/bin',dir=mkdtempSync('/private/tmp/msmail-'),data=join(dir,'pg'),socket=join(dir,'sock');mkdirSync(socket,{mode:0o700});
 const env={PATH:'/usr/bin:/bin:/opt/homebrew/bin',LANG:'C',LC_ALL:'C'},owner='supply_mail_fixture_owner';
 const tool=(name,args,input)=>execFileSync(join(bin,name),args,{input,env,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']});
 const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',socket,'-p','55488','-U',owner,'-d','supply_mail_fixture'];
 const sql=q=>tool('psql',args,q).trim(),value=q=>JSON.parse(sql(q));
 const as=(actor,q,role='authenticated')=>`BEGIN;SET LOCAL ROLE ${role};SET LOCAL request.jwt.claim.sub=${L(actor)};SET LOCAL request.jwt.claim.role=${L(role)};${q};COMMIT;`;
 // psql prints SQL NULL as an empty field, which is not JSON. Preserve the RPC
 // null result explicitly for empty queues and rejected completion tokens.
 const query=(name,p)=>`SELECT coalesce(to_jsonb(public.${name}(${Object.entries(p).map(([k,v])=>k+'=>'+(v===null?'NULL':typeof v==='object'?J(v):typeof v==='number'||typeof v==='boolean'?String(v):L(v))).join(',')})), 'null'::jsonb)`;
 const rpc=(actor,name,p={},role='authenticated')=>value(as(actor,query(name,p),role));
 const denied=(fn,code)=>assert.throws(fn,e=>String(e.stderr||e.message).includes(code));
 const ids={owner:randomUUID(),other:randomUUID(),staff:randomUUID()};let started=false,app;
 const save=(id,revision)=>rpc(ids.owner,'supply_save_application',{p_type:'transport',p_profile:profile,...id?{p_id:id,p_revision:revision}:{}});
 const claim=()=>rpc('','supply_mail_claim',{p_id:app.id,p_actor:ids.owner},'service_role');
 const finish=(item,result,token=item.claimToken)=>rpc('','supply_mail_finish',{p_event:item.event.id,p_claim:token,p_result:result},'service_role');
 const state=id=>sql(`SELECT state FROM public.supply_mail_events WHERE id=${L(id)}`);
 const due=()=>sql(`UPDATE public.supply_mail_events SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE application_id=${L(app.id)} AND state='retry'`);
 try{
  tool('initdb',['-D',data,'-U',owner,'--auth-local=trust','--auth-host=reject','--encoding=UTF8','--no-locale']);
  tool('pg_ctl',['-D',data,'-l',join(dir,'pg.log'),'-o',`-k ${socket} -p 55488 -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);started=true;
  tool('createdb',['-h',socket,'-p','55488','-U',owner,'supply_mail_fixture']);
  sql(readFileSync(new URL('tests/quote-sql/bootstrap.sql',root),'utf8'));
  sql('CREATE TABLE public.learning_review_staff(user_id uuid PRIMARY KEY REFERENCES auth.users(id));CREATE TABLE public.learning_review_exclusions(user_id uuid PRIMARY KEY REFERENCES auth.users(id),reason text NOT NULL);');
  const migration=readFileSync(new URL('supabase/migrations/202611200002_supply_mail_outbox.sql',root),'utf8');
  await t.test('migration fails closed on missing prerequisites and applies once without backfill',()=>{
   denied(()=>sql(migration),'SUPPLY_MAIL_PREREQUISITES_MISSING');
   sql(readFileSync(new URL('supabase/migrations/202611200001_supply_onboarding.sql',root),'utf8'));
   sql(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ${Object.entries(ids).map(([k,id])=>`(${L(id)},${L(k+'@fixture.invalid')},now())`).join(',')};INSERT INTO public.learning_review_staff VALUES(${L(ids.staff)});`);
   // A pre-existing application must not generate historical notifications.
   rpc(ids.other,'supply_save_application',{p_type:'transport',p_profile:profile});
   sql("ALTER FUNCTION public.supply_save_application(text,jsonb,uuid,bigint) SET search_path='public'");
   denied(()=>sql(migration),'SUPPLY_MAIL_PREREQUISITE_DRIFT');
   sql("ALTER FUNCTION public.supply_save_application(text,jsonb,uuid,bigint) SET search_path=''");
   sql('GRANT EXECUTE ON FUNCTION public.supply_save_application(text,jsonb,uuid,bigint) TO anon');
   denied(()=>sql(migration),'SUPPLY_MAIL_PREREQUISITE_DRIFT');
   sql('REVOKE EXECUTE ON FUNCTION public.supply_save_application(text,jsonb,uuid,bigint) FROM anon');
   sql(migration);assert.equal(sql('SELECT count(*) FROM public.supply_mail_events'),'0');denied(()=>sql(migration),'SUPPLY_MAIL_OBJECTS_ALREADY_EXIST');
  });
  await t.test('empty queues and unknown completions round-trip SQL NULL as JSON null',()=>{
   const existing=rpc(ids.other,'supply_my_applications')[0];
   assert.equal(rpc('','supply_mail_claim',{p_id:existing.id,p_actor:ids.other},'service_role'),null);
   assert.equal(rpc('','supply_mail_finish',{p_event:randomUUID(),p_claim:randomUUID(),p_result:'sent'},'service_role'),null);
   assert.equal(sql('SELECT count(*) FROM public.supply_mail_events'),'0');
  });
  await t.test('profile and outbox inserts roll back together; duplicate submission cannot duplicate mail',()=>{
   sql(as(ids.owner,query('supply_save_application',{p_type:'transport',p_profile:profile})).replace('COMMIT;','ROLLBACK;'));
   assert.equal(sql('SELECT count(*) FROM public.supply_mail_events'),'0');app=save();
   assert.equal(sql('SELECT count(*) FROM public.supply_mail_events'),'1');
   denied(()=>save(),'duplicate key');assert.equal(sql('SELECT count(*) FROM public.supply_mail_events'),'1');
   assert.equal(sql(`SELECT revision FROM public.supply_mail_events WHERE application_id=${L(app.id)}`),'1');
  });
  await t.test('private outbox, helper and claims are inaccessible to clients and unauthorized actors',()=>{
   for(const role of ['anon','authenticated','service_role'])denied(()=>sql(as(ids.owner,'SELECT * FROM public.supply_mail_events',role)),'permission denied');
   for(const role of ['anon','authenticated'])for(const [name,p] of [['supply_mail_claim',{p_id:app.id,p_actor:ids.owner}],['supply_mail_finish',{p_event:randomUUID(),p_claim:randomUUID(),p_result:'sent'}],['supply_mail_capture',{}]])denied(()=>rpc(ids.owner,name,p,role),'permission denied');
   denied(()=>rpc('','supply_mail_claim',{p_id:app.id,p_actor:ids.other},'service_role'),'SUPPLY_MAIL_ACCESS_DENIED');
  });
  await t.test('claim returns only safe routing projection, fences finish and persists accepted outcome',()=>{
   const item=claim();assert.equal(item.application.email,'owner@fixture.invalid');assert.deepEqual(Object.keys(item.application).sort(),['email','id']);
   for(const secret of ['SYNTHETIC_PRIVATE','payout','credential','reason','profile'])assert.equal(JSON.stringify(item).includes(secret),false);
   assert.equal(claim(),null);for(const invalid of [null,'invented'])denied(()=>finish(item,invalid),'SUPPLY_MAIL_INVALID_RESULT');assert.equal(finish(item,'sent',randomUUID()),null);assert.equal(state(item.event.id),'sending');
   assert.equal(finish(item,'sent'),'sent');assert.equal(finish(item,'sent'),null);assert.equal(claim(),null);
  });
  await t.test('stale decisions roll back without mail and exact-revision decisions enqueue once',()=>{
   app=save(app.id,1);
   denied(()=>rpc(ids.staff,'supply_review_application',{p_id:app.id,p_revision:1,p_decision:'rejected',p_reason:'SYNTHETIC_PRIVATE_FEEDBACK'}),'SUPPLY_STALE_REVISION');
   const p={p_id:app.id,p_revision:2,p_decision:'rejected',p_reason:'SYNTHETIC_PRIVATE_FEEDBACK'};
   sql(as(ids.staff,query('supply_review_application',p)).replace('COMMIT;','ROLLBACK;'));
   assert.equal(sql("SELECT count(*) FROM public.supply_mail_events WHERE kind='rejected'"),'0');
   rpc(ids.staff,'supply_review_application',p);denied(()=>rpc(ids.staff,'supply_review_application',p),'SUPPLY_STALE_REVISION');
   assert.equal(sql("SELECT count(*) FROM public.supply_mail_events WHERE kind='rejected'"),'1');
  });
  await t.test('resubmission supersedes unsent older revisions and concurrent claims cannot take the same event',async()=>{
   app=save(app.id,2);const q=as('',query('supply_mail_claim',{p_id:app.id,p_actor:ids.owner}),'service_role');
   // Use independent psql sessions and argv SQL, not TCP or any managed connection.
   const claims=await Promise.all([1,2].map(()=>promisify(execFile)(join(bin,'psql'),[...args,'-c',q],{env,encoding:'utf8'})));
   const items=claims.map(r=>JSON.parse(r.stdout.trim())).filter(Boolean);assert.equal(items.length,1);assert.equal(items[0].event.revision,3);
   assert.equal(sql("SELECT count(*) FROM public.supply_mail_events WHERE revision=2 AND state='cancelled'"),'2');finish(items[0],'sent');
  });
  await t.test('definitively unaccepted sends retry with delay and stop after three attempts',()=>{
   app=save(app.id,3);let item=claim();const key=item.idempotencyKey;
   assert.equal(finish(item,'retry'),'retry');assert.equal(claim(),null);due();item=claim();assert.equal(item.idempotencyKey,key);
   assert.equal(finish(item,'retry'),'retry');assert.equal(claim(),null);due();item=claim();assert.equal(finish(item,'retry'),'failed');due();assert.equal(claim(),null);
   assert.equal(sql(`SELECT attempts FROM public.supply_mail_events WHERE id=${L(item.event.id)}`),'3');
  });
  await t.test('ambiguous and expired sends never retry and late completion cannot overwrite uncertainty',()=>{
   app=save(app.id,4);let item=claim();assert.equal(finish(item,'uncertain'),'uncertain');assert.equal(claim(),null);
   app=save(app.id,5);item=claim();sql(`UPDATE public.supply_mail_events SET claimed_at=clock_timestamp()-interval '3 minutes' WHERE id=${L(item.event.id)}`);
   assert.equal(finish(item,'sent'),null);assert.equal(state(item.event.id),'uncertain');assert.equal(claim(),null);
   app=save(app.id,6);item=claim();sql(`UPDATE public.supply_mail_events SET claimed_at=clock_timestamp()-interval '3 minutes' WHERE id=${L(item.event.id)}`);assert.equal(claim(),null);assert.equal(state(item.event.id),'uncertain');
  });
  await t.test('recipient changes and revoked verification stop retries',()=>{
   app=save(app.id,7);const item=claim();finish(item,'retry');due();sql(`UPDATE auth.users SET email='changed@fixture.invalid' WHERE id=${L(ids.owner)}`);assert.equal(claim(),null);assert.equal(state(item.event.id),'cancelled');
   app=save(app.id,8);sql(`UPDATE auth.users SET email_confirmed_at=NULL WHERE id=${L(ids.owner)}`);denied(()=>claim(),'SUPPLY_MAIL_ACCESS_DENIED');
   assert.equal(rpc('','supply_mail_claim',{p_id:app.id,p_actor:ids.staff},'service_role'),null);
   sql(`UPDATE auth.users SET email_confirmed_at=now() WHERE id=${L(ids.owner)}`);
  });
  await t.test('teacher and translator saves capture acknowledgements; credentials do not create extra events',()=>{
   const teacher={displayName:'Synthetic Teacher',bio:'Synthetic profile for notifications.',publicationConsent:false,languages:['English'],hourlyRateMinor:10000,currency:'MAD',timezone:'Africa/Casablanca',availability:[{day:1,start:'09:00',end:'10:00'}],introVideo:'https://video.fixture.invalid/intro'};
   const translator={displayName:'Synthetic Translator',bio:'Synthetic translation profile.',publicationConsent:false,organizationKind:'individual',languagePairs:[{source:'English',target:'French'}],specialties:['Legal']};
   for(const [type,p] of Object.entries({teacher,translator})){
    const a=rpc(ids.owner,'supply_save_application',{p_type:type,p_profile:p});
    assert.equal(sql(`SELECT count(*) FROM public.supply_mail_events WHERE application_id=${L(a.id)} AND kind='submitted'`),'1');
    if(type==='translator'){
     rpc('','supply_record_credential',{p_actor:ids.owner,p_id:a.id,p_file:{id:randomUUID(),backend:'spaces',bucket:'synthetic-private-fixtures',key:'synthetic/'+randomUUID(),sha256:'a'.repeat(64),size:123,mime:'application/pdf'}},'service_role');
     assert.equal(sql(`SELECT count(*) FROM public.supply_mail_events WHERE application_id=${L(a.id)}`),'1');
     const receipt=rpc('','supply_mail_claim',{p_id:a.id,p_actor:ids.owner},'service_role');assert.equal(receipt.event.revision,1);assert.equal(receipt.event.kind,'submitted');finish(receipt,'sent');
    }else{
     rpc(ids.staff,'supply_review_application',{p_id:a.id,p_revision:1,p_decision:'approved',p_reason:'SYNTHETIC_PRIVATE_FEEDBACK'});
     assert.equal(sql(`SELECT count(*) FROM public.supply_mail_events WHERE application_id=${L(a.id)} AND kind='approved'`),'1');
    }
   }
  });
  await t.test('fake transport drives real disposable claim and completion RPCs without provider calls',async()=>{
   app=save(app.id,9);let sends=0;
   const dispatch=createSupplyMailDispatcher({serviceRpc:async(name,p)=>rpc('',name,p,'service_role'),sendMail:async(messages)=>{sends++;assert.deepEqual(messages[0].to,['changed@fixture.invalid']);return {state:'sent'};}});
   const results=await dispatch({applicationId:app.id,actorId:ids.owner});assert.equal(results.length,1);assert.equal(results[0].state,'sent');assert.equal(sends,1);
   assert.deepEqual(await dispatch({applicationId:app.id,actorId:ids.owner}),[]);assert.equal(sends,1);
  });
  await t.test('revoked administrators cannot claim another owner notifications',()=>{
   sql(`DELETE FROM public.learning_review_staff WHERE user_id=${L(ids.staff)}`);
   denied(()=>rpc('','supply_mail_claim',{p_id:app.id,p_actor:ids.staff},'service_role'),'SUPPLY_MAIL_ACCESS_DENIED');
  });
 }finally{if(started)tool('pg_ctl',['-D',data,'-m','fast','-w','stop']);}
});
