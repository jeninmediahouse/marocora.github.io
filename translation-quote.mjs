const $=id=>document.getElementById(id);
const category=$('category'),file=$('document'),status=$('quote-status'),price=$('price'),manual=$('manual');
const money=value=>new Intl.NumberFormat('en',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
const MAX=10*1024*1024;
const allowed=/\.(txt|docx|pdf)$/i;
let latest=null;

function say(text,isError=false){
 status.textContent=text;
 if(isError)status.dataset.error='';else delete status.dataset.error;
}
function showPrice(value){
 latest=value;
 $('total').textContent=money(value.total);
 $('total2').textContent=money(value.total)+' MAD';
 $('words').textContent=String(value.words);
 $('billable').textContent=String(value.billableWords);
 $('rate').textContent=money(value.rate)+' MAD';
 $('subtotal').textContent=money(value.subtotal)+' MAD';
 $('vat').textContent=money(value.vat)+' MAD';
 const link=new URL('translation-request.html',location.href);
 link.searchParams.set('words',String(value.words));
 link.searchParams.set('category',value.category);
 link.searchParams.set('quoted-total',money(value.total));
 $('continue').href=link.href;
 manual.hidden=true;price.hidden=false;
}
function showManual(reason){
 latest=null;price.hidden=true;manual.hidden=false;
 $('manual-reason').textContent=reason==='SWORN_PER_PAGE'
  ?'Sworn translation is priced per page, so a person needs to see the document before quoting.'
  :'This looks like a scan or an image, so the words cannot be counted automatically.';
 const link=new URL('translation-request.html',location.href);
 link.searchParams.set('category',category.value);
 $('manual').querySelector('a.cta').href=link.href;
}
async function estimate(){
 const chosen=file.files&&file.files[0];
 price.hidden=true;manual.hidden=true;
 if(!chosen){say('');return;}
 if(chosen.size>MAX){say('That file is larger than 10 MB. Please send it for a quote instead.',true);showManual('TOO_LARGE');return;}
 if(!allowed.test(chosen.name)){say('');showManual('SCANNED_DOCUMENT');return;}
 say('Counting the words…');
 try{
  const url=new URL('/api/quote/estimate',location.origin);
  url.searchParams.set('category',category.value);
  url.searchParams.set('filename',chosen.name);
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:chosen,credentials:'omit'});
  if(!response.ok)throw Error('ESTIMATE_UNAVAILABLE');
  const value=await response.json();
  if(value.manualQuote){say('');showManual(value.reason);return;}
  say('');
  showPrice(value);
 }catch{
  say('We could not read that file just now. Please send it for a quote instead.',true);
  showManual('ESTIMATE_UNAVAILABLE');
 }
}
file.addEventListener('change',estimate);
category.addEventListener('change',estimate);
if(category.value==='sworn'){/* nothing until a file is chosen */}
