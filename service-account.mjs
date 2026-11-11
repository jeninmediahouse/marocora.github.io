import { instructorStore } from './learn/instructor-store.mjs';
import { verificationCopy } from './service-verification.mjs';
import { applyLocale,resolveLocale } from './learn/locale.mjs';
let saved={};try{saved=JSON.parse(localStorage.getItem('marocora.verification.return')||'{}');}catch{}
const lang=['en','fr','ar','es'].includes(saved.lang)?saved.lang:resolveLocale(location.search),t=verificationCopy[lang];applyLocale(lang);
const allowed=new Set(['contact.html','translation-request.html','translator-apply.html','join.html','lesson-request.html','booking-confirmation.html','service-review.html']);
const target=allowed.has(saved.page)?saved.page:'contact.html';
const link=document.querySelector('#return');link.href=`/${target}?lang=${lang}`;link.textContent=t.back;
document.querySelector('#check').textContent=t.signin;
async function check(){
 const {data,error}=await instructorStore.auth.getUser();
 const good=!error&&data.user?.email_confirmed_at&&!data.user?.is_anonymous;
 document.querySelector('#title').textContent=good?t.callback:t.title;
 document.querySelector('#message').textContent=good?t.callbackNote:t.invalid;
 link.hidden=false;
}
document.querySelector('#check').onclick=check;
await check();
instructorStore.auth.onAuthStateChange(()=>{setTimeout(check,0);});
