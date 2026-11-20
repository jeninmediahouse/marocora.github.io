// Local SQLite online backup only; no network client, secrets, restore or pruning.
import {spawnSync} from 'node:child_process';
import {mkdirSync,lstatSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {privateDirectory,noLinks,requireThat} from './contract.mjs';
// Return fixed categories only. Never attach child stderr, argv, paths or input
// to the thrown error: these diagnostics also run against private runtime state.
export function sqliteFailureCode(result,stage){
 requireThat(['BACKUP','SNAPSHOT','INTEGRITY'].includes(stage),'BACKUP_INVALID_DIAGNOSTIC_STAGE');
 const text=String(result.stderr||'').slice(0,8192).toLowerCase();let reason;
 if(result.error?.code==='ETIMEDOUT')reason='TIMEOUT';
 else if(result.error?.code==='ENOENT')reason='EXECUTABLE_NOT_FOUND';
 else if(['EACCES','EPERM'].includes(result.error?.code))reason='PERMISSION_DENIED';
 else if(result.error)reason='PROCESS_ERROR';
 else if(result.signal)reason='TERMINATED';
 else if(/unknown (?:option|command)|unrecognized (?:option|command)/.test(text))reason='UNSUPPORTED_CLI';
 else if(/not authorized|authorization denied|not permitted|prohibited|unsafe/.test(text))reason='AUTHORIZATION_DENIED';
 else if(/readonly|read-only/.test(text))reason='READ_ONLY';
 else if(/permission denied/.test(text))reason='PERMISSION_DENIED';
 else if(/file is not a database|file is encrypted or is not a database|database disk image is malformed|malformed database/.test(text))reason='CORRUPT';
 else if(/database (?:is )?(?:locked|busy)/.test(text))reason='BUSY';
 else if(/disk (?:or database )?full|no space left/.test(text))reason='DISK_FULL';
 else if(/disk i\/o|input\/output error/.test(text))reason='IO_FAILED';
 else if(/unable to open|cannot open|no such file/.test(text))reason='OPEN_FAILED';
 else if(/wal|shm|locking protocol/.test(text))reason='WAL_OR_LOCK';
 else reason='UNCLASSIFIED';
 return 'BACKUP_SQLITE_FAILED_'+stage+'_'+reason;
}
export function backup({dataDir,backupDir,sqlite='/usr/bin/sqlite3'}){
 process.umask(0o077);
 // Fixed source basename; CLI never accepts arbitrary SQL or a credential path.
 for(const path of [dataDir,backupDir])requireThat(!path.split('/').some(p=>p.startsWith('.env')||/\.env(?:\.|$)/.test(p)),'BACKUP_PROTECTED_PATH_DENIED');
 privateDirectory(dataDir);privateDirectory(join(dataDir,'learning-room-state'));privateDirectory(backupDir);
 requireThat(noLinks(sqlite).isFile(),'BACKUP_SQLITE_EXECUTABLE_REQUIRED');
 const source=join(dataDir,'learning-room-state/sessions.sqlite'),s=noLinks(source);
 requireThat(s.isFile()&&s.uid===process.getuid()&&(s.mode&0o777)===0o600,'BACKUP_PRIVATE_SOURCE_REQUIRED');
 // .backup parser has its own quoting rules: reject unsupported destination characters.
 requireThat(/^[A-Za-z0-9_./-]+$/.test(backupDir),'BACKUP_DESTINATION_PATH_INVALID');
 const id='snapshot-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomBytes(8).toString('hex');
 const temp=join(backupDir,'.pending-'+id),final=join(backupDir,id);mkdirSync(temp,{mode:0o700});
 const target=join(temp,'sessions.sqlite');
 const run=(path,input,stage)=>{
  requireThat(['BACKUP','SNAPSHOT','INTEGRITY'].includes(stage),'BACKUP_INVALID_DIAGNOSTIC_STAGE');
  // Only the freshly created private snapshot may initialize journal state.
  // Source backup and final integrity verification always open read-only.
  requireThat(stage!=='SNAPSHOT'||(path===target&&path!==source),'BACKUP_WRITABLE_TARGET_DENIED');
  const r=spawnSync(sqlite,['-init','/dev/null','-batch','-bail',...(stage==='SNAPSHOT'?[]:['-readonly']),path],{input,encoding:'utf8',timeout:30000,maxBuffer:1024*1024,env:{PATH:'/usr/bin:/bin'}});
  if(r.error||r.status!==0)throw Error(sqliteFailureCode(r,stage));return r.stdout.trim();
 };
 run(source,`.timeout 5000\n.backup '${target}'\n`,'BACKUP');
 const out=lstatSync(target);requireThat(out.isFile()&&!out.isSymbolicLink()&&out.uid===process.getuid()&&(out.mode&0o777)===0o600,'BACKUP_PRIVATE_OUTPUT_REQUIRED');
 // A copied WAL-mode header can require journal/shared-memory initialization
 // on reopen. Normalize ONLY the completed snapshot into a standalone rollback-
 // journal database before its unchanged read-only integrity verification.
 requireThat(run(target,'.timeout 5000\nPRAGMA journal_mode=DELETE;\n','SNAPSHOT')==='delete','BACKUP_SNAPSHOT_JOURNAL_FAILED');
 requireThat(run(target,'PRAGMA integrity_check;\n','INTEGRITY')==='ok','BACKUP_INTEGRITY_FAILED');
 const verified=lstatSync(target);requireThat(verified.isFile()&&!verified.isSymbolicLink()&&verified.uid===process.getuid()&&(verified.mode&0o777)===0o600,'BACKUP_PRIVATE_OUTPUT_REQUIRED');
 renameSync(temp,final);return {status:'SQLITE_BACKUP_OK',snapshot:id,integrity:'ok'};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{if(process.argv.length!==4)throw Error();console.log(JSON.stringify(backup({dataDir:process.argv[2],backupDir:process.argv[3]})));}
 catch(error){const code=error?.message||'';console.error(/^BACKUP_SQLITE_FAILED_(?:BACKUP|SNAPSHOT|INTEGRITY)_[A-Z_]+$/.test(code)||code==='BACKUP_SNAPSHOT_JOURNAL_FAILED'?code:'SQLITE_BACKUP_FAILED');process.exitCode=1;}
}
