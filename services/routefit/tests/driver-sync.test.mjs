import test from 'node:test';
import assert from 'node:assert/strict';
import {writeDriverSync} from '../adapters/driver.mjs';

const companyId='11111111-1111-4111-8111-111111111111',driverId='22222222-2222-4222-8222-222222222222',deviceId='33333333-3333-4333-8333-333333333333',assignmentId='44444444-4444-4444-8444-444444444444',orderId='55555555-5555-4555-8555-555555555555';
const principal={companyId,principalId:driverId};
function client(){
 const events=new Map();let sequence=0;
 return {query:async(sql,params=[])=>{
  if(sql.includes("SELECT kind,person_id FROM org.principal"))return {rows:[{kind:'DRIVER',person_id:'66666666-6666-4666-8666-666666666666'}],rowCount:1};
  if(sql.includes('SELECT device_id,fingerprint,result,resource_id')){const row=events.get(params[1]);return {rows:row?[row]:[],rowCount:row?1:0};}
  if(sql.includes('FROM mobile.device d JOIN mobile.shift'))return {rows:[{ok:1}],rowCount:1};
  if(sql.includes('INSERT INTO mobile.sync_device_state'))return {rows:[],rowCount:0};
  if(sql.includes('SELECT last_sequence FROM mobile.sync_device_state'))return {rows:[{last_sequence:sequence}],rowCount:1};
  if(sql.includes('SELECT a.*,pv.plan_version FROM dispatch.assignment'))return {rows:[{id:assignmentId,order_id:orderId,version:1,plan_version:1}],rowCount:1};
  if(sql.includes('count(*)::integer AS count FROM evidence.file'))return {rows:[{count:0}],rowCount:1};
  if(sql.includes('INSERT INTO mobile.sync_event')){events.set(params[1],{device_id:params[2],fingerprint:params[8],result:params[9],resource_id:params[10],resource_version:params[11],error_code:params[12]});return {rows:[],rowCount:1};}
  if(sql.includes('UPDATE mobile.sync_device_state SET last_sequence')){sequence=params[2];return {rows:[],rowCount:1};}
  return {rows:[],rowCount:0};
 }};
}
const arrived=(eventId,sequence,point={lat:11.55,lng:104.92})=>({eventId,sequence,assignmentId,assignmentVersion:1,planVersion:1,observedAt:new Date().toISOString(),type:'ARRIVED',payload:{point,evidenceFileIds:[]}});
test('offline sync permanently deduplicates an applied arrival and rejects changed content',async()=>{
 const db=client(),first=arrived('77777777-7777-4777-8777-777777777777',1),applied=await writeDriverSync(db,principal,{deviceId,events:[first]});
 assert.deepEqual(applied.results,[{eventId:first.eventId,result:'APPLIED',resourceId:assignmentId,resourceVersion:1,errorCode:null}]);
 const duplicate=await writeDriverSync(db,principal,{deviceId,events:[first]});assert.equal(duplicate.results[0].result,'DUPLICATE');
 const conflicting=await writeDriverSync(db,principal,{deviceId,events:[{...first,payload:{...first.payload,point:{lat:11.56,lng:104.92}}}]});assert.equal(conflicting.results[0].errorCode,'SYNC_EVENT_ID_CONFLICT');
});
test('offline cash report is recorded for independent finance review rather than becoming a receipt',async()=>{
 const db=client(),event={...arrived('88888888-8888-4888-8888-888888888888',1),type:'CASH_REPORTED',payload:{orderId,orderVersion:1,deliveryAmountMinor:100,insuranceAmountMinor:0,codAmountMinor:0,currency:'USD',cashVoucherRef:'CASH-1',evidenceFileIds:['99999999-9999-4999-8999-999999999999'],observedAt:new Date().toISOString()}};
 const result=await writeDriverSync(db,principal,{deviceId,events:[event]});assert.deepEqual(result.results[0],{eventId:event.eventId,result:'NEEDS_REVIEW',resourceId:assignmentId,resourceVersion:1,errorCode:'SYNC_CASH_FINANCE_REVIEW_REQUIRED'});
});
