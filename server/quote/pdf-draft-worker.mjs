import {parentPort,workerData} from 'node:worker_threads';
import {PDFDocument,degrees,rgb} from 'pdf-lib';
try{
 const source=await PDFDocument.load(new Uint8Array(workerData),{updateMetadata:false}),draft=await PDFDocument.create();
 for(const embedded of await draft.embedPages(source.getPages())){
  const page=draft.addPage([embedded.width,embedded.height]);page.drawPage(embedded);
  const size=Math.max(8,Math.min(32,embedded.width/18,embedded.height/12));let stamped=false;
  for(let y=70;y<embedded.height-size*5;y+=180){page.drawText('DRAFT - BALANCE DUE',{x:15,y,size,rotate:degrees(25),color:rgb(.7,.12,.12),opacity:.3});stamped=true;}
  if(!stamped)page.drawText('DRAFT - BALANCE DUE',{x:5,y:embedded.height/2,size:Math.min(12,embedded.width/25),color:rgb(.7,.12,.12),opacity:.3});
 }
 parentPort.postMessage({bytes:await draft.save()});
}catch{parentPort.postMessage({error:'INVALID_FINAL_PDF'});}
