import {currencies} from './learn/currencies.mjs';
export const translationServices=['Document Translation','Certified / Sworn Translation','Interpretation','Business Translation','Website & Digital Translation','Other Language Service'];
export function moneyError(amount,currency,{unitRate=false}={}){
 const code=String(currency||'').trim().toUpperCase(),value=String(amount??'').trim();
 if(code&&!currencies[code])return {field:'currency',message:'Choose a currency code from the list.'};
 if(!value)return null;
 if(!code)return {field:'currency',message:'Choose a currency for the amount you entered.'};
 const match=/^\d+(?:\.(\d+))?$/.exec(value);
 if(!match||!Number.isFinite(Number(value))||(match[1]?.length||0)>(unitRate?6:currencies[code].digits))return {field:'amount',message:unitRate?'Enter a nonnegative unit rate with up to six decimal places.':'Enter a nonnegative amount using the currency’s allowed decimal places.'};
 return null;
}
export function languagePairError(source,target,otherSource='',otherTarget=''){
 const normalize=s=>String(s||'').normalize('NFKC').trim().toLocaleLowerCase();
 const from=source==='Other'?otherSource:source,to=target==='Other'?otherTarget:target;
 if(source==='Other'&&!normalize(from))return {field:'source-other',message:'Enter the other language.'};
 if(target==='Other'&&!normalize(to))return {field:'target-other',message:'Enter the other language.'};
 if(normalize(from)&&normalize(from)===normalize(to))return {field:'target-language',message:'Use a different source and target language.'};
 return null;
}
