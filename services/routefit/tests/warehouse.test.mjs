import test from 'node:test';
import assert from 'node:assert/strict';
import {orderQuery} from '../adapters/orders.mjs';
import {readWarehouseQueue} from '../adapters/warehouse.mjs';

const companyId='11111111-1111-4111-8111-111111111111',principal={companyId,principalId:'22222222-2222-4222-8222-222222222222'},warehouseId='33333333-3333-4333-8333-333333333333',orderId='44444444-4444-4444-8444-444444444444';
test('warehouse queue exposes only active return work and accepts a warehouse filter',async()=>{
 const page=orderQuery(new URL(`http://localhost/api/ops/v1/warehouse/queue?warehouseId=${warehouseId}&limit=1`),'warehouse-queue',principal);
 assert.equal(page.filters.warehouseId,warehouseId);
 const client={query:async(sql,params)=>{
  if(sql.includes('FROM dispatch.return_task')){assert.match(sql,/state IN \('authorized','received','inspected'\)/);assert.deepEqual(params,[companyId,warehouseId,null,null,2]);return {rows:[{updated:'2026-10-25T00:00:00.000Z',snapshot:{order:{id:orderId,orderNo:'RT-1',version:3,state:'return_open',serviceLevel:'S1',fulfillmentStage:'delivery_recorded',customerId:'55555555-5555-4555-8555-555555555555',promiseId:null,updatedAt:'2026-10-25T00:00:00.000Z'}}}]};}
  if(sql.includes('finance.allocation_reversal'))return {rowCount:0,rows:[]};
  if(sql.includes('finance.prepayment_receipt'))return {rows:[{reported:'0'}]};
  throw Error('Unexpected query: '+sql);
 }};
 assert.deepEqual(await readWarehouseQueue(client,principal,page),{items:[{id:orderId,orderNo:'RT-1',version:3,state:'return_open',serviceLevel:'S1',fulfillmentStage:'delivery_recorded',customerId:'55555555-5555-4555-8555-555555555555',promiseId:null,updatedAt:'2026-10-25T00:00:00.000Z',collectionState:'unpaid'}],nextCursor:null});
});
test('warehouse queue rejects malformed filters',()=>{
 assert.throws(()=>orderQuery(new URL('http://localhost/api/ops/v1/warehouse/queue?warehouseId=bad'),'warehouse-queue',principal),{code:'INVALID_QUERY'});
 assert.throws(()=>orderQuery(new URL('http://localhost/api/ops/v1/warehouse/queue?state=return_open'),'warehouse-queue',principal),{code:'INVALID_QUERY'});
});
