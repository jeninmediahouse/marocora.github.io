// Owner-run network diagnostic; never included as a live call in pnpm test.
import {createClient} from '@supabase/supabase-js';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSupabaseTransport} from '../server/block1/network-diagnostics.mjs';
import {authEnvironment,authConfig,credentials,sdkOptions,validateBearer,mockAuthFetch,probeAuth,reportFailure} from './auth-test-support.mjs';
export async function testRealAuth(env,{fetcher=fetch,logger=console.log,showSensitive=false,probeOnly=false}={}){
 const config=authConfig(env);
 await probeAuth(config,{fetcher,logger});
 if(probeOnly)return {probeOnly:true};
 const login=credentials(env),client=createClient(config.url,config.anon,sdkOptions(createSupabaseTransport(config,{fetcher})));
 const result=await client.auth.signInWithPassword(login);
 if(result.error)throw result.error;
 const token=result.data?.session?.access_token;validateBearer(token);
 // getUser verifies the token with Auth; format checks alone are insufficient.
 const verified=await client.auth.getUser(token);
 if(verified.error)throw verified.error;
 if(!verified.data?.user?.email_confirmed_at||verified.data.user.is_anonymous!==false||verified.data.user.id!==result.data.user?.id)throw Error('VERIFIED_CONFIRMED_USER_REQUIRED');
 if(showSensitive)logger(JSON.stringify(result,null,2));
 else logger('DIRECT_AUTH_PASS '+JSON.stringify({accessToken:'[REDACTED]',tokenFormatValid:true,userVerified:true,emailConfirmed:true,anonymous:false,expiresIn:result.data.session.expires_in}));
 return {userVerified:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let env;
 try{
  const mock=process.argv.includes('--mock');env=authEnvironment({mock});
  console.log(mock?'MODE: MOCK (no .env or internet)':'MODE: REAL AUTH (no workflow/database mutations)');
  await testRealAuth(env,{fetcher:mock?mockAuthFetch:fetch,showSensitive:process.argv.includes('--show-sensitive'),probeOnly:process.argv.includes('--probe-only')});
 }catch(error){reportFailure(error,env);process.exitCode=1;}
}
