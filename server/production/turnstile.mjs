const ENDPOINT='https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const turnstileAction='supply-register';
function configuration(env){
 const siteKey=typeof env?.TURNSTILE_SITE_KEY==='string'?env.TURNSTILE_SITE_KEY.trim():'';
 const secret=typeof env?.TURNSTILE_SECRET_KEY==='string'?env.TURNSTILE_SECRET_KEY.trim():'';
 return siteKey&&secret?{siteKey,secret}:null;
}
export function createTurnstileVerifier(env,{fetcher=fetch,timeoutMs=5000}={}){
 const config=configuration(env);if(!config)return null;
 const verify=async(token,remoteIp)=>{
  if(typeof token!=='string')return false;
  const response=token.trim();
  if(!response||response.length>2048||/\s/.test(response))return false;
  const form=new URLSearchParams({secret:config.secret,response});
  if(typeof remoteIp==='string'&&remoteIp&&remoteIp.length<=64)form.set('remoteip',remoteIp);
  const controller=new AbortController();
  let rejectDeadline;
  const deadline=new Promise((_,reject)=>{rejectDeadline=setTimeout(()=>reject(Error('TURNSTILE_TIMEOUT')),timeoutMs);rejectDeadline.unref?.();});
  const abort=setTimeout(()=>controller.abort(),timeoutMs);abort.unref?.();
  let result;
  try{
   result=await Promise.race([fetcher(ENDPOINT,{method:'POST',body:form,headers:{'Content-Type':'application/x-www-form-urlencoded'},redirect:'error',signal:controller.signal}),deadline]);
  }catch{return false;}
  finally{clearTimeout(abort);clearTimeout(rejectDeadline);}
  if(!result||result.status!==200)return false;
  let data;
  try{data=await result.json();}catch{return false;}
  if(data?.success!==true)return false;
  if(typeof data.action==='string'&&data.action!==turnstileAction)return false;
  return true;
 };
 return {siteKey:config.siteKey,verify};
}
