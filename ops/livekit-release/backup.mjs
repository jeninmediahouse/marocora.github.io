// Local SQLite online backup only; no network client, secrets, restore or pruning.
import {spawnSync} from 'node:child_process';
import {mkdirSync,lstatSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {privateDirectory,noLinks,requireThat} from './contract.mjs';
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
 const run=(path,input)=>{const r=spawnSync(sqlite,['-init','/dev/null','-batch','-bail','-readonly',path],{input,encoding:'utf8',timeout:30000,maxBuffer:1024*1024,env:{PATH:'/usr/bin:/bin'}});requireThat(!r.error&&r.status===0,'BACKUP_SQLITE_FAILED');return r.stdout.trim();};
 run(source,`.timeout 5000\n.backup '${target}'\n`);
 const out=lstatSync(target);requireThat(out.isFile()&&!out.isSymbolicLink()&&out.uid===process.getuid()&&(out.mode&0o777)===0o600,'BACKUP_PRIVATE_OUTPUT_REQUIRED');
 requireThat(run(target,'PRAGMA integrity_check;\n')==='ok','BACKUP_INTEGRITY_FAILED');
 renameSync(temp,final);return {status:'SQLITE_BACKUP_OK',snapshot:id,integrity:'ok'};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{if(process.argv.length!==4)throw Error();console.log(JSON.stringify(backup({dataDir:process.argv[2],backupDir:process.argv[3]})));}
 catch{console.error('SQLITE_BACKUP_FAILED');process.exitCode=1;}
}
