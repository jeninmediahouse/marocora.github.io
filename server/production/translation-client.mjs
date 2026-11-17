// Production uses only the Secure HttpOnly Supabase session cookie.
export const authHeaders=()=>({});
export async function api(path,options={}){const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});if(response.status===401){location.assign('/production-login.html?next='+encodeURIComponent(location.pathname+location.search));throw Error('AUTH_REQUIRED');}if(!response.ok){let code='REQUEST_FAILED';try{code=(await response.json()).error||code;}catch{}throw Error(code);}return response.json();}
export const post=(path,value)=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
export function privateDownload(){}
