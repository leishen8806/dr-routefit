import test from 'node:test';
import assert from 'node:assert/strict';
import {acknowledgeCustomerStatement,customerFinanceRequestQuery,customerSettlementAccountQuery,driverSettlementAccountQuery,opsSettlementAccountQuery,readDriverSettlementAccounts,readOpsSettlementAccounts,requestCustomerRefund,settlementPeriods,settlementRuleQuery,statementQuery,writeSettlement} from '../adapters/settlement.mjs';

const principal={companyId:'11111111-1111-4111-8111-111111111111',principalId:'22222222-2222-4222-8222-222222222222'};
const base={subjectId:'33333333-3333-4333-8333-333333333333',direction:'RECEIVABLE',purpose:'DELIVERY',currency:'USD',period:'EVERY_N_DAYS',anchorDate:'2026-01-01',intervalDays:7,shortMonthPolicy:'MONTH_END',issueDelayDays:1,dueAfterDays:3,remindBeforeDays:1,overdueRepeatDays:2,effectiveFrom:'2026-01-01',ownerPersonId:'44444444-4444-4444-8444-444444444444'};

test('settlement periods are deterministic and obey short-month policy',()=>{
 assert.deepEqual(settlementPeriods(base),[
  {start:'2026-01-01',endExclusive:'2026-01-08',issueDate:'2026-01-09',dueDate:'2026-01-12'},
  {start:'2026-01-08',endExclusive:'2026-01-15',issueDate:'2026-01-16',dueDate:'2026-01-19'},
  {start:'2026-01-15',endExclusive:'2026-01-22',issueDate:'2026-01-23',dueDate:'2026-01-26'}
 ]);
 const monthly={...base,period:'MONTHLY',anchorDate:'2026-02-01',effectiveFrom:'2026-02-01',monthDay:31,shortMonthPolicy:'MONTH_END'};
 assert.equal(settlementPeriods(monthly,1)[0].endExclusive,'2026-03-01');
 assert.equal(settlementPeriods({...monthly,shortMonthPolicy:'NEXT_VALID_MONTH'},1)[0].endExclusive,'2026-04-01');
 assert.throws(()=>settlementPeriods({...base,period:'WEEKLY'}),{code:'INVALID_SETTLEMENT_RULE'});
});

test('settlement cursors bind scope and reject offset queries',()=>{
 assert.equal(settlementRuleQuery(new URL('http://localhost/api/ops/v1/finance/settlement-rules?limit=2'),principal).limit,2);
 assert.equal(statementQuery(new URL('http://localhost/api/ops/v1/finance/statements?limit=3'),principal).limit,3);
 assert.equal(customerSettlementAccountQuery(new URL('http://localhost/api/customer/v1/settlement-accounts?limit=2'),principal).limit,2);
 assert.equal(driverSettlementAccountQuery(new URL('http://localhost/api/driver/v1/settlement-accounts?limit=2'),principal).limit,2);
 assert.equal(opsSettlementAccountQuery(new URL('http://localhost/api/ops/v1/settlement-accounts?subjectId=33333333-3333-4333-8333-333333333333'),principal).subjectId,'33333333-3333-4333-8333-333333333333');
 assert.equal(customerFinanceRequestQuery(new URL('http://localhost/api/customer/v1/finance-requests?limit=3'),principal).limit,3);
 assert.throws(()=>statementQuery(new URL('http://localhost/api/ops/v1/finance/statements?offset=1'),principal),{code:'INVALID_QUERY'});
});

test('driver settlement accounts require a driver identity and bind to that driver only',async()=>{
 const accountId='55555555-5555-4555-8555-555555555555',calls=[];
 const client={query:async(sql,params=[])=>{
  calls.push([sql,params]);
  if(sql.startsWith('SELECT kind,person_id FROM org.principal'))return {rows:[{kind:'DRIVER',person_id:'66666666-6666-4666-8666-666666666666'}],rowCount:1};
  if(sql.startsWith('SELECT * FROM finance.settlement_account'))return {rows:[{id:accountId,subject_id:principal.principalId,version:2,state:'verified',bank_code:'ABA',last4:'1234',holder_display_name:'Driver'}],rowCount:1};
  throw Error('unexpected query '+sql);
 }};
 const query=driverSettlementAccountQuery(new URL('http://localhost/api/driver/v1/settlement-accounts'),principal);
 const result=await readDriverSettlementAccounts(client,principal,query);
 assert.equal(result.items[0].subjectId,principal.principalId);
 const accounts=calls.find(([sql])=>sql.startsWith('SELECT * FROM finance.settlement_account'));
 assert.equal(accounts[1][1],principal.principalId);
});

