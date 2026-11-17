const form=document.getElementById('production-login'),status=document.getElementById('login-status');
form.onsubmit=async event=>{
 event.preventDefault();const button=form.querySelector('button');button.disabled=true;
 try{
  const response=await fetch('/api/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.email.value,password:form.password.value}),cache:'no-store'});
  if(!response.ok)throw Error('Sign-in failed. Check your account details and email confirmation.');
  form.password.value='';const next=new URL(new URLSearchParams(location.search).get('next')||'/instant-quote.html',location.origin);
  location.assign(next.origin===location.origin&&['/instant-quote.html','/learning-room.html'].includes(next.pathname)?next.href:'/instant-quote.html');
 }catch(error){status.textContent=window.MarocoraSite?.t(error.message)||error.message;}finally{button.disabled=false;}
};
