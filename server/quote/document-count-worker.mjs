import {parentPort,workerData} from 'node:worker_threads';
import {analyzeDocument} from './document-count-core.mjs';
try{
 parentPort.postMessage(await analyzeDocument(new Uint8Array(workerData.bytes),workerData.extension));
}catch{parentPort.postMessage({error:'DOCUMENT_REQUIRES_MANUAL_REVIEW'});}
