// Code recovery never reads, copies or scrubs URL credentials. Inputs stay only
// in their form controls and transient request bodies, never attributes/storage/logs.
const form=document.getElementById('password-reset'),status=document.getElementById('reset-status'),resend=document.getElementById('send-new-code');
const errors={RESET_EMAIL_INVALID:'Enter a valid email address.',RESET_CODE_MALFORMED:'Enter the 6-digit code.',
 RESET_CODE_INVALID_OR_EXPIRED:'The code is incorrect or has expired. Request a new code.',
 RESET_TOO_MANY_ATTEMPTS:'Too many attempts. Try again later.',RESET_PASSWORD_INVALID:'Password must be 12 to 128 characters.',
 RESET_PASSWORD_REJECTED:'Choose a different password that meets the security requirements.',
 RESET_COMPLETION_UNCERTAIN:'The password may have changed, but confirmation failed. Try signing in or request a new code.',
 RESET_SERVICE_UNAVAILABLE:'Service temporarily unavailable. Please try again later.'};
let busy=false,done=false,statusKey='Enter the code from your email.';
const show=key=>{statusKey=key;status.textContent=window.MarocoraSite?.t(key)||key;};
const validEmail=email=>email.length<=320&&/^\S+@\S+\.\S+$/.test(email);
const lock=value=>{busy=value;for(const button of form.querySelectorAll('button'))button.disabled=value;form.setAttribute('aria-busy',String(value));};
const clearSecrets=()=>{form.code.value='';form.password.value='';form.confirmation.value='';};
async function post(path,fields){
 const signal=typeof globalThis.AbortSignal?.timeout==='function'?globalThis.AbortSignal.timeout(20000):undefined;
 const response=await fetch(path,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields),signal});
 let data;try{data=await response.json();}catch{throw Error('RESET_SERVICE_UNAVAILABLE');}
 if(!response.ok)throw Error(response.status===429?'RESET_TOO_MANY_ATTEMPTS':Object.hasOwn(errors,data?.error)?data.error:'RESET_SERVICE_UNAVAILABLE');
 return data;
}
resend.hidden=false;show(statusKey);document.addEventListener('marocora:language',()=>show(statusKey));
form.onsubmit=async event=>{
 event.preventDefault();if(busy||done)return;
 const email=form.email.value.trim(),code=form.code.value,password=form.password.value;
 if(!validEmail(email)){show(errors.RESET_EMAIL_INVALID);return;}
 if(!/^\d{6}$/.test(code)){show(errors.RESET_CODE_MALFORMED);return;}
 if(password.length<12||password.length>128){show(errors.RESET_PASSWORD_INVALID);return;}
 if(password!==form.confirmation.value){show('The passwords do not match.');return;}
 lock(true);show('Verifying your code…');
 try{
  const data=await post('/api/auth/complete-reset-code',{email,code,password});
  if(data?.reset!==true)throw Error('RESET_SERVICE_UNAVAILABLE');
  done=true;form.hidden=true;form.email.value='';show('Password changed. Sign in with your new password.');
 }catch(error){resend.hidden=false;show(Object.hasOwn(errors,error?.message)?errors[error.message]:errors.RESET_SERVICE_UNAVAILABLE);}
 finally{clearSecrets();lock(false);}
};
resend.onclick=async()=>{
 if(busy||done)return;
 const email=form.email.value.trim();if(!validEmail(email)){show(errors.RESET_EMAIL_INVALID);return;}
 lock(true);clearSecrets();show('Sending a new code…');
 try{
  const data=await post('/api/auth/request-reset',{email});
  if(data?.accepted!==true)throw Error('RESET_SERVICE_UNAVAILABLE');
  show('If an account uses this address, a new code will be sent. Check your inbox and spam folder.');
 }catch(error){show(Object.hasOwn(errors,error?.message)?errors[error.message]:errors.RESET_SERVICE_UNAVAILABLE);}
 finally{lock(false);}
};
