// Snapshot non-enumerable Error fields too; never retain a raw SDK error/token
// reference in the console where it could later expose connection credentials.
export function liveKitErrorSnapshot(error,{token}={}){
 const seen=new WeakSet();
 const clean=(value,depth=0)=>{
  if(typeof value==='string'){
   let text=token?value.split(token).join('[REDACTED]'):value;
   return text.replace(/Bearer\s+[^\s"'<>]+/gi,'Bearer [REDACTED]').replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[REDACTED_JWT]').replace(/([?&](?:access_?token|token|ticket|api_?key|secret)=)[^&#\s"']*/gi,'$1[REDACTED]').slice(0,8000);
  }
  if(value===null||typeof value==='number'||typeof value==='boolean')return value;
  if(value===undefined)return undefined;
  if(typeof value!=='object')return String(value);
  if(depth>=6)return '[DEPTH_LIMIT]';if(seen.has(value))return '[CIRCULAR]';seen.add(value);
  if(Array.isArray(value))return value.slice(0,50).map(item=>clean(item,depth+1));
  const result={};
  const keys=[...new Set([...Object.getOwnPropertyNames(value),'name','message','stack','code','reason','reasonName','status','statusCode','context','cause'])].slice(0,75);
  for(const key of keys){
   try{const item=value[key];if(item===undefined)continue;Object.defineProperty(result,key,{value:/(token|secret|authorization|cookie|credential|password|api.?key)/i.test(key)?'[REDACTED]':clean(item,depth+1),enumerable:true});}
   catch{Object.defineProperty(result,key,{value:'[UNREADABLE]',enumerable:true});}
  }
  return result;
 };
 return clean(error);
}
export function logLiveKitConnectionError(error,{token,serverUrl},log=console.error){
 log('LIVEKIT_CONNECTION_ERROR',liveKitErrorSnapshot(error,{token}),{serverUrl});
}
