// Imported before tests. No Cloudmersive or other external host can be contacted.
import http from 'node:http';
import https from 'node:https';
import {syncBuiltinESMExports} from 'node:module';
let denied=0;
const allowed=new Set(['127.0.0.1','localhost','::1','[::1]']);
function guard(input,options){
 let host;
 if(typeof input==='string'||input instanceof URL)host=new URL(input).hostname;
 else host=input?.hostname||input?.host||'localhost';
 if(options&&typeof options==='object')host=options.hostname||options.host||host;
 if(!allowed.has(host)){denied++;throw Error('TEST_EXTERNAL_NETWORK_BLOCKED');}
}
for(const module of [http,https]){
 const original=module.request;module.request=function(input,options,...rest){guard(input,options);return original.call(this,input,options,...rest);};
 const get=module.get;module.get=function(input,options,...rest){guard(input,options);return get.call(this,input,options,...rest);};
}
const fetch=globalThis.fetch;globalThis.fetch=(input,options)=>{guard(typeof input==='string'||input instanceof URL?input:input.url);return fetch(input,options);};
syncBuiltinESMExports();
process.once('exit',()=>console.log('TEST_NETWORK_GUARD: external attempts blocked='+denied+'; no external connection permitted'));
