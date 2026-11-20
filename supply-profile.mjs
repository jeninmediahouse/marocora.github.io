import {api,node,dataNode,message,typeNames,profileDetails} from './supply-client.mjs';
const root=document.querySelector('#profile');
async function load(){const id=new URL(location.href).searchParams.get('id');if(!id)throw Error('This profile is unavailable.');const rows=await api('/api/supply/profiles?'+new URLSearchParams({id}));const row=rows[0];if(!row)throw Error('This profile is unavailable.');root.replaceChildren(node('span','Reviewed partner','status'),dataNode('h1',row.profile.displayName),node('p',typeNames[row.type]),profileDetails(row.profile,row.type));}
load().catch(error=>{root.replaceChildren(node('h1','Profile unavailable'));message(document.querySelector('#message'),error.message,true);});
