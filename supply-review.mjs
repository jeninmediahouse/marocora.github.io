import {api,node,dataNode,message,typeNames,statusNames,profileDetails} from './supply-client.mjs';
const queue=document.querySelector('#queue'),notice=document.querySelector('#message'),allHost=document.querySelector('#all-applications-section');
let allRows=[],currentEmail='';
const wrap=(label,control)=>{const el=node('label');el.append(document.createTextNode(label+' '),control);return el;};
const status=document.createElement('select'),type=document.createElement('select'),search=document.createElement('input'),refreshAll=node('button','Refresh all','secondary');
const allStatus=node('option','All statuses');allStatus.value='';status.append(allStatus);for(const [value,text] of Object.entries(statusNames)){const option=node('option',text);option.value=value;status.append(option);}
const allType=node('option','All types');allType.value='';type.append(allType);for(const [value,text] of Object.entries(typeNames)){const option=node('option',text);option.value=value;type.append(option);}
search.type='search';search.placeholder='Search name or email';refreshAll.type='button';
const panel=node('section',undefined,'panel'),heading=node('h2','All applications'),signedIn=node('p',undefined,'muted'),pulse=node('p',undefined,'muted'),controls=node('div',undefined,'actions'),allList=node('div');
controls.append(wrap('Status',status),wrap('Type',type),wrap('Search',search),refreshAll);
panel.append(heading,signedIn,pulse,controls,allList);allHost.append(panel);
function updatePulse(){
 const week=Date.now()-7*24*60*60*1000;
 const count=value=>allRows.filter(row=>row.status===value).length;
 const fresh=allRows.filter(row=>{const at=Date.parse(row.createdAt||'');return Number.isFinite(at)&&at>=week;}).length;
 pulse.textContent=`Total ${allRows.length} · Pending ${count('pending_review')} · Approved ${count('approved')} · Rejected ${count('rejected')} · New this week ${fresh}`;
}
function renderAll(email=''){
 currentEmail=email||'';
 signedIn.textContent=currentEmail?'Signed in as '+currentEmail:'';
 updatePulse();
 const needle=search.value.trim().toLowerCase();
 const rows=allRows.filter(row=>(!status.value||row.status===status.value)&&(!type.value||row.type===type.value)&&(!needle||String(row.displayName||'').toLowerCase().includes(needle)||String(row.ownerEmail||'').toLowerCase().includes(needle)));
 allList.replaceChildren();
 if(!rows.length){allList.append(node('p','No applications match.','muted'));return;}
 for(const row of rows){
  const card=node('article',undefined,'card');card.append(dataNode('h3',row.displayName||'Unnamed application'),node('p',typeNames[row.type]||row.type),node('span',statusNames[row.status]||row.status,'status '+row.status));
  if(row.ownerEmail)card.append(dataNode('p',row.ownerEmail,'muted'));
  card.append(node('p','Updated '+(row.updatedAt?new Date(row.updatedAt).toLocaleString():'—'),'muted'));
  if(row.status==='pending_review'){const link=node('a','Review below');link.href='#application-'+encodeURIComponent(row.id);card.append(link);}
  else if(row.status==='approved'&&row.public){const link=node('a','View public profile');link.href='/supply-profile.html?id='+encodeURIComponent(row.id);link.target='_blank';link.rel='noopener noreferrer';card.append(link);}
  else if(row.status==='approved')card.append(node('p','Approved, but not public: consent or eligibility is missing.','muted'));
  allList.append(card);
 }
}
status.onchange=type.onchange=()=>renderAll(currentEmail);
search.oninput=()=>renderAll(currentEmail);
refreshAll.onclick=()=>load().catch(error=>message(notice,error.message,true));
function renderQueue(applications){
 queue.replaceChildren();if(!applications.length)queue.append(node('p','No applications are awaiting review.','notice'));
 for(const app of applications){const card=node('article',undefined,'card');card.id='application-'+app.id;card.append(dataNode('h2',app.profile.displayName),node('p',typeNames[app.type]),node('span','Pending review','status pending_review'),profileDetails(app.profile,app.type),node('p',app.profile.publicationConsent?'Public profile consent provided.':'Public profile consent has not been provided.','muted'));
  const videoBox=node('div');videoBox.append(node('h3','Introduction video'),node('p','Checking…','muted'));card.append(videoBox);
  const approveButtons=[];
  api('/api/supply/applications/'+encodeURIComponent(app.id)+'/intro').then(state=>{
   videoBox.replaceChildren(node('h3','Introduction video'));
   if(state.status==='ready'){
    const player=document.createElement('video');player.controls=true;player.preload='metadata';player.src='/api/supply/applications/'+encodeURIComponent(app.id)+'/intro/video?v='+Date.now();
    videoBox.append(player,node('p','Duration '+Math.round(state.durationSeconds||0)+'s'+(state.hasAudio===false?' · no sound detected':'')+'.','muted'));
   }else if(state.status==='processing'){
    videoBox.append(node('p','Still converting — approval is blocked until it finishes.','muted'));
    approveButtons.forEach(b=>{b.disabled=true;});
   }else{
    videoBox.append(node('p',app.type==='teacher'?'No introduction video yet. A teacher cannot be approved without one.':'No introduction video (not required for this type).','muted'));
    if(app.type==='teacher')approveButtons.forEach(b=>{b.disabled=true;});
   }
  }).catch(()=>{videoBox.replaceChildren(node('h3','Introduction video'),node('p','Video status unavailable.','muted'));approveButtons.forEach(b=>{b.disabled=true;});});
  const credentials=node('div');credentials.append(node('h3','Private credentials'));if(!app.credentials.length)credentials.append(node('p','No credential documents attached.','muted'));
  for(const file of app.credentials){const link=node('a','Download scanned credential');link.href='/api/supply/credentials/'+encodeURIComponent(file.id);const paragraph=node('p');paragraph.append(link);credentials.append(paragraph);}card.append(credentials);
  const form=node('form'),reviewed=node('input');reviewed.type='checkbox';reviewed.name='credentialsReviewed';const checkedLabel=node('label',undefined,'check');checkedLabel.append(reviewed,document.createTextNode('I reviewed the attached credential documents.'));form.append(checkedLabel);
  const label=node('label','Decision note (required for rejection)'),reason=node('textarea');reason.id='reason-'+app.id;label.htmlFor=reason.id;reason.maxLength=2000;form.append(label,reason);const actions=node('div',undefined,'actions');
  for(const [decision,text,style] of [['approved','Approve application',''],['rejected','Reject application','reject']]){const button=node('button',text,style);button.type='submit';button.value=decision;if(decision==='approved')approveButtons.push(button);actions.append(button);}form.append(actions);
  form.onsubmit=async event=>{event.preventDefault();const decision=event.submitter?.value;if(!decision)return;const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await api('/api/supply/applications/'+encodeURIComponent(app.id)+'/review',{method:'POST',body:{revision:app.revision,decision,reason:reason.value.trim(),credentialsReviewed:reviewed.checked}});await load();message(notice,'Review saved.');}catch(error){message(notice,error.message,true);}finally{buttons.forEach(b=>b.disabled=false);}};card.append(form);queue.append(card);
 }
}
async function load(){
 const access=await api('/api/supply/admin');if(!access.admin)throw Error('Administrator access is required.');
 const [applications,rows,me]=await Promise.all([api('/api/supply/review'),api('/api/supply/applications/all'),api('/api/auth/me')]);
 allRows=Array.isArray(rows)?rows:[];renderQueue(applications);renderAll(me.email||'');
}
document.querySelector('#refresh').onclick=()=>load().catch(error=>message(notice,error.message,true));
load().catch(error=>{queue.replaceChildren();message(notice,error.message,true);});