test('ops settlement accounts require an unexpired subject grant before reading',async()=>{
 const subjectId='33333333-3333-4333-8333-333333333333',accountId='55555555-5555-4555-8555-555555555555',calls=[];
 const client={query:async(sql,params=[])=>{
  calls.push([sql,params]);
  if(sql.startsWith('SELECT 1 FROM org.role_grant'))return {rows:[{exists:1}],rowCount:1};
  if(sql.startsWith('SELECT * FROM finance.settlement_account'))return {rows:[{id:accountId,subject_id:subjectId,version:2,state:'verified',bank_code:'ABA',last4:'1234',holder_display_name:'Subject'}],rowCount:1};
  throw Error('unexpected query '+sql);
 }};
 const query=opsSettlementAccountQuery(new URL('http://localhost/api/ops/v1/settlement-accounts?subjectId='+subjectId),principal);
 const result=await readOpsSettlementAccounts(client,principal,query);
 assert.equal(result.items[0].subjectId,subjectId);
 assert.equal(calls.find(([sql])=>sql.startsWith('SELECT 1 FROM org.role_grant'))[1][2],subjectId);
 const denied={query:async sql=>{if(sql.startsWith('SELECT 1 FROM org.role_grant'))return {rows:[],rowCount:0};throw Error('scope denial must occur before account read');}};
 await assert.rejects(()=>readOpsSettlementAccounts(denied,principal,query),{code:'NOT_FOUND'});
});

test('only a different natural person can activate a settlement rule',async()=>{
 const rule={...base},row={id:'55555555-5555-4555-8555-555555555555',version:1,state:'draft',rule,subject_id:rule.subjectId,direction:rule.direction,purpose:rule.purpose,currency:rule.currency,maker_person_id:'66666666-6666-4666-8666-666666666666'};
 const client={query:async sql=>{
  if(sql.startsWith('SELECT * FROM finance.settlement_rule WHERE'))return {rows:[row],rowCount:1};
  if(sql.startsWith("SELECT person_id FROM org.principal"))return {rows:[{person_id:row.maker_person_id}],rowCount:1};
  throw Error('unexpected query '+sql);
 }};
 await assert.rejects(()=>writeSettlement(client,principal,'settlement-rule-activate',row.id,{reason:'approved',evidenceFileIds:['77777777-7777-4777-8777-777777777777']},1),{code:'INDEPENDENT_RULE_APPROVAL_REQUIRED'});
});

test('statement approval excludes both the maker and reviewer',async()=>{
 const id='55555555-5555-4555-8555-555555555555',maker='66666666-6666-4666-8666-666666666666',reviewer='77777777-7777-4777-8777-777777777777';
 const row={id,version:2,internal_state:'reviewed',maker_person_id:maker};
 const client={query:async sql=>{
  if(sql.startsWith('SELECT * FROM finance.statement WHERE'))return {rows:[row],rowCount:1};
  if(sql.startsWith("SELECT person_id FROM org.principal"))return {rows:[{person_id:reviewer}],rowCount:1};
  if(sql.startsWith('SELECT action,person_id FROM finance.statement_event'))return {rows:[{action:'CREATED',person_id:maker},{action:'REVIEWED',person_id:reviewer}],rowCount:2};
  throw Error('unexpected query '+sql);
 }};
 await assert.rejects(()=>writeSettlement(client,principal,'statement-approve',id,{reason:'approved'},2),{code:'INDEPENDENT_APPROVAL_REQUIRED'});
});

