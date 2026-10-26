import test from 'node:test';
import assert from 'node:assert/strict';
import {writeReturn} from '../adapters/returns.mjs';

const companyId='11111111-1111-4111-8111-111111111111',principalId='22222222-2222-4222-8222-222222222222',personId='33333333-3333-4333-8333-333333333333',taskId='44444444-4444-4444-8444-444444444444',orderId='55555555-5555-4555-8555-555555555555',warehouseId='66666666-6666-4666-8666-666666666666',evidenceId='77777777-7777-4777-8777-777777777777',packageOne='88888888-8888-4888-8888-888888888888',packageTwo='99999999-9999-4999-8999-999999999999';
const principal={companyId,principalId};
function client(row){const calls=[];return {calls,query:async(sql,params)=>{calls.push({sql,params});if(sql.startsWith("SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2 AND kind='STAFF'"))return {rows:[{person_id:personId}]};if(sql.startsWith('SELECT * FROM dispatch.return_task'))return {rows:[row]};if(sql.startsWith('SELECT count(*)::integer AS count FROM evidence.file'))return {rows:[{count:params[1].length}]};return {rows:[],rowCount:1};}};}
test('return receipt partitions every task package and preserves missing discrepancy',async()=>{
 const c=client({id:taskId,order_id:orderId,warehouse_id:warehouseId,state:'authorized',version:2,discrepancy_open:false,snapshot:{packageIds:[packageOne,packageTwo]}});
 const result=await writeReturn(c,principal,'receive',taskId,{receivedPackageIds:[packageOne],missingPackageIds:[packageTwo],evidenceFileIds:[evidenceId]},2);
 assert.deepEqual(result,{id:taskId,version:3,orderId,warehouseId,state:'received',packageIds:[packageOne,packageTwo],discrepancyOpen:true});
 assert.equal(c.calls.find(call=>call.sql.startsWith('UPDATE dispatch.return_task')).params[3],true);
});
test('return inspection accepts exactly the received packages',async()=>{
 const c=client({id:taskId,order_id:orderId,warehouse_id:warehouseId,state:'received',version:3,discrepancy_open:false,snapshot:{packageIds:[packageOne],receivedPackageIds:[packageOne]}});
 const result=await writeReturn(c,principal,'inspect',taskId,{packageIds:[packageOne],disposition:'QUARANTINE',reason:'DEMO inspection',evidenceFileIds:[evidenceId]},3);
 assert.deepEqual(result,{id:taskId,version:4,orderId,warehouseId,state:'inspected',packageIds:[packageOne],discrepancyOpen:false});
 await assert.rejects(writeReturn(client({id:taskId,order_id:orderId,warehouse_id:warehouseId,state:'received',version:3,discrepancy_open:false,snapshot:{packageIds:[packageOne],receivedPackageIds:[packageOne]}}),principal,'inspect',taskId,{packageIds:[packageTwo],disposition:'QUARANTINE',reason:'DEMO inspection',evidenceFileIds:[evidenceId]},3),error=>error.code==='RETURN_INSPECTION_PACKAGES_INVALID');
});
test('return close requires inspection without an open discrepancy',async()=>{
 const input={reason:'DEMO return closure',evidenceFileIds:[evidenceId]};
 const c=client({id:taskId,order_id:orderId,warehouse_id:warehouseId,state:'inspected',version:4,discrepancy_open:false,snapshot:{packageIds:[packageOne]}});
 const result=await writeReturn(c,principal,'close',taskId,input,4);
 assert.deepEqual(result,{id:taskId,version:5,orderId,warehouseId,state:'closed',packageIds:[packageOne],discrepancyOpen:false});
 await assert.rejects(writeReturn(client({id:taskId,order_id:orderId,warehouse_id:warehouseId,state:'inspected',version:4,discrepancy_open:true,snapshot:{packageIds:[packageOne]}}),principal,'close',taskId,input,4),error=>error.code==='RETURN_DISCREPANCY_OPEN');
});
