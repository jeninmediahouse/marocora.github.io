// Node/Deno-compatible configuration helpers. Errors never contain input values.
const fail=code=>{throw Error(code);};
export function isModernSupabaseKey(value,type){
 return typeof value==='string'&&new RegExp('^sb_'+type+'_[A-Za-z0-9_-]{16,}$').test(value);
}
export function supabaseKeyPair(env){
 const modern=['SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY'].some(name=>Object.hasOwn(env,name));
 if(modern||env.SUPABASE_REQUIRE_MODERN_KEYS==='true'){
  if(!isModernSupabaseKey(env.SUPABASE_PUBLISHABLE_KEY,'publishable')||!isModernSupabaseKey(env.SUPABASE_SECRET_KEY,'secret'))fail('SUPABASE_MODERN_KEY_PAIR_REQUIRED');
  return {anon:env.SUPABASE_PUBLISHABLE_KEY,service:env.SUPABASE_SECRET_KEY,keyMode:'modern'};
 }
 // Temporary compatibility for an already-running legacy deployment. A partial
 // modern pair NEVER falls back, even when old variables remain in PM2.
 if([env.SUPABASE_ANON_KEY,env.SUPABASE_SERVICE_ROLE_KEY].some(value=>typeof value!=='string'||!value.trim()))fail('STAGING_ENV_INCOMPLETE');
 if(env.SUPABASE_ANON_KEY.startsWith('sb_secret_'))fail('SUPABASE_PUBLIC_KEY_REQUIRED');
 return {anon:env.SUPABASE_ANON_KEY,service:env.SUPABASE_SERVICE_ROLE_KEY,keyMode:'legacy'};
}
export function supabaseRequestHeaders(apiKey,authorization){
 return {apikey:apiKey,...(authorization?{Authorization:authorization}:
  /^sb_(secret|publishable)_/.test(apiKey)?{}:{Authorization:'Bearer '+apiKey})};
}
export function edgeSupabaseConfiguration(get){
 const supabaseURL=get('SUPABASE_URL');let url;
 try{url=new URL(supabaseURL);}catch{fail('INVALID_SUPABASE_URL');}
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)fail('INVALID_SUPABASE_URL');
 const name=get('MAROCORA_SUPABASE_SECRET_KEY_NAME')||'marocora-production-20261119';
 let serviceKey=get('MAROCORA_SUPABASE_SECRET_KEY');
 if(serviceKey===undefined){
  let keys;try{keys=JSON.parse(get('SUPABASE_SECRET_KEYS')||'null');}catch{fail('SUPABASE_MODERN_SECRET_CONFIGURATION_INVALID');}
  if(!keys||typeof keys!=='object'||Array.isArray(keys)||!Object.hasOwn(keys,name))fail('SUPABASE_NAMED_SECRET_KEY_REQUIRED');
  serviceKey=keys[name];
 }
 if(!isModernSupabaseKey(serviceKey,'secret'))fail('SUPABASE_MODERN_SECRET_KEY_REQUIRED');
 return {supabaseURL:url.origin,serviceKey};
}
