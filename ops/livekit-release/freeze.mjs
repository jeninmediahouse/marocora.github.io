// Freeze committed, explicitly eligible nonsecret source only. No worktree read.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {candidate,baseline,sha256,safeRelative,requireThat,noLinks} from './contract.mjs';
export function eligible(path){
 if(!safeRelative(path)||/\.(?:pem|key|p12|pfx|dump|sqlite|bak)(?:\.|$)/i.test(path)||path.includes('-evidence/'))return false;
 return /^(?:server|learn|scripts|tests|emails|supabase|\.github)\//.test(path)||path.startsWith('ops/livekit-release/')||/^docs\/(?:deployment\/(?:LIVEKIT-|HANDOFF-LIVEKIT-)|learning\/LIVEKIT-)/.test(path)||(!path.includes('/')&&/\.(?:html|mjs|js|css|svg|png|jpe?g|webp|ico|json|yaml|md|txt|xml)$/i.test(path))||['CNAME','.gitignore','.gitattributes'].includes(path);
}
export function freeze(repository,output){
 const git=args=>execFileSync('git',args,{cwd:repository,maxBuffer:100*1024*1024,stdio:['ignore','pipe','pipe']});
 const commit=git(['rev-parse','HEAD']).toString().trim();requireThat(/^[a-f0-9]{40}$/.test(commit),'RELEASE_COMMIT_REQUIRED');
 const entries=git(['ls-tree','-rz','--full-tree',commit]).toString().split('\0').filter(Boolean).map(line=>{const tab=line.indexOf('\t');return {meta:line.slice(0,tab).split(' '),path:line.slice(tab+1)};}).filter(f=>eligible(f.path)).sort((a,b)=>a.path.localeCompare(b.path,'en'));
 requireThat(entries.length>0&&entries.every(f=>['100644','100755'].includes(f.meta[0])&&f.meta[1]==='blob'),'RELEASE_REGULAR_SOURCE_REQUIRED');
 const files=entries.map(f=>({path:f.path,sha256:sha256(git(['cat-file','blob',f.meta[2]]))}));
 // Parent must already exist; do not overwrite an earlier package or traverse links.
 noLinks(resolve(output,'..'));mkdirSync(output,{mode:0o700});
 const archive=join(output,'source.tar');git(['archive','--format=tar','--output='+archive,commit,'--',...files.map(f=>f.path)]);
 const manifest={version:1,sourceCommit:commit,videoEnabled:false,candidate,baseline,sourceArchive:{file:'source.tar',sha256:sha256(readFileSync(archive))},files,sqlite:{schema:'seven learning_room_* STRICT JSON tables; no user_version migration marker',path:candidate.dataDir+'/learning-room-state/sessions.sqlite',backup:'local sqlite3 .backup; manual retention; no scheduled job'},acceptance:{startupDeadlineSeconds:60,observationSeconds:900},pending:['Owner review and fresh baseline/configuration inventory','CI for frozen commit; no push authorized','Ubuntu frozen-lockfile dependency install and production build; artifact hashes','Nginx effective configuration review and drain/restore acceptance','Owner-injected private configuration and approved DATA_DIR confirmation','Private filesystem and backup/restore rehearsal on Ubuntu','Isolated provider/restart/revocation staging before any video activation'],executionAuthorized:false};
 const bytes=JSON.stringify(manifest,null,2)+'\n';writeFileSync(join(output,'release-manifest.json'),bytes,{flag:'wx',mode:0o600});
 writeFileSync(join(output,'SHA256SUMS'),`${sha256(bytes)}  release-manifest.json\n${manifest.sourceArchive.sha256}  source.tar\n`,{flag:'wx',mode:0o600});
 return {commit,manifestSha256:sha256(bytes),sourceArchiveSha256:manifest.sourceArchive.sha256,files:files.length};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{if(process.argv.length!==3)throw Error();console.log(JSON.stringify(freeze(process.cwd(),resolve(process.argv[2]))));}
 catch{console.error('LIVEKIT_SOURCE_FREEZE_FAILED');process.exitCode=1;}
}
