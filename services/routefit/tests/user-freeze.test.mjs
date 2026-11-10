import test from 'node:test';
import assert from 'node:assert/strict';
import {assertAccountCanTransact,freezeUser,unfreezeUser} from '../domain/user-freeze.mjs';

const user={id:'user-1',state:'ACTIVE'};

test('administrator can manually freeze and unfreeze a user without automatic rules',()=>{
 const frozen=freezeUser(user,{reason:'Example manual review'});
 assert.deepEqual(frozen,{id:'user-1',state:'FROZEN',freezeReason:'Example manual review',automaticFreezeEnabled:false});
 assert.deepEqual(unfreezeUser(frozen),user);
});

test('frozen user receives the same error for order and payment creation',()=>{
 const frozen=freezeUser(user,{reason:'Example manual review'});
 for(const action of ['ORDER_CREATE','PAYMENT_CREATE'])assert.throws(()=>assertAccountCanTransact(frozen,action),{code:'ACCOUNT_FROZEN'});
});
