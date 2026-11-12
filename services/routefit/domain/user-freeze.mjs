import {ensure} from './errors.mjs';

export function freezeUser(user,{reason}){
 ensure(user.state==='ACTIVE',409,'INVALID_FREEZE_TRANSITION','Only active users can be frozen');
 ensure(typeof reason==='string'&&reason.trim(),422,'FREEZE_REASON_REQUIRED','Manual freeze requires a reason');
 return {...user,state:'FROZEN',freezeReason:reason.trim(),automaticFreezeEnabled:false};
}

export function unfreezeUser(user){
 ensure(user.state==='FROZEN',409,'INVALID_FREEZE_TRANSITION','Only frozen users can be unfrozen');
 const {freezeReason,automaticFreezeEnabled,...active}=user;
 return {...active,state:'ACTIVE'};
}

export function assertAccountCanTransact(user,action){
 ensure(['ORDER_CREATE','PAYMENT_CREATE'].includes(action),422,'UNSUPPORTED_ACCOUNT_ACTION','Unsupported account action');
 ensure(user.state!=='FROZEN',403,'ACCOUNT_FROZEN','Frozen accounts cannot create orders or payments');
}
