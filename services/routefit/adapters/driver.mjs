import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {ApiError,ensure} from '../domain/errors.mjs';
import {getOrder} from './orders.mjs';
import {readEvidenceDownload,writeEvidence} from './evidence.mjs';
import {writeCustody} from './custody.mjs';
import {writeDelivery} from './delivery.mjs';
import {writeException} from './exceptions.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cursorKey=randomBytes(32),sign=value=>createHmac('sha256',cursorKey).update(value).digest('base64url');
const view=row=>({id:row.id,version:Number(row.version),orderId:row.order_id,vehicleId:row.vehicle_id,driverId:row.driver_id,state:row.state,expiresAt:new Date(row.expires_at).toISOString(),planVersion:Number(row.plan_version)});
export async function driverIdentity(client,principal){const row=(await client.query("SELECT kind,person_id FROM org.principal WHERE company_id=$1 AND id=$2 AND status='ACTIVE'",[principal.companyId,principal.principalId])).rows[0];ensure(row&&['DRIVER','PARTNER_DRIVER'].includes(row.kind)&&row.person_id,403,'DRIVER_IDENTITY_REQUIRED','当前会话不是有效司机身份');return row;}
const driver=driverIdentity;
export async function authorizeDriverEvidence(client,principal,type,id){
 ensure(type==='ORDER'&&uuid.test(id),422,'EVIDENCE_RESOURCE_UNSUPPORTED','司机端仅可操作当前订单证据');await driver(client,principal);
 const assigned=(await client.query("SELECT 1 FROM dispatch.assignment WHERE company_id=$1 AND driver_id=$2 AND order_id=$3 AND state IN ('offered','accepted')",[principal.companyId,principal.principalId,id])).rowCount;
 ensure(assigned,404,'NOT_FOUND','资源不存在');
}
export const writeDriverEvidence=(client,principal,kind,id,input,version,options)=>writeEvidence(client,principal,kind==='evidence-create'?'create':'complete',id,input,version,{...options,authorizeOrder:authorizeDriverEvidence});
export const readDriverEvidenceDownload=(client,principal,id,options)=>readEvidenceDownload(client,principal,id,{...options,authorizeOrder:authorizeDriverEvidence});
async function evidence(client,principal,orderId,ids){ensure(new Set(ids).size===ids.length,422,'DUPLICATE_EVIDENCE','证据不得重复');const found=(await client.query("SELECT count(*)::integer AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND resource_type='ORDER' AND resource_id=$3 AND state='available'",[principal.companyId,ids,orderId])).rows[0].count;ensure(found===ids.length,422,'EVIDENCE_UNAVAILABLE','证据不存在、未完成或不属于本订单');}
function page(url,principal){
 for(const key of url.searchParams.keys())ensure(['limit','cursor','group'].includes(key)&&url.searchParams.getAll(key).length===1,422,'INVALID_QUERY','查询参数不支持或重复');
 const limit=Number(url.searchParams.get('limit')??50),group=url.searchParams.get('group');ensure(Number.isInteger(limit)&&limit>=1&&limit<=100,422,'INVALID_LIMIT','limit须为1到100');ensure(group===null||['overdue','in_transit','completed','cancelled'].includes(group),422,'INVALID_QUERY','任务分组无效');
 const binding=JSON.stringify([principal.companyId,principal.principalId,limit,group]);let after=null,token=url.searchParams.get('cursor');
 if(token!==null){try{const [payload,signature,...rest]=token.split('.');ensure(token.length<=2048&&signature&&rest.length===0&&timingSafeEqual(Buffer.from(signature),Buffer.from(sign(payload))),422,'INVALID_CURSOR','游标无效或已失效');const decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));ensure(decoded.binding===binding&&uuid.test(decoded.after)&&decoded.expiresAt>Date.now(),422,'INVALID_CURSOR','游标无效或已失效');after=decoded.after;}catch{ensure(false,422,'INVALID_CURSOR','游标无效或已失效');}}
 return {limit,after,group,cursor:after=>{const payload=Buffer.from(JSON.stringify({binding,after,expiresAt:Date.now()+3600000})).toString('base64url');return payload+'.'+sign(payload)}};
}
async function record(client,principal,id,lock=false){ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');const row=(await client.query('SELECT a.*,pv.plan_version FROM dispatch.assignment a JOIN dispatch.route_plan_version pv ON pv.company_id=a.company_id AND pv.id=a.plan_version_id WHERE a.company_id=$1 AND a.id=$2 AND a.driver_id=$3'+(lock?' FOR UPDATE OF a':''),[principal.companyId,id,principal.principalId])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');return row;}
async function event(client,principal,row,action,detail={}){const person=(await driver(client,principal)).person_id,snapshot={assignmentId:row.id,version:row.version,action,principalId:principal.principalId,personId:person,...detail,recordedAt:new Date().toISOString()};await client.query('INSERT INTO dispatch.assignment_event(company_id,assignment_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[principal.companyId,row.id,row.version,action,principal.principalId,person,snapshot]);}
export const driverQuery=(url,principal)=>page(url,principal);
const syncFingerprint=value=>createHash('sha256').update(JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)).digest('hex');
const syncResult=(eventId,result,resourceId=null,resourceVersion=null,errorCode=null)=>({eventId,result,resourceId,resourceVersion,errorCode});
async function syncDevice(client,principal,deviceId,observedAt){
 const active=(await client.query("SELECT 1 FROM mobile.device d JOIN mobile.shift s ON s.company_id=d.company_id AND s.device_id=d.id AND s.driver_id=d.driver_id WHERE d.company_id=$1 AND d.id=$2 AND d.driver_id=$3 AND d.state='ACTIVE' AND s.state IN ('ACTIVE','ENDED') AND $4::timestamptz BETWEEN s.starts_at AND s.ends_at",[principal.companyId,deviceId,principal.principalId,observedAt])).rowCount;
 ensure(active,409,'SYNC_DEVICE_NOT_AUTHORIZED','设备未获授权于该观测时间处理此司机事件');
}
async function syncAssignment(client,principal,input){
 const current=await record(client,principal,input.assignmentId,true);
 ensure(Number(current.version)===input.assignmentVersion,409,'SYNC_ASSIGNMENT_VERSION_STALE','指派版本已变化，请等待调度裁定');
 ensure(Number(current.plan_version)===input.planVersion,409,'SYNC_PLAN_VERSION_STALE','路线版本已变化，请等待调度裁定');
 ensure(Date.parse(input.observedAt)<=Date.now()+300000,422,'SYNC_OBSERVATION_IN_FUTURE','离线观测时间不能显著晚于当前时间');return current;
}
async function savedSyncResult(client,principal,deviceId,input,fingerprint){
 const prior=(await client.query('SELECT device_id,fingerprint,result,resource_id,resource_version,error_code FROM mobile.sync_event WHERE company_id=$1 AND event_id=$2',[principal.companyId,input.eventId])).rows[0];
 if(!prior)return null;
 if(prior.device_id!==deviceId||prior.fingerprint!==fingerprint)return syncResult(input.eventId,'REJECTED',null,null,'SYNC_EVENT_ID_CONFLICT');
 return syncResult(input.eventId,'DUPLICATE',prior.resource_id,prior.resource_version===null?null:Number(prior.resource_version),prior.error_code);
}
async function storeSyncResult(client,principal,deviceId,input,fingerprint,result){
 await client.query('INSERT INTO mobile.sync_event(company_id,event_id,device_id,driver_id,sequence,assignment_id,event_type,observed_at,fingerprint,result,resource_id,resource_version,error_code,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[principal.companyId,input.eventId,deviceId,principal.principalId,input.sequence,input.assignmentId,input.type,input.observedAt,fingerprint,result.result,result.resourceId,result.resourceVersion,result.errorCode,{input,result,receivedAt:new Date().toISOString()}]);
 await client.query('UPDATE mobile.sync_device_state SET last_sequence=$3,updated_at=clock_timestamp() WHERE company_id=$1 AND device_id=$2',[principal.companyId,deviceId,input.sequence]);
}
async function applySyncEvent(client,principal,input){
 const assignment=await syncAssignment(client,principal,input);
 if(input.type==='ARRIVED'){await evidence(client,principal,assignment.order_id,input.payload.evidenceFileIds);return syncResult(input.eventId,'APPLIED',assignment.id,Number(assignment.version));}
 if(input.type==='HANDOVER_SIGNED'){
  const transfer=(await client.query('SELECT assignment_id,version FROM custody.transfer WHERE company_id=$1 AND id=$2',[principal.companyId,input.payload.transferId])).rows[0];
  ensure(transfer&&transfer.assignment_id===assignment.id&&Number(transfer.version)===input.payload.transferVersion,409,'SYNC_TRANSFER_VERSION_STALE','交接记录已变化，请等待调度裁定');
  const result=await writeCustody(client,principal,'driver-confirm',input.payload.transferId,{reason:'Offline handover sync',evidenceFileIds:input.payload.evidenceFileIds},input.payload.transferVersion);
  return syncResult(input.eventId,'APPLIED',result.id,result.version);
 }
 if(input.type==='DELIVERY_RECORDED'){
  ensure(input.payload.orderId===assignment.order_id,409,'SYNC_ORDER_MISMATCH','交付订单不属于当前指派');
  const result=await writeDelivery(client,principal,'driver-record',input.payload.orderId,input.payload,input.payload.orderVersion);
  return syncResult(input.eventId,'APPLIED',result.id,result.version);
 }
 if(input.type==='EXCEPTION_REPORTED'){
  ensure(input.payload.orderId===assignment.order_id,409,'SYNC_ORDER_MISMATCH','异常订单不属于当前指派');
  const result=await writeException(client,principal,'create',null,input.payload,null);
  return syncResult(input.eventId,'APPLIED',result.id,result.version);
 }
 // shortcut: departure payload has no required evidence and cash needs an independent finance fact; route both to staff review until the contract supplies those inputs.
 return syncResult(input.eventId,'NEEDS_REVIEW',assignment.id,Number(assignment.version),input.type==='DEPARTED'?'SYNC_DEPARTURE_EVIDENCE_REQUIRED':'SYNC_CASH_FINANCE_REVIEW_REQUIRED');
}
export async function writeDriverSync(client,principal,input){
 await driver(client,principal);const results=[];
 for(const item of input.events){
  const fingerprint=syncFingerprint(item),prior=await savedSyncResult(client,principal,input.deviceId,item,fingerprint);if(prior){results.push(prior);continue;}
  // `authorized` = the device may speak for this driver; `inSequence` = the event is exactly the next one expected.
  // Only in-sequence events are persisted (and advance last_sequence). An out-of-order event is reported back but not
  // stored, so the device can resend it later in order instead of being blocked forever or rewinding the counter.
  let result,authorized=false,inSequence=false;
  try{
   await client.query('SAVEPOINT driver_sync_event');await syncDevice(client,principal,input.deviceId,item.observedAt);authorized=true;
   await client.query('INSERT INTO mobile.sync_device_state(company_id,device_id,driver_id,last_sequence) VALUES($1,$2,$3,0) ON CONFLICT(company_id,device_id) DO NOTHING',[principal.companyId,input.deviceId,principal.principalId]);
   const state=(await client.query('SELECT last_sequence FROM mobile.sync_device_state WHERE company_id=$1 AND device_id=$2 FOR UPDATE',[principal.companyId,input.deviceId])).rows[0];
   ensure(Number(state.last_sequence)+1===item.sequence,409,'SYNC_SEQUENCE_INVALID','设备事件顺序不连续');inSequence=true;result=await applySyncEvent(client,principal,item);await client.query('RELEASE SAVEPOINT driver_sync_event');
  }catch(error){
   await client.query('ROLLBACK TO SAVEPOINT driver_sync_event').catch(()=>{});await client.query('RELEASE SAVEPOINT driver_sync_event').catch(()=>{});
   result=syncResult(item.eventId,'REJECTED',null,null,error instanceof ApiError?error.code:'SYNC_PROCESSING_FAILED');
  }
  if(!authorized||!inSequence){results.push(result);continue;}
  try{await storeSyncResult(client,principal,input.deviceId,item,fingerprint,result);}catch(error){results.push(syncResult(item.eventId,'REJECTED',null,null,error instanceof ApiError?error.code:'SYNC_PROCESSING_FAILED'));continue;}results.push(result);
 }
 return {results};
}
export async function writeDriverLocations(client,principal,input){
 await driver(client,principal);const shift=(await client.query("SELECT s.starts_at,s.ends_at FROM mobile.shift s JOIN mobile.device d ON d.company_id=s.company_id AND d.id=s.device_id AND d.state='ACTIVE' WHERE s.company_id=$1 AND s.id=$2 AND s.device_id=$3 AND s.driver_id=$4 AND s.state='ACTIVE' AND clock_timestamp() BETWEEN s.starts_at AND s.ends_at",[principal.companyId,input.shiftId,input.deviceId,principal.principalId])).rows[0];ensure(shift,409,'LOCATION_SHIFT_NOT_ACTIVE','设备或当班授权当前无效');
 const acceptedPointIds=[],rejectedPointIds=[];let latestObservedAt=null;
 // Collection is authorised only for this shift: a late upload of points observed before it started or after it ended is refused (PRD 8).
 const shiftStart=Date.parse(shift.starts_at),shiftEnd=Date.parse(shift.ends_at);
 for(const point of input.points){
  const observed=Date.parse(point.observedAt);
  if(observed>Date.now()+300000||!(observed>=shiftStart&&observed<=shiftEnd)){rejectedPointIds.push(point.clientPointId);continue;}
  const inserted=(await client.query('INSERT INTO mobile.location_event(company_id,device_id,driver_id,client_point_id,observed_at,lat,lng,accuracy_m,permission,foreground,battery_ratio) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(company_id,device_id,client_point_id) DO NOTHING RETURNING observed_at',[principal.companyId,input.deviceId,principal.principalId,point.clientPointId,point.observedAt,point.point.lat,point.point.lng,point.accuracyM,point.permission,point.foreground,point.batteryRatio])).rows[0];
  if(!inserted){rejectedPointIds.push(point.clientPointId);continue;}acceptedPointIds.push(point.clientPointId);if(!latestObservedAt||Date.parse(inserted.observed_at)>Date.parse(latestObservedAt))latestObservedAt=new Date(inserted.observed_at).toISOString();
 }
 return {acceptedPointIds,rejectedPointIds,latestObservedAt};
}
export async function readDriver(client,principal,kind,id,query){
 await driver(client,principal);
 if(kind==='assignments'){
  const states={overdue:['offered'],in_transit:['accepted'],completed:['completed'],cancelled:['rejected','revoked','expired','superseded']}[query.group]??null;
  const rows=(await client.query("SELECT a.*,pv.plan_version FROM dispatch.assignment a JOIN dispatch.route_plan_version pv ON pv.company_id=a.company_id AND pv.id=a.plan_version_id WHERE a.company_id=$1 AND a.driver_id=$2 AND ($3::uuid IS NULL OR a.id>$3) AND ($4::text[] IS NULL OR a.state=ANY($4)) AND ($5::boolean=false OR a.expires_at<=clock_timestamp()) ORDER BY a.id LIMIT $6",[principal.companyId,principal.principalId,query.after,states,query.group==='overdue',query.limit+1])).rows;
  const items=rows.slice(0,query.limit).map(view);return {items,nextCursor:rows.length>query.limit?query.cursor(items.at(-1).id):null};
 }
 if(kind==='assignment')return view(await record(client,principal,id));
 ensure(kind==='order'&&uuid.test(id),404,'NOT_FOUND','资源不存在');const allowed=(await client.query("SELECT 1 FROM dispatch.assignment WHERE company_id=$1 AND driver_id=$2 AND order_id=$3 AND state IN ('offered','accepted')",[principal.companyId,principal.principalId,id])).rowCount;ensure(allowed,404,'NOT_FOUND','资源不存在');const order=await getOrder(client,principal,id);return {order:order.order,pickup:order.pickup,delivery:order.delivery,items:order.items,evidenceFileIds:[],quoteId:order.quoteId};
}
export async function writeDriver(client,principal,kind,id,input,version){
 await driver(client,principal);const current=await record(client,principal,id,true);ensure(Number(current.version)===version,412,'VERSION_CONFLICT','指派已变化，请重新查询');
 if(kind==='depart'){
  ensure(current.state==='accepted',409,'ASSIGNMENT_NOT_DEPARTABLE','仅已接受指派可在完成交接后出发');const order=await getOrder(client,principal,current.order_id,true);ensure(order.order.state==='executing'&&order.order.fulfillmentStage==='pickup_pending',409,'ORDER_NOT_READY_TO_DEPART','订单当前不能出发');await evidence(client,principal,current.order_id,input.evidenceFileIds);ensure(input.reason.trim(),422,'EMPTY_REASON','出发说明不能为空');
  const released=(await client.query("SELECT 1 FROM dispatch.load_review WHERE company_id=$1 AND id=$2 AND order_id=$3 AND result='RELEASED'",[principal.companyId,current.load_review_id,current.order_id])).rowCount;ensure(released,409,'LOAD_REVIEW_NOT_RELEASED','装载复核当前未放行');const expected=order.items.flatMap(item=>item.packageIds).length,held=(await client.query('SELECT count(*)::integer AS count FROM custody.package_position WHERE company_id=$1 AND order_id=$2 AND custodian_id=$3',[principal.companyId,current.order_id,principal.principalId])).rows[0].count;ensure(held===expected,409,'CUSTODY_NOT_READY','司机尚未取得全部件的保管责任');
  const next={...view(current),version:Number(current.version)+1};await client.query('UPDATE dispatch.assignment SET version=$3,snapshot=$4,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,id,next.version,{...current.snapshot,...next,lastAction:'DEPARTED',departureReason:input.reason.trim(),departureEvidenceFileIds:input.evidenceFileIds}]);await event(client,principal,next,'DEPARTED',{reason:input.reason.trim(),evidenceFileIds:input.evidenceFileIds});
  const now=new Date().toISOString(),stored=(await client.query('SELECT snapshot FROM orders.draft WHERE company_id=$1 AND id=$2',[principal.companyId,current.order_id])).rows[0].snapshot,nextOrder={...stored,order:{...stored.order,fulfillmentStage:'in_transit',version:order.order.version+1,updatedAt:now}};await client.query('UPDATE orders.draft SET version=$3,snapshot=$4,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,current.order_id,nextOrder.order.version,nextOrder]);await client.query('INSERT INTO orders.draft_revision(company_id,order_id,version,snapshot,principal_id) VALUES($1,$2,$3,$4,$5)',[principal.companyId,current.order_id,nextOrder.order.version,nextOrder,principal.principalId]);return next;
 }
 if(kind==='reject'){
  ensure(current.state==='offered'&&current.expires_at>Date.now(),409,'ASSIGNMENT_NOT_REJECTABLE','仅未过期的待接受指派可拒绝');const next={...view(current),version:Number(current.version)+1,state:'rejected'};await client.query('UPDATE dispatch.assignment SET state=$3,version=$4,snapshot=$5,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,id,next.state,next.version,{...current.snapshot,...next,lastAction:'REJECTED',reason:input.reason.trim()}]);await event(client,principal,next,'REJECTED',{reason:input.reason.trim()});await client.query("UPDATE dispatch.fulfillment_execution SET state='ENDED',ended_at=clock_timestamp(),end_reason='DRIVER_REJECTED' WHERE company_id=$1 AND id=$2 AND state='ACTIVE'",[principal.companyId,current.execution_id]);return next;
 }
 ensure(current.state==='offered'&&current.expires_at>Date.now(),409,'ASSIGNMENT_NOT_ACCEPTABLE','仅未过期的待接受指派可接受');ensure(input.planVersion===Number(current.plan_version),409,'PLAN_VERSION_STALE','路线版本已变化，请读取最新任务');
 const route=(await client.query("SELECT 1 FROM dispatch.route_plan p JOIN dispatch.route_plan_version pv ON pv.company_id=p.company_id AND pv.plan_id=p.id AND pv.plan_version=p.current_version WHERE p.company_id=$1 AND pv.id=$2 AND p.state='ready' AND pv.state='ready' AND p.current_version=$3",[principal.companyId,current.plan_version_id,input.planVersion])).rowCount;ensure(route,409,'ROUTE_PLAN_STALE','路线计划已变化或不可用');
 const order=await getOrder(client,principal,current.order_id,true);ensure(order.order.state==='awaiting_dispatch'&&order.order.promiseId===current.promise_id,409,'ORDER_NOT_ASSIGNABLE','订单当前不能接受指派');const next={...view(current),version:Number(current.version)+1,state:'accepted'};
 await client.query('UPDATE dispatch.assignment SET state=$3,version=$4,snapshot=$5,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,id,next.state,next.version,{...current.snapshot,...next,lastAction:'ACCEPTED'}]);await event(client,principal,next,'ACCEPTED');const now=new Date().toISOString(),stored=(await client.query('SELECT snapshot FROM orders.draft WHERE company_id=$1 AND id=$2',[principal.companyId,current.order_id])).rows[0].snapshot,nextOrder={...stored,order:{...stored.order,state:'executing',fulfillmentStage:'pickup_pending',version:order.order.version+1,updatedAt:now}};
 await client.query('UPDATE orders.draft SET version=$3,snapshot=$4,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,current.order_id,nextOrder.order.version,nextOrder]);await client.query('INSERT INTO orders.draft_revision(company_id,order_id,version,snapshot,principal_id) VALUES($1,$2,$3,$4,$5)',[principal.companyId,current.order_id,nextOrder.order.version,nextOrder,principal.principalId]);return next;
}
