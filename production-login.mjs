const form=document.getElementById('production-login'),status=document.getElementById('login-status');
const forgot=document.getElementById('forgot-password');
let resetBusy=false;
forgot.onclick=async()=>{
 if(resetBusy)return;
 const email=form.email.value;
 const show=key=>{status.textContent=window.MarocoraSite?.t(key)||key;};
 if(email.length>320||!/^\S+@\S+\.\S+$/.test(email)){show('Enter a valid email address.');return;}
 resetBusy=true;forgot.disabled=true;
 try{
  const response=await fetch('/api/auth/request-reset',{method:'POST',credentials:'omit',cache:'no-store',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
  if(!response.ok){show(response.status===429?'Too many attempts. Try again later.':'Service temporarily unavailable. Please try again later.');return;}
  const result=await response.json();if(result?.accepted!==true)throw Error('RESET_REQUEST_FAILED');
  show('If an account uses this address, a new code will be sent. Check your inbox and spam folder.');
  location.assign('/reset-password.html');
 }catch{show('Service temporarily unavailable. Please try again later.');}
 finally{resetBusy=false;forgot.disabled=false;}
};
form.onsubmit=async event=>{
 event.preventDefault();const button=form.querySelector('button');button.disabled=true;
 try{
  const response=await fetch('/api/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.email.value,password:form.password.value}),cache:'no-store'});
  if(!response.ok)throw Error('Sign-in failed. Check your account details and email confirmation.');
  form.password.value='';const next=new URL(new URLSearchParams(location.search).get('next')||'/instant-quote.html',location.origin);
  const destinations=['/supply-dashboard.html','/supply-review.html','/instant-quote.html','/translation-workspace.html','/learning-room.html','/application.html','/vendor-review.html','/service-review.html','/launch-report.html','/staff-review.html','/learn/account.html','/learn/schedule.html'];
  location.assign(next.origin===location.origin&&destinations.includes(next.pathname)?next.href:'/instant-quote.html');
 }catch(error){status.textContent=window.MarocoraSite?.t(error.message)||error.message;}finally{button.disabled=false;}
};
