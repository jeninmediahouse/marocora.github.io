import {createClient} from '@supabase/supabase-js';
import {cloudConfiguration,createStagingDatabase} from '../block1/supabase-database.mjs';
import {createSupabaseTransport} from '../block1/network-diagnostics.mjs';
import {uuid} from '../quote/contracts.mjs';
const fail=(code,status=401)=>{throw Object.assign(Error(code),{status});};
export function createProductionSupabase(env,{fetcher=fetch}={}){
 const config=cloudConfiguration(env);if(!config)fail('SUPABASE_CONFIGURATION_REQUIRED',503);
 const transport=createSupabaseTransport(config,{fetcher});
 const client=(token,key=config.anon)=>createClient(config.url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport,...(token?{headers:{Authorization:'Bearer '+token}}:{})}});
 const auth=client(),db=createStagingDatabase(config,{directory:env.DATA_DIR||'/var/lib/marocora',fetcher,production:true});
 return {
  db,
  async checkReady(){const {data,error}=await client(undefined,config.service).rpc('production_runtime_status',{});if(error||data?.version!==4||data.mockPayments!==false)fail('PRODUCTION_SCHEMA_REQUIRED',503);},
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
