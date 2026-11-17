import {parentPort,workerData} from 'node:worker_threads';
import {getLatestRates} from '@allratestoday/bank-al-maghrib-exchange-rate';
try{parentPort.postMessage(await getLatestRates({apiKey:workerData.apiKey}));}catch{parentPort.postMessage({unavailable:true});}