test('customer acknowledgement cannot reveal or mutate another customer statement',async()=>{
 const id='55555555-5555-4555-8555-555555555555',customerId='66666666-6666-4666-8666-666666666666',otherCustomerId='77777777-7777-4777-8777-777777777777';
 const client={query:async sql=>{
  if(sql.startsWith('SELECT c.id FROM party.customer'))return {rows:[{id:customerId}],rowCount:1};
  if(sql.startsWith('SELECT * FROM finance.statement WHERE'))return {rows:[{id,subject_id:otherCustomerId,direction:'RECEIVABLE',internal_state:'issued',version:1,customer_state:'unseen'}],rowCount:1};
  if(sql.startsWith("SELECT person_id FROM org.principal"))return {rows:[{person_id:'88888888-8888-4888-8888-888888888888'}],rowCount:1};
  throw Error('unexpected query '+sql);
 }};
 await assert.rejects(()=>acknowledgeCustomerStatement(client,principal,id,{reason:'seen'},1),{code:'NOT_FOUND'});
});

test('customer refund reserves only its confirmed, unallocated receipt balance',async()=>{
 const receiptId='55555555-5555-4555-8555-555555555555',accountId='77777777-7777-4777-8777-777777777777',customerId='66666666-6666-4666-8666-666666666666',calls=[];
 const client={query:async(sql,params=[])=>{
  calls.push([sql,params]);
  if(sql.startsWith('SELECT c.id FROM party.customer'))return {rows:[{id:customerId}],rowCount:1};
  if(sql.startsWith('SELECT r.id,r.payer_subject_id'))return {rows:[{id:receiptId,payer_subject_id:customerId,money_amount_minor:1000,money_currency:'USD',confirmation:{recordedAt:'2026-01-01T00:00:00.000Z'}}],rowCount:1};
  if(sql.startsWith('SELECT * FROM finance.settlement_account'))return {rows:[{id:accountId,subject_id:customerId,version:3,state:'verified',bank_code:'ABA',last4:'1234',holder_display_name:'Customer'}],rowCount:1};
  if(sql.startsWith('SELECT COALESCE(sum(money_amount_minor)'))return {rows:[{total:'250'}],rowCount:1};
  if(sql.startsWith('SELECT person_id FROM org.principal'))return {rows:[{person_id:'88888888-8888-4888-8888-888888888888'}],rowCount:1};
  if(sql.startsWith('INSERT INTO finance.refund_request'))return {rows:[],rowCount:1};
  throw Error('unexpected query '+sql);
 }};
 const result=await requestCustomerRefund(client,principal,{kind:'REFUND',receiptId,receiptVersion:2,money:{amountMinor:750,currency:'USD'},accountId,accountVersion:3,reason:'cancelled before dispatch'});
 assert.equal(result.state,'submitted');assert.equal(result.money.amountMinor,750);assert.deepEqual(result.sourceIds,[receiptId]);
 const insert=calls.find(([sql])=>sql.startsWith('INSERT INTO finance.refund_request'));
 assert.equal(insert[1][3],receiptId);assert.equal(insert[1][4],null);assert.equal(insert[1][6],750);
 await assert.rejects(()=>requestCustomerRefund(client,principal,{kind:'REFUND',receiptId,receiptVersion:2,money:{amountMinor:751,currency:'USD'},accountId,accountVersion:3,reason:'over remaining'}),{code:'REFUND_AMOUNT_EXCEEDS_AVAILABLE'});
});

test('customer refund hides another customers receipt',async()=>{
 const receiptId='55555555-5555-4555-8555-555555555555',accountId='77777777-7777-4777-8777-777777777777',customerId='66666666-6666-4666-8666-666666666666';
 const client={query:async sql=>{
  if(sql.startsWith('SELECT c.id FROM party.customer'))return {rows:[{id:customerId}],rowCount:1};
  if(sql.startsWith('SELECT r.id,r.payer_subject_id'))return {rows:[{id:receiptId,payer_subject_id:'88888888-8888-4888-8888-888888888888',money_amount_minor:1000,money_currency:'USD',confirmation:{}}],rowCount:1};
  throw Error('another customer refund must stop before account or write access');
 }};
 await assert.rejects(()=>requestCustomerRefund(client,principal,{kind:'REFUND',receiptId,receiptVersion:2,money:{amountMinor:1,currency:'USD'},accountId,accountVersion:1,reason:'not mine'}),{code:'NOT_FOUND'});
});
