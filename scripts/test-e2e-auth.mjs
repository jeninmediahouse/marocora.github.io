// Starts a fresh loopback HTTP app with the same adapter as start-staging.mjs.
// No PostgreSQL, migrations, seeds, workflow mutations or retained private state.
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStagingDatabase,cloudConfiguration} from '../server/block1/supabase-database.mjs';
import {createLocalApp} from '../server/block1/http.mjs';
import {mockCloudmersive} from '../tests/fixtures/cloudmersive-mock.mjs';
import {authEnvironment,credentials,validateBearer,mockAuthFetch,reportFailure} from './auth-test-support.mjs';
export async function testE2eAuth(env,{fetcher=fetch,logger=console.log}={}){
 const config=cloudConfiguration(env);if(!config)throw Error('STAGING_ENV_REQUIRED');
 const login=credentials(env),directory=mkdtempSync(join(tmpdir(),'marocora-auth-e2e-'));let app;
 try{
  const db=createStagingDatabase(config,{directory,fetcher});
  app=createLocalApp(db,{}, {scanner:mockCloudmersive().scanner});
  const origin=await app.listen();
  const started=Date.now();
  const response=await fetch(origin+'/api/staging-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(login),signal:AbortSignal.timeout(150000),redirect:'error'});
  const result=await response.json();
  if(response.status!==200)throw Object.assign(Error('E2E_LOGIN_FAILED: '+(result.error||'unknown')),{status:response.status});
  validateBearer(result.accessToken);
  const me=await fetch(origin+'/api/me',{headers:{Authorization:'Bearer '+result.accessToken},signal:AbortSignal.timeout(150000),redirect:'error'});
  const context=await me.json();
  if(me.status!==200)throw Object.assign(Error('E2E_ME_FAILED: '+(context.error||'unknown')),{status:me.status});
  assert.equal(context.staging,true);assert.ok(['staff','provider','customer'].includes(context.role));
  assert.equal(Object.hasOwn(context,'accessToken'),false);
  logger('E2E_AUTH_PASS '+JSON.stringify({loginStatus:200,meStatus:200,tokenFormatValid:true,userVerified:true,role:context.role,switches:context.switches,elapsedMs:Date.now()-started}));
  return {loginStatus:200,meStatus:200,role:context.role};
 }finally{if(app)await app.close();rmSync(directory,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let env;
 try{
  const mock=process.argv.includes('--mock');env=authEnvironment({mock});
  console.log(mock?'MODE: MOCK (no .env or internet)':'MODE: REAL E2E AUTH (temporary loopback app; no workflow/database mutations)');
  await testE2eAuth(env,{fetcher:mock?mockAuthFetch:fetch});
 }catch(error){reportFailure(error,env);process.exitCode=1;}
}
