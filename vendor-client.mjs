import {instructorStore} from './learn/instructor-store.mjs';
import {config} from './learn/config.mjs';
export {instructorStore};
export async function workflow(input){
 const {data:{session}}=await instructorStore.auth.getSession();
 if(!session)throw new Error('SIGN_IN_REQUIRED');
 const r=await fetch(`${config.supabaseURL}/functions/v1/vendor-workflow`,{method:'POST',headers:{apikey:config.supabasePublishableKey,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(input)});
 const result=await r.json();if(!r.ok)throw new Error(result.error||'WORKFLOW_UNAVAILABLE');return result;
}
export async function rpc(name,args={}){const {data,error}=await instructorStore.rpc(name,args);if(error)throw error;return data;}
export async function setupAuth({admin=false,onReady}){
 let renderedUserId=null;
 const clearPrivate=()=>{const workspace=document.querySelector('#workspace');if(workspace)workspace.hidden=true;else document.querySelector('#applications')?.replaceChildren();};
 const form=document.querySelector('#signin'),message=document.querySelector('#auth-status'),identity=document.querySelector('#identity');
 form.querySelector('input').value=admin?'admin@marocora.com':'';
 form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;
  try{localStorage.setItem('marocora.verification.return',JSON.stringify({page:admin?'vendor-review.html':'application.html',lang:'en',id:location.hash.slice(1)}));
   const {error}=await instructorStore.auth.signInWithOtp({email:form.email.value.trim(),options:{emailRedirectTo:`${location.origin}/verify-email.html`,shouldCreateUser:false}});
   if(error)throw error;message.textContent='Check your email, open the secure sign-in link, then return here. No application will be submitted by signing in.';
  }catch{message.textContent='Could not send the sign-in email. Check the address and try again.';}finally{button.disabled=false;}
 };
 async function check(){
  const {data:{user}}=await instructorStore.auth.getUser();
  identity.textContent=user?`Signed in as ${user.email}`:'Not signed in';
  if(!user){renderedUserId=null;clearPrivate();form.hidden=false;return;}
  try{await onReady(user);renderedUserId=user.id;form.hidden=true;message.textContent='';}catch(error){renderedUserId=null;clearPrivate();form.hidden=false;message.textContent=admin?'Sign in as an authorised Marocora reviewer.':readableError(error);}
 }
 document.querySelector('#signout').onclick=async()=>{await instructorStore.auth.signOut();location.reload();};
 document.querySelector('#refresh').onclick=check;
 await check();
 instructorStore.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(event==='SIGNED_IN'&&session?.user.id!==renderedUserId)){clearPrivate();setTimeout(check,0);}});
}
export function readableError(error){
 const m=error.message||'';
 if(m.includes('NOT_SUBMITTED'))return 'The teacher has edited this profile. Ask them to submit the latest version, then refresh.';
 if(m.includes('STALE_REVISION'))return 'This application changed. Refresh and review the latest version before submitting.';
 if(m.includes('QA_APPROVAL_BLOCKED'))return 'This test application cannot be approved.';
 if(m.includes('SELF_REVIEW_DENIED'))return 'You cannot approve or review your own teacher application.';
 if(m.includes('EMAIL_WORKFLOW_NOT_CONFIGURED'))return 'Email delivery is not activated yet. No decision was saved.';
 if(m.includes('ANSWERS_REQUIRED'))return 'Please answer every requested question.';
 return 'Could not complete this action. Your text is still here. Refresh before trying again if a decision may have been saved.';
}
