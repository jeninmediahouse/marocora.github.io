import {api,node,dataNode,message,typeNames,profileDetails} from './supply-client.mjs';
const queue=document.querySelector('#queue'),notice=document.querySelector('#message');
async function load(){
 const access=await api('/api/supply/admin');if(!access.admin)throw Error('Administrator access is required.');
 const applications=await api('/api/supply/review');queue.replaceChildren();if(!applications.length)queue.append(node('p','No applications are awaiting review.','notice'));
 for(const app of applications){const card=node('article',undefined,'card');card.append(dataNode('h2',app.profile.displayName),node('p',typeNames[app.type]),node('span','Pending review','status pending_review'),profileDetails(app.profile,app.type),node('p',app.profile.publicationConsent?'Public profile consent provided.':'Public profile consent has not been provided.','muted'));
  const credentials=node('div');credentials.append(node('h3','Private credentials'));if(!app.credentials.length)credentials.append(node('p','No credential documents attached.','muted'));
  for(const file of app.credentials){const link=node('a','Download scanned credential');link.href='/api/supply/credentials/'+encodeURIComponent(file.id);const paragraph=node('p');paragraph.append(link);credentials.append(paragraph);}card.append(credentials);
  const form=node('form'),reviewed=node('input');reviewed.type='checkbox';reviewed.name='credentialsReviewed';const checkedLabel=node('label',undefined,'check');checkedLabel.append(reviewed,document.createTextNode('I reviewed the attached credential documents.'));form.append(checkedLabel);
  const label=node('label','Decision note (required for rejection)'),reason=node('textarea');reason.id='reason-'+app.id;label.htmlFor=reason.id;reason.maxLength=2000;form.append(label,reason);const actions=node('div',undefined,'actions');
  for(const [decision,text,style] of [['approved','Approve application',''],['rejected','Reject application','reject']]){const button=node('button',text,style);button.type='submit';button.value=decision;actions.append(button);}form.append(actions);
  form.onsubmit=async event=>{event.preventDefault();const decision=event.submitter?.value;if(!decision)return;const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await api('/api/supply/applications/'+encodeURIComponent(app.id)+'/review',{method:'POST',body:{revision:app.revision,decision,reason:reason.value.trim(),credentialsReviewed:reviewed.checked}});await load();message(notice,'Review saved.');}catch(error){message(notice,error.message,true);}finally{buttons.forEach(b=>b.disabled=false);}};card.append(form);queue.append(card);
 }
}
document.querySelector('#refresh').onclick=()=>load().catch(error=>message(notice,error.message,true));load().catch(error=>{queue.replaceChildren();message(notice,error.message,true);});
