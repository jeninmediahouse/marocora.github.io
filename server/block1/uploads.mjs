// Bounded format inspection, not a document renderer or a malware detector.
import {basename,extname,join} from 'node:path';
import {existsSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import Cloudmersive from 'cloudmersive-virus-api-client';
export const MAX_FILE_BYTES=10_000_000;
export const MIME_TYPES=Object.freeze({'.txt':'text/plain','.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png'});
const reject=(code,status=400)=>{throw Object.assign(Error(code),{status});};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function text(bytes){try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{reject('INVALID_FILE_CONTENT');}}
function crc32(bytes){let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
function inspectDocx(bytes){
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0||end+22+bytes.readUInt16LE(end+20)!==bytes.length)reject('INVALID_DOCX');
 const count=bytes.readUInt16LE(end+10),start=bytes.readUInt32LE(end+16),size=bytes.readUInt32LE(end+12);
 if(bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6)||bytes.readUInt16LE(end+8)!==count||count<3||count>1024||start+size!==end)reject('INVALID_DOCX');
 const names=new Map();let pos=start,total=0;
 for(let i=0;i<count;i++){
  if(pos+46>end||bytes.readUInt32LE(pos)!==0x02014b50)reject('INVALID_DOCX');
  const flags=bytes.readUInt16LE(pos+8),method=bytes.readUInt16LE(pos+10),packed=bytes.readUInt32LE(pos+20),unpacked=bytes.readUInt32LE(pos+24),nameLength=bytes.readUInt16LE(pos+28),extra=bytes.readUInt16LE(pos+30),comment=bytes.readUInt16LE(pos+32),offset=bytes.readUInt32LE(pos+42),crc=bytes.readUInt32LE(pos+16);
  if(pos+46+nameLength+extra+comment>end||flags&1||![0,8].includes(method)||unpacked>20_000_000||unpacked>Math.max(1,packed)*100||bytes.readUInt16LE(pos+34))reject('UNSAFE_DOCX');
  total+=unpacked;if(total>50_000_000)reject('UNSAFE_DOCX');
  const name=text(bytes.subarray(pos+46,pos+46+nameLength));
  if(!name||names.has(name)||name.startsWith('/')||name.includes('\\')||name.split('/').includes('..')||/[\x00-\x1f]/.test(name)||/vbaProject\.bin|word\/embeddings\//i.test(name))reject('UNSAFE_DOCX');
  if(offset+30>start||bytes.readUInt32LE(offset)!==0x04034b50||bytes.readUInt16LE(offset+6)!==flags||bytes.readUInt16LE(offset+8)!==method)reject('INVALID_DOCX');
  const localName=bytes.readUInt16LE(offset+26),localExtra=bytes.readUInt16LE(offset+28),dataStart=offset+30+localName+localExtra;
  if(dataStart+packed>start||text(bytes.subarray(offset+30,offset+30+localName))!==name)reject('INVALID_DOCX');
  names.set(name,{dataStart,packed,unpacked,method,crc});pos+=46+nameLength+extra+comment;
 }
 if(pos!==end)reject('INVALID_DOCX');
 const xml=name=>{
  const part=names.get(name);if(!part||part.unpacked>2_000_000)reject('INVALID_DOCX');
  let data;try{const compressed=bytes.subarray(part.dataStart,part.dataStart+part.packed);data=part.method===0?compressed:inflateRawSync(compressed,{maxOutputLength:2_000_000});}catch{reject('INVALID_DOCX');}
  if(data.length!==part.unpacked||crc32(data)!==part.crc)reject('INVALID_DOCX');return text(data);
 };
 if(!xml('[Content_Types].xml').includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')||!xml('word/document.xml').includes('<w:document')||!xml('_rels/.rels').includes('relationships'))reject('INVALID_DOCX');
}
export function validateUpload(bytes,name,claimedType=''){
 if(!name||basename(name)!==name||/[\\/\x00-\x1f\x7f]/.test(name)||name.length>120)reject('INVALID_FILE_NAME');
 if(!bytes.length||bytes.length>MAX_FILE_BYTES)reject('FILE_SIZE_LIMIT',413);
 const extension=extname(name).toLowerCase(),mime=MIME_TYPES[extension];if(!mime)reject('UNSUPPORTED_FILE_TYPE',415);
 if(!['',mime,'application/octet-stream'].includes(claimedType))reject('FILE_TYPE_MISMATCH',415);
 if(extension==='.txt'){
  const value=text(bytes);if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)||value.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'))reject('INVALID_FILE_CONTENT');
 }else if(extension==='.pdf'){
  if(!/^%PDF-(1\.[0-9]|2\.0)/.test(bytes.subarray(0,9).toString('ascii'))||!bytes.subarray(-4096).includes(Buffer.from('%%EOF')))reject('INVALID_PDF');
 }else if(extension==='.docx'){
  try{inspectDocx(bytes);}catch(e){if(e.status)throw e;reject('INVALID_DOCX');}
 }else if(extension==='.png'){
  if(bytes.length<45||!bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))||bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR'||!bytes.readUInt32BE(16)||!bytes.readUInt32BE(20)||bytes.toString('hex',bytes.length-12)!=='0000000049454e44ae426082')reject('INVALID_PNG');
 }else if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217)reject('INVALID_JPEG');
 return {mime,sha256:sha(bytes),size:bytes.length};
}
export function localScanner(){
 const candidates=[...new Set(['/opt/homebrew/bin/clamscan','/usr/local/bin/clamscan','/usr/bin/clamscan',...(process.env.PATH||'').split(':').filter(Boolean).map(dir=>join(dir,'clamscan'))])];
 const binary=candidates.find(path=>existsSync(path));
 return {available:!!binary,engine:binary?'ClamAV clamscan':'none',
  scan(path,expectedHash){
   if(sha(readFileSync(path))!==expectedHash)return {status:'error',engine:'integrity',reason:'CONTENT_CHANGED'};
   if(!binary)return {status:'quarantined',engine:'none',reason:'SCANNER_NOT_INSTALLED'};
   let status,reason;
   try{execFileSync(binary,['--no-summary','--stdout','--',path],{timeout:20000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});status='clean';reason='CLAMAV_EXIT_0';}
   catch(e){status=e.status===1?'infected':'error';reason=e.status===1?'CLAMAV_EXIT_1':e.code==='ETIMEDOUT'?'SCANNER_TIMEOUT':'SCANNER_ERROR';}
   if(sha(readFileSync(path))!==expectedHash)return {status:'error',engine:'integrity',reason:'CONTENT_CHANGED'};
   return {status,engine:'ClamAV clamscan',reason};
  }};
}

