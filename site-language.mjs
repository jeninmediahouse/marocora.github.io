import {resolveLocale,applyLocale,localeNames,sharedCopy} from './learn/locale.mjs';
import {siteCopy} from './site-copy.mjs';
import {homeCopy} from './home-copy.mjs';
import {siteUI} from './site-ui-copy.mjs';
import {extraCopy} from './site-extra-copy.mjs';
import {translationCopy} from './translation-copy.mjs';

const copy={...homeCopy,...siteCopy,...extraCopy,...translationCopy}, originals=new WeakMap(), attributes=new WeakMap();
const norm=s=>s.replace(/\s+/g,' ').trim();
let locale=resolveLocale(location.search), observer;
const t=s=>copy[norm(s)]?.[locale] ?? s;
const ui=k=>siteUI[locale][k];
function localURL(value){const u=new URL(value,document.baseURI);if(u.origin===location.origin&&/^https?:$/.test(u.protocol)){u.searchParams.set('lang',locale);if(['/', '/index.html'].includes(u.pathname))u.searchParams.set('v','20260929-home4');}return u.href;}
const skip=n=>n.parentElement?.closest('script,style,textarea,[data-user-content],[data-site-language]');
function translate(root){
 // Preserve canonical submission values before translating visible option labels.
 for(const option of root.querySelectorAll('option:not([value])'))option.setAttribute('value',option.textContent);
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){
  const n=walker.currentNode;if(skip(n)||!norm(n.data))continue;
  let saved=originals.get(n);
  if(!saved||n.data!==saved.last){if(!copy[norm(n.data)])continue;saved={source:n.data};}
  const translated=t(saved.source), leading=saved.source.match(/^\s*/)[0], trailing=saved.source.match(/\s*$/)[0];
  saved.last=leading+translated.trim()+trailing;n.data=saved.last;originals.set(n,saved);
 }
 for(const element of root.querySelectorAll('[placeholder],[aria-label],img[alt],meta[name=description]')){
  if(element.closest('[data-user-content],[data-site-language]'))continue;
  const saved=attributes.get(element)||{};
  for(const name of ['placeholder','aria-label','alt','content']){
   if(!element.hasAttribute(name)||name==='content'&&!element.matches('meta[name=description]'))continue;
   const value=element.getAttribute(name);let item=saved[name];
   if(!item||value!==item.last)item={source:value};
   item.last=t(item.source);element.setAttribute(name,item.last);saved[name]=item;
  }attributes.set(element,saved);
 }
 for(const a of root.querySelectorAll('a[href]')){
  const href=a.getAttribute('href');if(!href||href.startsWith('#'))continue;
  const u=new URL(href,document.baseURI);if(u.origin===location.origin&&/^https?:$/.test(u.protocol))a.href=localURL(href);
 }
 for(const field of root.querySelectorAll('input[type=email],input[type=tel],input[type=url],input[type=number],input[type=date],input[type=datetime-local],input[data-currency-code]'))field.dir='ltr';
 for(const field of root.querySelectorAll('input[type=text]:not([data-currency-code]),textarea'))field.dir='auto';
 for(const field of root.querySelectorAll('input[name=interface_language]'))field.value=locale;
}
const bar=document.createElement('div');bar.className='site-language-bar';bar.dataset.siteLanguage='';
bar.innerHTML='<a href="/?v=20260929-home4">Marocora</a><label><span></span> <select id="site-locale"></select></label>';
const selector=bar.querySelector('select');
for(const [value,label] of Object.entries(localeNames)){const option=document.createElement('option');option.value=value;option.textContent=label;selector.append(option);}
document.body.prepend(bar);
// Personal details are data, even when a name happens to equal a translated label.
for(const n of document.querySelectorAll('#review-name,#review-email,#review-phone,#review-notes,#success-name,#success-email,#payment-name,#payment-email,#student-name,#student-email'))if(!['Not provided','No message provided'].includes(norm(n.textContent)))n.dataset.userContent='';
function watch(){observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','alt','href']});}
function render(){
 observer?.disconnect();applyLocale(locale);const u=new URL(location.href);u.searchParams.set('lang',locale);history.replaceState(null,'',u.pathname+u.search+u.hash);
 selector.value=locale;bar.querySelector('span').textContent=sharedCopy[locale].language;selector.setAttribute('aria-label',sharedCopy[locale].language);
 translate(document.documentElement);document.dispatchEvent(new CustomEvent('marocora:language',{detail:{locale}}));if(observer)watch();
}
function validateForm(form){
 form.dispatchEvent(new CustomEvent('marocora:beforevalidate'));
 const invalid=[...form.elements].find(n=>n.willValidate&&!n.validity.valid);
 if(invalid){const status=form.querySelector('[data-form-status]')||form.querySelector('[role=status]');if(status){status.hidden=false;status.textContent=invalid.validity.customError?invalid.validationMessage:ui('checkFields');}invalid.setAttribute('aria-invalid','true');invalid.focus();return false;}return true;
}
window.MarocoraSite={t,ui,localURL,validateForm,get locale(){return locale;}};
selector.addEventListener('change',()=>{locale=selector.value;render();});
const destinations={'contact.html':'contact-thank-you.html','join.html':'thank-you.html','translator-apply.html':'translator-application-thank-you.html','lesson-request.html':'lesson-thank-you.html','translation-request.html':'translation-thank-you.html'};
const page=location.pathname.split('/').pop();
if(['translation-request.html','translator-apply.html'].includes(page))await import('./translation-service.mjs?v=20260929-translation1');
for(const form of document.forms){
 if(!form.action.includes('formspree.io'))continue;
 const language=document.createElement('input');language.type='hidden';language.name='interface_language';language.value=locale;form.append(language);
 if(!destinations[page])continue;
 // One localized submission handler keeps fields intact on rejection or uncertain receipt.
 form.noValidate=true;const status=form.querySelector('[role=status]')||document.createElement('p');status.dataset.formStatus='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=true;if(!status.parentNode)form.append(status);
 let busy=false,statusKey='';const show=key=>{statusKey=key;status.hidden=false;status.textContent=ui(key);};
 document.addEventListener('marocora:language',()=>{if(statusKey)show(statusKey);});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;if(!validateForm(form)){statusKey='checkFields';return;}
  busy=true;const buttons=[...form.querySelectorAll('[type=submit]')];buttons.forEach(n=>n.disabled=true);form.setAttribute('aria-busy','true');show('sending');
  try{const response=await fetch(form.action,{method:'POST',body:new FormData(form),headers:{Accept:'application/json'}});if(response.ok)location.assign(localURL(destinations[page]));else show('rejected');}
  catch{show('uncertain');}finally{busy=false;buttons.forEach(n=>n.disabled=false);form.removeAttribute('aria-busy');}
 });
}
render();observer=new MutationObserver(()=>{observer.disconnect();translate(document.documentElement);watch();});watch();
await import('./site-services.mjs?v=20260929-translation1');
