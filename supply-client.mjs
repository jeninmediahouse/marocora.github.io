export function optionalIntroVideo(value){
 if(typeof value!=='string')throw Error('Leave the video link blank or use a plain HTTPS URL.');
 const text=value.trim();
 if(text&&!/^https:\/\/[A-Za-z0-9.-]+(:443)?(\/[^\s<>]*)?$/.test(text))throw Error('Leave the video link blank or use a plain HTTPS URL.');
 return text;
}
export async function api(path,{method='GET',body,headers={}}={}){
 const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:{...(body instanceof Blob?{}:body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:body instanceof Blob?body:JSON.stringify(body)}:{})});
 const data=await response.json();
 if(!response.ok){if(response.status===401){location.assign('/production-login.html?'+new URLSearchParams({next:location.pathname+location.search}));throw Error('Please sign in with a verified account.');}throw Error(messages[data.error]||'The request could not be completed. Please try again.');}return data;
}
const messages={SUPPLY_SCHEMA_REQUIRED:'Onboarding is not available in this environment yet.',SUPPLY_ADMIN_REQUIRED:'Administrator access is required.',SUPPLY_APPLICATION_EXISTS:'You already have an application for this service. Select it to edit.',SUPPLY_INVALID_PROFILE:'Check all profile fields, rates and availability. Availability slots must not overlap.',SUPPLY_STALE_REVISION:'This application changed. Refresh and review the latest details.',SUPPLY_VERIFIED_ACCOUNT_REQUIRED:'Verify your email before submitting an application.',SUPPLY_PAYOUT_STORAGE_UNAVAILABLE:'Secure bank storage is not configured here. Your profile application can still be submitted.',SUPPLY_INVALID_PAYOUT:'Check the account holder name, IBAN checksum and SWIFT code.',SUPPLY_CREDENTIAL_REVIEW_REQUIRED:'Review a clean credential before approving a sworn translator.',SUPPLY_CREDENTIAL_NOT_CLEAN:'The credential could not be cleared by scanning. It has not been attached.',SUPPLY_SCANNER_UNAVAILABLE:'Credential scanning is unavailable. Please try again later.',SUPPLY_INVALID_REGISTRATION:'Enter a valid email and a password of 12–128 characters.',SUPPLY_HUMAN_CHECK_REQUIRED:'The human check expired or was not completed. Please complete it again, then submit.',SUPPLY_REGISTRATION_UNAVAILABLE:'Partner registration is temporarily unavailable. Please try again later.',SUPPLY_PUBLICATION_BLOCKED:'This application cannot be published.',SUPPLY_SELF_REVIEW_DENIED:'You cannot review your own application.',SUPPLY_INVALID_DECISION:'Provide a reason when rejecting an application.'};
export function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(className)el.className=className;return el;}
export function dataNode(tag,text,className){const el=node(tag,text,className);el.dataset.userContent='';el.dir='auto';return el;}
export function message(el,text,error=false){el.textContent=text;el.classList.toggle('error',error);}
export const typeNames={teacher:'Language teacher',translator:'Translator / agency',transport:'Transportation company'};
export const statusNames={pending_review:'Pending review',approved:'Approved',rejected:'Rejected'};
export function profileDetails(profile,type){
 const dl=node('dl');const add=(label,value,authored=false)=>{dl.append(node('dt',label),authored?node('dd',value):dataNode('dd',value));};
 const list=(label,values)=>{const dd=node('dd');for(const [i,value] of values.entries()){if(i)dd.append(document.createTextNode(', '));dd.append(node('span',value));}dl.append(node('dt',label),dd);};
 add('About',profile.bio);
 if(type==='teacher'){
  add('Languages',profile.languages.join(', '));add('Hourly rate',money(profile.hourlyRateMinor,profile.currency));add('Timezone',profile.timezone);
  const slots=node('dd');for(const s of profile.availability){const line=node('div');line.append(node('span',['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][s.day]),dataNode('span',` ${s.start}–${s.end}`));slots.append(line);}dl.append(node('dt','Weekly availability'),slots);
  const dt=node('dt','Introduction video'),dd=node('dd'),link=node('a','Open introduction video');if(/^https:\/\/[A-Za-z0-9.-]+(:443)?(\/[^\s<>]*)?$/.test(profile.introVideo)){link.href=profile.introVideo;link.target='_blank';link.rel='noopener noreferrer';dd.append(link);}dl.append(dt,dd);
 }
 if(type==='translator'){
  add('Practice',profile.organizationKind==='agency'?'Agency':'Individual translator',true);
  const pairs=node('dd');for(const pair of profile.languagePairs){const line=node('div');line.append(dataNode('span',pair.source),document.createTextNode(' '),node('span','to'),document.createTextNode(' '),dataNode('span',pair.target));pairs.append(line);}dl.append(node('dt','Language pairs'),pairs);list('Specialties',profile.specialties);
 }
 if(type==='transport'){list('Vehicles',profile.vehicleTypes.map(value=>({sedan:'Sedan',van:'Van',bus:'Bus'}[value])));add('Passenger capacity',profile.capacity);add('Service regions',profile.serviceRegions.join(', '));add('Base rate',money(profile.baseRateMinor,profile.currency));}
 return dl;
}
export function money(minor,currency){return new Intl.NumberFormat('en',{style:'currency',currency}).format(minor/100);}
