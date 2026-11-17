// Supplement the unchanged historical HTTP guard. Any blocked attempt fails the
// process even if application code catches the exception. No DNS for remote hosts.
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns';
import dgram from 'node:dgram';
import http from 'node:http';
import https from 'node:https';
import {syncBuiltinESMExports} from 'node:module';
let denied=0;
const loopback=new Set(['127.0.0.1','::1','[::1]','localhost']);
function block(){denied++;process.exitCode=1;throw Error('TEST_EXTERNAL_NETWORK_BLOCKED');}
function host(value){if(!loopback.has(value))block();}
function socket(args){
 const a=args[0];
 if(Array.isArray(a))return socket(a);
 if(a&&typeof a==='object'){
  if(a.lookup)block();
  if(a.path){if(!String(a.path).startsWith('/'))block();return;}
  host(a.host||a.hostname||'localhost');return;
 }
 if(typeof a==='string'&&!/^\d+$/.test(a)){if(!a.startsWith('/'))block();return;}
 host(typeof args[1]==='string'?args[1]:'localhost');
}
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){socket(args);return connect.apply(this,args);};
const secure=tls.connect;
tls.connect=function(...args){socket(args);return secure.apply(this,args);};
function request(input,options){
 const u=typeof input==='string'||input instanceof URL?new URL(input):input||{};
 host(options?.hostname||options?.host||u.hostname||u.host||'localhost');
 // A custom resolver could turn localhost into an external address.
 if(options?.lookup||u.lookup)block();
}
for(const m of [http,https])for(const name of ['request','get']){
 const original=m[name];m[name]=function(input,options,...rest){request(input,options);return original.call(this,input,options,...rest);};
}
const fetch=globalThis.fetch;
globalThis.fetch=(input,options)=>{request(typeof input==='string'||input instanceof URL?input:input.url);return fetch(input,options);};
for(const api of [dns,dns.promises,dns.Resolver.prototype,dns.promises.Resolver.prototype]){
 for(const name of Object.getOwnPropertyNames(api))if(name==='lookup'||name==='reverse'||name.startsWith('resolve')){
  if(typeof api[name]!=='function')continue;
  const original=api[name];api[name]=function(value,...args){host(value);return original.call(this,value,...args);};
 }
}
for(const name of ['connect','send'])dgram.Socket.prototype[name]=block;
syncBuiltinESMExports();
process.once('exit',()=>{if(denied)process.exitCode=1;console.log('TEST_NETWORK_LOCK: blocked='+denied+'; unexpected outbound attempts fail process');});
