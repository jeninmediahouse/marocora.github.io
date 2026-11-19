import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync,statSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseEnv} from 'node:util';
import {prepareCloudmersiveEnvironment,rotateCloudmersive} from '../scripts/rotate-cloudmersive-key.mjs';

const OLD='SYNTHETIC_OLD_NOT_A_REAL_KEY',NEW='SYNTHETIC_NEW_NOT_A_REAL_KEY';
const original='APP_ORIGINS=https://app.example.invalid\nKEEP_ME="quoted value # literal"\nCLOUDMERSIVE_API_KEY='+OLD+'\n';
function fixture(t,extra={}){
 const root=mkdtempSync(join(tmpdir(),'marocora-key-rotation-test-')),envPath=join(root,'.env'),backupRoot=join(root,'private-backups'),calls=[],logs=[];
 t.after(()=>rmSync(root,{recursive:true,force:true}));writeFileSync(envPath,original,{mode:0o600});
 const options={envPath,backupRoot,key:NEW,runtimeOldKey:OLD,
  scan:async env=>{assert.equal(env.CLOUDMERSIVE_API_KEY,NEW);calls.push('scan');return {status:'clean',engine:'Cloudmersive'};},
  restart:async value=>calls.push(value===NEW?'restart-new':'restart-old'),
  health:async()=>{calls.push('health');return true;},save:async()=>calls.push('save'),log:line=>logs.push(line),...extra};
 return {root,envPath,backupRoot,calls,logs,options};
}
test('Rotation preparation repairs duplicate/typo key names without changing unrelated dotenv values',()=>{
 const source=original+'export CLOUDMERSIVE_API_KEY="'+OLD+'" # old duplicate\nLOUDMERSIVE_API_KEY=synthetic_typo\nCLOUDMERSIVE_API_KEY5=synthetic_typo\n';
 const result=prepareCloudmersiveEnvironment(source,NEW),env=parseEnv(result.content);
 assert.equal(env.CLOUDMERSIVE_API_KEY,NEW);assert.equal(env.KEEP_ME,'quoted value # literal');
 assert.equal(env.APP_ORIGINS,'https://app.example.invalid');
 assert.equal(Object.keys(env).filter(name=>name.includes('CLOUDMERSIVE')).length,1);
 assert.equal(env.LOUDMERSIVE_API_KEY,undefined);
 for(const value of [OLD,'',NEW+'\n',NEW+' ',NEW+'"'])assert.throws(()=>prepareCloudmersiveEnvironment(original,value));
 assert.throws(()=>prepareCloudmersiveEnvironment('CLOUDMERSIVE_API_KEY="first\nsecond"\n',NEW),/MULTILINE/);
 assert.throws(()=>prepareCloudmersiveEnvironment('NOTE="hello\nCLOUDMERSIVE_API_KEY=embedded\nworld"\n'+original,NEW),/UNRELATED/);
});
test('Rotation tests before update, preserves a private backup and saves only after health succeeds',async t=>{
 const f=fixture(t),result=await rotateCloudmersive(f.options);
 assert.deepEqual(f.calls,['scan','restart-new','health','save']);
 assert.equal(readFileSync(result.backup,'utf8'),original);
 assert.equal(statSync(result.backup).mode&0o777,0o600);assert.equal(statSync(f.backupRoot).mode&0o777,0o700);
 assert.equal(statSync(f.envPath).mode&0o777,0o600);assert.equal(parseEnv(readFileSync(f.envPath,'utf8')).CLOUDMERSIVE_API_KEY,NEW);
 assert.ok(!f.logs.join('\n').includes(NEW));assert.ok(!f.logs.join('\n').includes(OLD));
});
test('A scan error stops before updating environment or touching PM2, suppressing provider details',async t=>{
 const f=fixture(t,{scan:async()=>{throw Error(NEW+' private provider response');}});
 await assert.rejects(rotateCloudmersive(f.options),error=>error.stage==='replacement synthetic PDF scan'&&error.rollback==='not_needed'&&!String(error).includes(NEW));
 assert.equal(readFileSync(f.envPath,'utf8'),original);assert.deepEqual(f.calls,[]);assert.equal(existsSync(f.backupRoot),false);
 for(const result of [{status:'infected',engine:'Cloudmersive'},{status:'error',engine:'Cloudmersive'},{status:'clean',engine:'mock'}]){
  await assert.rejects(rotateCloudmersive({...f.options,scan:async()=>result}));
  assert.equal(readFileSync(f.envPath,'utf8'),original);
 }
});
test('Health failure restores both the original dotenv bytes and the actual prior runtime key',async t=>{
 let checks=0;const runtimeOldKey='SYNTHETIC_DIFFERENT_RUNTIME_KEY',restarts=[];
 const f=fixture(t,{runtimeOldKey,restart:async key=>restarts.push(key),health:async()=>++checks>1});
 await assert.rejects(rotateCloudmersive(f.options),error=>error.stage==='application health'&&error.rollback==='restored');
 assert.deepEqual(restarts,[NEW,runtimeOldKey]);assert.equal(readFileSync(f.envPath,'utf8'),original);assert.equal(checks,2);
 assert.deepEqual(f.calls,['scan','save']);assert.ok(f.logs.some(line=>line.startsWith('ROLLBACK: Original')));
});
test('A failed PM2 save also restores the previous key and saves the recovered process',async t=>{
 let saves=0;const f=fixture(t,{save:async()=>{if(++saves===1)throw Error(NEW);}});
 await assert.rejects(rotateCloudmersive(f.options),error=>error.stage==='PM2 save'&&error.rollback==='restored');
 assert.equal(saves,2);assert.equal(readFileSync(f.envPath,'utf8'),original);
 assert.deepEqual(f.calls,['scan','restart-new','health','restart-old','health']);
});
test('Concurrent edits and symlink paths are never silently overwritten during rotation or rollback',async t=>{
 const f=fixture(t);
 await assert.rejects(rotateCloudmersive({...f.options,scan:async()=>{
  writeFileSync(f.envPath,original+'OTHER_EDIT=preserve\n');return {status:'clean',engine:'Cloudmersive'};
 }}),error=>error.rollback==='not_needed');
 assert.match(readFileSync(f.envPath,'utf8'),/OTHER_EDIT=preserve/);assert.deepEqual(f.calls,[]);
 writeFileSync(f.envPath,original);
 await assert.rejects(rotateCloudmersive({...f.options,restart:async()=>{
  writeFileSync(f.envPath,readFileSync(f.envPath,'utf8')+'OTHER_EDIT=preserve\n');throw Error('RESTART_FAILED');
 }}),error=>error.rollback==='requires_attention');
 assert.match(readFileSync(f.envPath,'utf8'),/OTHER_EDIT=preserve/);
 const link=join(f.root,'linked-env');symlinkSync(f.envPath,link);
 await assert.rejects(rotateCloudmersive({...f.options,envPath:link}),error=>error.stage==='environment preflight');
});
