import {siteCopy} from './site-copy.mjs';
import {homeCopy} from './home-copy.mjs';
const api=window.MarocoraSite, copy={...homeCopy,...siteCopy};
const normalize=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
const terms=s=>[s,...Object.values(copy[s]||{})].map(normalize).join(' ');
const page=location.pathname.split('/').pop();
if(page==='professionals.html'){
 const cards=[...document.querySelectorAll('.category')];
 const search=document.createElement('div');search.className='service-search';search.dataset.siteLanguage='';search.innerHTML='<label for="service-search"></label><input id="service-search" type="search" dir="auto"><p class="service-request-note"></p><p role="status" hidden></p>';
 document.querySelector('.marketplace').prepend(search);
 const input=search.querySelector('input'),empty=search.querySelector('[role=status]');
 const records=cards.map(card=>{
  const title=card.dataset.serviceTitle;
  const description=card.dataset.serviceDescription;
  let link;if(card.tagName!=='A'){link=document.createElement('a');link.className='service-request-link';link.dataset.siteLanguage='';card.append(link);}
  return {card,title,description,link,index:terms(title)+' '+terms(description)};
 });
 function filter(){const query=normalize(input.value);let count=0;for(const item of records){item.card.hidden=!!query&&!item.index.includes(query);if(!item.card.hidden)count++;}empty.hidden=count!==0;empty.textContent=api.ui('noServices');}
 const selected=new URLSearchParams(location.search).get('service');let autoValue='';
 function render(){if(selected&&(!autoValue||input.value===autoValue)){autoValue=api.t(selected);input.value=autoValue;}search.querySelector('label').textContent=api.ui('search');input.placeholder=api.ui('searchHint');search.querySelector('.service-request-note').textContent=api.ui('requestNote');for(const item of records){if(item.link){item.link.textContent=api.ui('request');item.link.href=api.localURL('contact.html?service='+encodeURIComponent(item.title));}}filter();}
 input.addEventListener('input',filter);document.addEventListener('marocora:language',render);render();
}
if(page==='contact.html'){
 const service=new URLSearchParams(location.search).get('service');
 // Only known, authored service names can be displayed as selected categories.
 if(service&&copy[service]){
  const form=document.querySelector('form'),note=document.createElement('p');note.className='selected-service';note.dataset.siteLanguage='';form.prepend(note);
  const field=document.createElement('input');field.type='hidden';field.name='requested_service';field.value=service;form.append(field);
  const render=()=>{note.textContent=api.ui('selected')+': '+api.t(service);};document.addEventListener('marocora:language',render);render();
 }
}
if(page==='translators.html'){
 const filters=document.querySelector('.filters'),input=filters.querySelector('input'),selects=[...filters.querySelectorAll('select')];
 const cards=[...document.querySelectorAll('.translator-card')].map(card=>({card,index:card.dataset.searchIndex}));
 const note=document.createElement('p');note.dataset.siteLanguage='';note.className='service-request-note';filters.after(note);
 const request=document.createElement('a');request.dataset.siteLanguage='';request.className='profile-button';note.after(request);
 const empty=document.createElement('p');empty.dataset.siteLanguage='';empty.setAttribute('role','status');document.querySelector('.translator-grid').after(empty);
 function filter(){let count=0;for(const item of cards){const queries=[input.value,...selects.filter(s=>s.selectedIndex>0).map(s=>s.value)].map(normalize);item.card.hidden=queries.some(q=>!item.index.includes(q));if(!item.card.hidden)count++;}empty.hidden=!!count;empty.textContent=api.ui('noServices');}
 function render(){note.textContent=api.ui('sampleNotice');request.textContent=api.ui('request');request.href=api.localURL('translation-request.html');filter();}input.addEventListener('input',filter);selects.forEach(s=>s.addEventListener('change',filter));document.addEventListener('marocora:language',render);render();
}
