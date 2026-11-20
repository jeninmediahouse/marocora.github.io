import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,realpathSync} from 'node:fs';
import {isAbsolute,join,resolve,sep} from 'node:path';
export const candidate={pm2Name:'marocora-livekit-20261120-r1',path:'/srv/marocora/releases/livekit-20261120-r1',entrypoint:'ops/livekit-release/launch.mjs',user:'marocora',interpreter:'/usr/bin/node',instances:1,execMode:'fork',watch:false,host:'127.0.0.1',port:4195,dataDir:'/var/lib/marocora',origins:['https://marocora.com','https://www.marocora.com']};
export const baseline={pm2Name:'marocora-modern-346be72',path:'/srv/marocora/releases/supabase-346be72.HQbk1j',commit:'346be721e626a6dfab425985213490dc7e3d6d3e',entrypoint:'server/start-production.mjs',reconfirmationRequired:true,videoEnabled:false,updateEnv:false};
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function requireThat(value,code){if(!value)throw Error(code);}
export function safeRelative(path){return typeof path==='string'&&path.length>0&&!isAbsolute(path)&&!path.includes('\\')&&!path.split('/').some(p=>!p||p==='.'||p==='..'||p.startsWith('.env')||/\.env(?:\.|$)/.test(p));}
export function noLinks(path){
 requireThat(isAbsolute(path)&&resolve(path)===path,'RELEASE_ABSOLUTE_PATH_REQUIRED');
 let current=sep;
 for(const part of path.split(sep).filter(Boolean)){current=join(current,part);requireThat(!lstatSync(current).isSymbolicLink(),'RELEASE_SYMLINK_DENIED');}
 return lstatSync(path);
}
export function privateDirectory(path){const s=noLinks(path);requireThat(s.isDirectory()&&s.uid===process.getuid()&&(s.mode&0o777)===0o700,'RELEASE_PRIVATE_DIRECTORY_REQUIRED');}
export function verifyManifest(root,bytes,expectedHash){
 requireThat(/^[a-f0-9]{64}$/.test(expectedHash)&&sha256(bytes)===expectedHash,'RELEASE_MANIFEST_HASH_MISMATCH');
 const m=JSON.parse(bytes);
 requireThat(m.version===1&&/^[a-f0-9]{40}$/.test(m.sourceCommit)&&m.videoEnabled===false&&JSON.stringify(m.candidate)===JSON.stringify(candidate)&&JSON.stringify(m.baseline)===JSON.stringify(baseline),'RELEASE_MANIFEST_CONTRACT_MISMATCH');
 requireThat(Array.isArray(m.files)&&m.files.length>0,'RELEASE_SOURCE_LIST_REQUIRED');
 const seen=new Set();
 for(const f of m.files){
  requireThat(safeRelative(f.path)&&!seen.has(f.path)&&/^[a-f0-9]{64}$/.test(f.sha256),'RELEASE_SOURCE_LIST_INVALID');seen.add(f.path);
  const target=join(root,f.path);requireThat(noLinks(target).isFile()&&sha256(readFileSync(target))===f.sha256,'RELEASE_SOURCE_HASH_MISMATCH');
 }
 for(const name of ['server/start-production.mjs','server/learning-room-store.mjs','pnpm-lock.yaml',candidate.entrypoint,'ops/livekit-release/contract.mjs'])requireThat(seen.has(name),'RELEASE_REQUIRED_SOURCE_MISSING');
 return m;
}
export function validateRuntime(m,env,context){
 requireThat(context.platform==='linux'&&Number(context.nodeVersion.split('.')[0])>=24&&context.user===candidate.user&&context.cwd===candidate.path&&context.interpreter===candidate.interpreter,'RELEASE_RUNTIME_IDENTITY_MISMATCH');
 for(const [key,value] of Object.entries({NODE_ENV:'production',HOST:candidate.host,PORT:String(candidate.port),DATA_DIR:candidate.dataDir,TRUST_PROXY:'true',SUPABASE_REQUIRE_MODERN_KEYS:'true',LEARNING_VIDEO_MODE:'live',LEARNING_VIDEO_ENABLED:'false',LEARNING_VIDEO_DEBUG:'false'}))requireThat(env[key]===value,'RELEASE_CONFIGURATION_MISMATCH');
 requireThat(env.APP_ORIGINS===candidate.origins.join(','),'RELEASE_ORIGINS_MISMATCH');
 requireThat(m.videoEnabled===false,'RELEASE_VIDEO_MUST_REMAIN_OFF');
}
export function attestation(m,{pid,startedAt,kernelStartTicks,bootId}){return {version:1,pid,kernelStartTicks,bootId,sourceCommit:m.sourceCommit,candidatePath:candidate.path,pm2Name:candidate.pm2Name,videoEnabled:false,modernKeySelected:true,readOnlyReadiness:true,listening:true,persistentStoreVerified:false,startedAt,verifiedAt:new Date().toISOString()};}
