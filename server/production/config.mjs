export function productionConfig(env){
 const bad=code=>{throw Error(code);};
 if(env.NODE_ENV!=='production')bad('NODE_ENV_MUST_BE_PRODUCTION');
 const raw=env.APP_ORIGINS;if(typeof raw!=='string'||!raw.trim())bad('APP_ORIGINS_REQUIRED');
 const origins=[...new Set(raw.split(',').map(value=>{let u;try{u=new URL(value.trim());}catch{bad('INVALID_APP_ORIGIN');}if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')bad('INVALID_APP_ORIGIN');return u.origin;}))];
 if(origins.length>10)bad('TOO_MANY_APP_ORIGINS');
 const host=env.HOST||'127.0.0.1',port=Number(env.PORT||4195);
 if(!['127.0.0.1','::1'].includes(host))bad('PRODUCTION_REQUIRES_LOOPBACK_PROXY');
 if(!Number.isInteger(port)||port<0||port>65535)bad('INVALID_LOCAL_PORT');
 if(env.LEARNING_VIDEO_MODE&&env.LEARNING_VIDEO_MODE!=='live')bad('PRODUCTION_REQUIRES_LIVE_MODE');
 return {origins,host,port,trustProxy:env.TRUST_PROXY==='true'};
}
