import {createServer} from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,chmodSync,symlinkSync,realpathSync,statSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {candidate,baseline,sha256,verifyManifest,validateRuntime,attestation} from '../ops/livekit-release/contract.mjs';
import {startVerified} from '../ops/livekit-release/launch.mjs';
import {freeze,eligible} from '../ops/livekit-release/freeze.mjs';
import {backup,sqliteFailureCode} from '../ops/livekit-release/backup.mjs';
import {classify,healthCheck} from '../ops/livekit-release/check.mjs';
import {startProductionServer} from '../server/production/http.mjs';
// Fixtures are retained in private OS temp directories; never touch owner data.
const temp=()=>mkdtempSync(join(realpathSync(tmpdir()),'marocora-release-fixture-'));
const required=['server/start-production.mjs','server/learning-room-store.mjs','pnpm-lock.yaml',candidate.entrypoint,'ops/livekit-release/contract.mjs'];
function fixture(){const root=temp(),files=required.map(path=>{mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),'SYNTHETIC_SOURCE\n');return {path,sha256:sha256('SYNTHETIC_SOURCE\n')};});const m={version:1,sourceCommit:'a'.repeat(40),videoEnabled:false,candidate,baseline,files};const bytes=JSON.stringify(m);return {root,m,bytes,hash:sha256(bytes)};}
const env={NODE_ENV:'production',HOST:'127.0.0.1',PORT:'4195',DATA_DIR:candidate.dataDir,TRUST_PROXY:'true',SUPABASE_REQUIRE_MODERN_KEYS:'true',LEARNING_VIDEO_MODE:'live',LEARNING_VIDEO_ENABLED:'false',LEARNING_VIDEO_DEBUG:'false',APP_ORIGINS:candidate.origins.join(',')};
const context={platform:'linux',nodeVersion:'24.20.0',user:'marocora',cwd:candidate.path,interpreter:candidate.interpreter};
test('release manifest pins content and rejects changed source, digest, missing files and unsafe paths',()=>{
 const f=fixture();assert.equal(verifyManifest(f.root,f.bytes,f.hash).sourceCommit,f.m.sourceCommit);
 assert.throws(()=>verifyManifest(f.root,f.bytes,'b'.repeat(64)),/HASH_MISMATCH/);
 writeFileSync(join(f.root,required[0]),'SYNTHETIC_TAMPER');assert.throws(()=>verifyManifest(f.root,f.bytes,f.hash),/SOURCE_HASH_MISMATCH/);
 for(const files of [f.m.files.slice(1),[{path:'../escape',sha256:'a'.repeat(64)}],[{path:'.env.fixture',sha256:'a'.repeat(64)}]] ){
  const bytes=JSON.stringify({...f.m,files});assert.throws(()=>verifyManifest(f.root,bytes,sha256(bytes)));
 }
});
test('source verification rejects symlink traversal and duplicate manifest entries',()=>{
 const f=fixture(),other=temp();writeFileSync(join(other,'entry.mjs'),'SYNTHETIC_SOURCE\n');symlinkSync(join(other,'entry.mjs'),join(f.root,'link.mjs'));
 for(const files of [[...f.m.files,{path:'link.mjs',sha256:sha256('SYNTHETIC_SOURCE\n')}],[...f.m.files,f.m.files[0]]]){const bytes=JSON.stringify({...f.m,files});assert.throws(()=>verifyManifest(f.root,bytes,sha256(bytes)));}
});
test('runtime contract refuses wrong deployment identity and every guarded configuration field',()=>{
 const {m}=fixture();validateRuntime(m,env,context);
 for(const key of Object.keys(env))assert.throws(()=>validateRuntime(m,{...env,[key]:'SYNTHETIC_WRONG'},context));
 for(const key of Object.keys(context))assert.throws(()=>validateRuntime(m,env,{...context,[key]:'SYNTHETIC_WRONG'}));
 assert.throws(()=>validateRuntime({...m,videoEnabled:true},env,context));
});
test('verified startup emits attestation only after successful listener/readiness and closes on record failure',async()=>{
 const {m}=fixture(),events=[];let closed=0;
 const options={env,context,configuration:()=>({keyMode:'modern'}),start:async()=>{events.push('readiness-and-listen');return {server:{address:()=>({port:4195,address:'127.0.0.1'})},close:async()=>closed++};},record:()=>events.push('attested')};
 await startVerified(m,options);assert.deepEqual(events,['readiness-and-listen','attested']);
 await assert.rejects(startVerified(m,{...options,record:()=>{throw Error('SYNTHETIC_DISK_FAILURE');}}));assert.equal(closed,1);
 const before=events.length;await assert.rejects(startVerified(m,{...options,configuration:()=>({keyMode:'legacy'})}));assert.equal(events.length,before);
 await assert.rejects(startVerified(m,{...options,start:async()=>{throw Error('SYNTHETIC_READINESS_FAILURE');}}));assert.equal(events.length,before);
});
test('attestation is an explicit nonsecret projection and does not claim persistent readiness',()=>{
 const {m}=fixture();m.secret='SYNTHETIC_NOT_ALLOWED';const a=attestation(m,{pid:123,startedAt:'2026-11-20T00:00:00Z',kernelStartTicks:'456',bootId:'synthetic-boot'});
 assert.equal(a.videoEnabled,false);assert.equal(a.persistentStoreVerified,false);assert.equal(JSON.stringify(a).includes('SYNTHETIC_NOT_ALLOWED'),false);assert.equal(a.kernelStartTicks,'456');
});
test('freeze packages committed source rather than dirty worktree and archive round-trip verifies',()=>{
 const repo=temp(),out=join(temp(),'package');
 const git=args=>execFileSync('git',args,{cwd:repo,stdio:['ignore','pipe','pipe']});git(['init','-q']);
 for(const path of required){mkdirSync(dirname(join(repo,path)),{recursive:true});writeFileSync(join(repo,path),'SYNTHETIC_SOURCE\n');}
 git(['add','--',...required]);git(['-c','user.name=Synthetic Fixture','-c','user.email=synthetic@fixture.invalid','commit','-qm','Synthetic release fixture']);
 writeFileSync(join(repo,required[0]),'SYNTHETIC_DIRTY_SOURCE');const result=freeze(repo,out);
 assert.equal(result.files,required.length);const extracted=temp();execFileSync('/usr/bin/tar',['-xf',join(out,'source.tar'),'-C',extracted]);
 const bytes=readFileSync(join(out,'release-manifest.json'));assert.equal(verifyManifest(extracted,bytes,result.manifestSha256).sourceCommit,result.commit);
 assert.equal(sha256(readFileSync(join(out,'source.tar'))),result.sourceArchiveSha256);
 assert.equal(readFileSync(join(extracted,required[0]),'utf8'),'SYNTHETIC_SOURCE\n');assert.throws(()=>freeze(repo,out));
 for(const path of ['.env','.env.example','server/name.env.secret','docs/foo-evidence/output.json','private.key','../escape'])assert.equal(eligible(path),false);
});
function stateFixture(){const root=temp(),dataDir=join(root,'data'),backupDir=join(root,'backups');mkdirSync(dataDir,{mode:0o700});mkdirSync(backupDir,{mode:0o700});mkdirSync(join(dataDir,'learning-room-state'),{mode:0o700});const source=join(dataDir,'learning-room-state/sessions.sqlite'),db=new DatabaseSync(source);chmodSync(source,0o600);db.exec("PRAGMA journal_mode=WAL; CREATE TABLE synthetic_state(value TEXT); INSERT INTO synthetic_state VALUES ('SYNTHETIC_RESERVED_MINUTES');");return {dataDir,backupDir,source,db};}
test('backup diagnostics identify subprocess stage and fixed reason without exposing child output',()=>{
 const cases=[
  [{error:{code:'ETIMEDOUT'},stderr:'SYNTHETIC_PRIVATE_OUTPUT'},'BACKUP','TIMEOUT'],
  [{error:{code:'ENOENT'}},'BACKUP','EXECUTABLE_NOT_FOUND'],
  [{stderr:'Error: unknown option: -SYNTHETIC_UNSUPPORTED'},'BACKUP','UNSUPPORTED_CLI'],
  [{stderr:'attempt to write a readonly database'},'BACKUP','READ_ONLY'],
  [{stderr:'unable to open database /synthetic/private/path SYNTHETIC_SECRET_DO_NOT_PRINT'},'BACKUP','OPEN_FAILED'],
  [{stderr:'database is locked'},'BACKUP','BUSY'],
  [{stderr:'file is not a database'},'INTEGRITY','CORRUPT'],
  [{stderr:'attempt to write a readonly database'},'SNAPSHOT','READ_ONLY'],
  [{signal:'SIGTERM'},'INTEGRITY','TERMINATED'],
  [{stderr:'SYNTHETIC_UNRECOGNIZED_PRIVATE_OUTPUT'},'INTEGRITY','UNCLASSIFIED']
 ];
 for(const [result,stage,reason] of cases)assert.equal(sqliteFailureCode(result,stage),'BACKUP_SQLITE_FAILED_'+stage+'_'+reason);
 assert.throws(()=>sqliteFailureCode({},'SYNTHETIC_UNTRUSTED_STAGE'),/BACKUP_INVALID_DIAGNOSTIC_STAGE/);
});
test('sqlite3 online backup includes committed WAL state and restores privately without changing source',()=>{
 const f=stateFixture();try{
  const result=backup(f);assert.equal(result.status,'SQLITE_BACKUP_OK');const target=join(f.backupDir,result.snapshot,'sessions.sqlite');assert.equal(statSync(target).mode&0o777,0o600);
  for(const suffix of ['-wal','-shm','-journal'])assert.equal(existsSync(target+suffix),false,'snapshot must be standalone');
  const restored=new DatabaseSync(target,{readOnly:true});try{
   assert.equal(restored.prepare('PRAGMA journal_mode').get().journal_mode,'delete');assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
   assert.equal(restored.prepare('SELECT value FROM synthetic_state').get().value,'SYNTHETIC_RESERVED_MINUTES');assert.equal(f.db.prepare('SELECT count(*) AS n FROM synthetic_state').get().n,1);
   assert.equal(f.db.prepare('PRAGMA journal_mode').get().journal_mode,'wal','source journal mode must remain unchanged');assert.equal(statSync(f.source).mode&0o777,0o600);
   f.db.exec("INSERT INTO synthetic_state VALUES ('SYNTHETIC_LATER_RESERVATION')");assert.equal(f.db.prepare('SELECT count(*) AS n FROM synthetic_state').get().n,2);assert.equal(restored.prepare('SELECT count(*) AS n FROM synthetic_state').get().n,1,'later source writes must not alter the snapshot');
  }finally{restored.close();}
 }finally{f.db.close();}
});
test('backup fails closed for absent/corrupt state, unsafe source permissions and symlink destinations',()=>{
 const f=stateFixture();f.db.close();chmodSync(f.source,0o644);assert.throws(()=>backup(f),/PRIVATE_SOURCE/);chmodSync(f.source,0o600);
 const alias=join(temp(),'alias');symlinkSync(f.backupDir,alias);assert.throws(()=>backup({...f,backupDir:alias}),/SYMLINK/);
 writeFileSync(f.source,'SYNTHETIC_CORRUPT');assert.throws(()=>backup(f),/SQLITE_FAILED/);
 const empty=temp();mkdirSync(join(empty,'learning-room-state'),{mode:0o700});assert.throws(()=>backup({...f,dataDir:empty}));
});
test('fixed log classifier discards arbitrary text and credential-shaped input',()=>{
 assert.deepEqual(classify(['LIVEKIT_RELEASE_READY','SYNTHETIC_TOKEN abc','PRODUCTION_START_FAILED secret','LIVEKIT_RELEASE_START_FAILED']),{recognized:2,unclassified:2,codes:{LIVEKIT_RELEASE_READY:1,LIVEKIT_RELEASE_START_FAILED:1}});
});
test('credential-free OFF checks run against actual production HTTP routing with synthetic adapters',async()=>{
 const app=await startProductionServer({env:{...env,PORT:'0',SUPABASE_URL:'https://service.fixture.invalid'},auth:{checkReady:async()=>{},authenticate:async()=>{throw Object.assign(Error('AUTH_REQUIRED'),{status:401});},db:{stop(){}}},storage:{kind:'spaces'},scanner:{mockOnly:false},learning:{close:async()=>{}},handleSignals:false,log:()=>{}});
 const observed=[];app.server.on('request',req=>observed.push({host:req.headers.host,method:req.method,path:req.url,origin:req.headers.origin}));
 try{
  const result=await healthCheck('http://127.0.0.1:'+app.server.address().port);assert.equal(result.status,'LIVEKIT_OFF_HTTP_CHECKS_OK');assert.equal(result.checks,7);assert.equal(result.persistenceChecked,false);assert.equal(result.providerChecked,false);assert.equal(result.authenticatedGateChecked,false);
  assert.deepEqual(observed.map(req=>req.host),['marocora.com','www.marocora.com','fixture.invalid','marocora.com','marocora.com','marocora.com','marocora.com']);
  assert.deepEqual(observed.at(-1),{host:'marocora.com',method:'POST',path:'/api/learning/room-token',origin:'https://fixture.invalid'});
 }finally{await app.close();}
});

