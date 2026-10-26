import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {developmentServiceAuth,digest} from '../adapters/development-auth.mjs';
import {importExternalOrder,writeWmsStockEvent} from '../adapters/service-intake.mjs';

const companyId='11111111-1111-4111-8111-111111111111',principalId='22222222-2222-4222-8222-222222222222',warehouseId='33333333-3333-4333-8333-333333333333',customerId='44444444-4444-4444-8444-444444444444',skuId='55555555-5555-4555-8555-555555555555';
const principal={companyId,principalId};
const stock={externalEventId:'wms-event-1',warehouseId,ownerAccountId:customerId,skuId,lotRef:null,unit:'piece',quantities:{bookQty:12,reservedQty:2,quarantineQty:1,requestableQty:9},sourceVersion:1,observedAt:new Date(Date.now()-1000).toISOString()};
const imported={externalOrderId:'source-order-1',externalRevision:1,pickup:{address:'Pickup',contactName:'Sender',phone:'+85510000001'},delivery:{address:'Delivery',contactName:'Recipient',phone:'+85510000002'},items:[{clientItemId:'cargo-1',name:'Box',quantity:1,lengthCm:10,widthCm:10,heightCm:10,weightKg:1,rotationAllowed:true,stackable:true,uprightOnly:true,restrictions:[],measurementEvidenceIds:[]}],requestedPickupWindow:{start:'2026-10-26T01:00:00.000Z',end:'2026-10-26T02:00:00.000Z'},requestedDeliveryWindow:{start:'2026-10-26T02:00:00.000Z',end:'2026-10-26T03:00:00.000Z'},serviceLevel:'S1',deliveryPrice:{amountMinor:100,currency:'USD'},insurancePrice:{amountMinor:10,currency:'USD'},sourcePlatform:'Demo marketplace'};

test('development service authentication accepts bearer only and rejects browser credentials',()=>{
 const token=randomBytes(32).toString('hex'),auth=developmentServiceAuth([{authType:'service',companyId,principalId,tokenHash:digest(token),expiresAt:new Date(Date.now()+60000).toISOString(),permissions:['warehouse:orders:create']}]);
 assert.equal(auth({headers:{authorization:'Bearer '+token}}).principalId,principalId);
 assert.throws(()=>auth({headers:{cookie:'rf_session=x',authorization:'Bearer '+token}}),{code:'SERVICE_TOKEN_REQUIRED'});
 assert.throws(()=>auth({headers:{}}),{code:'SERVICE_TOKEN_REQUIRED'});
});

test('WMS stock event refuses an out-of-scope warehouse before it reads or writes inventory',async()=>{
 let calls=0;const client={query:async sql=>{calls++;if(sql.includes('FROM integration.service_binding'))return {rows:[{channel:'WAREHOUSE',source_system:'demo-wms',warehouse_id:warehouseId,customer_id:customerId}]};throw Error('unexpected query');}};
 await assert.rejects(()=>writeWmsStockEvent(client,principal,{...stock,warehouseId:'66666666-6666-4666-8666-666666666666'}),{code:'NOT_FOUND'});assert.equal(calls,1);
});

test('WMS source event ID cannot be reused with different contents',async()=>{
 let calls=0;const client={query:async sql=>{calls++;if(sql.includes('FROM integration.service_binding'))return {rows:[{channel:'WAREHOUSE',source_system:'demo-wms',warehouse_id:warehouseId,customer_id:customerId}]};if(sql.includes('FROM integration.wms_stock_event'))return {rows:[{content_hash:'0'.repeat(64),inventory_id:'77777777-7777-4777-8777-777777777777'}]};throw Error('unexpected query');}};
 await assert.rejects(()=>writeWmsStockEvent(client,principal,stock),{code:'EXTERNAL_EVENT_CONFLICT'});assert.equal(calls,2);
});

test('external order import creates only a pending review draft and preserves separate source prices',async()=>{
 const seen=[];const client={query:async(sql,params=[])=>{seen.push({sql,params});if(sql.includes('FROM integration.external_intake i JOIN orders.draft'))return {rows:[]};if(sql.includes('SELECT c.id FROM party.customer c WHERE'))return {rowCount:1,rows:[{id:customerId}]};if(sql.includes('FROM integration.service_binding'))return {rows:[{channel:'EXTERNAL',source_system:'demo-marketplace',customer_id:customerId}]};return {rowCount:1,rows:[]};}};
 const result=await importExternalOrder(client,principal,'EXTERNAL',imported);
 assert.equal(result.state,'pending_review');assert.equal(result.duplicate,false);assert.equal(seen.some(x=>/finance\.|pricing\.order_quote|dispatch\./.test(x.sql)),false);
 const intake=seen.find(x=>x.sql.startsWith('INSERT INTO integration.external_intake'));
 assert.deepEqual(intake.params.at(-1).sourcePricing,{deliveryPrice:imported.deliveryPrice,insurancePrice:imported.insurancePrice});
});
