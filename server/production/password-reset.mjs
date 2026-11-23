import {createHmac,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createSupabaseTransport} from '../block1/network-diagnostics.mjs';
const fail=(code,status=400)=>{throw Object.assign(Error(code),{status});};
export function resetEmail(value){
 if(typeof value!=='string'||value.length>320||!/^\S+@\S+\.\S+$/.test(value))fail('RESET_EMAIL_INVALID');
 return value.toLowerCase();
}
export function resetCodeInput(email,code,password){
 const normalized=resetEmail(email);
 if(typeof code!=='string'||!/^\d{6}$/.test(code))fail('RESET_CODE_MALFORMED');
 if(typeof password!=='string'||password.length<12||password.length>128)fail('RESET_PASSWORD_INVALID');
 return normalized;
}
// Per-process fixed windows; no raw email/IP/code/password retained. Unknown and
// known accounts consume identical counters. No eviction of live limits on fill.
export function createResetAttemptLimiter({clock=Date.now,windowMs=900000,emailLimit=5,ipLimit=20,maxEntries=5000}={}){
 const secret=randomBytes(32),entries=new Map();
 return {
  consume({email,ip,kind='complete'}){
   const now=clock(),window=Math.floor(now/windowMs),until=(window+1)*windowMs;
   for(const [key,value] of entries)if(value.until<=now)entries.delete(key);
   const hash=value=>createHmac('sha256',secret).update(value).digest('hex');
   const keys=[kind+':email:'+hash(resetEmail(email)),kind+':ip:'+hash(String(ip))];
   const limits=kind==='request'?[3,10]:[emailLimit,ipLimit];
   const missing=keys.filter(key=>!entries.has(key)).length;
   if(entries.size+missing>maxEntries||keys.some((key,i)=>(entries.get(key)?.count||0)>=limits[i]))fail('RESET_TOO_MANY_ATTEMPTS',429);
   for(const key of keys){const value=entries.get(key)||{count:0,until};value.count++;entries.set(key,value);}
  },
  clear(){entries.clear();}
 };
}
const rateError=error=>error?.status===429||['over_request_rate_limit','over_email_send_rate_limit'].includes(error?.code);
export function createPasswordReset({config,fetcher=fetch}){
 const transport=createSupabaseTransport(config,{fetcher,logger:()=>{},timeoutMs:15000});
 const quietFetch=async(...args)=>{try{return await transport(...args);}catch{throw Error('RESET_SERVICE_UNAVAILABLE');}};
 const fresh=()=>createClient(config.url,config.anon,{auth:{flowType:'implicit',persistSession:false,
  autoRefreshToken:false,detectSessionInUrl:false,debug:false},global:{fetch:quietFetch}}).auth;
 return {
  async requestPasswordReset(email,origin){
   email=resetEmail(email);
   const url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin)fail('RESET_ORIGIN_INVALID');
   try{await fresh().resetPasswordForEmail(email);}catch{}
   // No account/provider-state disclosure. Template supplies Token, no redirect.
   return {accepted:true};
  },
  async completePasswordResetCode(email,code,password){
   email=resetCodeInput(email,code,password);
   const auth=fresh();let hasSession=false,updateAttempted=false;
   try{
    const verified=await auth.verifyOtp({email,token:code,type:'recovery'});
    hasSession=!!verified.data?.session;
    if(verified.error){
     if(rateError(verified.error))fail('RESET_TOO_MANY_ATTEMPTS',429);
     if(!verified.error.status||verified.error.status>=500)fail('RESET_SERVICE_UNAVAILABLE',503);
     fail('RESET_CODE_INVALID_OR_EXPIRED');
    }
    if(!hasSession||!verified.data?.user?.id||verified.data.user.email?.toLowerCase()!==email)fail('RESET_SERVICE_UNAVAILABLE',503);
    updateAttempted=true;
    const updated=await auth.updateUser({password});
    if(updated.error){
     if(rateError(updated.error)||updated.error.code==='over_password_update_rate_limit')fail('RESET_TOO_MANY_ATTEMPTS',429);
     if(['weak_password','same_password'].includes(updated.error.code))fail('RESET_PASSWORD_REJECTED');
     fail('RESET_COMPLETION_UNCERTAIN',503);
    }
    if(updated.data?.user?.id!==verified.data.user.id)fail('RESET_COMPLETION_UNCERTAIN',503);
    const ended=await auth.signOut({scope:'local'});
    if(ended.error)fail('RESET_COMPLETION_UNCERTAIN',503);
    hasSession=false;
    return {reset:true};
   }catch(error){
    if(/^RESET_[A-Z_]+$/.test(error?.message||''))throw error;
    fail(updateAttempted?'RESET_COMPLETION_UNCERTAIN':'RESET_SERVICE_UNAVAILABLE',503);
   }finally{
    if(hasSession){try{await auth.signOut({scope:'local'});}catch{}}
   }
  }
 };
}
