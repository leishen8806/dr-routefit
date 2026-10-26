import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const {token,csrf,origin}=JSON.parse(await readFile(new URL('../.local/client.json',import.meta.url),'utf8'));
const draft=JSON.parse(await readFile(new URL('../../../contracts/examples/order-draft.json',import.meta.url),'utf8'));
async function request(path,body,version,method=body?'POST':'GET'){
 const r=await fetch(origin+'/api/ops/v1'+path,{method,headers:{Cookie:'rf_session='+token,Origin:origin,'X-CSRF-Token':csrf,'Content-Type':'application/json','Idempotency-Key':randomUUID(),...(version?{'If-Match':`"${version}"`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const value=await r.json();assert.ok(r.ok,`${r.status}: ${value.error?.code}`);return value;
}
const customers=await request('/customers');assert.ok(customers.items.length,'No authorized synthetic customer; use a fresh bootstrap');
draft.customerId=customers.items[0].id;
const created=await request('/orders',draft),path='/orders/'+created.order.id;
assert.deepEqual((await request(path)).draft,draft);
const changed=await request(path,{...draft,notes:'Synthetic backend smoke edit'},created.order.version,'PATCH');
assert.equal(changed.order.version,2);assert.equal(changed.order.collectionState,'unpaid');assert.equal(changed.quoteId,null);
assert.equal((await request('/orders?customerId='+draft.customerId)).items.some(x=>x.id===created.order.id),true);
console.log('5 order/customer operations passed: authorized customer, create, read, edit, list. Draft only; no quote, payment or dispatch.');
