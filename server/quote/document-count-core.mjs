import {countDocumentWords} from '@transkripid/document-ocr/count';
import {PDFDocument,PDFDict,PDFName} from 'pdf-lib';

// Includes inherited resources and text in nested Form XObjects. Missing/unsafe
// resources fail to manual review rather than producing a zero-word quote.
function resourcesHaveText(resources,seen=new Set()){
 if(!resources||seen.has(resources))return false;
 if(seen.size>=128)throw Error('PDF_RESOURCE_LIMIT');
 seen.add(resources);
 const fonts=resources.lookupMaybe(PDFName.of('Font'),PDFDict);
 if(fonts?.keys().length)return true;
 const objects=resources.lookupMaybe(PDFName.of('XObject'),PDFDict);
 for(const ref of objects?.values()||[]){
  const object=resources.context.lookup(ref),dict=object?.dict;
  if(dict?.get(PDFName.of('Subtype'))===PDFName.of('Form')&&resourcesHaveText(dict.lookupMaybe(PDFName.of('Resources'),PDFDict),seen))return true;
 }
 return false;
}
export async function analyzeDocument(bytes,extension,{counter=countDocumentWords}={}){
 let pages=null;
 if(extension==='.pdf'){
  const pdf=await PDFDocument.load(bytes,{updateMetadata:false});pages=pdf.getPageCount();
  if(!pdf.getPages().some(page=>resourcesHaveText(page.node.Resources())))return {manualReview:true,reason:'SCANNED_OR_IMAGE_ONLY_PDF',words:null,pages};
 }
 const words=await counter(bytes,{maxDocumentBytes:20_000_000,maxPartBytes:2_000_000,zipLimits:{maxRatio:100,maxTotalUncompressed:50_000_000}});
 return {words,pages};
}
