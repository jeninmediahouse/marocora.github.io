import {api,message} from './supply-client.mjs';
const form=document.querySelector('#register-form'),notice=document.querySelector('#message'),slot=document.querySelector('#turnstile'),button=form.querySelector('button');
let widget=null,tokenAt=0;
const human=humanCheck();
async function humanCheck(){
 if(typeof fetch!=='function')return 'off';
 if(!slot||!button)return 'unavailable';
 let config;
 try{
  const response=await fetch('/api/supply/register-config',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw Error('CONFIG_UNAVAILABLE');
  config=await response.json();
 }catch{return 'unavailable';}
 if(config?.humanCheck==='unavailable')return 'unavailable';
 if(config?.humanCheck!=='turnstile'||typeof config.siteKey!=='string'||!config.siteKey)return 'off';
 try{
  await new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
   script.async=true;script.onload=resolve;script.onerror=reject;
   (document.head||document.body).append(script);
  });
  widget=window.turnstile.render(slot,{sitekey:config.siteKey,action:'supply-register',callback:()=>{tokenAt=Date.now();},'expired-callback':()=>{tokenAt=0;}});
  return 'ready';
 }catch{return 'unavailable';}
}
form.onsubmit=async event=>{
 event.preventDefault();
 button.disabled=true;
 const state=await human;
 if(state==='unavailable'){message(notice,'The human check could not load. Please refresh and try again.',true);button.disabled=false;return;}
 const token=state==='ready'?window.turnstile.getResponse(widget):'';
 if(state==='ready'&&(!token||(tokenAt&&Date.now()-tokenAt>240000))){message(notice,'The human check expired or is not finished. Please complete it again, then submit.',true);if(token)window.turnstile.reset(widget);tokenAt=0;button.disabled=false;return;}
 const data=new FormData(form);
 try{
  await api('/api/supply/register',{method:'POST',body:{email:data.get('email').trim(),password:data.get('password'),...(token?{token}:{})}});
  message(notice,'If your address can be registered, check your email to confirm your account. Then sign in to complete your partner profile. If it does not arrive in a few minutes, check your spam folder and mark it as not spam.');
 }catch(error){
  message(notice,error.message,true);
  if(state==='ready')window.turnstile.reset(widget);
 }finally{
  form.elements.password.value='';
  button.disabled=false;
 }
};
