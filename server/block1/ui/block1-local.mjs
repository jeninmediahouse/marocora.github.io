// Only this loopback backend serves the local auth endpoints. No production adapter.
export const authHeaders=()=>{const token=sessionStorage.getItem('marocora-staging-token');return token?{Authorization:'Bearer '+token}:{};};
export function privateDownload(link){link.addEventListener('click',async event=>{if(!sessionStorage.getItem('marocora-staging-token'))return;event.preventDefault();const r=await fetch(link.getAttribute('href'),{headers:authHeaders(),cache:'no-store'});if(!r.ok)return;const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download='document';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});}
export async function api(path,options={}){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers:{...authHeaders(),...(options.headers||{})}});
 if(!response.ok){let code='LOCAL_REQUEST_FAILED';try{code=(await response.json()).error||code;}catch{}throw Error(code);}
 return response.json();
}
export const post=(path,value,csrf)=>api(path,{method:'POST',headers:{'Content-Type':'application/json',...(csrf?{'x-csrf-token':csrf}:{})},body:JSON.stringify(value)});
if(location.pathname==='/block1-local.html'){
 const status=document.getElementById('status');const ticket=location.hash.slice(1);history.replaceState(null,'',location.pathname);
 try{if(ticket)await post('/api/local-login',{ticket});const me=await api('/api/me');status.textContent='Signed in as local '+me.role+'. Each browser profile has its own session. This is local authentication only.';}
 catch(e){status.textContent=e.message+'. Obtain a fresh one-use link by restarting the local launcher.';}
}
