import {api,node,dataNode,message,typeNames,profileDetails} from './supply-client.mjs';
const root=document.querySelector('#profile');
async function load(){const id=new URL(location.href).searchParams.get('id');if(!id)throw Error('This profile is unavailable.');const rows=await api('/api/supply/profiles?'+new URLSearchParams({id}));const row=rows[0];if(!row)throw Error('This profile is unavailable.');const parts=[node('span','Reviewed partner','status'),dataNode('h1',row.profile.displayName),node('p',typeNames[row.type])];
 if(row.hasVideo){const watch=node('a','Watch introduction video');watch.href='/intro/'+encodeURIComponent(row.id);watch.className='button primary intro-watch';parts.push(watch);}
 parts.push(profileDetails(row.profile,row.type));root.replaceChildren(...parts);}
load().catch(error=>{root.replaceChildren(node('h1','Profile unavailable'));message(document.querySelector('#message'),error.message,true);});
