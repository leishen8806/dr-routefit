import {createCipheriv,createHmac,randomBytes} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';

const keyFrom=value=>{
 const text=String(value??'').trim(),key=/^[a-f0-9]{64}$/i.test(text)?Buffer.from(text,'hex'):Buffer.from(text,'base64');
 ensure(key.length===32,503,'ACCOUNT_SECRET_KEY_REQUIRED','账户变更加密密钥未配置');
 return key;
};
const fingerprint=(value,key)=>createHmac('sha256',key).update(JSON.stringify(value)).digest('hex');

export function sealAccountChange(input,keyMaterial=process.env.ROUTEFIT_ACCOUNT_CHANGE_KEY){
 const holderName=input.holderName.trim(),accountNumber=input.accountNumber.trim(),digits=accountNumber.replace(/\D/g,'');
 ensure(digits.length>=4,422,'ACCOUNT_NUMBER_INVALID','账户号码必须至少包含四位数字');
 const secret={holderName,accountNumber},key=keyFrom(keyMaterial),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),ciphertext=Buffer.concat([cipher.update(JSON.stringify(secret),'utf8'),cipher.final()]),tag=cipher.getAuthTag(),secretFingerprint=fingerprint(secret,key);
 return {details:{kind:'ACCOUNT_CHANGE',subjectId:input.subjectId,currentAccountVersion:input.currentAccountVersion,currency:input.currency,bankCode:input.bankCode.trim(),holderDisplayName:'***',last4:digits.slice(-4),secretFingerprint,reason:input.reason.trim(),evidenceFileIds:input.evidenceFileIds},sealed:{iv,ciphertext,tag,keyId:'ROUTEFIT_ACCOUNT_CHANGE_KEY'}};
}
