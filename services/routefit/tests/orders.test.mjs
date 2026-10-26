import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateOrderDraft,orderDetail} from '../domain/orders.mjs';
import {orderRoutes} from '../application/orders.mjs';
import {specification,validate} from '../adapters/contract.mjs';
const draft=JSON.parse(readFileSync(new URL('../../../contracts/examples/order-draft.json',import.meta.url),'utf8'));
test('implemented order routes match contract, permissions and round-trip input',()=>{
 for(const r of orderRoutes){const op=Object.values(specification.paths).flatMap(Object.values).find(x=>x.operationId===r.operation);assert.equal(op['x-implementation-status'],'LOCAL_IMPLEMENTED_NOT_DEPLOYED');assert.deepEqual(op['x-permissions'],[r.permission]);}
 validateOrderDraft(draft);const first=orderDetail(draft);validate('OrderDetail',first);assert.deepEqual(first.draft,draft);
 const second=orderDetail({...draft,notes:'Changed'},first);assert.deepEqual(second.items,first.items);assert.equal(second.order.version,2);
});
test('draft unknown measurements and package bounds fail closed',()=>{
 assert.throws(()=>validateOrderDraft({...draft,items:[{...draft.items[0],lengthCm:null}]}),{code:'MEASUREMENT_REASON_REQUIRED'});
 assert.throws(()=>validateOrderDraft({...draft,items:[{...draft.items[0],quantity:1000},{...draft.items[0],clientItemId:'box-2'}]}),{code:'PACKAGE_LIMIT'});
});
