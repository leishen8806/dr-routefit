import test from 'node:test';
import assert from 'node:assert/strict';
import {writeBankTransaction} from '../adapters/bank.mjs';

const companyId='11111111-1111-4111-8111-111111111111',principal={companyId,principalId:'22222222-2222-4222-8222-222222222222'},accountId='33333333-3333-4333-8333-333333333333',evidenceId='44444444-4444-4444-8444-444444444444';
const draft={accountId,externalTransactionId:'bank-ref-1',direction:'IN',money:{amountMinor:1200,currency:'USD'},bookedAt:'2026-01-01T00:00:00.000Z',evidenceFileIds:[evidenceId]};
function client(){return {query:async(sql,params)=>{
 if(sql.includes('FROM evidence.file'))return {rows:[{count:1}],rowCount:1};
 if(sql.includes('FROM finance.receiving_account'))return {rows:[{id:accountId,currency:'USD'}],rowCount:1};
 if(sql.includes('INSERT INTO finance.bank_transaction'))return {rows:[],rowCount:1};
 if(sql.includes('INSERT INTO finance.bank_transaction_evidence'))return {rows:[],rowCount:1};
 throw Error('Unexpected query: '+sql);
}};}
test('bank transaction records one evidenced, currency-matched money fact without creating a receipt',async()=>{
 const result=await writeBankTransaction(client(),principal,draft);
 assert.equal(result.version,1);assert.equal(result.unmatchedMinor,1200);assert.equal(result.matchedMinor,0);assert.equal(result.externalTransactionId,'BANK-REF-1');
 await assert.rejects(()=>writeBankTransaction(client(),principal,{...draft,money:{amountMinor:1200,currency:'KHR'}}),{code:'CURRENCY_MISMATCH'});
});
