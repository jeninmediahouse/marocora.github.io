import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {optionalIntroVideo} from '../supply-client.mjs';
import {supplyCopy} from '../supply-copy.mjs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const baseline=read('supabase/migrations/202611200001_supply_onboarding.sql');
const migration=read('supabase/migrations/202611230001_supply_optional_intro_video.sql');
const preflight=read('supabase/preflight_supply_optional_intro_video.sql');
const original=baseline.match(/CREATE FUNCTION public\.supply_valid_profile\(t text,p jsonb\)[\s\S]*?END;\$\$;/)[0];
const old="coalesce(p->>'introVideo','') !~ '^https://[A-Za-z0-9.-]+(:443)?(/[^[:space:]<>]*)?$'";
const replacement="(coalesce(p->>'introVideo','')<>'' AND coalesce(p->>'introVideo','')\n     !~ '^https://[A-Za-z0-9.-]+(:443)?(/[^[:space:]<>]*)?$')";
const teacher={displayName:'Synthetic Teacher',bio:'Synthetic teaching profile.',publicationConsent:true,languages:['English'],hourlyRateMinor:25000,currency:'MAD',timezone:'Africa/Casablanca',availability:[{day:1,start:'09:00',end:'12:00'}],introVideo:'https://video.fixture.invalid/intro'};
const translator={displayName:'Synthetic Translator',bio:'Synthetic translation profile.',publicationConsent:true,organizationKind:'individual',languagePairs:[{source:'English',target:'French'}],specialties:['Legal']};
const transport={displayName:'Synthetic Transport',bio:'Synthetic transport profile.',publicationConsent:true,vehicleTypes:['van'],capacity:8,serviceRegions:['Rabat'],baseRateMinor:20000,currency:'MAD'};
const L=s=>"'"+String(s).replaceAll("'","''")+"'",J=v=>L(JSON.stringify(v))+'::jsonb';

