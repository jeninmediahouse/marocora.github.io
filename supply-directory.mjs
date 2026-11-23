// Public API remains the eligibility gate. Reject broken public contracts, never
// reproduce review/verification/consent eligibility from private fields in-browser.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const labels={teacher:'Language teacher',translator:'Translator / agency',transport:'Transportation company'};
const copy=key=>globalThis.window?.MarocoraSite?.t(key)||key;
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
export async function mountDirectory({root,status,fetcher=fetch}){
 const doc=root.ownerDocument;
 root.replaceChildren();root.hidden=true;root.setAttribute('aria-busy','true');
 let statusKey='Loading published partners…';status.textContent=copy(statusKey);
 const authored=[];
 const language=()=>{status.textContent=copy(statusKey);for(const [element,key] of authored)element.textContent=copy(key);};
 doc.addEventListener('marocora:language',language);
 try{
  const signal=typeof globalThis.AbortSignal?.timeout==='function'
   ?globalThis.AbortSignal.timeout(10000):undefined;
  const response=await fetcher('/api/supply/profiles',{method:'GET',credentials:'omit',cache:'no-store',
   headers:{Accept:'application/json'},signal});
  if(!response.ok)throw Error('DIRECTORY_UNAVAILABLE');
  const rows=directoryRows(await response.json());
  // Validate the entire batch before creating cards: no partial unsafe listing.
  const fragment=doc.createDocumentFragment();
  for(const row of rows){
   const item=doc.createElement('li');item.className='published-partner';
   const name=doc.createElement('h3'),bio=doc.createElement('p');
   for(const [element,value] of [[name,row.name],[bio,row.bio]]){element.textContent=value;element.dataset.userContent='';element.dir='auto';}
   const type=doc.createElement('p');type.className='published-partner-type';type.textContent=copy(labels[row.type]);
   const link=doc.createElement('a');link.href='/supply-profile.html?'+new URLSearchParams({id:row.id});link.textContent=copy('View public profile');
   authored.push([type,labels[row.type]],[link,'View public profile']);
   item.append(type,name,bio,link);fragment.append(item);
  }
  root.replaceChildren(fragment);root.hidden=rows.length===0;
  statusKey=rows.length?'Published partner profiles.':'No partners published yet.';
 }catch{
  root.replaceChildren();root.hidden=true;statusKey='Published partners are temporarily unavailable. Please try again later.';
 }finally{
  root.setAttribute('aria-busy','false');language();
 }
 return ()=>doc.removeEventListener('marocora:language',language);
}
if(typeof document!=='undefined'){
 const root=document.getElementById('published-partners'),status=document.getElementById('published-partners-status');
 if(root&&status)void mountDirectory({root,status});
}
