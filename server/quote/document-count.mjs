import {Worker} from 'node:worker_threads';
import {extname} from 'node:path';
export async function countUploadedDocument(bytes,name,{timeoutMs=10000}={}){
 const extension=extname(name).toLowerCase();
 if(!['.txt','.docx','.pdf'].includes(extension))return {manualReview:true,reason:'SCANNED_DOCUMENT',words:null,pages:null};
 if(!bytes.length||bytes.length>10_000_000)throw Error('FILE_SIZE_LIMIT');
 return new Promise(resolve=>{
  const worker=new Worker(new URL('./document-count-worker.mjs',import.meta.url),{workerData:{bytes,extension},resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:32}});
  let done=false;
  const finish=result=>{if(done)return;done=true;clearTimeout(timer);void worker.terminate();resolve(result);};
  const timer=setTimeout(()=>finish({manualReview:true,reason:'COUNT_TIMEOUT',words:null,pages:null}),timeoutMs);
  worker.once('message',result=>finish(result.manualReview?result:result.error||!Number.isSafeInteger(result.words)||result.words<1?{manualReview:true,reason:result.error||'NO_EXTRACTABLE_TEXT',words:null,pages:result.pages||null}:{manualReview:false,...result}));
  worker.once('error',()=>finish({manualReview:true,reason:'COUNT_FAILED',words:null,pages:null}));
  worker.once('exit',()=>finish({manualReview:true,reason:'COUNT_FAILED',words:null,pages:null}));
 });
}