test('optional-video migration changes exactly the original video predicate without grants or data writes',()=>{
 const actual=migration.match(/CREATE OR REPLACE FUNCTION[\s\S]*?END;\$\$;/g);assert.equal(actual.length,1);
 assert.equal(actual[0],original.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION').replace(old,replacement));
 const rest=migration.replace(/^--.*$/gm,'').replace(actual[0],'').trim();
 assert.equal(rest,"BEGIN;\nSET LOCAL lock_timeout='3s';\nSET LOCAL statement_timeout='15s';\n\nCOMMIT;");
 assert.doesNotMatch(actual[0],/\b(?:GRANT|REVOKE|DROP|INSERT|UPDATE|DELETE|TRUNCATE)\b/);
});
test('optional-video client accepts blank or plain HTTPS and rejects unsafe non-empty input before submission',()=>{
 for(const value of ['', '   ','https://video.fixture.invalid/intro','https://video.fixture.invalid:443/path?q=1'])assert.equal(optionalIntroVideo(value),value.trim());
 for(const value of ['http://video.fixture.invalid','javascript:alert(1)','//video.fixture.invalid','https://user@video.fixture.invalid','https://video.fixture.invalid:444/a','https://video.fixture.invalid/a b','https://video.fixture.invalid/<x>',null,42])assert.throws(()=>optionalIntroVideo(value));
 assert.match(read('supply-dashboard.mjs'),/introVideo:optionalIntroVideo\(data\.get\('introVideo'\)\)/);
});
test('optional video field retains its URL input and accessible translated hint without required',()=>{
 const html=read('supply-dashboard.html'),input=html.match(/<input\b[^>]*id="intro-video"[^>]*>/)[0];
 assert.match(input,/type="url"/);assert.doesNotMatch(input,/\brequired\b/);assert.match(input,/aria-describedby="intro-video-hint"/);
 for(const text of ['Optional. Leave blank or enter an HTTPS video link.','Leave the video link blank or use a plain HTTPS URL.'])for(const lang of ['en','fr','ar','es'])assert.ok(supplyCopy[text][lang]);
});
test('optional-video migration and read-only preflight preserve catalog ACLs and data on disposable Unix-socket PostgreSQL',()=>{
 const bin=process.env.QUOTE_PG_BIN||'/opt/homebrew/opt/postgresql@17/bin',dir=mkdtempSync('/private/tmp/moptional-'),data=join(dir,'pg'),socket=join(dir,'sock');mkdirSync(socket,{mode:0o700});
 const env={PATH:'/usr/bin:/bin:/opt/homebrew/bin',LANG:'C',LC_ALL:'C'},owner='optional_fixture_owner';let started=false;
 const tool=(name,args,input)=>execFileSync(join(bin,name),args,{input,env,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:16*1024*1024});
 const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',socket,'-p','55491','-U',owner,'-d','optional_fixture'];
 const sql=q=>tool('psql',args,q).trim(),value=q=>JSON.parse(sql(q));
 const valid=(type,p)=>value(`SELECT to_jsonb(public.supply_valid_profile(${L(type)},${J(p)}))`);
 const snap=()=>value(`SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg((to_jsonb(p)-'prosrc') || jsonb_build_object('body',CASE WHEN p.proname='supply_valid_profile' THEN 'allowed replacement' ELSE p.prosrc END) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace),
 'relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='public'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t WHERE NOT t.tgisinternal),
 'data',(SELECT jsonb_agg(to_jsonb(p) ORDER BY application_id) FROM public.supply_teacher_profiles p))`);
 try{
  tool('initdb',['-D',data,'-U',owner,'--auth-local=trust','--auth-host=reject','--encoding=UTF8','--no-locale']);
  tool('pg_ctl',['-D',data,'-l',join(dir,'pg.log'),'-o',`-k ${socket} -p 55491 -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);started=true;
  tool('createdb',['-h',socket,'-p','55491','-U',owner,'optional_fixture']);
  sql(read('tests/quote-sql/bootstrap.sql'));
  sql('CREATE TABLE public.learning_review_staff(user_id uuid PRIMARY KEY REFERENCES auth.users(id));CREATE TABLE public.learning_review_exclusions(user_id uuid PRIMARY KEY REFERENCES auth.users(id),reason text NOT NULL);');
  sql(baseline);
  assert.equal(value(preflight).verdict,'PROCEED');
  assert.equal(valid('teacher',{...teacher,introVideo:''}),false);
  sql(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('10000000-0000-4000-8000-000000000001','teacher@fixture.invalid',now());
   INSERT INTO public.supply_applications(id,owner_id,vendor_type) VALUES('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','teacher');
   INSERT INTO public.supply_teacher_profiles VALUES('20000000-0000-4000-8000-000000000002',${J(teacher)});`);
  const before=snap();sql(migration);assert.deepEqual(snap(),before);
  assert.equal(value(preflight).state,'ALREADY_UPDATED');sql(migration);assert.deepEqual(snap(),before);
  for(const introVideo of ['',teacher.introVideo])assert.equal(valid('teacher',{...teacher,introVideo}),true);
  for(const introVideo of ['http://video.fixture.invalid','javascript:alert(1)','https://a@b.fixture.invalid','https://video.fixture.invalid:444/a','https://video.fixture.invalid/a b'])assert.equal(valid('teacher',{...teacher,introVideo}),false);
  assert.equal(valid('teacher',{...teacher,availability:[]}),false);assert.equal(valid('teacher',{...teacher,introVideo:'',extra:true}),false);
  for(const [type,p] of [['translator',translator],['transport',transport]]){assert.equal(valid(type,p),true);assert.equal(valid(type,{...p,introVideo:''}),false);}
  sql(migration.replace(' RETURN true;',' RETURN false;'));assert.equal(value(preflight).verdict,'STOP');sql(migration);
  sql('GRANT EXECUTE ON FUNCTION public.supply_valid_profile(text,jsonb) TO anon;');assert.equal(value(preflight).failed_check,'EXISTING_OWNER_ONLY_ACL');
  sql('REVOKE EXECUTE ON FUNCTION public.supply_valid_profile(text,jsonb) FROM anon;');assert.equal(value(preflight).verdict,'PROCEED');
  assert.deepEqual(snap(),before);
 }finally{if(started)tool('pg_ctl',['-D',data,'-m','immediate','-w','stop']);}
});
