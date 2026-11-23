// Fragment credentials stay in this closure only. Never DOM/storage/console.
const form=document.getElementById('password-reset'),status=document.getElementById('reset-status');
let accessToken='',refreshToken='',busy=false,statusKey='This link has expired. Request a new one.';
const show=key=>{statusKey=key;status.textContent=window.MarocoraSite?.t(key)||key;};
function recovery(){
 const fragment=location.hash.length<=22000?new URLSearchParams(location.hash.slice(1)):null;
 const query=new URLSearchParams(location.search),lang=query.get('lang');
 let pair=null;
 // Explicit implicit flow only: a PKCE code is invalid, never exchanged here.
 const candidate=fragment?.get('access_token'),refresh=fragment?.get('refresh_token');
 if(fragment&&fragment.getAll('access_token').length===1&&fragment.getAll('refresh_token').length===1
 &&fragment.getAll('type').length===1&&fragment.get('type')==='recovery'&&!fragment.has('error')&&!query.has('code')
 &&fragment.getAll('token_type').length<=1&&(!fragment.has('token_type')||fragment.get('token_type')==='bearer')
 &&typeof candidate==='string'&&candidate.length<=12000&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(candidate)
 &&typeof refresh==='string'&&/^[\x21-\x7e]{16,4096}$/.test(refresh)){
  try{
   const encoded=candidate.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
   const payload=JSON.parse(atob(encoded));
   if(Number.isSafeInteger(payload.exp)&&payload.exp>Math.floor(Date.now()/1000))pair=[candidate,refresh];
  }catch{}
 }
 // Failure to erase credentials is fail-closed, before any submit becomes usable.
 history.replaceState(null,'',location.pathname+(['en','fr','ar','es'].includes(lang)?'?lang='+lang:''));
 return pair;
}
try{
 let pair=recovery();
 if(pair){[accessToken,refreshToken]=pair;pair=null;form.hidden=false;show('Enter your new password.');}
 else{form.hidden=true;show(statusKey);}
}catch{form.hidden=true;show(statusKey);}
document.addEventListener('marocora:language',()=>show(statusKey));
form.onsubmit=async event=>{
 event.preventDefault();if(busy||!accessToken||!refreshToken)return;
 const password=form.password.value,confirmation=form.confirmation.value;
 if(password.length<12||password.length>128){show('Use 12–128 characters.');return;}
 if(password!==confirmation){show('The passwords do not match.');return;}
 busy=true;const button=form.querySelector('button');button.disabled=true;
 try{
  const response=await fetch('/api/auth/complete-reset',{method:'POST',credentials:'omit',cache:'no-store',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken,refreshToken,password})});
  if(!response.ok)throw Error('RESET_FAILED');
  const result=await response.json();if(result?.reset!==true)throw Error('RESET_FAILED');
  form.hidden=true;show('Password changed. Sign in with your new password.');
 }catch{form.hidden=true;show('This link has expired. Request a new one.');}
 finally{accessToken='';refreshToken='';form.password.value='';form.confirmation.value='';busy=false;button.disabled=false;}
};
