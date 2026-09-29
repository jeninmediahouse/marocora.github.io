import {currencyCodes,currencyName} from './learn/currencies.mjs';
import {translationServices,moneyError,languagePairError} from './translation-validation.mjs';
const api=window.MarocoraSite;
const form=document.querySelector('form');
if(form){
 const field=id=>form.querySelector('#'+id),value=id=>field(id)?.value||'';
 function show(selector,visible){const group=form.querySelector(selector);if(!group)return;group.hidden=!visible;for(const n of group.querySelectorAll('input,select,textarea'))n.disabled=!visible;}
 function required(id,on=true){const n=field(id);if(n)n.required=on;}
 function setError(id,message){const n=field(id);if(n)n.setCustomValidity(message?api.t(message):'');}
 function validate(){
  for(const n of form.elements)if(n.setCustomValidity)n.setCustomValidity('');
  for(const n of form.querySelectorAll('input[type=text][required],input[type=tel][required],textarea[required]'))if(!n.disabled&&!n.value.trim())n.setCustomValidity(api.ui('checkFields'));
  if(field('source-language')){
   const pair=languagePairError(value('source-language'),value('target-language'),value('source-other'),value('target-other'));if(pair)setError(pair.field,pair.message);
   if(!value('message').trim())setError('message','Enter a brief description of your requirements.');
   if(value('interpretation-mode')==='In Person'&&!value('meeting-location').trim())setError('meeting-location','Enter the meeting location for in-person interpretation.');
   if(!field('appointment').disabled&&value('appointment')&&!value('timezone').trim())setError('timezone','Specify the time zone for your preferred appointment.');
   if(!field('timezone').disabled&&value('timezone')){try{new Intl.DateTimeFormat('en',{timeZone:value('timezone')});}catch{setError('timezone','Enter a recognised IANA time zone, such as Africa/Casablanca.');}}
   if(!field('receiving-authority').disabled&&!value('receiving-authority').trim())setError('receiving-authority','Provide the receiving organisation or country.');
   const money=moneyError(value('budget'),value('quote-currency'));if(money)setError(money.field==='amount'?'budget':'quote-currency',money.message);
  }else{
   const services=[...form.querySelectorAll('[name=services]')];if(!services.some(n=>n.checked))services[0].setCustomValidity(api.t('Select at least one service you offer.'));
   if(!field('registration-authority').disabled&&!value('registration-authority').trim())setError('registration-authority','Provide your declared registration authority or country.');
   if(!field('rate-amount').disabled){const money=moneyError(value('rate-amount'),value('rate-currency'),{unitRate:['Per Word','Per Page','Per Hour'].includes(value('rate-unit'))});if(money)setError(money.field==='amount'?'rate-amount':'rate-currency',money.message);}
  }
 }
 function render(){
  const request=!!field('source-language');
  if(request){
   for(const direction of ['source','target']){const other=value(direction+'-language')==='Other';show('[data-language-other='+direction+']',other);required(direction+'-other',other);}
   const interpretation=value('service')==='Interpretation',certified=value('service')==='Certified / Sworn Translation';
   show('[data-interpretation]',interpretation);show('[data-certified]',certified);show('[data-written]',!interpretation);show('[data-meeting-location]',interpretation&&value('interpretation-mode')==='In Person');
   required('interpretation-mode',interpretation);required('receiving-authority',certified);required('meeting-location',interpretation&&value('interpretation-mode')==='In Person');required('timezone',interpretation&&!!value('appointment'));
  }else{
   const fixed=value('pricing-method')==='Starting Rate',registered=value('sworn-status')==='Yes';
   show('[data-starting-rate]',fixed);show('[data-registration]',registered);
   for(const id of ['rate-amount','rate-currency','rate-unit'])required(id,fixed);required('registration-authority',registered);
  }
  const list=form.querySelector('#translation-currencies');list.dataset.siteLanguage='';list.replaceChildren(...currencyCodes.map(code=>{const option=document.createElement('option');option.value=code;option.label=currencyName(code,api.locale);return option;}));
  for(const n of form.querySelectorAll('#quote-currency,#rate-currency')){n.dataset.currencyCode='';n.dir='ltr';}
  validate();
 }
 if(field('service')){const service=new URLSearchParams(location.search).get('service');if(translationServices.includes(service))field('service').value=service;}
 form.addEventListener('change',render);form.addEventListener('input',()=>{validate();for(const n of form.querySelectorAll('[aria-invalid]'))if(n.validity.valid)n.removeAttribute('aria-invalid');});
 form.addEventListener('marocora:beforevalidate',()=>{for(const n of form.querySelectorAll('[data-currency-code]'))n.value=n.value.trim().toUpperCase();validate();});
 document.addEventListener('marocora:language',render);render();
}
