import {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {randomUUID,createHash} from 'node:crypto';
import {uuid} from '../quote/contracts.mjs';
const fail=code=>{throw Object.assign(Error(code),{status:503});};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const MAX_OBJECT_BYTES=16*1024*1024;
export function spacesConfiguration(env){
 const region=env.SPACES_REGION||'ams3',bucket=env.SPACES_BUCKET,key=env.SPACES_KEY,secret=env.SPACES_SECRET;
 if(!/^[a-z]{3}[0-9]$/.test(region)||typeof bucket!=='string'||!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket))fail('INVALID_SPACES_CONFIGURATION');
 if([key,secret].some(value=>typeof value!=='string'||!value||value!==value.trim()))fail('SPACES_CREDENTIALS_REQUIRED');
 return {bucket,endpoint:'https://'+region+'.digitaloceanspaces.com',region:'us-east-1',credentials:{accessKeyId:key,secretAccessKey:secret}};
}
export function createSpacesStore(env,{client}={}){
 const config=spacesConfiguration(env),s3=client||new S3Client({...config,forcePathStyle:false,maxAttempts:2,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'}),prefix='translation/v1/';
 const send=command=>s3.send(command,{abortSignal:AbortSignal.timeout(30000)});
 const keyFor=file=>{
  if(!file||file.backend!=='spaces'||file.bucket!==config.bucket||file.key!==prefix+uuid(file.id)||!Number.isSafeInteger(file.size)||file.size<1||file.size>MAX_OBJECT_BYTES||!/^[a-f0-9]{64}$/.test(file.sha256))fail('INVALID_STORED_FILE');
  return file.key;
 };
 const store={kind:'spaces',
  async put(input,mime){
   const bytes=Buffer.from(input);if(!bytes.length||bytes.length>MAX_OBJECT_BYTES)fail('FILE_SIZE_INVALID');
   const id=randomUUID(),sha256=digest(bytes),key=prefix+id;
   try{await send(new PutObjectCommand({Bucket:config.bucket,Key:key,Body:bytes,ContentType:mime,ContentLength:bytes.length,ACL:'private',Metadata:{sha256}}));}
   catch{fail('SPACES_WRITE_FAILED');}
   return {id,sha256,size:bytes.length,mime,backend:'spaces',bucket:config.bucket,key};
  },
  async get(file){
   const key=keyFor(file);let response;
   try{response=await send(new GetObjectCommand({Bucket:config.bucket,Key:key}));}catch{fail('SPACES_READ_FAILED');}
   const body=response.Body;
   const timer=setTimeout(()=>body?.destroy?.(Object.assign(Error('SPACES_READ_FAILED'),{status:503})),30000);timer.unref();
   try{
    if(response.ContentLength!==file.size||!body?.[Symbol.asyncIterator])fail('FILE_INTEGRITY_FAILURE');
    const chunks=[];let size=0;
    for await(const chunk of body){size+=chunk.length;if(size>file.size||size>MAX_OBJECT_BYTES)fail('FILE_INTEGRITY_FAILURE');chunks.push(Buffer.from(chunk));}
    const bytes=Buffer.concat(chunks);if(bytes.length!==file.size||digest(bytes)!==file.sha256)fail('FILE_INTEGRITY_FAILURE');return bytes;
   }finally{clearTimeout(timer);body?.destroy?.();}
  },
  async remove(file){if(!file)return;const key=keyFor(file);try{await send(new DeleteObjectCommand({Bucket:config.bucket,Key:key}));}catch{fail('SPACES_DELETE_FAILED');}},
  async scan(file,scanner,metadata){if(typeof scanner.scanBytes!=='function')fail('BYTE_SCANNER_REQUIRED');return scanner.scanBytes(await store.get(file),file.sha256,metadata);},
  close(){s3.destroy?.();}
 };return store;
}
