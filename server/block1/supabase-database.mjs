import {createClient} from '@supabase/supabase-js';
import {resolve} from 'node:path';
import {uuid} from '../quote/contracts.mjs';
import {createSupabaseTransport,safeError} from './network-diagnostics.mjs';
import {supabaseKeyPair} from '../supabase-api-keys.mjs';
export const stagingFunction=name=>name.replace(/^block1_/,'translation_').replace(/^block15_/,'translation_scan_').replace(/^block2_/,'translation_cert_');
const failure=(code,status=503)=>Object.assign(Error(code),{status});
export function cloudConfiguration(env){
 const names=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','SUPABASE_REQUIRE_MODERN_KEYS'];
 if(!names.some(name=>env[name]))return null;
 if(typeof env.SUPABASE_URL!=='string'||!env.SUPABASE_URL.trim())throw failure('STAGING_ENV_INCOMPLETE');
 const keys=supabaseKeyPair(env);
 let url;try{url=new URL(env.SUPABASE_URL);}catch{throw failure('INVALID_SUPABASE_URL');}
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw failure('INVALID_SUPABASE_URL');
 return {url:url.origin,...keys};
}
export function createStagingDatabase(config,{directory,fetcher=fetch,production=false}={}){
 const transport=createSupabaseTransport(config,{fetcher});
 const client=(key,token)=>createClient(config.url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport,...(token?{headers:{Authorization:'Bearer '+token}}:{})}});
 const authClient=client(config.anon),serviceClient=client(config.service);
 const sessionClients=new WeakMap();
 const userClient=session=>{if(!session?.bearer||!session.actor)throw failure('SUPABASE_SIGN_IN_REQUIRED',401);if(!sessionClients.has(session))sessionClients.set(session,client(config.anon,session.bearer));return sessionClients.get(session);};
 async function invoke(c,name,params){
  const {data,error}=await c.rpc(name,params);
  if(error){if(!production)console.log('REAL RPC ERROR:',error);const code=['CONSENT_AND_QUOTE_REQUIRED','FIRST_ORDER_DISCOUNT_ALREADY_USED','INVALID_PAYMENT_PHASE','PROVIDER_START_REQUIRED','PROVIDER_COMPLETE_REQUIRED','ORIGINALS_AND_SWORN_CREDENTIAL_REQUIRED','INVALID_STATE','CUSTOMER_REQUIRED','UNAVAILABLE','STAFF_OWNER_REQUIRED','PROVIDER_INELIGIBLE','SWORN_CREDENTIAL_REQUIRED','CAPTURE_DISABLED','COMMANDS_DISABLED','REQUEST_SUBMITTED','REQUEST_NOT_SUBMITTED','ORIGINAL_SCAN_REQUIRED','DOCUMENTS_QUARANTINED','FILE_QUARANTINED','STALE_REVISION','COMMAND_CONFLICT','EXACT_ACCEPTANCE_REQUIRED','FULFILLMENT_REQUIRED','EXTRA_COSTS_ACK_REQUIRED','ENCRYPTION_ACK_REQUIRED','IN_PERSON_REQUIRED','OFFER_EXPIRED','MOROCCO_ONLY'].find(x=>error.message?.includes(x));throw failure(code||'STAGING_RPC_FAILED',code?400:503);}return data;
 }
 const db={mode:production?'production':'staging',block2:true,dir:resolve(directory),stop(){},
  async authenticate(bearer){
   if(typeof bearer!=='string'||bearer.length>12000||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bearer))throw failure('INVALID_SUPABASE_TOKEN',401);
   const {data,error}=await authClient.auth.getUser(bearer);
   if(error||!data?.user?.email_confirmed_at||!data.user.email||data.user.is_anonymous!==false)throw failure('INVALID_SUPABASE_TOKEN',401);
   let actor;try{actor=uuid(data.user.id);}catch{throw failure('INVALID_SUPABASE_TOKEN',401);}
   const session={actor,bearer,email:data.user.email,role:null};const context=await invoke(userClient(session),'translation_session_context',{});
   if(context?.actor!==actor||!['staff','provider','customer'].includes(context.role))throw failure('INVALID_SUPABASE_CONTEXT',401);
   session.role=context.role;return session;
  },
  async signIn(email,password){
   const {data,error}=await authClient.auth.signInWithPassword({email,password});
   if(error||!data?.session?.access_token){
    console.error('STAGING_AUTH_ERROR '+JSON.stringify(safeError(error||Error('MISSING_ACCESS_TOKEN'),[config.anon,config.service,email,password])));
    if(error?.message==='STAGING_CONNECTION_FAILED')throw failure('STAGING_CONNECTION_FAILED');
    throw failure('STAGING_SIGN_IN_FAILED',401);
   }
   await db.authenticate(data.session.access_token);return {accessToken:data.session.access_token};
  },
  rpc:(session,name,params={})=>invoke(userClient(session),stagingFunction(name),params),
  instantRecord:(session,name,params={})=>{
   if(!['instant_record_order','instant_record_complete'].includes(name))throw failure('INVALID_RPC');
   return invoke(serviceClient,name,{...params,p_actor:session.actor});
  },
  settings:session=>invoke(userClient(session),'translation_runtime_settings',{}),
  options:session=>invoke(userClient(session),'translation_workspace_options',{}),
  command:(session,c)=>invoke(userClient(session),'quote_command',{p_command:c.commandId,p_action:c.action,p_target:c.targetId,p_revision:c.expectedRevision,p_payload:c.payload}),
  recordScan:(session,id,hash,result)=>invoke(serviceClient,'translation_scan_record_scan',{p_file:id,p_hash:hash,p_status:result.status,p_engine:result.engine,p_reason:result.reason,p_actor:session.actor}),
  recordCredential:(session,id,fields,file,result)=>invoke(serviceClient,'translation_cert_record_credential',{p_id:id,p_provider:session.actor,p_fields:fields,p_file:file,p_result:result})
 };return db;
}
