import {Worker} from 'node:worker_threads';
export function watermarkedDraft(bytes,{timeoutMs=10000}={}){return new Promise((resolve,reject)=>{
 const worker=new Worker(new URL('./pdf-draft-worker.mjs',import.meta.url),{workerData:bytes,resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:32}});let done=false;
 const finish=(error,data)=>{if(done)return;done=true;clearTimeout(timer);void worker.terminate();error?reject(Object.assign(Error(error),{status:400})):resolve(Buffer.from(data));};
 const timer=setTimeout(()=>finish('PDF_PREVIEW_TIMEOUT'),timeoutMs);
 worker.once('message',result=>finish(result.error,result.bytes));worker.once('error',()=>finish('INVALID_FINAL_PDF'));worker.once('exit',()=>finish('INVALID_FINAL_PDF'));
});}
