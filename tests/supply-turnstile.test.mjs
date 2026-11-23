import test from 'node:test';
import assert from 'node:assert/strict';
import {createTurnstileVerifier,turnstileAction} from '../server/production/turnstile.mjs';

const env={TURNSTILE_SITE_KEY:'synthetic-site-key',TURNSTILE_SECRET_KEY:'synthetic-server-secret'};
const reply=(body,status=200)=>Response.json(body,{status});

test('turnstile verifier stays disabled unless both public and secret configuration exist',()=>{
 assert.equal(createTurnstileVerifier({}),null);
 assert.equal(createTurnstileVerifier({TURNSTILE_SITE_KEY:'synthetic-site-key'}),null);
 assert.equal(createTurnstileVerifier({TURNSTILE_SECRET_KEY:'synthetic-server-secret'}),null);
 assert.equal(createTurnstileVerifier({TURNSTILE_SITE_KEY:'   ',TURNSTILE_SECRET_KEY:'synthetic-server-secret'}),null);
 assert.equal(createTurnstileVerifier({...env,fetcher:async()=>reply({success:true})}).siteKey,'synthetic-site-key');
});

test('turnstile verifier accepts only an explicit successful action-bound result',async()=>{
 const calls=[];
 const verifier=createTurnstileVerifier(env,{fetcher:async(url,options)=>{calls.push({url,options});return reply({success:true,action:turnstileAction});}});
 assert.equal(await verifier.verify('synthetic-human-token','203.0.113.9'),true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');
 assert.equal(calls[0].options.method,'POST');
 assert.equal(calls[0].options.redirect,'error');
 assert.equal(calls[0].options.body.get('secret'),'synthetic-server-secret');
 assert.equal(calls[0].options.body.get('response'),'synthetic-human-token');
 assert.equal(calls[0].options.body.get('remoteip'),'203.0.113.9');
});

test('turnstile verifier rejects false, missing success, wrong action and non-200 results',async()=>{
 const cases=[reply({success:false,action:turnstileAction}),reply({action:turnstileAction}),reply({success:true,action:'different-action'}),reply({success:true,action:turnstileAction},500),reply({success:true,action:turnstileAction},302)];
 for(const response of cases)assert.equal(await createTurnstileVerifier(env,{fetcher:async()=>response}).verify('synthetic-human-token'),false);
});

test('turnstile verifier fails closed on transport, redirect, malformed JSON and timeout errors',async()=>{
 const failing=[async()=>{throw Error('SYNTHETIC_NETWORK');},async()=>{throw Object.assign(Error('SYNTHETIC_REDIRECT'),{name:'TypeError'});},async()=>new Response('not-json',{status:200,headers:{'Content-Type':'text/html'}}),()=>new Promise(()=>{})];
 for(const fetcher of failing)assert.equal(await createTurnstileVerifier(env,{fetcher,timeoutMs:20}).verify('synthetic-human-token'),false);
});

test('turnstile verifier rejects unusable tokens before any network attempt',async()=>{
 let calls=0;
 const verifier=createTurnstileVerifier(env,{fetcher:async()=>{calls++;return reply({success:true,action:turnstileAction});}});
 for(const token of [undefined,null,42,'','   ','two words','x'.repeat(2049)])(assert.equal(await verifier.verify(token),false));
 assert.equal(calls,0);
});

test('turnstile verifier omits empty or oversized remote addresses and never exposes the secret',async()=>{
 const bodies=[];
 const verifier=createTurnstileVerifier(env,{fetcher:async(url,options)=>{bodies.push(options.body);return reply({success:true,action:turnstileAction});}});
 await verifier.verify('synthetic-human-token','');await verifier.verify('synthetic-human-token','9'.repeat(65));await verifier.verify('synthetic-human-token','203.0.113.9');
 assert.equal(bodies[0].has('remoteip'),false);assert.equal(bodies[1].has('remoteip'),false);assert.equal(bodies[2].get('remoteip'),'203.0.113.9');
 assert.equal(JSON.stringify(verifier).includes('synthetic-server-secret'),false);
});
