import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptWarehouseRequest,createCustomerWarehouseRequest,readCustomerWarehouseRequests,warehouseRequestQuery} from '../adapters/warehouse.mjs';

const companyId='11111111-1111-4111-8111-111111111111',principal={companyId,principalId:'22222222-2222-4222-8222-222222222222'},customerId='33333333-3333-4333-8333-333333333333',warehouseId='44444444-4444-4444-8444-444444444444',requestId='55555555-5555-4555-8555-555555555555',evidenceId='66666666-6666-4666-8666-666666666666',personId='77777777-7777-4777-8777-777777777777';
const inbound={warehouseId,expectedWindow:{start:'2026-10-25T00:00:00.000Z',end:'2026-10-25T01:00:00.000Z'},lines:[{skuId:'SKU-1',quantity:1}],packingEvidenceFileIds:[]};
const current={id:requestId,company_id:companyId,owner_account_id:customerId,warehouse_id:warehouseId,type:'INBOUND_NOTICE',state:'submitted',version:1,snapshot:{id:requestId,version:1,type:'INBOUND_NOTICE',ownerAccountId:customerId,warehouseId,state:'submitted',relatedOrderId:null,createdAt:'2026-10-25T00:00:00.000Z',nextAction:'等待仓库受理；预报不等于实收库存'},created_at:'2026-10-25T00:00:00.000Z'};

test('warehouse request query binds cursor to scope and rejects unknown parameters',()=>{
 const page=warehouseRequestQuery(new URL('http://localhost/api/customer/v1/inbound-notices?limit=2'),principal,'customer','INBOUND_NOTICE');
 assert.equal(page.limit,2);assert.throws(()=>warehouseRequestQuery(new URL('http://localhost/api/customer/v1/inbound-notices?ownerAccountId='+customerId),principal,'customer','INBOUND_NOTICE'),{code:'INVALID_QUERY'});
});

test('customer warehouse request records an application but never changes stock',async()=>{
 const calls=[];
 const client={query:async(sql,params)=>{
  calls.push(sql);
  if(sql.includes('FROM party.customer c JOIN party.customer_access'))return {rows:[{id:customerId}]};
  if(sql.includes('FROM warehouse.site'))return {rows:[{id:warehouseId}]};
  if(sql.startsWith('INSERT INTO warehouse.request(')){assert.equal(params[4],'INBOUND_NOTICE');assert.equal(params[5],'submitted');return {rows:[]};}
  if(sql.includes('SELECT person_id FROM org.principal'))return {rows:[{person_id:personId}]};
  if(sql.startsWith('INSERT INTO warehouse.request_event'))return {rows:[]};
  throw Error('Unexpected query: '+sql);
 }};
 const result=await createCustomerWarehouseRequest(client,principal,'INBOUND_NOTICE',inbound);
 assert.equal(result.state,'submitted');assert.equal(result.version,1);assert.equal(result.ownerAccountId,customerId);assert.match(result.nextAction,/不等于实收库存/);
 assert.ok(calls.every(sql=>!sql.toLowerCase().includes('inventory')&&!sql.toLowerCase().includes('stock')));
});

test('warehouse request rejects duplicate SKU before it can create an application',async()=>{
 const client={query:async sql=>{
  if(sql.includes('FROM party.customer c JOIN party.customer_access'))return {rows:[{id:customerId}]};
  if(sql.includes('FROM warehouse.site'))return {rows:[{id:warehouseId}]};
  throw Error('unexpected write');
 }};
 await assert.rejects(createCustomerWarehouseRequest(client,principal,'INBOUND_NOTICE',{...inbound,lines:[...inbound.lines,{skuId:'SKU-1',quantity:2}]}),{code:'DUPLICATE_SKU'});
});

test('customer cannot read another warehouse request',async()=>{
 const page=warehouseRequestQuery(new URL('http://localhost/api/customer/v1/inbound-notices/'+requestId),principal,'customer','INBOUND_NOTICE');
 const client={query:async sql=>{
  if(sql.includes('FROM party.customer c JOIN party.customer_access'))return {rows:[{id:customerId}]};
  if(sql.includes('FROM warehouse.request'))return {rows:[]};
  throw Error('Unexpected query: '+sql);
 }};
 await assert.rejects(readCustomerWarehouseRequests(client,principal,'INBOUND_NOTICE',requestId,page),{code:'NOT_FOUND'});
});

test('warehouse acceptance requires request-scoped evidence and does not reserve stock',async()=>{
 const calls=[];
 const client={query:async(sql,params)=>{
  calls.push(sql);
  if(sql.includes('SELECT * FROM warehouse.request'))return {rows:[current]};
  if(sql.includes('FROM warehouse.site'))return {rows:[{id:warehouseId}]};
  if(sql.includes('FROM evidence.file')){assert.deepEqual(params,[companyId,[evidenceId],requestId]);return {rows:[{count:1}]};}
  if(sql.startsWith('UPDATE warehouse.request SET'))return {rows:[]};
  if(sql.includes('SELECT person_id FROM org.principal'))return {rows:[{person_id:personId}]};
  if(sql.startsWith('INSERT INTO warehouse.request_event'))return {rows:[]};
  if(sql.startsWith('INSERT INTO warehouse.request_evidence'))return {rows:[]};
  throw Error('Unexpected query: '+sql);
 }};
 const result=await acceptWarehouseRequest(client,principal,'INBOUND_NOTICE',requestId,{reason:'仓库窗口已确认',evidenceFileIds:[evidenceId]},1);
 assert.deepEqual({state:result.state,version:result.version,relatedOrderId:result.relatedOrderId},{state:'accepted',version:2,relatedOrderId:null});
 assert.match(result.nextAction,/等待实际交接/);assert.ok(calls.every(sql=>!sql.toLowerCase().includes('inventory')&&!sql.toLowerCase().includes('reservation')));
});
