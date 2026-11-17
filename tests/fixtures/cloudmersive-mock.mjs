import Cloudmersive from 'cloudmersive-virus-api-client';
import {cloudmersiveScanner} from '../../server/block1/uploads.mjs';
// Real SDK operation/parameter construction, replaced transport, no HTTP calls.
export function mockCloudmersive(state={value:'clean'},{timeoutMs=30000}={}){
 const calls=[];let aborted=0;
 const scanner=cloudmersiveScanner({env:{CLOUDMERSIVE_API_KEY:'SYNTHETIC_TEST_KEY_NOT_A_CREDENTIAL'},timeoutMs,apiFactory:(key,timeout)=>{
  const client=new Cloudmersive.ApiClient();client.timeout=timeout;client.authentications.Apikey.apiKey=key;
  client.callApi=(...args)=>{
   const [path,method,,, ,headers,form]=args,callback=args.at(-1);
   calls.push({path,method,headers:{...headers},normalizedHeaders:client.normalizeParams(headers),bytes:Buffer.from(form.inputFile),timeout:client.timeout});
   const respond=()=>{
    state.beforeResponse?.();
    if(state.value==='throw'){callback(Error('Synthetic provider failure; never log its private body'),null,{status:503,body:{}});return;}
    if(state.value==='error'){callback(Error('Synthetic authentication/quota/API error'),null,{status:state.httpStatus||429,body:{}});return;}
    const raw=Object.hasOwn(state,'raw')?state.raw:{CleanResult:state.value==='clean'};
    callback(null,Cloudmersive.VirusScanAdvancedResult.constructFromObject(raw),{status:state.httpStatus||200,body:raw});
   };
   if(state.value==='never')return {abort(){aborted++;}};
   if(state.delayMs)setTimeout(respond,state.delayMs);else respond();
   return {abort(){aborted++;}};
  };
  return new Cloudmersive.ScanApi(client);
 }});
 scanner.mockOnly=true;
 return {scanner,calls,get aborted(){return aborted;}};
}
