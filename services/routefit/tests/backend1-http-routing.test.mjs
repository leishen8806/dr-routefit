import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {apiServer} from '../application/http.mjs';

test('Backend1 contract routes are registered before request handling', async t => {
 const server=apiServer({
  pool:null,
  authenticate:()=>({companyId:'00000000-0000-0000-0000-000000000001',principalId:'00000000-0000-0000-0000-000000000002',permissions:['pricing:read','pricing:write','marketing:coupon:read','marketing:coupon:write','customer:order:write','merchant:contract:read','merchant:contract:write','merchant:catalog:read','merchant:catalog:write','user:freeze:write']})
 });
 t.after(()=>server.close());
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 const response=await fetch(`http://127.0.0.1:${server.address().port}/api/ops/v1/coupons/batches`);
 assert.equal(response.status,405);
 assert.equal((await response.json()).error.code,'METHOD_NOT_ALLOWED');
});

test('Backend1 writes cannot fall through to unrelated order handling before repositories exist', async t => {
 const client={query:async sql=>sql.startsWith('SELECT p.id')?{rowCount:1,rows:[]}:{rowCount:0,rows:[]},release:()=>{}};
 const server=apiServer({
  pool:{connect:async()=>client},
  authenticate:()=>({companyId:'00000000-0000-0000-0000-000000000001',principalId:'00000000-0000-0000-0000-000000000002',permissions:['marketing:coupon:write']})
 });
 t.after(()=>server.close());
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 const response=await fetch(`http://127.0.0.1:${server.address().port}/api/ops/v1/coupons/batches`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':'backend1-routing-test-key'},body:JSON.stringify({code:'DEMO',discountType:'fixed',amountMinor:100,currency:'USD',budgetMinor:1000,startsAt:'2026-11-10T00:00:00Z',endsAt:'2026-11-11T00:00:00Z'})});
 assert.equal(response.status,501);
 assert.equal((await response.json()).error.code,'BACKEND1_REPOSITORY_PENDING');
});
