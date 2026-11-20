import {createCipheriv,randomBytes} from 'node:crypto';
const fail=code=>{throw Object.assign(Error(code),{status:code==='SUPPLY_PAYOUT_STORAGE_UNAVAILABLE'?503:400});};
export function encryptPayout(input,{key,actor,applicationId}){
 if(typeof key!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(key)||Buffer.from(key,'base64').length!==32)fail('SUPPLY_PAYOUT_STORAGE_UNAVAILABLE');
 if(!input||Object.getPrototypeOf(input)!==Object.prototype||Object.keys(input).some(k=>!['iban','swift','accountHolder'].includes(k)))fail('SUPPLY_INVALID_PAYOUT');
 if(typeof input.iban!=='string'||input.iban.length>60||typeof input.swift!=='string'||input.swift.length>20||typeof input.accountHolder!=='string'||input.accountHolder.trim().length<1||input.accountHolder.length>160)fail('SUPPLY_INVALID_PAYOUT');
 const iban=input.iban.replace(/\s/g,'').toUpperCase(),swift=input.swift.trim().toUpperCase();
 if(!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)||!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift))fail('SUPPLY_INVALID_PAYOUT');
 let remainder=0;for(const char of iban.slice(4)+iban.slice(0,4))for(const digit of /[A-Z]/.test(char)?String(char.charCodeAt(0)-55):char)remainder=(remainder*10+Number(digit))%97;
 if(remainder!==1)fail('SUPPLY_INVALID_PAYOUT');
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'base64'),nonce);
 cipher.setAAD(Buffer.from(`supply-payout:v1:${actor}:${applicationId}`));
 const plaintext=Buffer.from(JSON.stringify({iban,swift,accountHolder:input.accountHolder.trim()}));
 try{const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);return {envelope:{v:1,nonce:nonce.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')},lastFour:iban.slice(-4)};}
 finally{plaintext.fill(0);}
}
