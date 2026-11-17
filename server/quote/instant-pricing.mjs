export const RATES=Object.freeze({normal:0.70,technical:0.95,legal:1.10,medical:1.05,sworn:150});
export const MINIMUM_CHARGE=150;
export const VAT_RATE=0.20;
export const SUPPORTED_LANGUAGES=Object.freeze(['Arabic','Chinese (Mandarin)','English','French','German','Portuguese','Russian','Spanish','Turkish']);
export const WITHDRAWAL_CONSENT='I request immediate commencement of work. I understand I lose my 7-day right of withdrawal once translation begins (Law 31-08).';
const cents=Object.freeze({normal:70,technical:95,legal:110,medical:105,sworn:15000});
const integer=(n,max=10_000_000)=>{if(!Number.isSafeInteger(n)||n<1||n>max)throw Error('INVALID_PRICING_QUANTITY');return n;};
export function addVat(subtotalMinor){
 integer(subtotalMinor,999_999_999_999);
 const totalMinor=Number((BigInt(subtotalMinor)*120n+50n)/100n);
 return {subtotalMinor,vatMinor:totalMinor-subtotalMinor,totalMinor};
}
export function splitPayment(totalMinor){
 integer(totalMinor,999_999_999_999);
 const depositMinor=Math.ceil(totalMinor/2);
 return {depositMinor,balanceMinor:totalMinor-depositMinor};
}
export function calculatePrice({category,wordCount,pageCount,firstOrder=false}){
 if(!Object.hasOwn(cents,category))throw Error('UNSUPPORTED_PRICING_CATEGORY');
 if(typeof firstOrder!=='boolean')throw Error('INVALID_FIRST_ORDER');
 const countedWords=category==='sworn'?null:integer(wordCount);
 const billableWords=countedWords===null?null:Math.floor(countedWords*98/100);
 const quantity=category==='sworn'?integer(pageCount,10000):billableWords;
 const rawMinor=quantity*cents[category];
 // First-order promotion precedes the minimum, so the minimum remains 150 MAD.
 const discountedMinor=firstOrder?Math.round(rawMinor*90/100):rawMinor;
 const subtotalMinor=Math.max(15000,discountedMinor);
 const totals=addVat(subtotalMinor),split=splitPayment(totals.totalMinor);
 return {currency:'MAD',category,countedWords,billableWords,pageCount:category==='sworn'?pageCount:null,rate:RATES[category],firstOrder,discountPercent:firstOrder?10:0,minimumCharge:MINIMUM_CHARGE,...totals,...split,total:totals.totalMinor/100};
}
