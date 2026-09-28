// Frontend guidance for the existing draft contract. The server remains authoritative.
export const fieldLabels = {displayName:'displayName',headline:'headline',bio:'bio',countryOfResidence:'country',city:'city',timezone:'timezone',yearsExperience:'experience',education:'education',nativeLanguages:'native',spokenLanguages:'spoken',introductionVideo:'video',photoURL:'photo',availabilityNotes:'availability',category:'category',subject:'subject',qualifications:'qualifications',specialties:'specialties',title:'offeringTitle',durationMinutes:'duration',lessonCount:'lessons',price:'price',currency:'currency',levels:'levels'};
const lengths={displayName:120,headline:180,bio:4000,countryOfResidence:100,city:120,timezone:80,education:2000,nativeLanguages:300,spokenLanguages:300,introductionVideo:500,photoURL:500,availabilityNotes:1000,category:100,subject:100,qualifications:2000,title:140,currency:3};
const required=new Set(['displayName','headline','bio','countryOfResidence','timezone','category','subject','qualifications','title','durationMinutes','lessonCount','price','currency']);
export function instructorFieldProblem(field,value,{complete=false,currency=''}={}) {
 const text=String(value??'').trim();
 if(!text)return complete&&required.has(field)?'required':null;
 if(lengths[field]&&text.length>lengths[field])return 'invalid';
 if(['yearsExperience','durationMinutes','lessonCount'].includes(field)) {
  const number=Number(text),limits={yearsExperience:[0,80],durationMinutes:[15,240],lessonCount:[1,20]}[field];
  if(!Number.isInteger(number)||number<limits[0]||number>limits[1])return 'invalid';
 }
 if(field==='timezone'){try{new Intl.DateTimeFormat('en',{timeZone:text});}catch{return 'invalid';}}
 if(field==='currency') {if(!/^[a-z]{3}$/i.test(text))return 'invalid';try{new Intl.NumberFormat('en',{style:'currency',currency:text.toUpperCase()});}catch{return 'invalid';}}
 if(field==='introductionVideo'||field==='photoURL'){try{if(new URL(text).protocol!=='https:')return 'invalid';}catch{return 'invalid';}}
 if(field==='specialties'||field==='levels') {
  const values=text.split(',').map(s=>s.trim()).filter(Boolean),max=field==='specialties'?10:6,width=field==='specialties'?100:60;
  if(values.length>max||values.some(s=>s.length>width))return 'invalid';
 }
 if(field==='price') {
  const number=Number(text);if(!Number.isFinite(number)||number<0)return 'invalid';
  let decimals=2;try{if(currency)decimals=new Intl.NumberFormat('en',{style:'currency',currency:currency.toUpperCase()}).resolvedOptions().maximumFractionDigits;}catch{}
  const minor=number*10**decimals;
  if(Math.abs(minor-Math.round(minor))>0.000001)return 'precision';
  if(!Number.isSafeInteger(Math.round(minor))||minor>1_000_000_000)return 'invalid';
 }
 return null;
}
