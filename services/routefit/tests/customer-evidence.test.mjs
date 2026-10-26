import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeCustomerEvidence} from '../adapters/customer.mjs';

const principal={companyId:'11111111-1111-4111-8111-111111111111',principalId:'22222222-2222-4222-8222-222222222222'},customerId='33333333-3333-4333-8333-333333333333',orderId='44444444-4444-4444-8444-444444444444';
const currentCustomerSql='SELECT c.id FROM party.customer c JOIN party.customer_access';
test('customer evidence is limited to the current customer order',async()=>{
 const client={query:async(sql,params)=>{
  if(sql.startsWith(currentCustomerSql))return {rows:[{id:customerId}]};
  if(sql.startsWith('SELECT snapshot FROM orders.draft')){assert.deepEqual(params,[principal.companyId,orderId]);return {rows:[{snapshot:{order:{customerId}}}]};}
  throw Error('Unexpected query');
 }};
 await authorizeCustomerEvidence(client,principal,'ORDER',orderId);
 await assert.rejects(authorizeCustomerEvidence(client,principal,'PARTNER',orderId),{code:'EVIDENCE_RESOURCE_UNSUPPORTED'});
});
test('customer evidence hides another customer order',async()=>{
 const client={query:async sql=>sql.startsWith(currentCustomerSql)?{rows:[{id:customerId}]}:{rows:[{snapshot:{order:{customerId:'55555555-5555-4555-8555-555555555555'}}}]}};
 await assert.rejects(authorizeCustomerEvidence(client,principal,'ORDER',orderId),{code:'NOT_FOUND'});
});
