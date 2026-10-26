import test from 'node:test';
import assert from 'node:assert/strict';
import {cashHandoverQuery,writeCashCount,writeDriverCashReport,writeDriverHandover} from '../adapters/cash.mjs';

const companyId='11111111-1111-4111-8111-111111111111',driverId='22222222-2222-4222-8222-222222222222',staffId='33333333-3333-4333-8333-333333333333',personId='44444444-4444-4444-8444-444444444444',staffPersonId='55555555-5555-4555-8555-555555555555',orderId='66666666-6666-4666-8666-666666666666',receiptId='77777777-7777-4777-8777-777777777777',evidenceId='88888888-8888-4888-888888888888',handoverId='99999999-9999-4999-8999-999999999999';
const driver={companyId,principalId:driverId},staff={companyId,principalId:staffId};
const report={orderId,orderVersion:3,deliveryAmountMinor:100,insuranceAmountMinor:20,codAmountMinor:0,currency:'USD',cashVoucherRef:'cash-1',evidenceFileIds:[evidenceId],observedAt:'2026-01-01T00:00:00.000Z'};

test('driver cash report creates one driver-custody fact with delivery and insurance kept separate',async()=>{
 const calls=[],client={query:async(sql,params)=>{calls.push(sql);
  if(sql.includes('FROM org.principal'))return {rows:[{kind:'DRIVER',person_id:personId}],rowCount:1};
  if(sql.includes('FROM orders.draft'))return {rows:[{snapshot:{order:{id:orderId,version:3,customerId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}}}],rowCount:1};
  if(sql.includes('FROM dispatch.assignment'))return {rows:[{}],rowCount:1};
  if(sql.includes('FROM evidence.file'))return {rows:[{count:1}],rowCount:1};
  if(sql.includes('pg_advisory_xact_lock'))return {rows:[],rowCount:1};
  if(sql.includes('FROM finance.ledger_item'))return {rows:[{quote_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',fee_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',snapshot:{purpose:'DELIVERY',currency:'USD',originalMinor:100}},{quote_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',fee_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',snapshot:{purpose:'INSURANCE',currency:'USD',originalMinor:20}}],rowCount:2};
  if(sql.includes('FROM finance.prepayment_allocation'))return {rows:[{total:'0'}],rowCount:1};
  if(sql.includes("r.custody_type='DRIVER'"))return {rows:[],rowCount:0};
  if(sql.includes('INSERT INTO finance.receipt'))return {rows:[],rowCount:1};
  throw Error('Unexpected query: '+sql);
 }};
 const result=await writeDriverCashReport(client,driver,report);
 assert.equal(result.state,'reported');assert.equal(result.custodyType,'DRIVER');assert.equal(result.money.amountMinor,120);assert.equal(result.unallocatedMinor,0);
 assert.ok(calls.some(sql=>sql.includes('INSERT INTO finance.receipt_order')));assert.ok(calls.some(sql=>sql.includes('INSERT INTO finance.receipt_evidence')));
 await assert.rejects(()=>writeDriverCashReport(client,driver,{...report,codAmountMinor:1,cashVoucherRef:'cash-2'}),{code:'COD_NOT_CONFIGURED'});
 await assert.rejects(()=>writeDriverCashReport(client,driver,{...report,deliveryAmountMinor:9000000000000,insuranceAmountMinor:1,cashVoucherRef:'cash-3'}),{code:'CASH_AMOUNT_OUT_OF_RANGE'});
 await assert.rejects(()=>writeDriverCashReport(client,driver,{...report,deliveryAmountMinor:-1,cashVoucherRef:'cash-4'}),{code:'CASH_AMOUNT_OUT_OF_RANGE'});
});

test('driver handover consumes confirmed driver cash without a second receipt',async()=>{
 const calls=[],client={query:async(sql)=>{calls.push(sql);
  if(sql.includes('FROM org.principal'))return {rows:[{kind:'DRIVER',person_id:personId}],rowCount:1};
  if(sql.includes('JOIN finance.receipt_confirmation'))return {rows:[{id:receiptId,snapshot:{money:{amountMinor:120,currency:'USD'}}}],rowCount:1};
  if(sql.includes('FROM finance.cash_handover_line l'))return {rows:[{total:'0'}],rowCount:1};
  if(sql.includes('SELECT DISTINCT order_id'))return {rows:[{order_id:orderId}],rowCount:1};
  if(sql.includes('FROM evidence.file'))return {rows:[{count:1}],rowCount:1};
  if(sql.includes('INSERT INTO finance.cash_handover'))return {rows:[],rowCount:1};
  throw Error('Unexpected query: '+sql);
 }};
 const result=await writeDriverHandover(client,driver,{currency:'USD',items:[{receiptId,receiptVersion:2,amountMinor:120}],evidenceFileIds:[evidenceId]});
 assert.equal(result.state,'submitted');assert.equal(result.declared.amountMinor,120);assert.equal(calls.some(sql=>sql.includes('INSERT INTO finance.receipt(')),false);
});

test('cash count records a shortage without modifying the original customer receipt',async()=>{
 const snapshot={id:handoverId,version:1,driverSubjectId:driverId,declared:{amountMinor:120,currency:'USD'},counted:null,differenceMinor:null,differenceDirection:'UNKNOWN',state:'submitted',reviewDocumentId:null};
 const calls=[],client={query:async(sql)=>{calls.push(sql);
  if(sql.includes('FROM org.principal'))return {rows:[{kind:'STAFF',person_id:staffPersonId}],rowCount:1};
  if(sql.includes('FROM finance.cash_handover WHERE'))return {rows:[{id:handoverId,driver_person_id:personId,currency:'USD',declared_amount_minor:120,state:'submitted',version:1,snapshot}],rowCount:1};
  if(sql.includes('SELECT receipt_id FROM finance.cash_handover_line'))return {rows:[{receipt_id:receiptId}],rowCount:1};
  if(sql.includes('SELECT DISTINCT order_id'))return {rows:[{order_id:orderId}],rowCount:1};
  if(sql.includes('FROM evidence.file'))return {rows:[{count:1}],rowCount:1};
  if(sql.includes('INSERT INTO finance.cash_handover_count'))return {rows:[],rowCount:1};
  if(sql.includes('UPDATE finance.cash_handover'))return {rows:[],rowCount:1};
  throw Error('Unexpected query: '+sql);
 }};
 const result=await writeCashCount(client,staff,handoverId,{actual:{amountMinor:110,currency:'USD'},evidenceFileIds:[evidenceId],reason:'counted cash'},1);
 assert.deepEqual([result.state,result.differenceDirection,result.differenceMinor],['disputed','SHORT',10]);assert.equal(calls.some(sql=>sql.includes('finance.receipt')&&sql.includes('INSERT')),false);
});

test('cash handover cursors are scope-bound and reject offset-like query parameters',()=>{
 const page=cashHandoverQuery(new URL('http://localhost/api/driver/v1/cash-handovers?limit=2'),driver,'driver');assert.equal(page.limit,2);
 assert.throws(()=>cashHandoverQuery(new URL('http://localhost/api/driver/v1/cash-handovers?offset=1'),driver,'driver'),{code:'INVALID_QUERY'});
 assert.throws(()=>cashHandoverQuery(new URL('http://localhost/api/driver/v1/cash-handovers?cursor=bad'),driver,'driver'),{code:'INVALID_CURSOR'});
});
