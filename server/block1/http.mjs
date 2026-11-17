import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,openSync,closeSync,fsyncSync,unlinkSync,existsSync,chmodSync} from 'node:fs';
import {join,extname} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {root} from './database.mjs';
import {scope,uuid,record} from '../quote/contracts.mjs';
import {MAX_FILE_BYTES,MIME_TYPES,validateUpload,cloudmersiveScanner,CLOUDMERSIVE_QUARANTINE_MESSAGE} from './uploads.mjs';
import {credentialRoutes} from './block2-http.mjs';
import {instantRoutes} from './instant-http.mjs';
const id=v=>uuid(v);
const bad=(code,status=400)=>Object.assign(new Error(code),{status});
export function createLocalApp(db,actors={},{scanner,instantPricing=false,exchangeService}={}){
 if(db.block2&&scanner?.mockOnly!==true)throw Error('BLOCK2_MOCK_SCANNER_REQUIRED');
 scanner??=cloudmersiveScanner();
 const credentials=db.block2?credentialRoutes({db,scanner}):null;
 const instant=instantPricing?instantRoutes({db,scanner,exchangeService}):null;
 const sessions=new Map(),tickets=new Map();
 const files=join(db.dir,'documents');mkdirSync(files,{recursive:true,mode:0o700});chmodSync(files,0o700);
 const logins=Object.fromEntries((db.mode==='staging'?[]:['customer','staff','provider','otherStaff','outsider','replacement']).map(role=>{const token=randomBytes(32).toString('hex');tickets.set(token,{actor:actors[role],role});return [role,token];}));
 const stats={emailsSent:0,externalRequests:0};
 async function scan(fileId,hash,session,name){
  let result;
  try{result=await scanner.scan(join(files,fileId),hash,{name});}catch{result={status:'error',engine:scanner.engine||'unknown',reason:'SCANNER_ERROR'};}
  if(!result||!['clean','quarantined','infected','error'].includes(result.status))result={status:'error',engine:'unknown',reason:'INVALID_SCAN_RESULT'};
  if(createHash('sha256').update(readFileSync(join(files,fileId))).digest('hex')!==hash)result={status:'error',engine:'integrity',reason:'CONTENT_CHANGED'};
  return db.recordScan(session,fileId,hash,result);
 }
 let origin;
 const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
 const server=createServer(async(req,res)=>{
  const json=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj));};
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try{
   if(req.headers.host!==new URL(origin).host)throw bad('HOST_DENIED',403);
   const url=new URL(req.url,origin);
   if(!['GET','POST'].includes(req.method))throw bad('METHOD_DENIED',405);
   if(req.method==='POST'&&req.headers.origin!==origin)throw bad('ORIGIN_DENIED',403);
   const cookie=/(?:^|;\s*)block1=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'');
   let session=cookie&&sessions.get(cookie[1]);
   if(session&&session.expires<Date.now()){sessions.delete(cookie[1]);session=null;}
   if(req.headers.authorization!==undefined){
    const match=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(req.headers.authorization);
    if(!match||!db.authenticate)throw bad('INVALID_SUPABASE_TOKEN',401);session=await db.authenticate(match[1]);
   }else if(db.mode==='staging')session=null;
   async function body(limit){
    const chunks=[];let size=0;
    if(Number(req.headers['content-length']||0)>limit)throw bad('BODY_TOO_LARGE',413);
    for await(const part of req){size+=part.length;if(size>limit)throw bad('BODY_TOO_LARGE',413);chunks.push(part);}return Buffer.concat(chunks);
   }
   async function input(){if(req.headers['content-type']!=='application/json')throw bad('JSON_REQUIRED',415);try{return JSON.parse((await body(50000)).toString('utf8'));}catch(e){if(e.status)throw e;throw bad('INVALID_JSON');}}
   if(url.pathname==='/api/staging-login'&&req.method==='POST'&&db.mode==='staging'){const p=await input();record(p,['email','password']);if(typeof p.email!=='string'||typeof p.password!=='string'||p.email.length>320||p.password.length>1000)throw bad('INVALID_SIGN_IN');return json(200,await db.signIn(p.email,p.password));}
   if(url.pathname==='/api/local-login'&&req.method==='POST'){
    if(db.mode==='staging')throw bad('SYNTHETIC_LOGIN_DISABLED',403);
    const p=await input();record(p,['ticket']);const who=tickets.get(p.ticket);
    if(!who)throw bad('INVALID_LOCAL_TICKET',401);tickets.delete(p.ticket);
    const token=randomBytes(32).toString('hex');session={...who,csrf:randomBytes(32).toString('hex'),expires:Date.now()+8*3600000};sessions.set(token,session);
    res.setHeader('Set-Cookie',`block1=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
    return json(200,{localOnly:true});
   }
   if(url.pathname.startsWith('/api/')){
    if(!session)throw bad('LOCAL_SIGN_IN_REQUIRED',401);
    if(req.method==='POST'&&!session.bearer&&req.headers['x-csrf-token']!==session.csrf)throw bad('CSRF_DENIED',403);
    if(instant&&await instant({req,url,session,input,body,json,res}))return;
    const actor=session.actor;
    if(credentials){const handled=await credentials({req,url,session,input,body,json});if(handled){if(handled.bytes){res.setHeader('Content-Type',handled.mime);res.setHeader('Content-Disposition','attachment; filename="'+handled.fileName+'"');res.end(handled.bytes);}return;}}
    if(req.method==='POST'&&url.pathname==='/api/logout'){if(cookie)sessions.delete(cookie[1]);res.setHeader('Set-Cookie','block1=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(200,{ok:true});}
    if(req.method==='GET'&&url.pathname==='/api/me')return json(200,{role:session.role,...(session.bearer?{email:session.email}:{}),block2:!!db.block2,csrf:session.csrf,staging:db.mode==='staging',localOnly:db.mode!=='staging',scanner:{available:scanner.available,engine:scanner.engine},uploads:{maxBytes:MAX_FILE_BYTES,types:MIME_TYPES},switches:await db.settings(session)});
    if(req.method==='GET'&&url.pathname==='/api/requests')return json(200,await db.rpc(session,'block1_list'));
    if(req.method==='GET'&&url.pathname==='/api/options'){
     if(!['staff','otherStaff'].includes(session.role))throw bad('UNAVAILABLE',403);
     return json(200,await db.options(session));
    }
    if(req.method==='POST'&&url.pathname==='/api/requests'){
     const p=await input();record(p,db.block2?['requestId','fields','draft']:['requestId','fields']);if(db.block2&&p.draft!==undefined&&typeof p.draft!=='boolean')throw bad('INVALID_DRAFT');id(p.requestId);
     record(p.fields,db.block2?['name','phone','service','source','target','description','certified']:['name','phone','service','source','target','description']);
     const f=p.fields,sc=scope({service:f.service,source:f.source,target:f.target,description:f.description,...(f.certified!==undefined?{certified:f.certified}:{})});
     const fields={name:f.name,...(f.phone?{phone:f.phone}:{})};
     return json(200,await db.rpc(session,db.block2?'block2_capture':'block1_capture',{p_id:p.requestId,p_scope:sc,p_fields:fields,...(db.block2?{p_draft:p.draft===true}:{})}));
    }
    const submit=/^\/api\/requests\/([a-f0-9-]+)\/submit$/.exec(url.pathname);
    if(db.block2&&submit&&req.method==='POST'){const p=await input();record(p,[]);return json(200,await db.rpc(session,'block2_submit',{p_id:id(submit[1])}));}
    const detail=/^\/api\/requests\/([a-f0-9-]+)$/.exec(url.pathname);
    if(detail&&req.method==='GET')return json(200,await db.rpc(session,'block15_detail',{p_id:id(detail[1])}));
    if(req.method==='POST'&&url.pathname==='/api/command'){
     const c=await input();record(c,['commandId','action','targetId','expectedRevision','payload']);id(c.commandId);id(c.targetId);
     if(!Number.isSafeInteger(c.expectedRevision)||c.expectedRevision<0)throw bad('INVALID_REVISION');
     if(!['invite_provider','respond_assignment','issue_offer','accept_offer','decline_offer','withdraw_offer','cancel_request','close_unfulfilled','transfer_owner'].includes(c.action))throw bad('UNSUPPORTED_COMMAND');
     // Only the request's staff owner may issue; SQL records actual issuer.
     const q=await db.rpc(session,'block15_detail',{p_id:c.targetId});
     if(['invite_provider','issue_offer','transfer_owner','close_unfulfilled'].includes(c.action)&&q.ownerId!==actor)throw bad('STAFF_OWNER_REQUIRED',403);
     if(c.action==='issue_offer'&&['Certified / Sworn Translation','Interpretation'].includes(q.scope?.service))throw bad('REGULAR_TRANSLATION_ONLY');
     return json(200,await db.command(session,c));
    }
    const upload=/^\/api\/requests\/([a-f0-9-]+)\/files\/([a-f0-9-]+)$/.exec(url.pathname);
    if(upload&&req.method==='POST'){
     const requestId=id(upload[1]),fileId=id(upload[2]);
     const q=await db.rpc(session,'block1_detail',{p_id:requestId});
     if(q.role!=='customer')throw bad('CUSTOMER_REQUIRED',403);
     if(db.block2)await db.rpc(session,'block2_upload_check',{p_id:requestId});
     let name;try{name=decodeURIComponent(req.headers['x-file-name']||'');}catch{throw bad('INVALID_NAME');}
     const bytes=await body(MAX_FILE_BYTES),validated=validateUpload(bytes,name,req.headers['content-type']),hash=validated.sha256;
     const path=join(files,fileId);let created=false;
     if(existsSync(path)){if(createHash('sha256').update(readFileSync(path)).digest('hex')!==hash)throw bad('FILE_CONFLICT',409);}
     else{const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,bytes);fsyncSync(fd);created=true;}finally{closeSync(fd);}}
     let saved;
     try{saved=await db.rpc(session,'block15_register_file',{p_id:fileId,p_request:requestId,p_name:name,p_size:bytes.length,p_hash:hash,p_mime:validated.mime});}
     catch(e){if(created)unlinkSync(path);throw e;}
     if(saved.needsScan)saved=await scan(fileId,hash,session,name);
     return json(saved.scanStatus==='clean'?200:202,{id:fileId,scanStatus:saved.scanStatus,mediaType:validated.mime,message:saved.scanStatus==='clean'?'Scanned; authorized downloads available.':CLOUDMERSIVE_QUARANTINE_MESSAGE});
    }
    const rescan=/^\/api\/files\/([a-f0-9-]+)\/rescan$/.exec(url.pathname);
    if(rescan&&req.method==='POST'){
     if(!(await db.settings(session)).commands_enabled)throw bad('COMMANDS_DISABLED',403);
     const file=await db.rpc(session,'block15_scan_target',{p_id:id(rescan[1])});
     return json(200,await scan(file.id,file.sha256,session,file.name));
    }
    const download=/^\/api\/files\/([a-f0-9-]+)$/.exec(url.pathname);
    if(download&&req.method==='GET'){
     const file=await db.rpc(session,'block15_file',{p_id:id(download[1])});
     const bytes=readFileSync(join(files,file.id));if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw bad('FILE_INTEGRITY_FAILURE',503);
     res.setHeader('Content-Type',file.media_type+(file.media_type==='text/plain'?'; charset=utf-8':''));res.setHeader('Content-Disposition',`attachment; filename="document${extname(file.name).toLowerCase()}"; filename*=UTF-8''${encodeURIComponent(file.name)}`);res.end(bytes);return;
    }
    throw bad('NOT_FOUND',404);
   }
   // Explicit read-only static surface. No state directory, DB, server source,
   // production auth scripts, upload blobs or bearer tickets are served here.
   if(req.method!=='GET')throw bad('NOT_FOUND',404);
   let path=url.pathname==='/'?'/block1-local.html':url.pathname;
   if(instantPricing&&path==='/translation-request.html')path='/instant-quote.html';
   const allowed=new Set(['/block1-local.html','/block1-local.mjs','/translation-workspace.html','/block1-workspace.mjs','/block1-request.mjs','/translation-request.html','/translation-thank-you.html','/translation-copy.mjs','/site-extra-copy.mjs','/site-language.css','/translation-service.css','/receipt.css','/block1.css',...(db.mode==='staging'?['/staging-login.html','/staging-login.mjs']:[]),...(db.block2?['/block2-contracts.mjs','/block2-credentials.html','/block2-credentials.mjs']:[])]);
   if(instantPricing)for(const path of ['/instant-quote.html','/instant-quote.mjs','/instant-quote.css'])allowed.add(path);
   if(!allowed.has(path))throw bad('NOT_FOUND',404);
   const localUI=path.startsWith('/instant-')||path.startsWith('/staging-')||path.startsWith('/block2-')||path.startsWith('/block1-')||path==='/block1.css'||path==='/translation-workspace.html';
   let text=readFileSync(join(root,...(localUI?['server','block1','ui']:[]),path.slice(1)));
   if(path.endsWith('.html')){
    let html=text.toString();html=html.replace(/<script type="module" src="site-language\.mjs[^>]*><\/script>/g,'');
    if(path==='/translation-request.html')html=html.replace('</body>','<script type="module" src="block1-request.mjs"></script></body>');
    text=Buffer.from(html);
   }
   res.writeHead(200,{'Content-Type':(types[extname(path)]||'application/octet-stream')+'; charset=utf-8'});res.end(text);
  }catch(e){
   const raw=String(e.stderr||e.message||'');const codes=['SWORN_CREDENTIAL_REQUIRED','REQUEST_SUBMITTED','REQUEST_NOT_SUBMITTED','ORIGINAL_SCAN_REQUIRED','MOROCCO_ONLY','IN_PERSON_REQUIRED','FULFILLMENT_REQUIRED','EXTRA_COSTS_ACK_REQUIRED','ENCRYPTION_ACK_REQUIRED','DOB_FORMAT','DOB_INVALID','UNAVAILABLE','STAFF_OWNER_REQUIRED','CUSTOMER_REQUIRED','REGULAR_TRANSLATION_ONLY','EXACT_ACCEPTANCE_REQUIRED','STALE_REVISION','COMMAND_CONFLICT','REQUEST_CONFLICT','PROVIDER_INELIGIBLE','OFFER_EXPIRED','OFFER_UNAVAILABLE','INVALID_STATE','FILES_LOCKED_AFTER_QUOTE','FILE_LIMIT','CAPTURE_DISABLED','COMMANDS_DISABLED','FILE_CONFLICT','REQUEST_LIMIT','FILE_QUARANTINED','DOCUMENTS_QUARANTINED'];
   const httpStatus=Number.isInteger(e.status)&&e.status>=400&&e.status<=599?e.status:null;
   const code=codes.find(c=>raw.includes(c))||httpStatus&&e.message||'INVALID_REQUEST';
   req.resume();
   json(httpStatus||(['UNAVAILABLE','STAFF_OWNER_REQUIRED','CUSTOMER_REQUIRED','PROVIDER_INELIGIBLE','FILE_QUARANTINED','SWORN_CREDENTIAL_REQUIRED'].includes(code)?403:['STALE_REVISION','COMMAND_CONFLICT','REQUEST_CONFLICT','FILES_LOCKED_AFTER_QUOTE','FILE_CONFLICT','DOCUMENTS_QUARANTINED','REQUEST_SUBMITTED','REQUEST_NOT_SUBMITTED'].includes(code)?409:400),{error:code});
  }
 });
 return {server,logins,stats,scannerInfo:{available:scanner.available,engine:scanner.engine},async listen(port=0){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});origin=`http://127.0.0.1:${server.address().port}`;return origin;},close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();})};
}
