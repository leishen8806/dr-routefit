import test from 'node:test';
import assert from 'node:assert/strict';
import {driverIncomeQuery,moneyOverviewQuery,readDriverIncome,readMoneyOverview,reportQuery} from '../adapters/finance.mjs';
import {driverWithdrawalQuery,readDriverWithdrawals,requestDriverWithdrawal} from '../adapters/settlement.mjs';

const principal={companyId:'11111111-1111-4111-8111-111111111111',principalId:'22222222-2222-4222-8222-222222222222'};
test('ledger report filters fail closed',()=>{
 assert.throws(()=>reportQuery(new URL('http://localhost/api/ops/v1/finance/reports/ledger?direction=UNKNOWN'),principal),{code:'INVALID_QUERY'});
 assert.throws(()=>reportQuery(new URL('http://localhost/api/customer/v1/reports/ledger?subjectId=33333333-3333-4333-8333-333333333333'),principal,true),{code:'INVALID_QUERY'});
});
test('driver income returns only the current drivers payable income items',async()=>{
 const itemId='33333333-3333-4333-8333-333333333333',calls=[];
 const client={query:async(sql,params=[])=>{
  calls.push([sql,params]);
  if(sql.startsWith('SELECT kind,person_id FROM org.principal'))return {rows:[{kind:'DRIVER',person_id:'44444444-4444-4444-8444-444444444444'}],rowCount:1};
  if(sql.startsWith('WITH source AS'))return {rows:[{id:itemId,quote_id:null,fee_id:null,snapshot:{id:itemId,orderId:null,subjectId:principal.principalId,direction:'PAYABLE',purpose:'DRIVER_INCOME',currency:'USD',originalMinor:1200,adjustmentMinor:0,allocatedMinor:0,outstandingMinor:1200,reservedMinor:0,dueDate:'2026-10-25',sourceType:'AMENDMENT_DIFFERENCE',sourceId:itemId}}],rowCount:1};
  throw Error('unexpected query '+sql);
 }};
 const query=driverIncomeQuery(new URL('http://localhost/api/driver/v1/income-items'),principal),result=await readDriverIncome(client,principal,query);
 assert.equal(result.items[0].subjectId,principal.principalId);assert.equal(result.items[0].purpose,'DRIVER_INCOME');assert.equal(calls.find(([sql])=>sql.startsWith('WITH source AS'))[1][1],principal.principalId);
 assert.throws(()=>driverIncomeQuery(new URL('http://localhost/api/driver/v1/income-items?group=completed'),principal),{code:'INVALID_QUERY'});
});
test('driver withdrawal only reserves own payable income against a verified account',async()=>{
 const ledgerId='33333333-3333-4333-8333-333333333333',accountId='55555555-5555-4555-8555-555555555555',calls=[];
 const client={query:async(sql,params=[])=>{
  calls.push([sql,params]);
  if(sql.startsWith('SELECT kind,person_id FROM org.principal'))return {rows:[{kind:'DRIVER',person_id:'44444444-4444-4444-8444-444444444444'}],rowCount:1};
  if(sql.startsWith('SELECT id,snapshot FROM finance.ledger_item'))return {rows:[{id:ledgerId,snapshot:{subjectId:principal.principalId,purpose:'DRIVER_INCOME',direction:'PAYABLE',currency:'USD',outstandingMinor:1200}}],rowCount:1};
  if(sql.startsWith('SELECT * FROM finance.settlement_account'))return {rows:[{id:accountId,version:1,state:'verified'}],rowCount:1};
  if(sql.startsWith('SELECT COALESCE(sum(money_amount_minor)'))return {rows:[{total:'200'}],rowCount:1};
  if(sql.startsWith('SELECT person_id FROM org.principal'))return {rows:[{person_id:'44444444-4444-4444-8444-444444444444'}],rowCount:1};
  if(sql.startsWith('INSERT INTO finance.driver_withdrawal_request'))return {rows:[],rowCount:1};
  throw Error('unexpected query '+sql);
 }};
 const input={kind:'PAYMENT',ledgerItemId:ledgerId,ledgerItemVersion:1,money:{amountMinor:1000,currency:'USD'},accountId,accountVersion:1,reason:'weekly payout'};
 const result=await requestDriverWithdrawal(client,principal,input);
 assert.equal(result.kind,'PAYMENT');assert.equal(result.money.amountMinor,1000);assert.equal(calls.find(([sql])=>sql.startsWith('SELECT * FROM finance.settlement_account'))[1][2],principal.principalId);
 assert.throws(()=>driverWithdrawalQuery(new URL('http://localhost/api/driver/v1/withdrawal-requests?subjectId=33333333-3333-4333-8333-333333333333'),principal),{code:'INVALID_QUERY'});
 const listClient={query:async(sql,params=[])=>{if(sql.startsWith('SELECT kind,person_id FROM org.principal'))return {rows:[{kind:'DRIVER',person_id:'44444444-4444-4444-8444-444444444444'}],rowCount:1};if(sql.startsWith('SELECT * FROM finance.driver_withdrawal_request'))return {rows:[{id:ledgerId,version:1,money_amount_minor:1000,money_currency:'USD',ledger_item_id:ledgerId,created_at:'2026-10-25T00:00:00Z'}],rowCount:1};throw Error('unexpected query '+sql);}};
 const listed=await readDriverWithdrawals(listClient,principal,driverWithdrawalQuery(new URL('http://localhost/api/driver/v1/withdrawal-requests'),principal));assert.equal(listed.items[0].sourceIds[0],ledgerId);
});
test('money overview requires one currency and labels incomplete custody dimensions partial',async()=>{
 const calls=[],client={query:async(sql,params=[])=>{
  calls.push([sql,params]);
  if(sql.startsWith('WITH source AS'))return {rows:[{receivable:'1200',payable:'400'}],rowCount:1};
  if(sql.startsWith('WITH driver_cash AS'))return {rows:[{driver_held:'300',company_held:'700'}],rowCount:1};
  if(sql.startsWith("SELECT COALESCE(sum(amount_minor)"))return {rows:[{unmatched:'90',reserved:'0'},{unmatched:'0',reserved:'80'}],rowCount:2};
  throw Error('unexpected query '+sql);
 }};
 const query=moneyOverviewQuery(new URL('http://localhost/api/ops/v1/finance/reports/overview?currency=USD')),result=await readMoneyOverview(client,principal,query);
 assert.deepEqual({receivable:result.receivableMinor,payable:result.payableMinor,driverHeld:result.driverHeldMinor,companyHeld:result.companyHeldMinor,reserved:result.paymentReservedMinor,unmatched:result.unmatchedMinor},{receivable:1200,payable:400,driverHeld:300,companyHeld:700,reserved:80,unmatched:90});assert.equal(result.quality,'partial');
 assert.throws(()=>moneyOverviewQuery(new URL('http://localhost/api/ops/v1/finance/reports/overview?currency=USD&currency=KHR')),{code:'INVALID_QUERY'});
});
