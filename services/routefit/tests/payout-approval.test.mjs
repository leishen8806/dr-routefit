import test from 'node:test';
import assert from 'node:assert/strict';
import {approvePayout,confirmPayoutPaid} from '../domain/payout-approval.mjs';

const payout={id:'payout-1',state:'submitted',version:1,requestedBy:'requester-1'};

test('payout confirmation rejects the person who approved it',()=>{
 const approved=approvePayout(payout,'operator-1');
 assert.throws(()=>confirmPayoutPaid(approved,'operator-1'),{code:'SELF_CONFIRM_FORBIDDEN'});
});

test('a different financial confirmer can record simulated payment after approval',()=>{
 const approved=approvePayout(payout,'operator-1');
 assert.deepEqual(confirmPayoutPaid(approved,'finance-1'),{
  ...approved,state:'paid',version:3,confirmedBy:'finance-1',paymentMode:'simulated'
 });
});

test('payout confirmation cannot skip operational approval',()=>{
 assert.throws(()=>confirmPayoutPaid(payout,'finance-1'),{code:'INVALID_PAYOUT_STATE'});
});
