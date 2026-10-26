import test from 'node:test';
import assert from 'node:assert/strict';
import {readOpsSnapshot} from '../adapters/integration.mjs';

test('ops snapshot exposes current aggregate facts and labels unavailable inventory',async()=>{
 const observedAt=new Date('2026-10-25T00:00:00.000Z'),client={query:async(sql,params)=>{assert.match(sql,/orders\.draft/);assert.deepEqual(params,['11111111-1111-4111-8111-111111111111']);return {rows:[{observed_at:observedAt,orders:'3',vehicles:'2',exceptions:'1'}]};}};
 const snapshot=await readOpsSnapshot(client,{companyId:'11111111-1111-4111-8111-111111111111'});
 assert.deepEqual(snapshot,{schemaVersion:'1.0.0',generatedAt:observedAt.toISOString(),orders:{mode:'live',quality:'fresh',value:3,observedAt:observedAt.toISOString(),unknownReason:null},vehicles:{mode:'live',quality:'fresh',value:2,observedAt:observedAt.toISOString(),unknownReason:null},exceptions:{mode:'live',quality:'fresh',value:1,observedAt:observedAt.toISOString(),unknownReason:null},inventory:{mode:'unavailable',quality:'unavailable',value:null,observedAt:null,unknownReason:'WAREHOUSE_INVENTORY_NOT_INTEGRATED'}});
});
