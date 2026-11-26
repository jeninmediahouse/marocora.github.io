import {createClient} from '@supabase/supabase-js';
import {cloudConfiguration,createStagingDatabase} from '../block1/supabase-database.mjs';
import {createSupabaseTransport} from '../block1/network-diagnostics.mjs';
import {uuid} from '../quote/contracts.mjs';
import {createPasswordReset} from './password-reset.mjs';
const fail=(code,status=401)=>{throw Object.assign(Error(code),{status});};
const supplyCodes=new Set(['SUPPLY_VERIFIED_ACCOUNT_REQUIRED','SUPPLY_ADMIN_REQUIRED','SUPPLY_APPLICATION_NOT_FOUND','SUPPLY_CREDENTIAL_NOT_FOUND','SUPPLY_INVALID_PROFILE','SUPPLY_STALE_REVISION','SUPPLY_SELF_REVIEW_DENIED','SUPPLY_INVALID_DECISION','SUPPLY_PUBLICATION_BLOCKED','SUPPLY_CREDENTIAL_REVIEW_REQUIRED','SUPPLY_INVALID_CREDENTIAL','SUPPLY_CREDENTIAL_LIMIT','SUPPLY_INVALID_PAYOUT']);
function supplyError(error){const code=supplyCodes.has(error?.message)?error.message:error?.code==='23505'?'SUPPLY_APPLICATION_EXISTS':['42883','PGRST202'].includes(error?.code)?'SUPPLY_SCHEMA_REQUIRED':'SUPPLY_REQUEST_FAILED';fail(code,code.endsWith('NOT_FOUND')?404:code.includes('ADMIN')||code.includes('VERIFIED')||code.includes('SELF_REVIEW')?403:code.includes('STALE')||code.includes('EXISTS')?409:code.includes('SCHEMA')||code.includes('REQUEST_FAILED')?503:400);}
export function createProductionSupabase(env,{fetcher=fetch}={}){
 const config=cloudConfiguration(env);if(!config)fail('SUPABASE_CONFIGURATION_REQUIRED',503);
 const transport=createSupabaseTransport(config,{fetcher});
 const client=(token,key=config.anon)=>createClient(config.url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport,...(token?{headers:{Authorization:'Bearer '+token}}:{})}});
 const auth=client(),db=createStagingDatabase(config,{directory:env.DATA_DIR||'/var/lib/marocora',fetcher,production:true});
 const passwordReset=createPasswordReset({config,fetcher});
 return {
  db,
  requestPasswordReset:(email,origin)=>passwordReset.requestPasswordReset(email,origin),
  completePasswordResetCode:(email,code,password)=>passwordReset.completePasswordResetCode(email,code,password),
  async checkReady(){const {data,error}=await client(undefined,config.service).rpc('production_runtime_status',{});if(error||data?.version!==4||data.mockPayments!==false)fail('PRODUCTION_SCHEMA_REQUIRED',503);},
  async register(email,password,origin){
   if(typeof email!=='string'||email.length>320||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=='string'||password.length<12||password.length>128)fail('SUPPLY_INVALID_REGISTRATION',400);
   const {error}=await auth.auth.signUp({email,password,options:{emailRedirectTo:origin+'/production-login.html?next=%2Fsupply-dashboard.html'}});
   if(error)fail('SUPPLY_REGISTRATION_UNAVAILABLE',503);
   return {confirmationRequired:true};
  },
  async supplyRpc(session,name,args={}){
   if(!['supply_admin_access','supply_my_applications','supply_save_application','supply_review_queue','supply_review_application','supply_all_applications','supply_application_email','supply_intro_begin','supply_intro_get','supply_upload_context','supply_credential_file'].includes(name))fail('SUPPLY_RPC_DENIED',403);
   const {data,error}=await client(session.bearer).rpc(name,args);if(error)supplyError(error);return data;
  },
  async supplyPublic(id=null){const {data,error}=await auth.rpc('supply_public_profiles',{p_id:id});if(error)supplyError(error);return data;},
  async supplyPublicIntro(id){const {data,error}=await client(undefined,config.service).rpc('supply_public_intro',{p_id:id});if(error)supplyError(error);return data;},
  async supplyServiceRpc(name,args){
   if(!['supply_save_payout','supply_record_credential','supply_intro_ready','supply_intro_failed'].includes(name))fail('SUPPLY_RPC_DENIED',403);
   const {data,error}=await client(undefined,config.service).rpc(name,args);if(error)supplyError(error);return data;
  },
  async authenticate(bearer){
   if(typeof bearer!=='string'||bearer.length>12000||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bearer))fail('AUTH_REQUIRED');
   const {data,error}=await auth.auth.getUser(bearer);
   if(error||!data?.user?.email||!data.user.email_confirmed_at||data.user.is_anonymous!==false)fail('AUTH_REQUIRED');
   let actor;try{actor=uuid(data.user.id);}catch{fail('AUTH_REQUIRED');}return {actor,bearer,email:data.user.email};
  },
  async signIn(email,password){
   if(typeof email!=='string'||email.length>320||typeof password!=='string'||password.length<1||password.length>1000)fail('INVALID_SIGN_IN',400);
   const {data,error}=await client().auth.signInWithPassword({email,password});
   if(error||!data?.session?.access_token)fail('SIGN_IN_FAILED');
   const session=await this.authenticate(data.session.access_token);return {...session,maxAge:Math.max(1,Math.min(3600,(data.session.expires_at||0)-Math.floor(Date.now()/1000)))};
  },
  translationSession:bearer=>db.authenticate(bearer),
  async roomContext(session,bookingId){
   uuid(bookingId);const {data,error}=await client(session.bearer).rpc('production_learning_room_context',{p_booking:bookingId});
   if(error)fail(['42883','PGRST202'].includes(error.code)?'PRODUCTION_SCHEMA_REQUIRED':'ROOM_NOT_AVAILABLE',['42883','PGRST202'].includes(error.code)?503:403);
   if(data?.actor!==session.actor||data.bookingId!==bookingId||!['student','teacher'].includes(data.role))fail('ROOM_NOT_AVAILABLE',403);return data;
  }
 };
}
