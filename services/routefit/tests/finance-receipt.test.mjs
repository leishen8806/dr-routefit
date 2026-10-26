import test from 'node:test';
import assert from 'node:assert/strict';
import {writeReceipt} from '../adapters/finance.mjs';

const principal={companyId:'11111111-1111-4111-8111-111111111111',principalId:'22222222-2222-4222-8222-222222222222'},personId='33333333-3333-4333-8333-333333333333',orderId='44444444-4444-4444-8444-444444444444',receiptId='55555555-5555-4555-8555-555555555555';
test('receipt reporting rejects duplicate order allocation before creating a money fact',async()=>{
 const client={query:async sql=>{
  if(sql.startsWith('SELECT person_id FROM org.principal'))return {rows:[{person_id:personId}]};
  throw Error('No receipt row may be created for duplicate orders');
 }};
 await assert.rejects(writeReceipt(client,principal,'receipt-report',null,{payerSubjectId:'66666666-6666-4666-8666-666666666666',money:{amountMinor:1,currency:'USD'},method:'BANK_TRANSFER',receivingAccountId:'77777777-7777-4777-8777-777777777777',externalReference:'DEMO-1',orderIds:[orderId,orderId],evidenceFileIds:['88888888-8888-4888-8888-888888888888'],observedAt:new Date().toISOString()}),{code:'DUPLICATE_ORDER'});
});
test('receipt confirmation requires an independent natural person',async()=>{
 const snapshot={id:receiptId,payerSubjectId:'66666666-6666-4666-8666-666666666666',money:{amountMinor:1,currency:'USD'},method:'BANK_TRANSFER',custodyType:'COMPANY',custodianSubjectId:principal.companyId,orderIds:[orderId],evidenceFileIds:['88888888-8888-4888-8888-888888888888'],personId,receivingAccountId:'77777777-7777-4777-8777-777777777777',externalReference:'DEMO-1'};
 const client={query:async sql=>{
  if(sql.startsWith('SELECT person_id FROM org.principal'))return {rows:[{person_id:personId}]};
  if(sql.startsWith('SELECT snapshot FROM finance.receipt_confirmation'))return {rows:[]};
  if(sql.startsWith('SELECT snapshot FROM finance.receipt'))return {rows:[{snapshot}]};
  throw Error('A self-confirmation must not write evidence or a confirmation');
 }};
 await assert.rejects(writeReceipt(client,principal,'receipt-confirm',receiptId,{reason:'DEMO independent review',evidenceFileIds:['88888888-8888-4888-8888-888888888888']},1),{code:'INDEPENDENT_REVIEW_REQUIRED'});
});
