import {setupAuth,rpc,workflow,readableError} from './vendor-client.mjs';
import {escapeHTML as e,statusNames,categoryNames,fieldsHTML,historyHTML,applicationHeader,requestedQuestions} from './vendor-view.mjs';
import {publicationControls,publicPreviewHTML} from './learn/publication-view.mjs';
const list=document.querySelector('#applications'),detail=document.querySelector('#detail'),pageStatus=document.querySelector('#page-status');
const selectedId=()=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(location.hash.slice(1))?location.hash.slice(1):'';
let rows=[],selected=selectedId(),user,teacherRows=[],previewArgs=null;
const defaults={approved:'Thank you for applying to Marocora. Your application has been approved. We will contact you about onboarding and the next steps. Approval does not itself create a booking, assignment or employment contract.',declined:'Thank you for your interest in joining Marocora. After reviewing your application, we are unable to proceed with it at this time. Thank you for taking the time to apply.',needs_information:'Thank you for your application. Please answer the questions below so we can complete our review.'};
function visibleRows(){const search=document.querySelector('#search').value.toLowerCase(),filter=document.querySelector('#filter').value,tests=document.querySelector('#tests').checked;return rows.filter(a=>(tests||!a.is_test||a.id===location.hash.slice(1))&&(filter==='all'||a.status===filter)&&`${a.name} ${a.email} ${a.category}`.toLowerCase().includes(search));}
function renderList(){
 const shown=visibleRows();list.innerHTML=shown.map(a=>`<button class="application-card ${a.id===selected?'selected':''}" data-id="${e(a.id)}"><span class="eyebrow">${e(categoryNames[a.category]||a.category)}</span><strong>${e(a.name)}</strong><small>${e(a.email)}</small><span class="badge ${e(a.status)}">${e(statusNames[a.status])}</span>${a.is_test?' <small>Test application</small>':''}</button>`).join('')||'<p class="empty">No applications match this view.</p>';
 document.querySelector('#summary').innerHTML=['pending','needs_information','approved','declined'].map(s=>`<span><strong>${rows.filter(a=>!a.is_test&&a.status===s).length}</strong> ${e(statusNames[s])}</span>`).join('');
}
async function load(currentUser){
 user=currentUser||user;rows=await rpc('vendor_review_queue');
 if(selected&&!rows.some(a=>a.id===selected))rows.push(...await rpc('vendor_review_queue',{p_id:selected}));
 teacherRows=await rpc('learning_staff_review_queue');
 document.querySelector('#workspace').hidden=false;renderList();if(selected)renderDetail();
}
function renderDetail(){
 const a=rows.find(a=>a.id===selected);previewArgs=null;
 if(!a){detail.innerHTML='<p class="empty">Choose an application to review.</p>';return;}
 const teacher=teacherRows.find(r=>r.user_id===a.user_id),blocked=a.is_test||(a.source==='teacher'&&a.user_id===user.id);
 detail.innerHTML=applicationHeader(a)+`<section class="section"><h2>Complete application</h2>${fieldsHTML(a.fields)}</section>`+historyHTML(a)+
 `<section class="section"><h2>Make a decision</h2><p>Choose an outcome and review your message. Sending saves the decision and emails the applicant.</p>${blocked?'<p class="notice">Approval is blocked for this test or your own teacher application.</p>':''}<form id="decision"><label>Decision<select name="decision" required><option value="">Choose a decision</option><option value="approved" ${blocked?'disabled':''}>Approve application</option><option value="needs_information">Request more information</option><option value="declined">Decline application</option></select></label>${a.source==='teacher'?`<fieldset><legend>Teacher subjects</legend><p>Choose the decision for each subject. Only approved subjects can be published.</p>${a.fields.subjects.map((s,i)=>`<label>${e(s.subject)}<select name="subject-${i}">${['pending','approved','needs_changes','rejected'].map(d=>`<option value="${d}" ${(teacher?.review?.subject_decisions?.[i]?.decision||'pending')===d?'selected':''} ${d==='approved'&&blocked?'disabled':''}>${e(({pending:'Pending',approved:'Approved',needs_changes:'Changes requested',rejected:'Declined'})[d])}</option>`).join('')}</select></label>`).join('')}</fieldset>`:''}<label>Message to applicant<textarea name="message" maxlength="4000" required rows="6" placeholder="Explain your decision and the next steps."></textarea></label><section id="questions" hidden><label>Information you need — one question per line<textarea name="questions" maxlength="6000" rows="5" placeholder="Please describe your relevant experience.&#10;Please provide a link to your qualifications."></textarea></label><p>Each line becomes a separate answer field on the applicant’s follow-up form. Maximum 12 questions.</p></section><label class="check"><input type="checkbox" name="confirm" required>I have reviewed the application and this message, and I want to email this decision.</label><button>Save decision &amp; email applicant</button><p role="status"></p></form></section>`+
 (a.source==='teacher'&&teacher?publicationControls(teacher,'en',user.id):'')+
 `<p><a href="application.html#${e(a.id)}" target="_blank" rel="noopener">Applicant status page</a> <small>(only accessible to the applicant’s signed-in account)</small></p>`;
 const form=detail.querySelector('#decision');let commandId=crypto.randomUUID();
 form.addEventListener('input',()=>{commandId=crypto.randomUUID();});
 form.decision.onchange=()=>{form.message.value=defaults[form.decision.value]||'';detail.querySelector('#questions').hidden=form.decision.value!=='needs_information';form.questions.required=form.decision.value==='needs_information';form.confirm.checked=false;};
 form.onsubmit=async ev=>{ev.preventDefault();const b=form.querySelector('button'),status=form.querySelector('[role=status]');
 const questions=form.decision.value==='needs_information'?requestedQuestions(form.questions.value):[];
 if(questions.length>12||questions.some(q=>q.label.length>500)){status.textContent='Use up to 12 questions, each at most 500 characters.';return;}
 b.disabled=true;status.textContent='Saving decision and sending the email…';
 try{
  const subjects=a.source==='teacher'?a.fields.subjects.map((s,i)=>({category:s.category,subject:s.subject,decision:form.elements[`subject-${i}`].value})):[];
  const result=await workflow({action:'decide',id:a.id,revision:a.revision,decision:form.decision.value,message:form.message.value,questions,subjects,commandId});
  await load();pageStatus.textContent=result.email==='needs_attention'?'Decision saved. Email delivery needs attention; check Application history. Do not submit the same decision again.':'Decision saved and accepted by the email service. The applicant can see the update on their status page.';
 }catch(error){status.textContent=readableError(error);}finally{b.disabled=false;}
 };
}
list.onclick=event=>{const b=event.target.closest('[data-id]');if(!b)return;selected=b.dataset.id;history.replaceState(null,'',`#${selected}`);pageStatus.textContent='';renderList();renderDetail();};
for(const id of ['search','filter','tests'])document.querySelector('#'+id).addEventListener('input',renderList);
window.addEventListener('hashchange',()=>{selected=selectedId();renderList();renderDetail();});
detail.addEventListener('change',event=>{
 const section=event.target.closest('[data-publication]');if(!section)return;
 if(event.target.hasAttribute('data-publish-subject')){previewArgs=null;section.querySelector('[data-preview]').innerHTML='';}
 if(event.target.hasAttribute('data-publication-confirm'))section.querySelector('[data-action="publish"]').disabled=!event.target.checked;
});
detail.addEventListener('click',async event=>{
 const b=event.target.closest('[data-action]'),section=b?.closest('[data-publication]');if(!section)return;
 const row=teacherRows.find(r=>r.user_id===section.dataset.publication),args={applicant_id:section.dataset.publication,expected_revision:row?.revision,selected_subjects:[...section.querySelectorAll('[data-publish-subject]:checked')].map(n=>Number(n.value))};
 const status=section.querySelector('[role=status]');b.disabled=true;
 try{
  if(b.dataset.action==='preview'){const result=await rpc('learning_staff_publication_preview',args);previewArgs=JSON.stringify(args);section.querySelector('[data-preview]').innerHTML=publicPreviewHTML(result,'en');}
  else if(b.dataset.action==='publish'){if(previewArgs!==JSON.stringify(args)||!section.querySelector('[data-publication-confirm]')?.checked)throw new Error('PREVIEW_REQUIRED');await rpc('publish_learning_instructor',args);status.textContent='Teacher profile published. Check the public instructor catalog.';previewArgs=null;}
  else if(b.dataset.action==='unpublish'){await rpc('unpublish_learning_instructor',{applicant_id:section.dataset.publication});status.textContent='Teacher profile unpublished.';}
 }catch{status.textContent='Could not update publication. Refresh, review the latest application, and preview the approved subjects again.';}finally{b.disabled=false;}
});
await setupAuth({admin:true,onReady:load});
