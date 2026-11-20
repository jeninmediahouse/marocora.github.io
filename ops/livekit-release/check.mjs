import {request as httpRequest} from 'node:http';
import {readFileSync,readlinkSync,realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {candidate,noLinks,privateDirectory,requireThat,verifyManifest} from './contract.mjs';
// Explicit Host is required: the loopback URL identifies the socket, while Host
// identifies the approved site. No redirects, credentials or provider requests.
function localRequest(base,path,{host,method='GET',origin}={}){
 return new Promise((resolve,reject)=>{
  const req=httpRequest(new URL(path,base),{method,headers:{Host:host,...(origin?{Origin:origin}:{})},signal:AbortSignal.timeout(5000)},res=>{
   const chunks=[];let size=0;
   res.on('data',chunk=>{size+=chunk.length;if(size>4096){req.destroy(Error('RELEASE_HTTP_RESPONSE_TOO_LARGE'));return;}chunks.push(chunk);});
   res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));
   res.on('error',()=>reject(Error('RELEASE_HTTP_REQUEST_FAILED')));
  });
  req.on('error',()=>reject(Error('RELEASE_HTTP_REQUEST_FAILED')));req.end();
 });
}
export async function healthCheck(base='http://127.0.0.1:4195'){
 const target=new URL(base);
 requireThat(target.protocol==='http:'&&target.hostname==='127.0.0.1'&&!target.username&&!target.password&&target.pathname==='/'&&!target.search&&!target.hash,'RELEASE_CHECK_LOOPBACK_REQUIRED');
 const checks=[['/health','marocora.com',200],['/health','www.marocora.com',200],['/health','fixture.invalid',403],['/api/learning/room-config','marocora.com',401],['/api/local/learning-login','marocora.com',404],['/learning-room.html','marocora.com',302]];
 for(const [path,host,status] of checks){
  const r=await localRequest(target,path,{host});requireThat(r.status===status,'RELEASE_HTTP_CHECK_FAILED');
  if(path==='/health'&&status===200){let value;try{value=JSON.parse(r.body);}catch{throw Error('RELEASE_HEALTH_BODY_FAILED');}requireThat(JSON.stringify(value)==='{"status":"ok"}','RELEASE_HEALTH_BODY_FAILED');}
 }
 const foreign=await localRequest(target,'/api/learning/room-token',{method:'POST',host:'marocora.com',origin:'https://fixture.invalid'});
 requireThat(foreign.status===403,'RELEASE_ORIGIN_CHECK_FAILED');
 return {status:'LIVEKIT_OFF_HTTP_CHECKS_OK',checks:7,authenticatedGateChecked:false,persistenceChecked:false,providerChecked:false};
}
export function metadata(expectedManifestHash){
 const root=candidate.path;verifyManifest(root,readFileSync(join(root,'release-manifest.json')),expectedManifestHash);
 const dir=join(candidate.dataDir,'release-attestations');privateDirectory(dir);
 const path=join(dir,candidate.pm2Name+'.json'),s=noLinks(path);requireThat(s.isFile()&&s.uid===process.getuid()&&(s.mode&0o777)===0o600,'RELEASE_ATTESTATION_FILE_INVALID');
 const a=JSON.parse(readFileSync(path,'utf8'));
 requireThat(Number.isSafeInteger(a.pid)&&a.pid>1&&a.candidatePath===root&&a.pm2Name===candidate.pm2Name&&a.videoEnabled===false&&a.listening===true&&a.modernKeySelected===true&&a.readOnlyReadiness===true,'RELEASE_ATTESTATION_INVALID');
 const m=JSON.parse(readFileSync(join(root,'release-manifest.json'),'utf8'));requireThat(a.sourceCommit===m.sourceCommit,'RELEASE_ATTESTATION_COMMIT_MISMATCH');
 process.kill(a.pid,0);
 requireThat(readlinkSync('/proc/'+a.pid+'/cwd')===root&&realpathSync('/proc/'+a.pid+'/exe')===candidate.interpreter,'RELEASE_PROCESS_IDENTITY_MISMATCH');
 // /proc/PID/stat is metadata, never argv/environ. Compare kernel start time to
 // attestation so a stale file plus reused PID cannot pass.
 const stat=readFileSync('/proc/'+a.pid+'/stat','utf8'),ticks=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
 requireThat(a.kernelStartTicks===ticks&&a.bootId===readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim(),'RELEASE_STALE_ATTESTATION');
 return {status:'LIVEKIT_RELEASE_IDENTITY_OK',pid:a.pid,sourceCommit:a.sourceCommit,videoEnabled:false};
}
const codes=new Set(['LIVEKIT_RELEASE_READY','LIVEKIT_RELEASE_START_FAILED','PRODUCTION_START_FAILED','PRODUCTION_SCHEMA_REQUIRED','CONFIGURATION_OR_BIND_FAILED','REQUEST_FAILED','LIVEKIT_ROOM_SETUP_FAILED','LIVEKIT_TOKEN_FAILED','LIVEKIT_RELEASE_PENDING','ROOM_RECOVERY_CONFIGURATION_MISMATCH']);
export function classify(lines){const counts={recognized:0,unclassified:0,codes:{}};for(const line of lines){const code=line.trim();if(codes.has(code)){counts.recognized++;counts.codes[code]=(counts.codes[code]||0)+1;}else if(code)counts.unclassified++;}return counts;}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{if(process.argv[2]==='health'&&process.argv.length===3)console.log(JSON.stringify(await healthCheck()));else if(process.argv[2]==='metadata'&&process.argv.length===4)console.log(JSON.stringify(metadata(process.argv[3])));else throw Error();}
 catch{console.error('LIVEKIT_RELEASE_CHECK_FAILED');process.exitCode=1;}
}
