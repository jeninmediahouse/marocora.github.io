import {setupAuth,rpc,workflow,readableError} from './vendor-client.mjs';
import {escapeHTML as e,applicationHeader,fieldsHTML,historyHTML} from './vendor-view.mjs';
const root=document.querySelector('#applications'),pageStatus=document.querySelector('#page-status');
const hash=()=>/^[0-9a-f-]{36}$/i.test(location.hash.slice(1))?location.hash.slice(1):null;
async function load(){
 const rows=await rpc('vendor_my_applications',{p_id:hash()});root.replaceChildren();
 if(!rows.length){pageStatus.textContent='No application found for this signed-in email. Use the same email address you used to apply.';return;}
 pageStatus.textContent='';
 for(const a of rows){
  const card=document.createElement('article');card.className='panel';card.style.marginBottom='24px';
  card.innerHTML=applicationHeader(a)+`<section class="section"><h2>Your status</h2><p>${e(a.message||'Your application is awaiting review. We will email you when there is an update.')}</p></section>`+
  (a.status==='needs_information'?`<section class="section"><h2>Please provide this information</h2><p>Answer the questions below. You do not need to start a new application. If we request a document, you can provide a secure sharing link.</p><form data-reply>${a.questions.map(q=>`<label>${e(q.label)}<textarea name="${e(q.id)}" required maxlength="6000" rows="4"></textarea></label>`).join('')}<button>Send additional information</button><p role="status"></p></form></section>`:'')+
  historyHTML(a)+`<details class="section"><summary>View your original application</summary>${fieldsHTML(a.fields)}</details><p>Questions? Contact <a href="mailto:admin@marocora.com">admin@marocora.com</a>.</p>`;
  root.append(card);
  const form=card.querySelector('[data-reply]');if(form){let commandId=crypto.randomUUID();form.addEventListener('input',()=>{commandId=crypto.randomUUID();});form.onsubmit=async ev=>{ev.preventDefault();const b=form.querySelector('button'),status=form.querySelector('[role=status]');b.disabled=true;
   try{const answers=Object.fromEntries(new FormData(form));const result=await workflow({action:'reply',id:a.id,revision:a.revision,answers,commandId});await load();pageStatus.textContent=result.email==='needs_attention'?'Your information is saved. Notification delivery needs attention; please do not submit another copy.':'Your information has been sent. We will review your application again.';}
   catch(error){status.textContent=readableError(error);}finally{b.disabled=false;}
  };}
 }
}
await setupAuth({onReady:load});
