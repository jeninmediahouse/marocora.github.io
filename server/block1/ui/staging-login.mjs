const form=document.getElementById('staging-login'),status=document.getElementById('status');
form.addEventListener('submit',async event=>{
 event.preventDefault();const button=form.querySelector('button');button.disabled=true;
 try{
  const response=await fetch('/api/staging-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.email.value,password:form.password.value})});
  const data=await response.json();form.password.value='';if(!response.ok||!data.accessToken)throw Error('Staging sign-in failed');
  sessionStorage.setItem('marocora-staging-token',data.accessToken);status.textContent='Signed in to your staging account.'; const link=document.createElement('a');link.href='instant-quote.html';link.textContent=' Open translation workspace';status.append(link);
 }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
});
