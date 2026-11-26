import {uuid} from '../quote/contracts.mjs';
import {validateUpload} from '../block1/uploads.mjs';
import {encryptPayout} from './payout.mjs';
import {createSupplyNotifier, createSupplyReviewerNotifier} from '../supply-notify.mjs';
const fail=(code,status=400)=>{throw Object.assign(Error(code),{status});};
const record=(p,keys)=>{if(!p||Object.getPrototypeOf(p)!==Object.prototype||Object.keys(p).some(k=>!keys.includes(k)))fail('SUPPLY_INVALID_INPUT');return p;};
export function supplyRoutes({auth,storage,scanner,env,fetcher,logger}){
 const rpc=(session,name,args={})=>auth.supplyRpc(session,name,args);
 const notify=createSupplyNotifier({env,fetcher,logger});
 const notifyReviewer=createSupplyReviewerNotifier({env,fetcher,logger});
 const log=logger??console;
 return async({req,url,session,input,body,json,res})=>{
  if(!url.pathname.startsWith('/api/supply/'))return false;
  const path=url.pathname;
  if(path==='/api/supply/applications'&&req.method==='GET'){json(res,200,await rpc(session,'supply_my_applications'));return true;}
  if(path==='/api/supply/applications'&&req.method==='POST'){
   const p=record(await input(),['type','profile','id','revision']);
   const saved=await rpc(session,'supply_save_application',{p_type:p.type,p_profile:p.profile,p_id:p.id?uuid(p.id):null,p_revision:p.revision??0});
   // Never block or fail the submission on mail; the dashboard remains authoritative.
   void notify({kind:'submitted',application:{id:saved?.id,email:session.email},revision:saved?.revision});
   void notifyReviewer({applicationId:saved?.id,displayName:saved?.profile?.displayName,type:saved?.type,revision:saved?.revision});
   json(res,200,saved);return true;
  }
  if(path==='/api/supply/admin'&&req.method==='GET'){json(res,200,{admin:await rpc(session,'supply_admin_access')});return true;}
  if(path==='/api/supply/review'&&req.method==='GET'){json(res,200,await rpc(session,'supply_review_queue'));return true;}
  if(path==='/api/supply/applications/all'&&req.method==='GET'){
   const rows=await rpc(session,'supply_all_applications');if(rows===null)fail('SUPPLY_ADMIN_REQUIRED',403);json(res,200,rows);return true;
  }
  const review=/^\/api\/supply\/applications\/([^/]+)\/review$/.exec(path);
  if(review&&req.method==='POST'){
   const p=record(await input(),['revision','decision','reason','credentialsReviewed']);
   const decided=await rpc(session,'supply_review_application',{p_id:uuid(review[1]),p_revision:p.revision,p_decision:p.decision,p_reason:p.reason??'',p_credentials_reviewed:p.credentialsReviewed===true});
   if(decided?.status==='approved'||decided?.status==='rejected'){
    void (async()=>{
     try{
      const email=await rpc(session,'supply_application_email',{p_id:decided.id});
      await notify({kind:decided.status,application:{id:decided.id,email},revision:decided.reviewed_revision??decided.revision});
     }catch{log.warn('SUPPLY_DECISION_EMAIL_LOOKUP_FAILED');}
    })();
   }
   json(res,200,decided);return true;
  }
  const payout=/^\/api\/supply\/applications\/([^/]+)\/payout$/.exec(path);
  if(payout&&req.method==='POST'){
   const id=uuid(payout[1]);const rows=await rpc(session,'supply_my_applications');if(!rows.some(a=>a.id===id))fail('SUPPLY_APPLICATION_NOT_FOUND',404);
   const {envelope,lastFour}=encryptPayout(await input(),{key:env.SUPPLY_PAYOUT_ENCRYPTION_KEY,actor:session.actor,applicationId:id});
   json(res,200,await auth.supplyServiceRpc('supply_save_payout',{p_actor:session.actor,p_id:id,p_envelope:envelope,p_last_four:lastFour}));return true;
  }
  const upload=/^\/api\/supply\/applications\/([^/]+)\/credentials$/.exec(path);
  if(upload&&req.method==='POST'){
   const id=uuid(upload[1]);await rpc(session,'supply_upload_context',{p_id:id});
   if(!scanner.available||typeof scanner.scanBytes!=='function')fail('SUPPLY_SCANNER_UNAVAILABLE',503);
   const name=req.headers['x-file-name'];if(typeof name!=='string'||!/^credential\.(pdf|png|jpg|jpeg)$/.test(name))fail('SUPPLY_INVALID_CREDENTIAL');
   const bytes=await body(5*1024*1024),file=validateUpload(bytes,name,req.headers['content-type']);
   if(!['application/pdf','image/png','image/jpeg'].includes(file.mime))fail('SUPPLY_INVALID_CREDENTIAL');
   const result=await scanner.scanBytes(bytes,file.sha256,{name});if(result?.status!=='clean')fail('SUPPLY_CREDENTIAL_NOT_CLEAN',422);
   const stored=await storage.put(bytes,file.mime);
   // Do not delete after an ambiguous RPC response: it may have committed. This
   // private object remains for later owner-run orphan reconciliation, never public.
   json(res,201,await auth.supplyServiceRpc('supply_record_credential',{p_actor:session.actor,p_id:id,p_file:stored}));return true;
  }
  const download=/^\/api\/supply\/credentials\/([^/]+)$/.exec(path);
  if(download&&req.method==='GET'){
   const file=await rpc(session,'supply_credential_file',{p_id:uuid(download[1])}),bytes=await storage.get(file);
   if(!['application/pdf','image/png','image/jpeg'].includes(file.mime))fail('SUPPLY_INVALID_CREDENTIAL');
   res.writeHead(200,{'Content-Type':file.mime,'Content-Disposition':'attachment; filename="credential'+({'application/pdf':'.pdf','image/png':'.png','image/jpeg':'.jpg'}[file.mime])+'"'});res.end(bytes);return true;
  }
  return false;
 };
}
