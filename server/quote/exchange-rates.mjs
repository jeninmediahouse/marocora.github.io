import {Worker} from 'node:worker_threads';
export function validateRateTable(table,now=Date.now()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(table?.rate_date))throw Error('INVALID_RATE_DATE');
 const date=Date.parse(table.rate_date+'T00:00:00Z');
 if(!Number.isFinite(date)||now-date>7*86400000||date>now+86400000)throw Error('STALE_RATE_TABLE');
 const values={};
 for(const code of ['EUR','USD']){
  const rows=table.rates?.filter(r=>r.base===code&&r.quote==='MAD'&&r.type==='reference');
  if(rows?.length!==1||typeof rows[0].value!=='number'||!Number.isFinite(rows[0].value)||rows[0].value<=0)throw Error('INVALID_RATE');
  values[code]=rows[0].value;
 }
 return {date:table.rate_date,madPerUnit:values};
}
export function foreignEstimates(totalMinor,table){
 return Object.fromEntries(['EUR','USD'].map(code=>[code,Math.round(totalMinor/table.madPerUnit[code])/100]));
}
function loadRates(apiKey,timeoutMs){return new Promise(resolve=>{
 const worker=new Worker(new URL('./exchange-worker.mjs',import.meta.url),{workerData:{apiKey}});let done=false;
 const finish=value=>{if(done)return;done=true;clearTimeout(timer);void worker.terminate();resolve(value);};
 const timer=setTimeout(()=>finish(null),timeoutMs);
 worker.once('message',finish);worker.once('error',()=>finish(null));worker.once('exit',()=>finish(null));
});}
export function createExchangeService({apiKey=process.env.ALLRATESTODAY_API_KEY,loader=loadRates,now=Date.now,timeoutMs=5000}={}){
 let cache=null,expires=0,pending;
 return {async estimates(totalMinor){
  if(!apiKey)return {available:false,reason:'RATES_NOT_CONFIGURED'};
  if(now()>=expires){
   pending??=(async()=>{try{cache=validateRateTable(await loader(apiKey,timeoutMs),now());expires=now()+3600000;}catch{cache=null;expires=now()+60000;}finally{pending=null;}})();
   await pending;
  }
  if(!cache)return {available:false,reason:'RATES_UNAVAILABLE'};
  return {available:true,date:cache.date,source:'Bank Al-Maghrib via AllRatesToday',...foreignEstimates(totalMinor,cache)};
 }};
}
