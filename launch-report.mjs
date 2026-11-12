import {instructorStore,rpc} from './vendor-client.mjs';
const workspace=document.querySelector('#workspace'),status=document.querySelector('#status'),gate=document.querySelector('#signin-gate');
const labels={pending:'Awaiting review',needs_information:'Waiting for information',approved:'Approved',declined:'Declined'};
let snapshot=null,requestVersion=0;
function clear(){snapshot=null;workspace.hidden=true;document.querySelector('#metrics').replaceChildren();document.querySelector('#updated').textContent='';}
async function load(){
 const version=++requestVersion;clear();gate.hidden=true;status.textContent='Checking reviewer access…';document.querySelector('#refresh').disabled=true;
 try{
  const {data:{user},error}=await instructorStore.auth.getUser();if(error||!user)throw Error('REVIEWER_REQUIRED');
  // The server verifies staff membership and excludes permanent test records.
  const counts=await rpc('vendor_production_summary');
  if(version!==requestVersion)return;
  snapshot={at:new Date().toISOString(),counts:Object.fromEntries(Object.keys(labels).map(k=>{const n=Number(counts[k]);if(!Number.isSafeInteger(n)||n<0)throw Error('INVALID_SUMMARY');return [k,n];}))};
  for(const [key,label] of Object.entries(labels)){const item=document.createElement('span'),number=document.createElement('strong');number.textContent=String(snapshot.counts[key]);item.append(number,document.createTextNode(' '+label));document.querySelector('#metrics').append(item);}
  document.querySelector('#updated').textContent='Snapshot taken '+new Date(snapshot.at).toLocaleString()+'. Refresh to update.';workspace.hidden=false;status.textContent='Production vendor totals · test applications excluded';
 }catch{if(version===requestVersion){clear();gate.hidden=false;status.textContent='This report requires an authorised reviewer account.';}}
 finally{if(version===requestVersion)document.querySelector('#refresh').disabled=false;}
}
document.querySelector('#refresh').onclick=load;
document.querySelector('#export').onclick=()=>{
 if(!snapshot||workspace.hidden)return;
 const csv='snapshot_utc,scope,status,count\r\n'+Object.keys(labels).map(k=>`${snapshot.at},production_vendor_applications,${k},${snapshot.counts[k]}`).join('\r\n')+'\r\n';
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`marocora-vendor-launch-${snapshot.at.slice(0,10)}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
instructorStore.auth.onAuthStateChange(event=>{
 if(event==='SIGNED_OUT'||event==='SIGNED_IN'){
  requestVersion++;clear();document.querySelector('#refresh').disabled=false;
  gate.hidden=event==='SIGNED_IN';status.textContent=event==='SIGNED_IN'?'Checking reviewer access…':'This report requires an authorised reviewer account.';
  // Run outside the auth callback so an existing session loads automatically.
  if(event==='SIGNED_IN')setTimeout(load,0);
 }
});
await load();
