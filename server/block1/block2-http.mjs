import {mkdirSync,chmodSync,openSync,writeFileSync,closeSync,readFileSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {join,extname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {record,text,uuid} from '../quote/contracts.mjs';
import {validateUpload,MAX_FILE_BYTES} from './uploads.mjs';
import {validateDOB} from './ui/block2-contracts.mjs';
const fail=(code,status=400)=>{throw Object.assign(Error(code),{status});};
export function credentialRoutes({db,scanner}){
 const dir=join(db.dir,'credentials');mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);
 return async({req,url,session,input,body,json})=>{
  const actor=session.actor;
  if(url.pathname==='/api/credentials'&&req.method==='GET'){json(200,await db.rpc(session,'block2_credentials_list'));return true;}
  if(url.pathname==='/api/credentials'&&req.method==='POST'){
   if(!['provider','replacement'].includes(session.role))fail('PROVIDER_REQUIRED',403);
   if(!((await db.settings(session)).capture_enabled&&(await db.settings(session)).commands_enabled))fail('CAPTURE_DISABLED',403);
   let fields,name;try{fields=JSON.parse(decodeURIComponent(req.headers['x-credential-fields']||''));name=decodeURIComponent(req.headers['x-file-name']||'');}catch{fail('INVALID_CREDENTIAL');}
   record(fields,['legalName','dob','credentialNumber']);text(fields.legalName,200);validateDOB(fields.dob);text(fields.credentialNumber,100);
   const bytes=await body(MAX_FILE_BYTES),file=validateUpload(bytes,name,req.headers['content-type']);
   if(!['image/png','image/jpeg'].includes(file.mime))fail('CREDENTIAL_IMAGE_REQUIRED',415);
   const id=randomUUID(),pending=join(dir,id+'.pending'),path=join(dir,id);
   const fd=openSync(pending,'wx',0o600);try{writeFileSync(fd,bytes);}finally{closeSync(fd);}
   let result;try{
    try{result=await scanner.scan(pending,file.sha256,{name});}catch{result={status:'error',engine:'Cloudmersive',reason:'API_ERROR'};}
    if(!result||!['clean','infected','error'].includes(result.status)||createHash('sha256').update(readFileSync(pending)).digest('hex')!==file.sha256)result={status:'error',engine:'integrity',reason:'API_ERROR'};
    if(result.status==='clean')renameSync(pending,path);
    const saved=await db.recordCredential(session,id,fields,{name,mediaType:file.mime,size:file.size,sha256:file.sha256},result);
    json(result.status==='clean'?201:202,saved);return true;
   }catch(e){if(existsSync(path))unlinkSync(path);throw e;}finally{if(existsSync(pending))unlinkSync(pending);}
  }
  const review=/^\/api\/credentials\/([a-f0-9-]+)\/review$/.exec(url.pathname);
  if(review&&req.method==='POST'){
   const p=await input();record(p,['reviewId','expectedRevision','decision','reason']);uuid(p.reviewId);
   if(!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0)fail('INVALID_REVISION');
   text(p.reason,2000);text(p.decision,20);
   json(200,await db.rpc(session,'block2_review_credential',{p_id:uuid(review[1]),p_review:p.reviewId,p_revision:p.expectedRevision,p_decision:p.decision,p_reason:p.reason}));return true;
  }
  const download=/^\/api\/credentials\/([a-f0-9-]+)\/file$/.exec(url.pathname);
  if(download&&req.method==='GET'){
   const file=await db.rpc(session,'block2_credential_file',{p_id:uuid(download[1])}),bytes=readFileSync(join(dir,file.id));
   if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)fail('FILE_INTEGRITY_FAILURE',503);
   // JSON is deliberately not used for private binary bytes.
   return {bytes,fileName:'credential'+extname(file.name).toLowerCase(),mime:file.media_type};
  }
  return false;
 };
}
