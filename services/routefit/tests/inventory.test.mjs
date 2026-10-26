import test from 'node:test';
import assert from 'node:assert/strict';
import {createStockReservation,inventoryQuery,readCustomerInventory,writeStockReservation} from '../adapters/inventory.mjs';

const companyId='11111111-1111-4111-8111-111111111111',principal={companyId,principalId:'22222222-2222-4222-8222-222222222222'},customerId='33333333-3333-4333-8333-333333333333',warehouseId='44444444-4444-4444-8444-444444444444',requestId='55555555-5555-4555-8555-555555555555',inventoryId='66666666-6666-4666-8666-666666666666',reservationId='77777777-7777-4777-8777-777777777777',evidenceId='88888888-8888-4888-8888-888888888888',personId='99999999-9999-4999-8999-999999999999',skuId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const line={skuId,quantity:3,inventoryId,inventoryVersion:4};
const outboundRequest={id:requestId,owner_account_id:customerId,warehouse_id:warehouseId,type:'OUTBOUND_DELIVERY',state:'accepted',version:2,snapshot:{request:{lines:[{skuId,quantity:3}]}}};
const stock={id:inventoryId,owner_account_id:customerId,warehouse_id:warehouseId,sku_id:skuId,lot_ref:null,unit:'piece',book_qty:10,reserved_qty:2,quarantine_qty:1,source:'ROUTEFIT_WMS',observed_at:'2026-10-25T00:00:00.000Z',version:4};

test('inventory query rejects offset and malformed owner filters',()=>{
 const query=inventoryQuery(new URL('http://localhost/api/customer/v1/inventory?warehouseId='+warehouseId+'&limit=1'),principal);
 assert.equal(query.warehouseId,warehouseId);assert.throws(()=>inventoryQuery(new URL('http://localhost/api/customer/v1/inventory?offset=0'),principal),{code:'INVALID_QUERY'});assert.throws(()=>inventoryQuery(new URL('http://localhost/api/customer/v1/inventory?skuId=bad'),principal),{code:'INVALID_QUERY'});
});

test('customer inventory is scoped to the current customer and returns computed requestable quantity',async()=>{
 const query=inventoryQuery(new URL('http://localhost/api/customer/v1/inventory?limit=1'),principal);
 const client={query:async(sql,params)=>{
  if(sql.includes('FROM party.customer c JOIN party.customer_access'))return {rows:[{id:customerId}]};
  if(sql.includes('FROM warehouse.inventory_snapshot')){assert.deepEqual(params,[companyId,customerId,null,null,null,2]);return {rows:[stock]};}
  throw Error('Unexpected query: '+sql);
 }};
 const result=await readCustomerInventory(client,principal,query);
 assert.deepEqual(result.items[0].quantities,{bookQty:10,reservedQty:2,quarantineQty:1,requestableQty:7});assert.equal(result.items[0].ownerAccountId,customerId);assert.equal(result.nextCursor,null);
});

test('reservation locks matching accepted outbound stock and increments reserved quantity once',async()=>{
 const calls=[];
 const client={query:async(sql,params)=>{
  calls.push(sql);
  if(sql.includes('FROM warehouse.request'))return {rows:[outboundRequest]};
  if(sql.includes('FROM warehouse.inventory_snapshot WHERE'))return {rows:[stock]};
  if(sql.startsWith('INSERT INTO warehouse.stock_reservation('))return {rows:[]};
  if(sql.startsWith('UPDATE warehouse.inventory_snapshot SET reserved_qty')){assert.deepEqual(params,[companyId,inventoryId,3]);return {rows:[]};}
  if(sql.startsWith('INSERT INTO warehouse.stock_reservation_line'))return {rows:[]};
  if(sql.includes('SELECT person_id FROM org.principal'))return {rows:[{person_id:personId}]};
  if(sql.startsWith('INSERT INTO warehouse.stock_reservation_event'))return {rows:[]};
  throw Error('Unexpected query: '+sql);
 }};
 const result=await createStockReservation(client,principal,{warehouseRequestId:requestId,warehouseRequestVersion:2,lines:[line]});
 assert.equal(result.state,'confirmed');assert.equal(result.authority,'ROUTEFIT_WMS');assert.deepEqual(result.lines,[line]);assert.ok(calls.some(sql=>sql.includes('FOR UPDATE')));
});

test('reservation fails closed when requestable quantity is insufficient',async()=>{
 const client={query:async sql=>{
  if(sql.includes('FROM warehouse.request'))return {rows:[outboundRequest]};
  if(sql.includes('FROM warehouse.inventory_snapshot WHERE'))return {rows:[{...stock,book_qty:5,reserved_qty:2,quarantine_qty:1}]};
  throw Error('unexpected write');
 }};
 await assert.rejects(createStockReservation(client,principal,{warehouseRequestId:requestId,warehouseRequestVersion:2,lines:[line]}),{code:'INSUFFICIENT_STOCK'});
});

test('consuming a reservation requires request evidence and decrements booked plus reserved stock',async()=>{
 const reservation={id:reservationId,warehouse_request_id:requestId,authority:'ROUTEFIT_WMS',state:'confirmed',version:1,snapshot:{id:reservationId,version:1,state:'confirmed',warehouseRequestId:requestId,lines:[line],authority:'ROUTEFIT_WMS'}};
 const calls=[];
 const client={query:async(sql,params)=>{
  calls.push(sql);
  if(sql.includes('FROM warehouse.stock_reservation WHERE'))return {rows:[reservation]};
  if(sql.includes('FROM evidence.file')){assert.deepEqual(params,[companyId,[evidenceId],requestId]);return {rows:[{count:1}]};}
  if(sql.includes('FROM warehouse.stock_reservation_line'))return {rows:[{inventory_id:inventoryId,quantity:3}]};
  if(sql.includes('FROM warehouse.inventory_snapshot WHERE'))return {rows:[{...stock,reserved_qty:5}]};
  if(sql.startsWith('UPDATE warehouse.inventory_snapshot SET book_qty')){assert.deepEqual(params,[companyId,inventoryId,3]);return {rows:[]};}
  if(sql.startsWith('UPDATE warehouse.stock_reservation SET'))return {rows:[]};
  if(sql.includes('SELECT person_id FROM org.principal'))return {rows:[{person_id:personId}]};
  if(sql.startsWith('INSERT INTO warehouse.stock_reservation_event'))return {rows:[]};
  throw Error('Unexpected query: '+sql);
 }};
 const result=await writeStockReservation(client,principal,'consume',reservationId,{reason:'出库交接已确认',evidenceFileIds:[evidenceId]},1);
 assert.equal(result.state,'consumed');assert.equal(result.version,2);assert.ok(calls.some(sql=>sql.includes('book_qty=book_qty-$3,reserved_qty=reserved_qty-$3')));
});
