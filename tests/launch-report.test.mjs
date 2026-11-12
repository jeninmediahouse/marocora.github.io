import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../launch-report.mjs',import.meta.url),'utf8').replace(/^import .*?;\n/,'');
async function report({staff=true}={}){
 const nodes=new Map(),downloads=[],blobs=new Map(),timers=[];let authChange;
 const element=()=>({hidden:false,disabled:false,textContent:'',children:[],append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},click(){if(this.href)downloads.push({name:this.download,blob:blobs.get(this.href)});}});
 const document={querySelector(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},createElement:element,createTextNode:text=>({textContent:text})};
 const context={document,Blob,URL:{createObjectURL(blob){const id='blob:'+blobs.size;blobs.set(id,blob);return id;},revokeObjectURL(){}},Date,console,setTimeout(fn){timers.push(fn);},instructorStore:{auth:{async getUser(){return {data:{user:{id:'synthetic-reviewer'}}};},onAuthStateChange(fn){authChange=fn;}}},async rpc(name){assert.equal(name,'vendor_production_summary');if(!staff)throw Error('STAFF_REQUIRED');return {pending:3,needs_information:2,approved:1,declined:0};}};
 await runInNewContext('(async()=>{'+source+'})()',context);
 return {nodes,downloads,authChange,timers,async click(id){await nodes.get(id).onclick();}};
}
test('launch report denies nonstaff and cannot export a private snapshot',async()=>{
 const r=await report({staff:false});assert.equal(r.nodes.get('#workspace').hidden,true);assert.equal(r.nodes.get('#signin-gate').hidden,false);
 await r.click('#export');assert.equal(r.downloads.length,0);
});
test('staff report exports only aggregate status counts and clears them on sign-out',async()=>{
 const r=await report();assert.equal(r.nodes.get('#workspace').hidden,false);assert.equal(r.nodes.get('#metrics').children.length,4);
 await r.click('#export');assert.equal(r.downloads.length,1);const csv=await r.downloads[0].blob.text();
 assert.match(csv,/production_vendor_applications,pending,3/);assert.match(csv,/production_vendor_applications,needs_information,2/);assert.equal(csv.trim().split('\r\n').length,5);assert.ok(!csv.includes('synthetic-reviewer'));
 r.authChange('SIGNED_OUT');assert.equal(r.nodes.get('#workspace').hidden,true);assert.equal(r.nodes.get('#metrics').children.length,0);
 await r.click('#export');assert.equal(r.downloads.length,1);
});
test('restoring a signed-in session reloads outside the auth callback',async()=>{
 const r=await report();r.authChange('SIGNED_IN');assert.equal(r.nodes.get('#workspace').hidden,true);assert.equal(r.nodes.get('#signin-gate').hidden,true);
 assert.equal(r.timers.length,1);await r.timers[0]();assert.equal(r.nodes.get('#workspace').hidden,false);
});
