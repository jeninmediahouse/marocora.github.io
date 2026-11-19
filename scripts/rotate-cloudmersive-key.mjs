// Companion to rotate-cloudmersive-key.sh. Importing exports performs no rotation.
import {
 readFileSync,lstatSync,writeFileSync,mkdirSync,chmodSync,openSync,closeSync,
 fsyncSync,fchownSync,fchmodSync,renameSync,unlinkSync,realpathSync
} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {homedir,userInfo} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseEnv} from 'node:util';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const repairedName=/^(?:CLOUDMERSIVE_API_KEY|LOUDMERSIVE_API_KEY)\d*$/;
const setting=/^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=(.*)$/;
const reject=code=>{throw Error(code);};
export function prepareCloudmersiveEnvironment(original,key){
 if(typeof key!=='string'||!/^[A-Za-z0-9_+/=-]{16,4096}$/.test(key))reject('INVALID_REPLACEMENT_FORMAT');
 const before=parseEnv(original);
 if(!before.CLOUDMERSIVE_API_KEY)reject('EXISTING_KEY_REQUIRED_FOR_ROLLBACK');
 if(key===before.CLOUDMERSIVE_API_KEY)reject('REPLACEMENT_MUST_DIFFER');
 const lines=original.match(/[^\n]*(?:\n|$)/g).filter(Boolean);
 const kept=lines.filter(line=>{
  const match=setting.exec(line.replace(/\r?\n$/,''));
  if(!match||!repairedName.test(match[1]))return true;
  const value=match[2].trim(),quote=value[0];
  if(['"',"'",'`'].includes(quote)&&value.indexOf(quote,1)<0)reject('MULTILINE_KEY_REQUIRES_REVIEW');
  return false;
 });
 const ending=original.includes('\r\n')?'\r\n':'\n';
 let content=kept.join('');if(content&&!content.endsWith('\n'))content+=ending;
 content+='CLOUDMERSIVE_API_KEY='+key+ending;
 const after=parseEnv(content);
 if(after.CLOUDMERSIVE_API_KEY!==key)reject('ENVIRONMENT_PARSE_MISMATCH');
 for(const [name,value] of Object.entries(before)){
  if(!repairedName.test(name)&&after[name]!==value)reject('UNRELATED_SETTING_WOULD_CHANGE');
 }
 for(const name of Object.keys(after)){
  if(!repairedName.test(name)&&!Object.hasOwn(before,name))reject('UNRELATED_SETTING_WOULD_CHANGE');
 }
 return {content,before};
}

function atomicWrite(path,bytes,stat){
 const temporary=join(dirname(path),'.env-cloudmersive-'+randomUUID());let fd;
 try{
  fd=openSync(temporary,'wx',0o600);writeFileSync(fd,bytes);
  fchownSync(fd,stat.uid,stat.gid);fchmodSync(fd,0o600);fsyncSync(fd);closeSync(fd);fd=undefined;
  renameSync(temporary,path);
 }finally{if(fd!==undefined)closeSync(fd);try{unlinkSync(temporary);}catch{}}
}
function unchanged(path,bytes){
 const stat=lstatSync(path);return stat.isFile()&&!stat.isSymbolicLink()&&readFileSync(path).equals(bytes);
}

// Dependencies are constructor-only test seams; the human CLI has no skip-scan,
// dry-run-success, alternate provider or authorization-bypass switch.
export async function rotateCloudmersive({envPath,backupRoot,key,runtimeOldKey,scan,restart,health,save,log=()=>{}}){
 let stage='environment preflight',changed=false,backup,stat,original,candidate;
 try{
  stat=lstatSync(envPath);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.uid!==process.getuid()||stat.size>1024*1024)reject('UNSAFE_ENVIRONMENT_FILE');
  original=readFileSync(envPath);
  const prepared=prepareCloudmersiveEnvironment(original.toString('utf8'),key);
  if(typeof runtimeOldKey!=='string'||!runtimeOldKey)reject('RUNTIME_ROLLBACK_KEY_REQUIRED');
  if(runtimeOldKey===key)reject('REPLACEMENT_ALREADY_IN_RUNTIME');
  candidate=Buffer.from(prepared.content);
  stage='replacement synthetic PDF scan';
  const result=await scan({...prepared.before,CLOUDMERSIVE_API_KEY:key});
  if(result?.status!=='clean'||result?.engine!=='Cloudmersive')reject('REPLACEMENT_SCAN_NOT_CLEAN');
  log('PASS: Replacement key scanned the synthetic PDF clean through the production adapter.');
  stage='private backup';
  mkdirSync(backupRoot,{recursive:true,mode:0o700});
  const directory=lstatSync(backupRoot);
  if(!directory.isDirectory()||directory.isSymbolicLink()||directory.uid!==process.getuid())reject('UNSAFE_BACKUP_DIRECTORY');
  chmodSync(backupRoot,0o700);
  backup=join(backupRoot,'cloudmersive-env-'+randomUUID());
  writeFileSync(backup,original,{flag:'wx',mode:0o600});
  log('BACKUP: '+backup);
  stage='atomic environment update';
  if(!unchanged(envPath,original))reject('CONCURRENT_ENVIRONMENT_EDIT');
  atomicWrite(envPath,candidate,stat);changed=true;
  stage='PM2 environment update and restart';await restart(key);
  stage='application health';if(!await health())reject('HEALTH_CHECK_FAILED');
  stage='PM2 save';await save();
  log('SUCCESS: Replacement saved, explicitly loaded into PM2, health checked and PM2 saved.');
  log('PASS: Provider revocation is separate; revoke the exposed key only after this success.');
  return {backup};
 }catch{
  let rollback='not_needed';
  if(changed){
   try{
    if(!unchanged(envPath,candidate))reject('CONCURRENT_ENVIRONMENT_EDIT');
    atomicWrite(envPath,original,stat);
    await restart(runtimeOldKey);
    if(!await health())reject('ROLLBACK_HEALTH_FAILED');
    await save();rollback='restored';
    log('ROLLBACK: Original environment and previous runtime key restored; PM2 healthy and saved.');
   }catch{rollback='requires_attention';log('ROLLBACK: Could not complete automatic recovery. Inspect privately; use the retained backup.');}
  }
  const error=Error('ROTATION_FAILED');error.stage=stage;error.rollback=rollback;error.backup=backup;throw error;
 }
}

