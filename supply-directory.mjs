// Public API remains the eligibility gate. Reject broken public contracts, never
// reproduce review/verification/consent eligibility from private fields in-browser.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const labels={teacher:'Language teacher',translator:'Translator / agency',transport:'Transportation company'};
// A profile belongs to exactly one category. Nothing is ever listed outside one.
const categories={translator:'Translation & Language Services',transport:'Transportation & Local Services',teacher:'Find an Online Teacher'};
const typeForService=value=>{
 if(typeof value!=='string')return null;
 const wanted=value.trim().toLowerCase();
 for(const [type,title] of Object.entries(categories))if(title.toLowerCase()===wanted||type===wanted)return type;
 return null;
};
const copy=key=>globalThis.window?.MarocoraSite?.t(key)||key;
const ui=key=>globalThis.window?.MarocoraSite?.ui?.(key)||key;
export function directoryRows(value){
 if(!Array.isArray(value)||value.length>100)throw Error('DIRECTORY_INVALID_PUBLIC_CONTRACT');
 const seen=new Set();
 return value.map(row=>{
  const p=row?.profile;
  if(!row||!uuid.test(row.id||'')||seen.has(row.id)||!Object.hasOwn(labels,row.type)
   ||!p||typeof p!=='object'||Array.isArray(p)||Object.hasOwn(p,'publicationConsent')
   ||typeof p.displayName!=='string'||!p.displayName.trim()||p.displayName.length>160
   ||typeof p.bio!=='string'||!p.bio.trim()||p.bio.length>4000)throw Error('DIRECTORY_INVALID_PUBLIC_CONTRACT');
  seen.add(row.id);
  // A fresh allowlisted view model: no whole objects/extra fields serialized to DOM.
  return {id:row.id,type:row.type,name:p.displayName,bio:p.bio};
 });
}
function haystack(row){
 return [row.name,row.bio,categories[row.type],labels[row.type]].join(' ').toLowerCase();
}
export async function mountDirectory({root,status,fetcher=fetch,section,service,searchId='service-search'}){
 const doc=root.ownerDocument;
 root.replaceChildren();root.hidden=true;root.setAttribute('aria-busy','true');
 let statusKey='Loading published partners…';status.textContent=copy(statusKey);
 const authored=[];
 const language=()=>{status.textContent=statusKey?copy(statusKey):'';for(const [element,key] of authored)element.textContent=copy(key);};
 doc.addEventListener('marocora:language',language);
 // Without a section this is a plain renderer; with one it only ever shows a
 // single category, or the profiles matching what the visitor typed.
 const scoped=Boolean(section),heading=section?.querySelector('h2')||null;
 let rows=[],type=typeForService(service),term='';
 const searching=()=>term.length>=2;
 const active=()=>Boolean(type)||searching();
 function card(row){
  const item=doc.createElement('li');item.className='published-partner';
  const name=doc.createElement('h3'),bio=doc.createElement('p');
  const summary=row.bio.length>280?row.bio.slice(0,280).trimEnd()+'…':row.bio;
  for(const [element,value] of [[name,row.name],[bio,summary]]){element.textContent=value;element.dataset.userContent='';element.dir='auto';}
  const badge=doc.createElement('p');badge.className='published-partner-type';badge.textContent=copy(labels[row.type]);
  const link=doc.createElement('a');link.href='/supply-profile.html?'+new URLSearchParams({id:row.id});link.textContent=copy('View public profile');
  authored.push([badge,labels[row.type]],[link,'View public profile']);
  item.append(badge,name,bio,link);
  return item;
 }
 function render(){
  const matches=rows.filter(row=>{
   if(type&&row.type!==type)return false;
   return !searching()||haystack(row).includes(term);
  });
  if(!scoped){
   const fragment=doc.createDocumentFragment();
   for(const row of rows)fragment.append(card(row));
   root.replaceChildren(fragment);root.hidden=rows.length===0;
   statusKey=rows.length?'Published partner profiles.':'No partners published yet.';
   status.hidden=false;status.textContent=copy(statusKey);
   return;
  }
  if(!active()||!matches.length){
   root.replaceChildren();root.hidden=true;authored.length=0;
   if(heading)heading.textContent='';
   statusKey=scoped?'':(rows.length?'Published partner profiles.':'No partners published yet.');
   status.hidden=Boolean(scoped);
   status.textContent=statusKey?copy(statusKey):'';
   if(section)section.hidden=true;
   return;
  }
  const fragment=doc.createDocumentFragment();
  for(const row of matches)fragment.append(card(row));
  root.replaceChildren(fragment);root.hidden=false;
  if(heading)heading.textContent=copy('Published partner profiles.');
  statusKey='';status.hidden=true;status.textContent='';
  if(section)section.hidden=false;
 }
 const onInput=event=>{
  if(event.target?.id!==searchId)return;
  term=String(event.target.value||'').trim().toLowerCase();
  render();
 };
 if(scoped)doc.addEventListener('input',onInput);
 try{
  const signal=typeof globalThis.AbortSignal?.timeout==='function'
   ?globalThis.AbortSignal.timeout(10000):undefined;
  const response=await fetcher('/api/supply/profiles',{method:'GET',credentials:'omit',cache:'no-store',
   headers:{Accept:'application/json'},signal});
  if(!response.ok)throw Error('DIRECTORY_UNAVAILABLE');
  rows=directoryRows(await response.json());
  render();
 }catch{
  root.replaceChildren();root.hidden=true;
  if(section)section.hidden=true;
  statusKey='Published partners are temporarily unavailable. Please try again later.';
 }finally{
  root.setAttribute('aria-busy','false');language();
 }
 return ()=>doc.removeEventListener('marocora:language',language);
}
if(typeof document!=='undefined'){
 const root=document.getElementById('published-partners'),status=document.getElementById('published-partners-status');
 if(root&&status){
  const section=document.getElementById('professionals');
  const service=new URLSearchParams(location.search).get('service');
  if(section)void mountDirectory({root,status,section,service});
 }
}
