import {loadEnvFile} from 'node:process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createSupabaseTransport,safeError,networkHint} from '../server/block1/network-diagnostics.mjs';
export const dummyToken='synthetic.payload.signature';
export const dummyActor='11111111-1111-4111-8111-111111111111';
export function authEnvironment({mock=false}={}){
 if(mock)return {SUPABASE_URL:'https://mock-cloud.invalid',SUPABASE_ANON_KEY:'DUMMY_ANON',SUPABASE_SERVICE_ROLE_KEY:'DUMMY_SERVICE',STAGING_AUTH_TEST_EMAIL:'customer@staging.invalid',STAGING_AUTH_TEST_PASSWORD:'DUMMY_NOT_A_REAL_PASSWORD'};
 const file=fileURLToPath(new URL('../.env',import.meta.url));
 if(existsSync(file))loadEnvFile(file);
 return process.env;
}
export function authConfig(env){
 if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY)throw Error('SUPABASE_URL_AND_ANON_KEY_REQUIRED');
 let url;try{url=new URL(env.SUPABASE_URL);}catch{throw Error('INVALID_SUPABASE_URL');}
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('INVALID_SUPABASE_URL');
 return {url:url.origin,anon:env.SUPABASE_ANON_KEY,service:env.SUPABASE_SERVICE_ROLE_KEY};
}
export function credentials(env){
 if(!env.STAGING_AUTH_TEST_EMAIL||!env.STAGING_AUTH_TEST_PASSWORD)throw Error('STAGING_AUTH_TEST_EMAIL_AND_PASSWORD_REQUIRED: add STAGING_AUTH_TEST_EMAIL and STAGING_AUTH_TEST_PASSWORD privately to .env; do not put values in command arguments or chat');
 return {email:env.STAGING_AUTH_TEST_EMAIL,password:env.STAGING_AUTH_TEST_PASSWORD};
}
export const sdkOptions=transport=>({auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport}});
export function validateBearer(token){
 if(typeof token!=='string'||token.length>12000||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw Error('INVALID_ACCESS_TOKEN_FORMAT');
}
export function mockAuthFetch(input){
 const path=new URL(input).pathname;
 const user={id:dummyActor,email:'customer@staging.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',is_anonymous:false};
 if(path==='/auth/v1/settings')return Promise.resolve(Response.json({external:{email:true}}));
 if(path==='/auth/v1/token')return Promise.resolve(Response.json({access_token:dummyToken,refresh_token:'DUMMY_REFRESH',token_type:'bearer',expires_in:3600,user}));
 if(path==='/auth/v1/user')return Promise.resolve(Response.json(user));
 if(path.endsWith('/translation_session_context'))return Promise.resolve(Response.json({actor:dummyActor,role:'customer'}));
 if(path.endsWith('/translation_runtime_settings'))return Promise.resolve(Response.json({capture_enabled:false,commands_enabled:false,notifications_enabled:false}));
 throw Error('UNEXPECTED_MOCK_ENDPOINT');
}
export async function probeAuth(config,{fetcher=fetch,logger=console.log}={}){
 const transport=createSupabaseTransport(config,{fetcher});
 const response=await transport(config.url+'/auth/v1/settings',{headers:{apikey:config.anon}});
 // Consume without logging project settings or response bodies.
 await response.text();
 logger('AUTH_CONNECTIVITY '+JSON.stringify({httpStatus:response.status,reachedServer:true}));
 if(!response.ok)throw Object.assign(Error('AUTH_SETTINGS_HTTP_ERROR'),{status:response.status});
}
export function reportFailure(error,env={},logger=console.error){
 const detail=safeError(error,[env.SUPABASE_ANON_KEY,env.SUPABASE_SERVICE_ROLE_KEY,env.STAGING_AUTH_TEST_EMAIL,env.STAGING_AUTH_TEST_PASSWORD]);
 logger('AUTH_TEST_FAILED '+JSON.stringify({error:detail,hint:networkHint(detail)}));
}
