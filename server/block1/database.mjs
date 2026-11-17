// Local PostgreSQL by default; explicit complete Supabase configuration selects staging RPCs.
import {mkdirSync,readFileSync,writeFileSync,existsSync,chmodSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {cloudConfiguration,createStagingDatabase} from './supabase-database.mjs';
export const root=resolve(import.meta.dirname,'../..');
export const L=v=>"'"+String(v).replaceAll("'","''")+"'";
export const J=v=>L(JSON.stringify(v))+'::jsonb';
export const baseline=['learning_instructor_drafts.sql','learning_staff_review.sql','learning_launch.sql','learning_email_verification.sql','service_intake.sql','vendor_workflow.sql','vendor_workflow_test_fixtures.sql','vendor_workflow_intake_notifications.sql','vendor_workflow_delivery.sql','vendor_workflow_reply_status.sql'];
export function openLocalDatabase(directory,{enableLocalFlow=false,block2=false,forceLocal=false,environment=process.env,fetcher}={}){
 const config=forceLocal?null:cloudConfiguration(environment);
 if(config)return createStagingDatabase(config,{directory,fetcher});
 const dir=resolve(directory),data=join(dir,'pg'),socket=mkdtempSync('/private/tmp/marocora-b1-socket-');
 mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);mkdirSync(socket,{recursive:true,mode:0o700});chmodSync(socket,0o700);
 const bin=process.env.QUOTE_PG_BIN||'/opt/homebrew/opt/postgresql@17/bin';
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG')&&!/DATABASE_URL|SUPABASE|RESEND|FORMSPREE|CLOUDMERSIVE/.test(k)));
 const tool=(name,args,input)=>execFileSync(join(bin,name),args,{input,env,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']});
 const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',socket,'-p','55489','-U','block1_local_owner','-d','marocora_block1_local'];
 const sql=s=>tool('psql',args,s).trim();
 const as=(actor,q)=>JSON.parse(sql(`begin;set local role authenticated;set local request.jwt.claim.sub=${L(actor)};set local request.jwt.claim.role='authenticated';${q};commit;`));
 const source=[...baseline.map(n=>readFileSync(join(root,'supabase',n),'utf8')),...['quote_workflow.draft.sql','quote_commands.draft.sql'].map(n=>readFileSync(join(root,'supabase',n),'utf8')),readFileSync(join(root,'server/block1/local.sql'),'utf8')];
 const signature=createHash('sha256').update(source.join('\n')).digest('hex');
 const fresh=!existsSync(data);
 if(fresh)tool('initdb',['-D',data,'-U','block1_local_owner','--auth-local=trust','--auth-host=reject','--encoding=UTF8','--no-locale']);
 else if(!existsSync(join(dir,'local-state.json')))throw Error('UNRECOGNIZED_LOCAL_STATE');
 if(!fresh&&JSON.parse(readFileSync(join(dir,'local-state.json'),'utf8')).migrationHash!==signature)throw Error('LOCAL_MIGRATION_CHANGED_USE_NEW_SYNTHETIC_STATE_DIRECTORY');
 tool('pg_ctl',['-D',data,'-l',join(dir,'postgres.log'),'-o',`-k ${socket} -p 55489 -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);
 const stop=()=>{if(existsSync(join(data,'postmaster.pid')))tool('pg_ctl',['-D',data,'-m','fast','-w','stop']);rmSync(socket,{recursive:true,force:true});};
 try{
  if(fresh){
   tool('createdb',['-h',socket,'-p','55489','-U','block1_local_owner','marocora_block1_local']);
   sql(readFileSync(join(root,'tests/quote-sql/bootstrap.sql'),'utf8'));
   for(const s of source.slice(0,baseline.length))sql(s);
   const draft=s=>{if(!/\nrollback;\s*$/i.test(s))throw Error('DRAFT_GUARD_MISSING');return s.replace(/^begin;$/m,'').replace(/^rollback;\s*$/m,'');};
   sql('begin;'+draft(source[10])+draft(source[11])+source[12]+'commit;');
   writeFileSync(join(dir,'local-state.json'),JSON.stringify({migrationHash:signature,createdAt:new Date().toISOString()}),{mode:0o600});
  }
  const extension=readFileSync(join(root,'server/block1/block15.sql'),'utf8'),extensionHash=createHash('sha256').update(extension).digest('hex');
  const metadata=JSON.parse(readFileSync(join(dir,'local-state.json'),'utf8'));
  if(metadata.block15Hash&&metadata.block15Hash!==extensionHash)throw Error('LOCAL_BLOCK15_MIGRATION_CHANGED');
  if(!metadata.block15Hash){sql('begin;'+extension+'commit;');writeFileSync(join(dir,'local-state.json'),JSON.stringify({...metadata,block15Hash:extensionHash}),{mode:0o600});}
  if(block2){
   const extension=readFileSync(join(root,'server/block1/block2.sql'),'utf8'),hash=createHash('sha256').update(extension).digest('hex'),meta=JSON.parse(readFileSync(join(dir,'local-state.json'),'utf8'));
   if(meta.block2Hash&&meta.block2Hash!==hash)throw Error('LOCAL_BLOCK2_MIGRATION_CHANGED');
   if(!meta.block2Hash){sql('begin;'+extension+'commit;');writeFileSync(join(dir,'local-state.json'),JSON.stringify({...meta,block2Hash:hash}),{mode:0o600});}
  }
  sql(`update public.quote_settings set capture_enabled=${enableLocalFlow?'true':'false'},commands_enabled=${enableLocalFlow?'true':'false'},notifications_enabled=${enableLocalFlow?'true':'false'}`);
  const actorId=session=>typeof session==='string'?session:session.actor;
  const rpc=(session,name,params={})=>{if(!/^[a-z][a-z0-9_]+$/.test(name)||Object.keys(params).some(k=>!/^p_[a-z0-9_]+$/.test(k)))throw Error('INVALID_RPC');const literal=v=>v&&typeof v==='object'?J(v):typeof v==='boolean'?String(v):typeof v==='number'?String(v):v===null?'null':L(v);return as(actorId(session),`select to_jsonb(public.${name}(${Object.entries(params).map(([key,value])=>key+'=>'+literal(value)).join(',')}))`);};
  return {dir,sql,as,stop,signature,fresh,block2,mode:'local',rpc,
   instantRecord:(session,name,params={})=>{
    if(!['instant_record_order','instant_record_complete'].includes(name))throw Error('INVALID_RPC');
    const args={...params,p_actor:actorId(session)};
    return JSON.parse(sql(`begin;set local role service_role;set local request.jwt.claim.role='service_role';select public.${name}(${Object.entries(args).map(([key,value])=>key+'=>'+(value&&typeof value==='object'?J(value):value===null?'null':L(value))).join(',')});commit;`));
   },
   settings:()=>JSON.parse(sql('select to_jsonb(s) from public.quote_settings s')),
   options:()=>({readiness:JSON.parse(sql("select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'label','Synthetic regular/sworn translator')), '[]') from public.quote_provider_readiness r where state='enabled'")),policy:JSON.parse(sql("select jsonb_build_object('version',version,'digest',digest,'wording',wording) from public.quote_policies where kind='acceptance' order by approved_at desc limit 1"))}),
   recordScan:(session,id,hash,result)=>JSON.parse(sql(`select public.block15_record_scan(${L(id)},${L(hash)},${L(result.status)},${L(result.engine)},${L(result.reason)},${L(actorId(session))})`)),
   recordCredential:(session,id,fields,file,result)=>JSON.parse(sql(`select public.block2_record_credential(${L(id)},${L(actorId(session))},${J(fields)},${J(file)},${J(result)})`)),
   command:(session,c)=>as(actorId(session),`select public.quote_command(${L(c.commandId)}::uuid,${L(c.action)},${L(c.targetId)}::uuid,${Number(c.expectedRevision)},${J(c.payload)})`)};
 }catch(e){stop();throw e;}
}
export function seedLocalActors(db){
 if(db.mode==='staging')throw Error('SYNTHETIC_SEED_DENIED_IN_STAGING');
 const path=join(db.dir,'synthetic-actors.json');if(existsSync(path))return JSON.parse(readFileSync(path,'utf8'));
 const ids=Object.fromEntries(['customer','staff','provider','otherStaff','outsider','replacement','application','approval','readiness'].map(k=>[k,randomUUID()]));
 db.sql(`insert into auth.users(id,email,email_confirmed_at) values ${['customer','staff','provider','otherStaff','outsider','replacement'].map(k=>`(${L(ids[k])},${L(k+'@block1.invalid')},clock_timestamp())`).join(',')};
 insert into public.learning_review_staff(user_id) values(${L(ids.staff)}),(${L(ids.otherStaff)});
 insert into public.block1_local_settings(owner_id) values(${L(ids.staff)});
 insert into public.vendor_applications(id,source,source_key,user_id,email,name,category,fields,revision,status) values(${L(ids.application)},'translator',${L('block1:'+ids.application)},${L(ids.provider)},'provider@block1.invalid','Local synthetic regular translator','translation','{}',1,'approved');
 insert into public.vendor_application_events(id,application_id,actor_id,kind,delivery) values(${L(ids.approval)},${L(ids.application)},${L(ids.staff)},'approved','external');
 insert into public.quote_policies(kind,version,digest,wording,approved_at,approved_by) values
 ('participation','block1-local-participation',public.quote_digest('"LOCAL SYNTHETIC PARTICIPATION ONLY"'),'{"en":"LOCAL SYNTHETIC PARTICIPATION ONLY","fr":"LOCAL TEST","ar":"LOCAL TEST","es":"LOCAL TEST"}',clock_timestamp(),${L(ids.staff)}),
 ('acceptance','block1-local-acceptance',public.quote_digest('"LOCAL TEST ONLY: acceptance records the exact quoted scope, total, turnaround and terms. No work is scheduled and no payment is due. No live commercial policy is approved."'),'{"en":"LOCAL TEST ONLY: acceptance records the exact quoted scope, total, turnaround and terms. No work is scheduled and no payment is due. No live commercial policy is approved.","fr":"LOCAL TEST ONLY","ar":"LOCAL TEST ONLY","es":"LOCAL TEST ONLY"}',clock_timestamp(),${L(ids.staff)});`);
 const policy=JSON.parse(db.sql("select jsonb_build_object('digest',digest) from public.quote_policies where kind='participation'"));
 const caps={services:['Document Translation','Business Translation','Website & Digital Translation','Other Language Service',...(db.block2?['Sworn Translation (Morocco)']:[])],directions:[{source:'English',target:'French'},{source:'Arabic',target:'English'},{source:'English',target:'Arabic'}],currencies:['MAD','EUR','USD'],availability:'Synthetic local availability',specialAssessment:'Regular translation only'};
 // Synthetic fixture provisioning is owner-only and does not activate public gates.
 const send=(actor,action,payload,revision)=>JSON.parse(db.sql(`begin;set local request.jwt.claim.sub=${L(actor)};select public.quote_command_core(${L(randomUUID())},${L(action)},${L(ids.readiness)},${revision},${J(payload)});commit;`));
 send(ids.staff,'propose_readiness',{applicationId:ids.application,capabilities:caps,policyVersion:'block1-local-participation',policyDigest:policy.digest},0);
 const r=JSON.parse(db.sql(`select to_jsonb(r) from public.quote_provider_readiness r where id=${L(ids.readiness)}`));
 send(ids.provider,'acknowledge_participation',{capabilityDigest:r.capability_digest,policyVersion:'block1-local-participation',policyDigest:policy.digest,language:'en'},1);
 send(ids.staff,'enable_readiness',{},2);
 writeFileSync(path,JSON.stringify(ids),{mode:0o600});return ids;
}
