import {mkdirSync,chmodSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {uuid} from '../quote/contracts.mjs';
export function createLocalFileStore(directory){
 mkdirSync(directory,{recursive:true,mode:0o700});chmodSync(directory,0o700);
 return {kind:'local',
  put(bytes,mime){const id=randomUUID();writeFileSync(join(directory,id),bytes,{flag:'wx',mode:0o600});return {id,sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length,mime};},
  get(file){const bytes=readFileSync(join(directory,uuid(file.id)));if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Object.assign(Error('FILE_INTEGRITY_FAILURE'),{status:503});return bytes;},
  remove(file){if(file)rmSync(join(directory,uuid(file.id)),{force:true});},
  scan(file,scanner,metadata){return scanner.scan(join(directory,uuid(file.id)),file.sha256,metadata);}
 };
}
