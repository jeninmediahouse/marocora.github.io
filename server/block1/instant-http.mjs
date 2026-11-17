import {randomUUID,createHash} from 'node:crypto';
import {join} from 'node:path';
import {validateUpload,MAX_FILE_BYTES} from './uploads.mjs';
import {countUploadedDocument} from '../quote/document-count.mjs';
import {SUPPORTED_LANGUAGES,RATES,WITHDRAWAL_CONSENT,calculatePrice} from '../quote/instant-pricing.mjs';
import {createExchangeService} from '../quote/exchange-rates.mjs';
import {uuid,record} from '../quote/contracts.mjs';
import {createLocalFileStore} from '../storage/local-files.mjs';
import {watermarkedDraft} from '../quote/pdf-draft.mjs';
const bad=(code,status=400)=>{throw Object.assign(Error(code),{status});};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function instantRoutes({db,scanner,exchangeService=createExchangeService(),storage,allowMockPayments=true}){
 const files=storage||createLocalFileStore(join(db.dir,'instant-private'));
 const store=(data,mime)=>files.put(data,mime),remove=file=>files.remove(file),bytes=file=>files.get(file);
 const view=q=>({...q,original_file:undefined,final_file:undefined,draft_file:undefined,canDownloadFinal:q.status==='paid_in_full',mockPayment:allowMockPayments,withdrawalConsent:WITHDRAWAL_CONSENT});
 const invoke=(session,name,params={})=>db.rpc(session,name,params);
 const privileged=(session,name,params)=>db.instantRecord(session,name,params);
 return async({req,url,session,input,body,json,res})=>{
  if(!url.pathname.startsWith('/api/instant/'))return false;
  if(req.method==='GET'&&url.pathname==='/api/instant/config'){json(200,{languages:SUPPORTED_LANGUAGES,rates:RATES,consent:WITHDRAWAL_CONSENT,mockPayment:allowMockPayments,...(!allowMockPayments?{paymentConfigured:false}:{})});return true;}
  if(req.method==='GET'&&url.pathname==='/api/instant/providers'){json(200,await invoke(session,'instant_providers'));return true;}
  if(req.method==='GET'&&url.pathname==='/api/instant/orders'){json(200,(await invoke(session,'instant_list')).map(view));return true;}
  if(req.method==='POST'&&url.pathname==='/api/instant/orders'){
   if(!['customer'].includes(session.role))bad('CUSTOMER_REQUIRED',403);
   const settings=await db.settings(session);if(!settings.capture_enabled||!settings.commands_enabled)bad('COMMANDS_DISABLED',403);
   let fields,name;
   try{fields=JSON.parse(decodeURIComponent(req.headers['x-quote-details']||''));name=decodeURIComponent(req.headers['x-file-name']||'');}catch{bad('INVALID_QUOTE_FIELDS');}
   record(fields,['category','source','target','sampleRequested','scanned']);
   if(!Object.hasOwn(RATES,fields.category)||!SUPPORTED_LANGUAGES.includes(fields.source)||!SUPPORTED_LANGUAGES.includes(fields.target)||fields.source===fields.target||typeof fields.sampleRequested!=='boolean'||typeof fields.scanned!=='boolean')bad('INVALID_QUOTE_FIELDS');
   const data=await body(MAX_FILE_BYTES),validated=validateUpload(data,name,req.headers['content-type']);
   const file=await store(data,validated.mime);
   let recordAttempted=false;
   try{
    const scan=await files.scan(file,scanner,{name});
    if(scan?.status!=='clean')bad('DOCUMENTS_QUARANTINED',409);
    if(hash(await bytes(file))!==file.sha256)bad('FILE_INTEGRITY_FAILURE',503);
    const count=fields.scanned?{manualReview:true,reason:'SCANNED_DOCUMENT',words:null,pages:null}:await countUploadedDocument(data,name);
    const manualReview=fields.scanned||count.manualReview||(fields.category==='sworn'&&!count.pages);
    recordAttempted=true;
    const q=await privileged(session,'instant_record_order',{p_payload:{id:randomUUID(),...fields,...count,scanned:fields.scanned||count.reason==='SCANNED_OR_IMAGE_ONLY_PDF',manualReview,file,words:count.words??null,pages:count.pages??null}});
    if(!manualReview){const expected=calculatePrice({category:fields.category,wordCount:q.counted_words,pageCount:q.page_count,firstOrder:q.first_order});if(expected.totalMinor!==q.total_minor)bad('PRICING_MISMATCH',503);}
    json(201,{...view(q),conversion:q.total_minor?await exchangeService.estimates(q.total_minor):{available:false}});return true;
   }catch(e){if(!recordAttempted)await remove(file);throw e;}
  }
  const match=/^\/api\/instant\/orders\/([a-f0-9-]+)(?:\/(assign|review|pay|start|complete|draft|final|original|confirm-originals))?$/.exec(url.pathname);
  if(!match)bad('NOT_FOUND',404);
  const id=uuid(match[1]),action=match[2],q=await invoke(session,'instant_detail',{p_id:id});
  if(req.method==='GET'&&!action){json(200,{...view(q),conversion:q.total_minor?await exchangeService.estimates(q.total_minor):{available:false}});return true;}
  if(req.method==='GET'&&['original','draft','final'].includes(action)){
   if(action==='final'&&q.customer_id===session.actor&&q.status!=='paid_in_full')bad('BALANCE_REQUIRED',403);
   if(action==='draft'&&!q.draft_file||action==='final'&&!q.final_file)bad('NOT_READY',409);
   const file=q[action+'_file'];if(!file)bad('NOT_READY',409);
   const data=await bytes(file);res.writeHead(200,{'Content-Type':file.mime,'Content-Disposition':`inline; filename="${action}${file.mime==='application/pdf'?'.pdf':'.txt'}"`});res.end(data);return true;
  }
  if(req.method==='POST'&&action==='complete'){
   if(q.provider_id!==session.actor||q.status!=='in_progress_deposit_paid'||!q.work_started_at)bad('PROVIDER_COMPLETE_REQUIRED',403);
   const data=await body(MAX_FILE_BYTES);validateUpload(data,'translation.pdf',req.headers['content-type']);
   const final=await store(data,'application/pdf');let draft,recordAttempted=false;
   try{
    const result=await files.scan(final,scanner,{name:'translation.pdf'});
    if(result?.status!=='clean')bad('DOCUMENTS_QUARANTINED',409);
    await bytes(final);
    draft=await store(await watermarkedDraft(data),'application/pdf');
    recordAttempted=true;
    const updated=await privileged(session,'instant_record_complete',{p_id:id,p_payload:{final,draft}});
    json(200,view(updated));return true;
   }catch(e){if(!recordAttempted){await remove(final);await remove(draft);}throw e;}
  }
  if(req.method==='POST'){
   const p=await input();let updated;
   if(action==='pay'){if(!allowMockPayments)bad('PAYMENT_GATEWAY_NOT_CONFIGURED',503);record(p,['commandId','phase','consent']);uuid(p.commandId);if(typeof p.consent!=='boolean')bad('CONSENT_REQUIRED');updated=await invoke(session,'instant_pay_mock',{p_id:id,p_command:p.commandId,p_phase:p.phase,p_consent:p.consent});}
   else if(action==='assign'){record(p,['providerId']);updated=await invoke(session,'instant_assign',{p_id:id,p_provider:uuid(p.providerId)});}
   else if(action==='review'){record(p,['words','pages']);if(p.words!==null&&(!Number.isSafeInteger(p.words)||p.words<1)||p.pages!==null&&(!Number.isSafeInteger(p.pages)||p.pages<1))bad('INVALID_QUANTITY');updated=await invoke(session,'instant_review',{p_id:id,p_words:p.words,p_pages:p.pages});}
   else if(action==='confirm-originals'){record(p,[]);updated=await invoke(session,'instant_confirm_originals',{p_id:id});}
   else if(action==='start'){record(p,[]);updated=await invoke(session,'instant_start',{p_id:id});}
   else bad('NOT_FOUND',404);
   json(200,view(updated));return true;
  }
  bad('METHOD_DENIED',405);
 };
}
