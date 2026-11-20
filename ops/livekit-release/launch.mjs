// Owner-injected inherited configuration only. Never opens an environment file.
import {readFileSync,writeFileSync,renameSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {userInfo} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {candidate,requireThat,noLinks,privateDirectory,verifyManifest,validateRuntime,attestation} from './contract.mjs';
export async function startVerified(m,{env,context,configuration,start,record}){
 validateRuntime(m,env,context);
 requireThat(configuration(env)?.keyMode==='modern','RELEASE_MODERN_KEYS_REQUIRED');
 const app=await start();
 try{
  requireThat(app.server.address()?.port===candidate.port&&app.server.address()?.address===candidate.host,'RELEASE_LISTENER_MISMATCH');
  await record();return app;
 }catch(error){await app.close();throw error;}
}
export async function launch(manifestPath,expectedHash){
 process.umask(0o077);
 const startedAt=new Date().toISOString();
 requireThat(manifestPath===join(candidate.path,'release-manifest.json'),'RELEASE_MANIFEST_PATH_MISMATCH');
 requireThat(noLinks(manifestPath).isFile(),'RELEASE_MANIFEST_FILE_REQUIRED');
 const m=verifyManifest(candidate.path,readFileSync(manifestPath),expectedHash);
 const context={platform:process.platform,nodeVersion:process.versions.node,user:userInfo().username,cwd:realpathSync(process.cwd()),interpreter:realpathSync(process.execPath)};
 requireThat(realpathSync(fileURLToPath(import.meta.url))===join(candidate.path,candidate.entrypoint),'RELEASE_LAUNCHER_PATH_MISMATCH');
 privateDirectory(candidate.dataDir); // Require preprovisioned private app data; never chmod it.
 const targetDir=join(candidate.dataDir,'release-attestations');privateDirectory(targetDir);
 const {cloudConfiguration}=await import(pathToFileURL(join(candidate.path,'server/block1/supabase-database.mjs')));
 const {startProductionServer}=await import(pathToFileURL(join(candidate.path,'server/production/http.mjs')));
 // This performs the existing read-only runtime-v4 readiness check before listening.
 return startVerified(m,{env:process.env,context,configuration:cloudConfiguration,start:()=>startProductionServer({log:()=>{}}),record:()=>{
  const target=join(targetDir,candidate.pm2Name+'.json'),temp=join(targetDir,'.attestation-'+randomBytes(12).toString('hex'));
  writeFileSync(temp,JSON.stringify(attestation(m,{pid:process.pid,startedAt,kernelStartTicks:readFileSync('/proc/self/stat','utf8').slice(readFileSync('/proc/self/stat','utf8').lastIndexOf(')')+2).split(' ')[19],bootId:readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()}))+'\n',{flag:'wx',mode:0o600});renameSync(temp,target);
  console.log('LIVEKIT_RELEASE_READY');
 }});
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{if(process.argv.length!==4)throw Error();await launch(process.argv[2],process.argv[3]);}
 catch{console.error('LIVEKIT_RELEASE_START_FAILED');process.exitCode=1;}
}
