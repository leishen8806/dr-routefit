import test from 'node:test';
import assert from 'node:assert/strict';
import {readFinanceTasks,taskQuery,writeFinanceTask} from '../adapters/finance.mjs';

const companyId='11111111-1111-4111-8111-111111111111',principal={companyId,principalId:'22222222-2222-4222-8222-222222222222'},subjectId='33333333-3333-4333-8333-333333333333',receiptId='44444444-4444-4444-8444-444444444444';
test('finance tasks only projects pending financial review facts',async()=>{
 const query=taskQuery(new URL(`http://localhost/api/ops/v1/finance/tasks?type=RECEIPT_REVIEW&currency=USD&subjectId=${subjectId}`),principal);
 const client={query:async(sql,params)=>{if(sql.startsWith('WITH tasks')){assert.match(sql,/finance\.prepayment_receipt/);assert.match(sql,/finance\.amendment_adjustment/);assert.deepEqual(params,[companyId,'RECEIPT_REVIEW','USD',subjectId,null,null,null,51]);return {rows:[{id:receiptId,version:'1',type:'RECEIPT_REVIEW',subject_id:subjectId,source_id:receiptId,money:{amountMinor:1200,currency:'USD'},owner_id:null,due_at:'2026-10-25T00:00:00.000Z',next_action:'核对银行交易、金额、币种和收款账户'}]};}if(sql.startsWith('SELECT read_at FROM finance.task_read'))return {rows:[]};throw Error('Unexpected query');}};
 assert.deepEqual(await readFinanceTasks(client,principal,query),{items:[{id:receiptId,version:1,type:'RECEIPT_REVIEW',subjectId,sourceId:receiptId,money:{amountMinor:1200,currency:'USD'},ownerId:null,dueAt:'2026-10-25T00:00:00.000Z',state:'open',readAt:null,nextAction:'核对银行交易、金额、币种和收款账户'}],nextCursor:null});
});
test('finance task filters fail closed',()=>{
 assert.throws(()=>taskQuery(new URL('http://localhost/api/ops/v1/finance/tasks?type=UNKNOWN'),principal),{code:'INVALID_QUERY'});
 assert.throws(()=>taskQuery(new URL('http://localhost/api/ops/v1/finance/tasks?currency=EUR'),principal),{code:'INVALID_QUERY'});
 assert.throws(()=>taskQuery(new URL('http://localhost/api/ops/v1/finance/tasks?subjectId=bad'),principal),{code:'INVALID_QUERY'});
});
test('marking a finance task read leaves the business task open',async()=>{
 const taskRow={id:receiptId,version:'1',type:'RECEIPT_REVIEW',subject_id:subjectId,source_id:receiptId,money:{amountMinor:1200,currency:'USD'},owner_id:null,due_at:'2026-10-25T00:00:00.000Z',next_action:'核对银行交易、金额、币种和收款账户'},readAt='2026-10-25T01:00:00.000Z';let inserted=false;
 const client={query:async(sql,params)=>{if(sql.startsWith('WITH tasks')){assert.deepEqual(params,[companyId,null,null,null,receiptId,null,null,2]);return {rows:[taskRow]};}if(sql.startsWith('SELECT read_at FROM finance.task_read'))return {rows:inserted?[{read_at:readAt}]:[]};if(sql.startsWith('INSERT INTO finance.task_read')){inserted=true;return {rowCount:1,rows:[]};}throw Error('Unexpected query');}};
 const result=await writeFinanceTask(client,principal,'task-read',receiptId,1);
 assert.equal(result.state,'open');assert.equal(result.version,2);assert.equal(result.readAt,readAt);
});
test('holding an outstanding receivable keeps its ledger untouched and reopens after the deadline',async()=>{
 const evidenceId='55555555-5555-4555-8555-555555555555',personId='66666666-6666-4666-8666-666666666666',until=new Date(Date.now()+600000).toISOString(),row={id:receiptId,version:'1',type:'COLLECT',subject_id:subjectId,source_id:receiptId,money:{amountMinor:1200,currency:'USD'},owner_id:null,due_at:'2026-10-25T00:00:00.000Z',next_action:'客户尚有费用未结；按账期跟进收款'};let held=false;
 const client={query:async(sql,params=[])=>{
  if(sql.startsWith('WITH tasks')){assert.match(sql,/finance\.task_hold_event/);return {rows:[held?{...row,hold_version:'1',until_at:until}:{...row,hold_version:null,until_at:null}]};}
  if(sql.startsWith('SELECT read_at FROM finance.task_read'))return {rows:[]};
  if(sql.startsWith('SELECT order_id FROM finance.ledger_item'))return {rows:[{order_id:'77777777-7777-4777-8777-777777777777'}]};
  if(sql.startsWith('SELECT count(*)::integer AS count FROM evidence.file'))return {rows:[{count:1}]};
  if(sql.startsWith('SELECT pg_advisory_xact_lock'))return {rows:[]};
  if(sql.startsWith('SELECT COALESCE(max(version),0)'))return {rows:[{version:'0'}]};
  if(sql.startsWith('SELECT person_id FROM org.principal'))return {rows:[{person_id:personId}]};
  if(sql.startsWith('INSERT INTO finance.task_hold_event')){held=true;assert.equal(params[2],1);assert.equal(params[4],'客户已确认下周付款');return {rows:[]};}
  throw Error('Unexpected query '+sql);
 }};
 const result=await writeFinanceTask(client,principal,'task-hold',receiptId,1,{reason:'客户已确认下周付款',until,evidenceFileIds:[evidenceId]});
 assert.equal(result.state,'held');assert.equal(result.version,2);assert.match(result.nextAction,/暂缓至/);
});
