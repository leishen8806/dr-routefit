import test from 'node:test';
import assert from 'node:assert/strict';
import {writeNotification} from '../adapters/notifications.mjs';

const companyId='11111111-1111-4111-8111-111111111111',principalId='22222222-2222-4222-8222-222222222222',subjectId='33333333-3333-4333-8333-333333333333',orderId='44444444-4444-4444-8444-444444444444',templateId='55555555-5555-4555-8555-555555555555';
const principal={companyId,principalId},request={templateId,subjectId,resourceType:'ORDER',resourceId:orderId,resourceVersion:3,channel:'IN_APP',reason:'订单状态更新'};
function client(){let message=null;return {query:async(sql,params=[])=>{
 if(sql.includes("SELECT person_id FROM org.principal"))return {rows:[{person_id:'66666666-6666-4666-8666-666666666666'}],rowCount:1};
 if(sql.includes('SELECT customer_id,version FROM orders.draft'))return {rows:[{customer_id:subjectId,version:3}],rowCount:1};
 if(sql.includes("FROM notification.template"))return {rows:[{id:templateId}],rowCount:1};
 if(sql.includes('SELECT * FROM notification.message WHERE company_id=$1 AND subject_id'))return {rows:message?[message]:[],rowCount:message?1:0};
 if(sql.includes('SELECT * FROM notification.message WHERE company_id=$1 AND id=$2'))return {rows:message?[message]:[],rowCount:message?1:0};
 if(sql.includes('INSERT INTO notification.message')){message={id:params[0],version:params[9],state:params[8],resource_id:params[4],failure_code:null,snapshot:params[11]};return {rows:[],rowCount:1};}
 if(sql.includes('UPDATE notification.message SET state=')){message={...message,state:params[2],version:params[3],failure_code:null,snapshot:params[4]};return {rows:[],rowCount:1};}
 return {rows:[],rowCount:0};
}};}
test('notification queues an approved order template and merges the same business delivery',async()=>{
 const db=client(),first=await writeNotification(db,principal,'create',null,request,null);assert.equal(first.state,'queued');assert.equal(first.resourceId,orderId);assert.equal(first.failureCode,null);
 const merged=await writeNotification(db,principal,'create',null,request,null);assert.deepEqual(merged,first);
});
test('notification retry only returns a recorded failure to the durable queue',async()=>{
 const db=client(),first=await writeNotification(db,principal,'create',null,request,null);
 const failed={id:first.id,version:2,state:'failed',resource_id:orderId,failure_code:'CHANNEL_TIMEOUT',snapshot:{...first,state:'failed',version:2,failureCode:'CHANNEL_TIMEOUT'}};
 const retried=await writeNotification({...db,query:async(sql,params=[])=>{
  if(sql.includes('SELECT * FROM notification.message WHERE company_id=$1 AND id=$2'))return {rows:[failed],rowCount:1};
  if(sql.includes('UPDATE notification.message SET state=')){assert.equal(params[2],'queued');assert.equal(params[3],3);return {rows:[],rowCount:1};}
  return db.query(sql,params);
 }},principal,'retry',first.id,{reason:'渠道已恢复'},2);
 assert.deepEqual(retried,{id:first.id,version:3,state:'queued',resourceId:orderId,readAt:null,failureCode:null});
});