export const CLOUDMERSIVE_OPTIONS=Object.freeze({
 allowExecutables:false,allowInvalidFiles:false,allowScripts:false,
 allowMacros:false,allowPasswordProtectedFiles:false,allowUnsafeArchives:false,
 allowOleEmbeddedObject:false,allowXmlExternalEntities:false,
 allowInsecureDeserialization:false,allowHtml:false,allowUnwantedAction:false,
 restrictFileTypes:'.txt,.pdf,.docx,.jpg,.jpeg,.png'
});
export const CLOUDMERSIVE_QUARANTINE_MESSAGE='Your file is being scanned for security. This usually takes a few seconds. If the scan does not complete, your file will remain in quarantine and staff will review it manually.';
function sdkScanner(apiKey,timeoutMs){
 const client=new Cloudmersive.ApiClient();
 client.basePath='https://api.cloudmersive.com';
 client.authentications.Apikey.apiKey=apiKey;client.timeout=timeoutMs;
 return new Cloudmersive.ScanApi(client);
}
// Test injection is constructor-only; no HTTP field/flag can replace transport.
export function cloudmersiveScanner({env=process.env,apiFactory=sdkScanner,timeoutMs=30000}={}){
 const apiKey=typeof env.CLOUDMERSIVE_API_KEY==='string'?env.CLOUDMERSIVE_API_KEY.trim():'';
 let api;
 const failure=()=>({status:'error',engine:'Cloudmersive',reason:'API_ERROR'});
 async function perform(bytes,expectedHash,metadata,verify){
  if(!bytes?.length||bytes.length>MAX_FILE_BYTES||sha(bytes)!==expectedHash||!apiKey)return failure();
  const suffix=extname(metadata.name||'').toLowerCase();if(!Object.hasOwn(MIME_TYPES,suffix))return failure();
  const options={...CLOUDMERSIVE_OPTIONS,fileName:'document'+suffix};
  return new Promise(resolve=>{
   let done=false,request,timer;
   const finish=result=>{if(done)return;done=true;clearTimeout(timer);resolve(result);};
   timer=setTimeout(()=>{finish(failure());try{request?.abort();}catch{}},timeoutMs);
   try{
    api??=apiFactory(apiKey,timeoutMs);
    request=api.scanFileAdvanced(bytes,options,(error,data,response)=>{
     if(done)return;
     try{const raw=response?.body;
      if(error||!Number.isInteger(response?.status)||response.status<200||response.status>=300||!raw||!Object.hasOwn(raw,'CleanResult')||typeof raw.CleanResult!=='boolean'||data?.CleanResult!==raw.CleanResult||!verify()){finish(failure());return;}
      finish(raw.CleanResult?{status:'clean',engine:'Cloudmersive',reason:'API_CLEAN'}:{status:'infected',engine:'Cloudmersive',reason:'API_INFECTED'});
     }catch{finish(failure());}
    });
   }catch{finish(failure());}
  });
 }
 return {available:!!apiKey,engine:'Cloudmersive Virus Scan API',
  async scan(filePath,expectedHash,metadata={}){try{return await perform(readFileSync(filePath),expectedHash,{name:metadata.name||filePath},()=>sha(readFileSync(filePath))===expectedHash);}catch{return failure();}},
  async scanBytes(input,expectedHash,metadata={}){const bytes=Buffer.from(input);return perform(bytes,expectedHash,metadata,()=>sha(bytes)===expectedHash);}
 };
}
