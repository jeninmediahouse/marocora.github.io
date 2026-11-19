// OWNER-RUN ONLY. Read-only RPC/anonymous rejection checks, no dotenv loading.
// Supply settings privately through the owner's runtime; never via CLI arguments.
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createProductionSupabase} from '../server/production/supabase.mjs';
import {cloudConfiguration} from '../server/block1/supabase-database.mjs';

export async function checkModernSupabaseKeys(env,{fetcher=fetch}={}){
 const configuration=cloudConfiguration({...env,SUPABASE_REQUIRE_MODERN_KEYS:'true'});
 // Metadata-only RPC: no account creation, applicant writes, scans or mail.
 await createProductionSupabase({...env,SUPABASE_REQUIRE_MODERN_KEYS:'true'},{fetcher}).checkReady();
 for(const name of ['service-intake','vendor-workflow']){
  const response=await fetcher(configuration.url+'/functions/v1/'+name,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:configuration.anon,Origin:'https://marocora.com','Content-Type':'application/json'},body:'{}'});
  await response.body?.cancel();
  if(response.status!==401)throw Error('EDGE_ANONYMOUS_REJECTION_REQUIRED');
 }
 return {runtimeReadiness:true,anonymousEdgeRequestsDenied:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  await checkModernSupabaseKeys(process.env);
  console.log('PASS: Modern-key runtime readiness and anonymous Edge rejection verified.');
  console.log('PENDING: Verify signed-in forms, role permissions and the active PM2 runtime before revoking legacy keys.');
 }catch{
  console.error('FAIL: Modern-key canary failed. No provider response or credentials printed; do not retire keys yet.');process.exitCode=1;
 }
}
