export const STAGING_TIMEOUT_MS=45000;
// Keep the underlying code/cause, never arbitrary error objects, headers or bodies.
export function safeError(error,secrets=[]){
 const clean=value=>{
  let text=String(value);
  for(const secret of secrets.filter(x=>typeof x==='string'&&x.length))text=text.split(secret).join('[REDACTED]');
  return text.replace(/https?:\/\/[^\s'"<>]+/g,'[URL REDACTED]')
   .replace(/Bearer\s+[^\s'"<>]+/gi,'Bearer [REDACTED]')
   .replace(/\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[TOKEN OR HOST REDACTED]')
   .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/g,'[KEY REDACTED]').slice(0,600);
 };
 const seen=new Set();
 function visit(e,depth=0){
  if(!e||depth>4||seen.has(e))return undefined;
  if(typeof e!=='object')return {message:clean(e)};
  seen.add(e);const out={};
  for(const field of ['name','message','code','errno','syscall','status'])if(['string','number'].includes(typeof e[field]))out[field]=clean(e[field]);
  if(e.cause)out.cause=visit(e.cause,depth+1);
  if(Array.isArray(e.errors))out.errors=e.errors.slice(0,8).map(x=>visit(x,depth+1));
  return out;
 }
 return visit(error)||{message:'Unknown error'};
}
export function networkHint(detail){
 const text=JSON.stringify(detail);
 if(/ENOTFOUND|EAI_AGAIN/.test(text))return 'DNS lookup failed. Check the configured Supabase URL against Dashboard Project URL, then DNS/VPN settings.';
 if(/CERT_|CERTIFICATE|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS/.test(text))return 'TLS verification failed. Check Mac clock and trusted CA/VPN inspection certificates. Do not disable TLS verification.';
 if(/EPERM|EACCES/.test(text))return 'Network access denied. Run the real-auth command in a normal Terminal, outside the offline npm-test sandbox; check firewall/VPN restrictions.';
 if(/UND_ERR_CONNECT_TIMEOUT/.test(text))return 'TCP/TLS connection timed out inside Node fetch. Check firewall, VPN, routing and IPv4/IPv6. The 45-second request deadline does not override Node internal connect timeouts.';
 if(/TimeoutError|ETIMEDOUT|ABORT_ERR/.test(text))return 'Request timed out or was cancelled. Check network/VPN and Supabase availability; request deadline is 45 seconds.';
 if(/ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH/.test(text))return 'Connection refused/reset or unreachable. Check firewall/VPN, network routing and project availability.';
 if(/invalid_credentials/.test(text))return 'Auth was reached. Check the synthetic account email/password and project; do not rerun migrations.';
 if(/email_not_confirmed/.test(text))return 'Auth was reached. Confirm the synthetic user through the no-email admin route.';
 if(/429|over_request_rate_limit/.test(text))return 'Auth rate limit reached. Stop retries and wait before testing again.';
 return 'Check the structured error code/cause. HTTP Auth errors mean the server was reached; transport failures do not establish bad credentials.';
}
export function createSupabaseTransport(config,{fetcher=fetch,logger=console.error,timeoutMs=STAGING_TIMEOUT_MS}={}){
 return async(input,options={})=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  if(url.origin!==config.url)throw Object.assign(Error('STAGING_REMOTE_ORIGIN_DENIED'),{status:503});
  const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs);
  const headers=new Headers(options.headers??(input instanceof Request?input.headers:undefined));
  const apiKey=headers.get('apikey');
  // The SDK may default Authorization to its API key. Opaque keys are not JWTs;
  // remove only that redundant value, never the signed-in user's session JWT.
  if(/^sb_(publishable|secret)_/.test(apiKey||'')&&headers.get('authorization')==='Bearer '+apiKey)headers.delete('authorization');
  try{return await fetcher(input,{...options,headers,redirect:'error',signal});}
  catch(error){
   const secrets=[config.anon,config.service,url.hostname];
   for(const value of new Headers(options.headers).values())secrets.push(value);
   try{const body=JSON.parse(options.body);secrets.push(body.email,body.password,body.refresh_token);}catch{}
   const detail=safeError(error,secrets);
   logger('STAGING_NETWORK_ERROR '+JSON.stringify({timeoutMs,error:detail,hint:networkHint(detail)}));
   throw Object.assign(Error('STAGING_CONNECTION_FAILED',{cause:error}),{status:503});
  }
 };
}
