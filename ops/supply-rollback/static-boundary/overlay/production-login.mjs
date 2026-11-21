// Rollback-only overlay. The authored onboarding login module remains unchanged.
const form=document.getElementById('production-login'),status=document.getElementById('login-status');
const unavailable='/professionals.html#supply-unavailable';
const supplyPaths=new Set(['/supply-register.html','/supply-dashboard.html','/supply-review.html','/supply-profile.html']);
const destinations=['/instant-quote.html','/translation-workspace.html','/learning-room.html','/application.html','/vendor-review.html','/service-review.html','/launch-report.html','/staff-review.html','/learn/account.html','/learn/schedule.html'];
function target(){
 try{
  const raw=new URLSearchParams(location.search).get('next')||'/instant-quote.html';
  const next=new URL(raw,location.origin);
  if(next.origin!==location.origin)return {href:'/instant-quote.html',supply:false};
  const path=decodeURIComponent(next.pathname).replace(/\/+$/,'').toLowerCase();
  if(supplyPaths.has(path))return {href:unavailable,supply:true};
  return {href:destinations.includes(next.pathname)?next.href:'/instant-quote.html',supply:false};
 }catch{return {href:'/instant-quote.html',supply:false};}
}
if(target().supply){
 // Do not collect credentials or issue an auth request for a suspended flow.
 form.hidden=true;
 form.onsubmit=event=>event.preventDefault();
 location.replace(unavailable);
}else{
 form.onsubmit=async event=>{
  event.preventDefault();const button=form.querySelector('button');button.disabled=true;
  try{
   const response=await fetch('/api/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.email.value,password:form.password.value}),cache:'no-store'});
   if(!response.ok)throw Error('Sign-in failed. Check your account details and email confirmation.');
   form.password.value='';location.assign(target().href);
  }catch(error){status.textContent=window.MarocoraSite?.t(error.message)||error.message;}
  finally{button.disabled=false;}
 };
}
