import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createSupabaseTransport} from '../block1/network-diagnostics.mjs';

const fail=code=>{throw Object.assign(Error(code),{status:400});};
const jwt=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
export function resetEmail(value){
 if(typeof value!=='string'||value.length>320||!/^\S+@\S+\.\S+$/.test(value))fail('RESET_EMAIL_INVALID');
 return value;
}
export function resetInput(accessToken,refreshToken,password,now=Date.now()){
 if(typeof password!=='string'||password.length<12||password.length>128)fail('RESET_PASSWORD_INVALID');
 if(typeof accessToken!=='string'||accessToken.length>12000||!jwt.test(accessToken)
 ||typeof refreshToken!=='string'||!/^\S{16,4096}$/.test(refreshToken)||/[^\x21-\x7e]/.test(refreshToken))fail('RESET_LINK_EXPIRED');
 let payload,header;
 try{
  const parts=accessToken.split('.');
  if(parts.some(part=>part.length%4===1))fail('RESET_LINK_EXPIRED');
  header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
  payload=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
 }catch{fail('RESET_LINK_EXPIRED');}
 if(!header||!['HS256','ES256','RS256','EdDSA'].includes(header.alg)
 ||(header.typ!==undefined&&header.typ!=='JWT'))fail('RESET_LINK_EXPIRED');
 if(!Number.isSafeInteger(payload?.exp)||payload.exp<=Math.floor(now/1000)
 ||typeof payload.sub!=='string'||typeof payload.session_id!=='string'
 ||!/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(payload.sub)
 ||!/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(payload.session_id))fail('RESET_LINK_EXPIRED');
 return payload;
}

export function createPasswordReset({config,fetcher=fetch,clock=Date.now}){
 // Only hashed replay/in-flight markers; never tokens, email or passwords.
 // Auth refresh-token revocation remains authoritative across app restarts.
 const used=new Map();
 const transport=createSupabaseTransport(config,{fetcher,logger:()=>{}});
 const quietFetch=async(...args)=>{try{return await transport(...args);}catch{throw Error('RESET_AUTH_UNAVAILABLE');}};
 const fresh=()=>createClient(config.url,config.anon,{auth:{flowType:'implicit',persistSession:false,
   autoRefreshToken:false,detectSessionInUrl:false,debug:false},global:{fetch:quietFetch}}).auth;
 return {
  async requestPasswordReset(email,origin){
   resetEmail(email);
   const url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin)fail('RESET_ORIGIN_INVALID');
   try{await fresh().resetPasswordForEmail(email,{redirectTo:origin+'/reset-password.html'});}catch{}
   // Deliberately independent of provider success/account existence.
   return {accepted:true};
  },
  async completePasswordReset(accessToken,refreshToken,password){
   const claims=resetInput(accessToken,refreshToken,password,clock());
   const now=Math.floor(clock()/1000);
   for(const [key,marker] of used)if(marker.expiry<=now)used.delete(key);
   const key=createHash('sha256').update(accessToken).digest('hex');
   if(used.has(key)||used.size>=5000)fail('RESET_LINK_EXPIRED');
   // Reserve synchronously; remotely verified attempts stay terminal on ambiguity.
   const marker={expiry:Math.min(claims.exp,now+60),verified:false};used.set(key,marker);
   const auth=fresh();let hasSession=false;
   try{
    const initial=await auth.setSession({access_token:accessToken,refresh_token:refreshToken});
    if(initial.error||initial.data?.user?.id!==claims.sub)fail('RESET_LINK_EXPIRED');
    marker.verified=true;marker.expiry=claims.exp;
    hasSession=true;
    // setSession alone ignores refresh-token validity when the JWT is unexpired.
    const refreshed=await auth.refreshSession({refresh_token:refreshToken});
    if(refreshed.error||refreshed.data?.user?.id!==claims.sub||!refreshed.data?.session?.access_token)fail('RESET_LINK_EXPIRED');
    const refreshedClaims=resetInput(refreshed.data.session.access_token,refreshed.data.session.refresh_token,password,clock());
    if(refreshedClaims.session_id!==claims.session_id)fail('RESET_LINK_EXPIRED');
    const updated=await auth.updateUser({password});
    if(updated.error||updated.data?.user?.id!==claims.sub)fail('RESET_LINK_EXPIRED');
    // Do not leave the recovery session usable; no app/browser cookie is issued.
    const ended=await auth.signOut({scope:'local'});
    if(ended.error)fail('RESET_LINK_EXPIRED');
    hasSession=false;
    return {reset:true};
   }catch{fail('RESET_LINK_EXPIRED');}
   finally{
    if(hasSession){try{await auth.signOut({scope:'local'});}catch{}}
    if(!marker.verified)used.delete(key);
   }
  }
 };
}