function pm2(args,env=process.env){
 return execFileSync('pm2',args,{env,encoding:'utf8',timeout:20000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
}
function runningApp({requireOnline=true}={}){
 const matches=JSON.parse(pm2(['jlist'])).filter(app=>app.name==='marocora');
 if(matches.length!==1)reject('EXPECTED_SINGLE_PM2_PROCESS');
 const app=matches[0],env=app.pm2_env;
 if((requireOnline&&env.status!=='online')||env.exec_mode!=='fork_mode')reject('EXPECTED_ONLINE_FORK_PROCESS');
 const root=realpathSync(env.pm_cwd);
 if(!root.startsWith('/srv/marocora/')||realpathSync(env.pm_exec_path)!==join(root,'server/start-production.mjs'))reject('UNEXPECTED_PM2_ENTRYPOINT');
 return {app,root};
}
async function main(){
 let stage='runtime preflight';
 try{
  process.umask(0o077);
  if(userInfo().username!=='marocora'||Number(process.versions.node.split('.')[0])<24)reject('REQUIRES_MAROCORA_AND_NODE_24');
  let key='';for await(const chunk of process.stdin){key+=chunk;if(key.length>4096)reject('KEY_TOO_LONG');}
  const envPath='/srv/marocora/app/.env',initial=runningApp();
  const fileEnv=parseEnv(readFileSync(envPath,'utf8'));
  const runtimeOldKey=initial.app.pm2_env.CLOUDMERSIVE_API_KEY??initial.app.pm2_env.env?.CLOUDMERSIVE_API_KEY??fileEnv.CLOUDMERSIVE_API_KEY;
  const {cloudmersiveScanner}=await import(pathToFileURL(join(initial.root,'server/block1/uploads.mjs')).href);
  const {PDFDocument}=await import('pdf-lib');
  await rotateCloudmersive({envPath,backupRoot:join(homedir(),'.marocora-env-backups'),key,runtimeOldKey,
   scan:async env=>{
    const pdf=await PDFDocument.create();pdf.addPage().drawText('Marocora synthetic PDF key rotation canary.');
    const bytes=Buffer.from(await pdf.save()),digest=createHash('sha256').update(bytes).digest('hex');
    return cloudmersiveScanner({env,timeoutMs:30000}).scanBytes(bytes,digest,{name:'canary.pdf'});
   },
   restart:async value=>{
    const before=runningApp({requireOnline:false});if(before.root!==initial.root)reject('PM2_RELEASE_CHANGED');
    // Explicit process environment is intentional: --update-env alone does NOT
    // read .env, and a previous environment value overrides Node --env-file.
    pm2(['restart',String(before.app.pm_id),'--update-env'],{...process.env,CLOUDMERSIVE_API_KEY:value});
    const after=runningApp({requireOnline:false});
    if(after.root!==initial.root||(after.app.pm2_env.CLOUDMERSIVE_API_KEY??after.app.pm2_env.env?.CLOUDMERSIVE_API_KEY)!==value)reject('PM2_ENVIRONMENT_NOT_UPDATED');
   },
   health:async()=>{
    for(let attempt=0;attempt<30;attempt++){
     try{
      const responses=await Promise.all(['marocora.com','www.marocora.com'].map(host=>fetch('http://127.0.0.1:4195/health',{headers:{Host:host},signal:AbortSignal.timeout(3000)})));
      const healthy=responses.every(response=>response.status===200);
      await Promise.all(responses.map(response=>response.body?.cancel()));if(healthy)return true;
     }catch{}
     await new Promise(resolve=>setTimeout(resolve,2000));
    }return false;
   },
   save:async()=>{pm2(['save']);},log:line=>console.log(line)
  });
 }catch(error){
  console.error('FAIL: '+(error.stage||stage)+'. No key values or provider/PM2 details printed.');
  if(error.rollback==='not_needed')console.error('PASS: No environment update or PM2 restart was performed.');
  process.exitCode=1;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
