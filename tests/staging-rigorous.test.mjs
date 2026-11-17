import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createStagingDatabase} from '../server/block1/supabase-database.mjs';
import {createLocalApp} from '../server/block1/http.mjs';
import {mockCloudmersive} from './fixtures/cloudmersive-mock.mjs';
import {verifyStagingSql} from '../scripts/test-staging-sql.mjs';
const token='synthetic.payload.signature';
const config={url:'https://mock-cloud.invalid',anon:'DUMMY_ANON',service:'DUMMY_SERVICE'};
const off={capture_enabled:false,commands_enabled:false,notifications_enabled:false};
async function fixture(run){
 const directory=mkdtempSync(join(tmpdir(),'marocora-rigorous-')),actor=randomUUID(),calls=[];
 const state={user:{id:actor,email:'customer@staging.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',is_anonymous:false,user_metadata:{role:'staff'}},role:'customer',fail:null};
 const fetcher=async(input,options)=>{
  const url=new URL(input),headers=new Headers(options.headers),path=url.pathname;
  assert.equal(url.origin,config.url);assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);
  calls.push({path,authorization:headers.get('authorization'),body:options.body});
  if(path==='/auth/v1/user')return state.authError?Response.json({message:state.authError,code:'bad_jwt'},{status:401}):Response.json(state.user);
  assert.equal(headers.get('authorization'),'Bearer '+token);
  if(path.endsWith('/translation_session_context'))return state.unallowlisted?Response.json({message:'UNAVAILABLE',code:'P0001'},{status:403}):Response.json(state.context||{actor,role:state.role});
  if(state.fail==='timeout')throw Object.assign(Error('synthetic timeout'),{name:'TimeoutError'});
  if(state.fail==='500')return Response.json({message:'SYNTHETIC_PRIVATE_DATABASE_DETAIL',code:'XX000'},{status:500});
  if(path.endsWith('/translation_runtime_settings'))return Response.json(off);
  if(path.endsWith('/translation_scan_detail'))return Response.json({ownerId:actor,scope:{service:'Document Translation'}});
  if(path.endsWith('/quote_command'))return Response.json({message:'COMMANDS_DISABLED',code:'P0001'},{status:400});
  if(path.endsWith('/translation_list'))return Response.json([]);
  throw Error('UNEXPECTED_MOCK_CALL');
 };
 const db=createStagingDatabase(config,{directory,fetcher}),app=createLocalApp(db,{}, {scanner:mockCloudmersive().scanner});
 try{const origin=await app.listen();await run({db,origin,state,calls,actor});}
 finally{await app.close();rmSync(directory,{recursive:true,force:true});}
}
const auth={Authorization:'Bearer '+token};
for(const kind of ['invalid JWT','expired token','unconfirmed email','anonymous user'])test('Mock-cloud Auth fails closed: '+kind,()=>fixture(async({origin,state,calls})=>{
 if(kind==='invalid JWT'||kind==='expired token')state.authError=kind;
 if(kind==='unconfirmed email')state.user.email_confirmed_at=null;
 if(kind==='anonymous user')state.user.is_anonymous=true;
 const response=await fetch(origin+'/api/me',{headers:{...auth,'x-role':'staff',Cookie:'block1='+'a'.repeat(64)}});
 assert.equal(response.status,401);assert.equal((await response.json()).error,'INVALID_SUPABASE_TOKEN');
 assert.ok(calls.every(c=>c.path==='/auth/v1/user'));
}));
test('Mock-cloud database allowlist denies a confirmed user claiming staff metadata',()=>fixture(async({origin,state,calls})=>{
 state.unallowlisted=true;
 const r=await fetch(origin+'/api/options',{headers:{...auth,'x-role':'staff'}});
 assert.equal(r.status,400);assert.equal((await r.json()).error,'UNAVAILABLE');
 assert.ok(!calls.some(c=>c.path.endsWith('/translation_workspace_options')));
}));
test('Mock-cloud database customer role overrides staff metadata and headers',()=>fixture(async({origin})=>{
 const me=await fetch(origin+'/api/me',{headers:auth});assert.equal((await me.json()).role,'customer');
 assert.equal((await fetch(origin+'/api/options',{headers:{...auth,'x-role':'staff'}})).status,403);
}));
for(const context of [{role:'staff'},{actor:randomUUID(),role:'staff'},{role:'administrator'}])test('Mock-cloud rejects missing/mismatched identity or unknown database role '+JSON.stringify(context),()=>fixture(async({db,state,actor})=>{
 state.context={actor,...context};if(!Object.hasOwn(context,'actor')&&context.role==='staff')delete state.context.actor;
 await assert.rejects(db.authenticate(token),e=>e.status===401&&e.message==='INVALID_SUPABASE_CONTEXT');
}));
for(const kind of ['timeout','500'])test('Mock-cloud RPC '+kind+' returns 503 and server recovers',()=>fixture(async({origin,state})=>{
 state.fail=kind;
 const r=await fetch(origin+'/api/requests',{headers:auth});assert.equal(r.status,503);
 const body=await r.json();assert.equal(body.error,'STAGING_RPC_FAILED');assert.ok(!JSON.stringify(body).includes('PRIVATE_DATABASE'));
 state.fail=null;const recovered=await fetch(origin+'/api/requests',{headers:auth});assert.equal(recovered.status,200);assert.deepEqual(await recovered.json(),[]);
}));
test('Mock-cloud all switches OFF propagates database refusal of workflow command',()=>fixture(async({origin,state,calls})=>{
 state.role='staff';const me=await fetch(origin+'/api/me',{headers:auth});assert.deepEqual((await me.json()).switches,off);
 const r=await fetch(origin+'/api/command',{method:'POST',headers:{...auth,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({commandId:randomUUID(),targetId:randomUUID(),expectedRevision:0,action:'cancel_request',payload:{}})});
 assert.equal(r.status,400);assert.equal((await r.json()).error,'COMMANDS_DISABLED');
 assert.ok(calls.some(c=>c.path.endsWith('/quote_command'))); // SQL, not a cached UI switch, is authoritative.
}));
test('Network lock rejects HTTP, fetch, raw TCP/TLS, DNS and UDP before connection; caught attempts still fail process',()=>{
 const child=spawnSync(process.execPath,['--import','./tests/fixtures/block16-network-guard.mjs','--import','./scripts/test-network-lock.mjs','--input-type=module','-e',`
 import assert from 'node:assert/strict';import http from 'node:http';import https from 'node:https';import net from 'node:net';import tls from 'node:tls';import dns from 'node:dns';import dgram from 'node:dgram';
 const probes=[()=>fetch('https://external.invalid'),()=>http.get('http://external.invalid'),()=>https.request('https://external.invalid'),()=>net.connect(443,'203.0.113.1'),()=>tls.connect({port:443,host:'203.0.113.1'}),()=>dns.lookup('external.invalid',()=>{}),()=>dns.promises.resolve4('external.invalid'),()=>new dns.Resolver().resolve4('external.invalid',()=>{}),()=>new dns.promises.Resolver().resolve4('external.invalid'),()=>{const s=dgram.createSocket('udp4');try{s.send('test',53,'203.0.113.1');}finally{s.close();}}];
 for(const probe of probes)assert.throws(probe,/TEST_EXTERNAL_NETWORK_BLOCKED/);console.log('ISOLATION_PROBES_PASSED='+probes.length);
 `],{encoding:'utf8',env:{PATH:process.env.PATH}});
 assert.equal(child.status,1,child.stderr);assert.match(child.stdout,/ISOLATION_PROBES_PASSED=10/);assert.match(child.stdout,/TEST_NETWORK_LOCK: blocked=10/);
});
test('OS sandbox blocks an unguarded child TCP connection before internet egress',()=>{
 // Deliberately omit JS guards in this child to prove inherited kernel policy.
 // TEST-NET-3 is documentation-only; EPERM/EACCES must arrive immediately.
 const child=spawnSync(process.execPath,['--input-type=module','-e',`
 import net from 'node:net';
 const s=net.connect({host:'203.0.113.1',port:443});
 s.on('connect',()=>{s.destroy();process.exitCode=2;});
 s.on('error',e=>{console.log('OS_EGRESS_DENIED='+e.code);process.exitCode=['EPERM','EACCES'].includes(e.code)?1:3;});
 `],{encoding:'utf8',env:{PATH:process.env.PATH},timeout:2000});
 assert.equal(child.status,1,child.stderr);assert.match(child.stdout,/OS_EGRESS_DENIED=(EPERM|EACCES)/);
});
test('Disposable PostgreSQL migration, seed, RLS, scan privilege and safe reapplication',{timeout:60000},()=>verifyStagingSql());