test('OFF checks reject bad health bodies, redirects, foreign-host acceptance and foreign-origin acceptance',async()=>{
 for(const fault of ['invalid-json','wrong-body','redirect','host-accepted','origin-accepted']){
  let requests=0;
  const server=createServer((req,res)=>{
   requests++;
   if(req.headers.host==='fixture.invalid'){res.writeHead(fault==='host-accepted'?200:403);return res.end();}
   if(req.url==='/health'){
    if(fault==='redirect'){res.writeHead(302,{Location:'/health'});return res.end();}
    res.writeHead(200,{'Content-Type':'application/json'});return res.end(fault==='invalid-json'?'not-json':fault==='wrong-body'?'{}':'{"status":"ok"}');
   }
   res.writeHead(req.url==='/api/learning/room-config'?401:req.url==='/api/local/learning-login'?404:req.url==='/learning-room.html'?302:fault==='origin-accepted'?200:403);res.end();
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  try{
   const expected=['invalid-json','wrong-body'].includes(fault)?'RELEASE_HEALTH_BODY_FAILED':fault==='origin-accepted'?'RELEASE_ORIGIN_CHECK_FAILED':'RELEASE_HTTP_CHECK_FAILED';
   await assert.rejects(healthCheck('http://127.0.0.1:'+server.address().port),{message:expected},fault);
   if(fault==='redirect')assert.equal(requests,1,'redirects must not be followed');
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 }
 await assert.rejects(healthCheck('https://provider.fixture.invalid'),/RELEASE_CHECK_LOOPBACK_REQUIRED/);
});
