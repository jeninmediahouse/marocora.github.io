// Browser configuration accepts publishable keys only. No server credentials.
export function publicSupabaseConfiguration(config){
 let url;try{url=new URL(config.supabaseURL);}catch{throw Error('PUBLIC_SUPABASE_CONFIGURATION_REQUIRED');}
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||
  !/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(config.supabasePublishableKey||''))throw Error('PUBLIC_SUPABASE_CONFIGURATION_REQUIRED');
 return {url:url.origin,key:config.supabasePublishableKey};
}
export function publicSupabaseUserHeaders(config,session){
 const {key}=publicSupabaseConfiguration(config);
 if(typeof session?.access_token!=='string'||!session.access_token||session.access_token.startsWith('sb_')||/[\r\n]/.test(session.access_token))throw Error('SIGN_IN_REQUIRED');
 return {apikey:key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'};
}
export function publicSupabaseFetch(fetcher=fetch){
 return (input,options={})=>{
  const headers=new Headers(options.headers??(input instanceof Request?input.headers:undefined)),key=headers.get('apikey');
  if(key?.startsWith('sb_publishable_')&&headers.get('authorization')==='Bearer '+key)headers.delete('authorization');
  return fetcher(input,{...options,headers});
 };
}
