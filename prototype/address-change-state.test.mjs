import test from 'node:test';
import assert from 'node:assert/strict';
import {selectAddressChangeCase} from './address-change-state.mjs';

test('address change state ignores newer non-address-change cases',()=>{
 const addressChange={id:'address-1',type:'ADDRESS_CHANGE',state:'submitted'};
 const newerOther={id:'other-2',type:'CUSTOMER_COMPLAINT',state:'submitted'};
 assert.equal(selectAddressChangeCase([addressChange,newerOther]),addressChange);
 assert.deepEqual(selectAddressChangeCase([{...addressChange,state:'rejected'},newerOther]),{...addressChange,state:'rejected'});
});
