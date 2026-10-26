import {randomUUID} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {getOrder,orderQuery} from './orders.mjs';
import {getQuote} from './quotes.mjs';
import {admission} from './prepayment.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const vehicleView=row=>({id:row.id,version:Number(row.version),label:row.label,kind:row.kind,specVersionId:row.spec_version_id,state:row.state,maxPayloadKg:Number(row.max_payload_kg),internalLengthCm:Number(row.internal_length_cm),internalWidthCm:Number(row.internal_width_cm),internalHeightCm:Number(row.internal_height_cm),doorWidthCm:Number(row.door_width_cm),doorHeightCm:Number(row.door_height_cm)});

export function dispatchQuery(url,principal){
 if(url.pathname.endsWith('/dispatch/board')){
  for(const key of url.searchParams.keys())ensure(['queue','warehouseId'].includes(key)&&url.searchParams.getAll(key).length===1,422,'INVALID_QUERY','查询参数不支持或重复');
  const queue=url.searchParams.get('queue');ensure(queue===null||['awaiting_dispatch','offered','in_transit','urgent'].includes(queue),422,'INVALID_QUERY','调度队列无效');
  const warehouseId=url.searchParams.get('warehouseId');if(warehouseId!==null){ensure(uuid.test(warehouseId),422,'INVALID_QUERY','仓库ID无效');ensure(false,422,'WAREHOUSE_SCOPE_UNAVAILABLE','本地调度看板尚未接入仓库范围');}
  return {queue};
 }
 return orderQuery(url,'customers',principal);
}

export function vehicleReasons(order,vehicle){
 const reasons=[];
 if(vehicle.state!=='available')reasons.push('VEHICLE_NOT_AVAILABLE');
 let weight=0,volume=0;
 for(const item of order.items){
  if(['lengthCm','widthCm','heightCm','weightKg'].some(key=>item[key]===null)){reasons.push('MEASUREMENT_UNKNOWN');continue;}
  weight+=item.weightKg*item.quantity;volume+=item.lengthCm*item.widthCm*item.heightCm*item.quantity;
  if(item.restrictions.length)reasons.push('CARGO_RESTRICTION_UNSUPPORTED');
  const dimensions=[item.lengthCm,item.widthCm,item.heightCm];
  const fits=item.rotationAllowed?dimensions.slice().sort((a,b)=>a-b).every((value,index)=>value<=[vehicle.internalWidthCm,vehicle.internalHeightCm,vehicle.internalLengthCm].slice().sort((a,b)=>a-b)[index]):item.lengthCm<=vehicle.internalLengthCm&&item.widthCm<=vehicle.internalWidthCm&&item.heightCm<=vehicle.internalHeightCm;
  if(!fits)reasons.push('CARGO_DIMENSIONS_EXCEEDED');
  // Door opening is width x height. A fixed-orientation item keeps its own width/height; a rotatable one
  // may present its two smallest sides to the door.
  const clears=item.rotationAllowed?(()=>{const [small,middle]=dimensions.slice().sort((a,b)=>a-b);return small<=Math.min(vehicle.doorWidthCm,vehicle.doorHeightCm)&&middle<=Math.max(vehicle.doorWidthCm,vehicle.doorHeightCm);})():item.widthCm<=vehicle.doorWidthCm&&item.heightCm<=vehicle.doorHeightCm;
  if(!clears)reasons.push('CARGO_DOOR_CLEARANCE_EXCEEDED');
 }
 if(weight>vehicle.maxPayloadKg)reasons.push('PAYLOAD_EXCEEDED');
 if(volume>vehicle.internalLengthCm*vehicle.internalWidthCm*vehicle.internalHeightCm)reasons.push('VOLUME_EXCEEDED');
 return [...new Set(reasons)];
}

const assignmentView=row=>({id:row.id,version:Number(row.version),orderId:row.order_id,vehicleId:row.vehicle_id,driverId:row.driver_id,state:row.state,expiresAt:row.expires_at.toISOString(),planVersion:Number(row.plan_version)});
const routeReasons=(order,row)=>{
 const reasons=vehicleReasons(order,vehicleView(row)),snapshot=row.plan_snapshot??{},validUntil=Date.parse(snapshot.validUntil);
 if(!['MANUAL','CALIBRATED'].includes(snapshot.estimateType)||!Number.isFinite(validUntil)||validUntil<=Date.now())reasons.push('ETA_UNAVAILABLE');
 return [...new Set(reasons)];
};

async function routeForOrder(client,principal,order,input,lock=false){
 const rows=(await client.query(`SELECT plan.id AS plan_id,plan.current_version,pv.id AS plan_version_id,pv.snapshot AS plan_snapshot,v.*
  FROM dispatch.route_plan plan
  JOIN dispatch.route_plan_version pv ON pv.company_id=plan.company_id AND pv.plan_id=plan.id AND pv.plan_version=plan.current_version
  JOIN fleet.vehicle v ON v.company_id=plan.company_id AND v.id=plan.vehicle_id
  JOIN org.principal driver ON driver.company_id=plan.company_id AND driver.id=plan.driver_id AND driver.status='ACTIVE' AND driver.kind IN ('DRIVER','PARTNER_DRIVER')
  WHERE plan.company_id=$1 AND plan.vehicle_id=$2 AND plan.driver_id=$3 AND plan.current_version=$4 AND plan.state='ready' AND pv.state='ready'
   AND EXISTS(SELECT 1 FROM dispatch.route_stop pickup WHERE pickup.company_id=plan.company_id AND pickup.plan_version_id=pv.id AND pickup.order_id=$5 AND pickup.stop_type='PICKUP')
   AND EXISTS(SELECT 1 FROM dispatch.route_stop dropoff WHERE dropoff.company_id=plan.company_id AND dropoff.plan_version_id=pv.id AND dropoff.order_id=$5 AND dropoff.stop_type='DROPOFF')${lock?' FOR UPDATE OF plan,pv':''}`,[principal.companyId,input.vehicleId,input.driverId,input.planVersion,order.order.id])).rows;
 ensure(rows.length===1,409,'ROUTE_PLAN_UNAVAILABLE','当前订单没有匹配的有效路线计划');
 const row=rows[0];ensure(Number(row.version)===input.vehicleVersion,412,'VEHICLE_VERSION_CONFLICT','车辆版本已变化，请重新计算候选');
 return {row,reasons:routeReasons(order,row)};
}
async function orderEvidence(client,principal,orderId,ids){
 ensure(new Set(ids).size===ids.length,422,'DUPLICATE_EVIDENCE','证据不得重复');
 const count=(await client.query("SELECT count(*)::integer AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND resource_type='ORDER' AND resource_id=$3 AND state='available'",[principal.companyId,ids,orderId])).rows[0].count;
 ensure(count===ids.length,422,'EVIDENCE_UNAVAILABLE','证据不存在、未完成或不属于本订单');
}
async function person(client,principal){const row=(await client.query("SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2 AND status='ACTIVE'",[principal.companyId,principal.principalId])).rows[0];ensure(row?.person_id,401,'SESSION_REVOKED','当前人员身份无效');return row.person_id;}
async function assignmentEvent(client,principal,row,action,detail={}){const personId=await person(client,principal),snapshot={assignmentId:row.id,version:row.version,action,principalId:principal.principalId,personId,...detail,recordedAt:new Date().toISOString()};await client.query('INSERT INTO dispatch.assignment_event(company_id,assignment_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[principal.companyId,row.id,row.version,action,principal.principalId,personId,snapshot]);}
async function closeExecution(client,principal,id,reason){await client.query("UPDATE dispatch.fulfillment_execution SET state='ENDED',ended_at=clock_timestamp(),end_reason=$3 WHERE company_id=$1 AND id=$2 AND state='ACTIVE'",[principal.companyId,id,reason]);}
async function transitionAssignment(client,principal,current,state,action,detail={}){
 const next={...assignmentView(current),version:Number(current.version)+1,state};
 await client.query('UPDATE dispatch.assignment SET state=$3,version=$4,snapshot=$5,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,current.id,next.state,next.version,{...current.snapshot,...next,lastAction:action,...detail}]);
 await assignmentEvent(client,principal,next,action,detail);return next;
}
async function expireOffers(client,principal,orderId){
 const rows=(await client.query("SELECT a.*,pv.plan_version FROM dispatch.assignment a JOIN dispatch.route_plan_version pv ON pv.company_id=a.company_id AND pv.id=a.plan_version_id WHERE a.company_id=$1 AND a.order_id=$2 AND a.state='offered' AND a.expires_at<=clock_timestamp() FOR UPDATE OF a",[principal.companyId,orderId])).rows;
 for(const row of rows){await transitionAssignment(client,principal,{...row,plan_version:row.plan_version},'expired','EXPIRED');await closeExecution(client,principal,row.execution_id,'EXPIRED');}
}
// Called inside the order-cancel transaction: an order that is cancelled must not keep an open offer or an ACTIVE execution,
// otherwise the driver can still list it and read pickup/delivery details until the offer happens to expire.
export async function revokeOffersForCancelledOrder(client,principal,orderId,{reason,evidenceFileIds}){
 const carrier=(await client.query("SELECT 1 FROM dispatch.fulfillment_execution WHERE company_id=$1 AND order_id=$2 AND state='ACTIVE' AND kind='CARRIER'",[principal.companyId,orderId])).rowCount;
 ensure(!carrier,409,'CARRIER_BOOKING_ACTIVE','订单存在有效的快递委托，须先确认取消委托后再取消订单');
 const rows=(await client.query("SELECT a.*,pv.plan_version FROM dispatch.assignment a JOIN dispatch.route_plan_version pv ON pv.company_id=a.company_id AND pv.id=a.plan_version_id WHERE a.company_id=$1 AND a.order_id=$2 AND a.state IN ('offered','accepted') FOR UPDATE OF a",[principal.companyId,orderId])).rows;
 ensure(rows.every(row=>row.state==='offered'),409,'ASSIGNMENT_ACCEPTED','订单已有司机接受的指派，不能直接取消');
 for(const row of rows){await transitionAssignment(client,principal,row,'revoked','REVOKED',{reason,evidenceFileIds,cause:'ORDER_CANCELLED'});await closeExecution(client,principal,row.execution_id,'ORDER_CANCELLED');}
 return rows.length;
}
async function prepareOffer(client,principal,order,input){
 ensure(input.availabilityId===undefined,422,'AVAILABILITY_UNAVAILABLE','本地路线计划尚未接入独立司机班次可用性记录');
 ensure(order.order.state==='awaiting_dispatch'&&uuid.test(order.order.promiseId),409,'PROMISE_REQUIRED','派单须基于当前有效承诺');
 const gate=await admission(client,principal,order.order.id);ensure(gate.paymentSatisfied,409,'PAYMENT_NOT_ADMITTED','付款、报价或受理条件尚未满足');
 const promise=(await client.query('SELECT vehicle_id FROM dispatch.service_promise WHERE company_id=$1 AND id=$2 AND order_id=$3',[principal.companyId,input.promiseId,order.order.id])).rows[0];
 ensure(promise&&input.promiseId===order.order.promiseId&&promise.vehicle_id===input.vehicleId,409,'PROMISE_MISMATCH','指派必须引用当前承诺车辆');
 const review=(await client.query("SELECT * FROM dispatch.load_review WHERE company_id=$1 AND id=$2 AND order_id=$3 AND order_version=$4 AND vehicle_id=$5 AND result='RELEASED'",[principal.companyId,input.loadReviewId,order.order.id,order.order.version,input.vehicleId])).rows[0];
 ensure(review,409,'LOAD_REVIEW_REQUIRED','派单须使用当前订单、车辆与规格的已放行装载复核');
 const route=await routeForOrder(client,principal,order,input,true);ensure(route.reasons.length===0,422,'ROUTE_CONSTRAINT_FAILED','路线计划、车辆或ETA不满足派单硬约束');
 return {route,review};
}
// PILOT-0 candidate values (PRD 3.2): S1 offers live 60s, other service levels 120s. A candidate, not a production default.
export const offerTtlSeconds=serviceLevel=>serviceLevel==='S1'?60:120;
async function createOffer(client,principal,order,input,prepared){
 const executionId=randomUUID(),id=randomUUID(),expiresAt=new Date(Date.now()+offerTtlSeconds(order.order.serviceLevel)*1000).toISOString(),result={id,version:1,orderId:order.order.id,vehicleId:input.vehicleId,driverId:input.driverId,state:'offered',expiresAt,planVersion:input.planVersion};
 await client.query("INSERT INTO dispatch.fulfillment_execution(id,company_id,order_id,kind,state,created_by) VALUES($1,$2,$3,'VEHICLE','ACTIVE',$4)",[executionId,principal.companyId,order.order.id,principal.principalId]);
 await client.query('INSERT INTO dispatch.assignment(id,company_id,execution_id,order_id,vehicle_id,driver_id,plan_version_id,promise_id,load_review_id,state,expires_at,version,snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[id,principal.companyId,executionId,order.order.id,input.vehicleId,input.driverId,prepared.route.row.plan_version_id,input.promiseId,input.loadReviewId,result.state,expiresAt,result.version,{...result,routePlanId:prepared.route.row.plan_id,loadReviewId:input.loadReviewId,promiseId:input.promiseId,estimateType:prepared.route.row.plan_snapshot.estimateType,routeValidUntil:prepared.route.row.plan_snapshot.validUntil},principal.principalId]);
 await assignmentEvent(client,principal,result,'OFFERED',{routePlanId:prepared.route.row.plan_id,loadReviewId:input.loadReviewId,promiseId:input.promiseId});return result;
}

export async function readDispatch(client,principal,kind,id,page){
 if(kind==='board'){
  const orderRows=page.queue===null||page.queue==='awaiting_dispatch'?(await client.query("SELECT snapshot FROM orders.draft WHERE company_id=$1 AND snapshot#>>'{order,state}'='awaiting_dispatch' ORDER BY id LIMIT 1001",[principal.companyId])).rows:[],vehicleRows=(await client.query('SELECT * FROM fleet.vehicle WHERE company_id=$1 ORDER BY id LIMIT 501',[principal.companyId])).rows;
  ensure(orderRows.length<=1000&&vehicleRows.length<=500,422,'LOCAL_LIMIT_REACHED','本地调度看板超出安全读取上限');
  return {asOf:new Date().toISOString(),orderIds:orderRows.map(row=>row.snapshot.order.id),vehicles:vehicleRows.map(row=>({vehicleId:row.id,point:null,observedAt:null,quality:'unavailable',state:row.state,activeAssignmentIds:[],exceptionIds:[]})),urgentExceptionIds:[],nextCursor:null};
 }
 if(kind==='vehicles'){
  const rows=(await client.query('SELECT * FROM fleet.vehicle WHERE company_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',[principal.companyId,page.after,page.limit+1])).rows;
  const items=rows.slice(0,page.limit).map(vehicleView);return {items,nextCursor:rows.length>page.limit?page.cursor(items.at(-1).id):null};
 }
 if(kind==='candidates'){
  ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');await getOrder(client,principal,id);
  const order=await getOrder(client,principal,id),rows=(await client.query(`SELECT plan.current_version,pv.snapshot AS plan_snapshot,v.*,plan.driver_id
   FROM dispatch.route_plan plan JOIN dispatch.route_plan_version pv ON pv.company_id=plan.company_id AND pv.plan_id=plan.id AND pv.plan_version=plan.current_version
   JOIN fleet.vehicle v ON v.company_id=plan.company_id AND v.id=plan.vehicle_id
   WHERE plan.company_id=$1 AND plan.state='ready' AND pv.state='ready'
    AND EXISTS(SELECT 1 FROM dispatch.route_stop pickup WHERE pickup.company_id=plan.company_id AND pickup.plan_version_id=pv.id AND pickup.order_id=$2 AND pickup.stop_type='PICKUP')
    AND EXISTS(SELECT 1 FROM dispatch.route_stop dropoff WHERE dropoff.company_id=plan.company_id AND dropoff.plan_version_id=pv.id AND dropoff.order_id=$2 AND dropoff.stop_type='DROPOFF') ORDER BY plan.vehicle_id LIMIT 101`,[principal.companyId,id])).rows;
  ensure(rows.length<=100,422,'LOCAL_LIMIT_REACHED','路线候选超出安全读取上限');
  const items=rows.map(row=>{const reasons=routeReasons(order,row),estimateType=['MANUAL','CALIBRATED'].includes(row.plan_snapshot?.estimateType)?row.plan_snapshot.estimateType:'UNAVAILABLE';return {vehicleId:row.id,driverId:row.driver_id,vehicleVersion:Number(row.version),planVersion:Number(row.current_version),eligible:reasons.length===0,reasons,estimatedCost:null,estimateType};});return {items,nextCursor:null};
 }
 ensure(kind==='promise-history'&&uuid.test(id),404,'NOT_FOUND','资源不存在');await getOrder(client,principal,id);
 const rows=(await client.query('SELECT id,snapshot FROM dispatch.service_promise WHERE company_id=$1 AND order_id=$2 AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4',[principal.companyId,id,page.after,page.limit+1])).rows;
 const items=rows.slice(0,page.limit).map(row=>row.snapshot);return {items,nextCursor:rows.length>page.limit?page.cursor(items.at(-1).id):null};
}

export async function writePromiseCheck(client,principal,orderId,input,version){
 ensure(uuid.test(orderId),404,'NOT_FOUND','资源不存在');
 const order=await getOrder(client,principal,orderId,true);ensure(order.order.version===version,412,'VERSION_CONFLICT','订单版本已变化，请重新查询');
 const quote=await getQuote(client,principal,input.quoteId);
 ensure(quote.orderId===orderId&&order.quoteId===input.quoteId&&quote.state==='confirmed',409,'QUOTE_NOT_CONFIRMED','承诺检查须使用当前已确认报价');
 let reasons=['ETA_UNAVAILABLE'],planVersion=null;
 if(input.fulfillmentMode==='VEHICLE'){
  ensure(uuid.test(input.vehicleId),404,'NOT_FOUND','资源不存在');assertPromiseWindows(input.pickupWindow,input.deliveryWindow);
  const row=(await client.query('SELECT * FROM fleet.vehicle WHERE company_id=$1 AND id=$2',[principal.companyId,input.vehicleId])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');
  reasons=[...vehicleReasons(order,vehicleView(row)),'ETA_UNAVAILABLE'];
 }else reasons=['CARRIER_CAPABILITY_UNAVAILABLE','ETA_UNAVAILABLE'];
 const result={id:randomUUID(),orderId,orderVersion:order.order.version,quoteId:input.quoteId,feasible:false,reasons:[...new Set(reasons)],expiresAt:new Date(Date.now()+300000).toISOString(),planVersion};
 await client.query('INSERT INTO dispatch.promise_check(id,company_id,order_id,order_version,quote_id,snapshot,principal_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[result.id,principal.companyId,orderId,result.orderVersion,input.quoteId,{...result,input},principal.principalId]);
 return result;
}

const sameWindow=(first,second)=>Date.parse(first.start)===Date.parse(second.start)&&Date.parse(first.end)===Date.parse(second.end);
// Contract: every window has start<end, and the capacity reservation spans pickup.start..delivery.end, so that range must be non-empty too.
export function assertPromiseWindows(pickup,delivery){
 const p=[Date.parse(pickup?.start),Date.parse(pickup?.end)],d=[Date.parse(delivery?.start),Date.parse(delivery?.end)];
 ensure([...p,...d].every(Number.isFinite)&&p[0]<p[1]&&d[0]<d[1]&&p[0]<d[1],422,'PROMISE_WINDOW_INVALID','取件与送达窗口的开始时间必须早于结束时间，且取件不得晚于送达结束');
}
export async function writePromise(client,principal,orderId,input,version){
 ensure(uuid.test(orderId),404,'NOT_FOUND','资源不存在');
 const order=await getOrder(client,principal,orderId,true);ensure(order.order.version===version,412,'VERSION_CONFLICT','订单版本已变化，请重新查询');
 ensure(['quoted','awaiting_dispatch'].includes(order.order.state),409,'INVALID_STATE','仅已确认报价或待派单订单可记录承诺');
 const quote=await getQuote(client,principal,input.quoteId);ensure(quote.id===order.quoteId&&quote.orderId===orderId&&quote.state==='confirmed',409,'QUOTE_NOT_CONFIRMED','承诺须引用当前已确认报价');
 const payment=await admission(client,principal,orderId);ensure(payment.paymentSatisfied,409,'PAYMENT_NOT_ADMITTED','付款核销、报价或受理条件尚未满足');
 const row=(await client.query('SELECT snapshot FROM dispatch.promise_check WHERE company_id=$1 AND id=$2',[principal.companyId,input.checkId])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');
 const check=row.snapshot,source=check.input;ensure(check.orderId===orderId&&check.orderVersion===version&&check.quoteId===input.quoteId&&Date.parse(check.expiresAt)>Date.now(),409,'PROMISE_CHECK_STALE','承诺检查已过期或订单版本已变化');
 ensure(source?.fulfillmentMode==='VEHICLE'&&uuid.test(source.vehicleId),422,'MANUAL_PROMISE_UNSUPPORTED','当前仅支持已核验车辆的人工承诺');
 assertPromiseWindows(input.pickupWindow,input.deliveryWindow);
 ensure(sameWindow(input.pickupWindow,source.pickupWindow)&&sameWindow(input.deliveryWindow,source.deliveryWindow),422,'PROMISE_WINDOW_MISMATCH','承诺窗口必须与检查窗口一致');
 const vehicleRow=(await client.query('SELECT * FROM fleet.vehicle WHERE company_id=$1 AND id=$2',[principal.companyId,source.vehicleId])).rows[0];ensure(vehicleRow,404,'NOT_FOUND','资源不存在');
 const reasons=vehicleReasons(order,vehicleView(vehicleRow));ensure(reasons.length===0&&check.reasons.every(reason=>reason==='ETA_UNAVAILABLE'),422,'PROMISE_CHECK_NOT_FEASIBLE','车辆或货物条件已变化，不能人工覆盖硬约束');
 const current=order.order.promiseId;
 if(order.order.state==='quoted')ensure(!input.supersedesPromiseId,422,'UNEXPECTED_SUPERSEDE','首次承诺不应引用旧承诺');
 else ensure(input.supersedesPromiseId===current,409,'SUPERSEDE_REQUIRED','替换承诺必须明确引用当前承诺');
 const now=new Date().toISOString(),id=randomUUID(),result={id,version:1,orderId,acceptedAt:now,pickupWindow:input.pickupWindow,deliveryWindow:input.deliveryWindow,basis:'APPROVED_MANUAL',supersedesPromiseId:input.supersedesPromiseId??null};
 await client.query('INSERT INTO dispatch.service_promise(id,company_id,order_id,check_id,quote_id,vehicle_id,supersedes_promise_id,snapshot,principal_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,principal.companyId,orderId,input.checkId,input.quoteId,source.vehicleId,input.supersedesPromiseId??null,result,principal.principalId]);
 if(current)await client.query("UPDATE dispatch.capacity_reservation SET released_at=$3,released_by_promise_id=$4,release_reason='SUPERSEDED' WHERE company_id=$1 AND promise_id=$2 AND released_at IS NULL",[principal.companyId,current,now,id]);
 const reservation={promiseId:id,orderId,vehicleId:source.vehicleId,pickupWindow:input.pickupWindow,deliveryWindow:input.deliveryWindow,createdAt:now};
 await client.query("INSERT INTO dispatch.capacity_reservation(company_id,promise_id,order_id,vehicle_id,reservation_window,snapshot) VALUES($1,$2,$3,$4,tstzrange($5,$6,'[)'),$7)",[principal.companyId,id,orderId,source.vehicleId,input.pickupWindow.start,input.deliveryWindow.end,reservation]);
 const stored=(await client.query('SELECT snapshot FROM orders.draft WHERE company_id=$1 AND id=$2',[principal.companyId,orderId])).rows[0].snapshot;
 const next={...stored,order:{...stored.order,state:'awaiting_dispatch',version:version+1,promiseId:id,updatedAt:now}};
 await client.query('UPDATE orders.draft SET version=$3,snapshot=$4,updated_at=now() WHERE company_id=$1 AND id=$2',[principal.companyId,orderId,version+1,next]);
 await client.query('INSERT INTO orders.draft_revision(company_id,order_id,version,snapshot,principal_id) VALUES($1,$2,$3,$4,$5)',[principal.companyId,orderId,version+1,next,principal.principalId]);
 return result;
}

export async function writeLoadReview(client,principal,orderId,input,version){
 ensure(uuid.test(orderId),404,'NOT_FOUND','资源不存在');
 const order=await getOrder(client,principal,orderId,true);ensure(order.order.version===version,412,'VERSION_CONFLICT','订单版本已变化，请重新查询');
 ensure(order.order.state==='awaiting_dispatch'&&uuid.test(order.order.promiseId),409,'PROMISE_REQUIRED','装载复核须基于当前有效承诺');
 ensure(new Set(input.evidenceFileIds).size===input.evidenceFileIds.length,422,'DUPLICATE_EVIDENCE','装载证据不得重复');
 const promise=(await client.query('SELECT vehicle_id FROM dispatch.service_promise WHERE company_id=$1 AND id=$2 AND order_id=$3',[principal.companyId,order.order.promiseId,orderId])).rows[0];
 ensure(promise,409,'PROMISE_REQUIRED','当前承诺不存在或已失效');
 ensure(promise.vehicle_id===input.vehicleId,422,'PROMISE_VEHICLE_MISMATCH','装载复核车辆必须与当前承诺一致');
 const vehicle=(await client.query('SELECT * FROM fleet.vehicle WHERE company_id=$1 AND id=$2',[principal.companyId,input.vehicleId])).rows[0];
 ensure(vehicle,404,'NOT_FOUND','资源不存在');ensure(vehicle.spec_version_id===input.specVersionId,422,'VEHICLE_SPEC_MISMATCH','车辆规格版本已变化');
 const evidence=(await client.query("SELECT count(*)::integer AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND resource_type='ORDER' AND resource_id=$3 AND state='available'",[principal.companyId,input.evidenceFileIds,orderId])).rows[0];
 ensure(evidence.count===input.evidenceFileIds.length,422,'LOAD_EVIDENCE_UNAVAILABLE','装载证据不存在、未完成或不属于本订单');
 const reasons=vehicleReasons(order,vehicleView(vehicle));
 ensure(input.result!=='RELEASED'||reasons.length===0,422,'LOAD_REVIEW_NOT_FEASIBLE','车辆或货物硬约束未满足，不能放行');
 const reviewer=(await client.query('SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2',[principal.companyId,principal.principalId])).rows[0];
 ensure(reviewer?.person_id,401,'SESSION_REVOKED','当前复核人员身份无效');
 const now=new Date().toISOString(),result={id:randomUUID(),version:1,orderId,orderVersion:order.order.version,vehicleId:input.vehicleId,specVersionId:input.specVersionId,result:input.result,reviewerPersonId:reviewer.person_id,recordedAt:now};
 await client.query('INSERT INTO dispatch.load_review(id,company_id,order_id,order_version,vehicle_id,spec_version_id,result,reviewer_principal_id,reviewer_person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[result.id,principal.companyId,orderId,result.orderVersion,input.vehicleId,input.specVersionId,input.result,principal.principalId,reviewer.person_id,{...result,evidenceFileIds:input.evidenceFileIds,reason:input.reason.trim(),reasons}]);
 return result;
}

export async function writeAssignment(client,principal,kind,id,input,version){
 if(kind==='assignment-create'){
  ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');const order=await getOrder(client,principal,id,true);ensure(order.order.version===version,412,'VERSION_CONFLICT','订单已变化，请重新查询');await expireOffers(client,principal,id);
  const active=(await client.query("SELECT 1 FROM dispatch.fulfillment_execution WHERE company_id=$1 AND order_id=$2 AND state='ACTIVE'",[principal.companyId,id])).rowCount;ensure(!active,409,'FULFILLMENT_ALREADY_ACTIVE','订单已有有效履约，不能重复派单');return createOffer(client,principal,order,input,await prepareOffer(client,principal,order,input));
 }
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');const current=(await client.query('SELECT a.*,pv.plan_version FROM dispatch.assignment a JOIN dispatch.route_plan_version pv ON pv.company_id=a.company_id AND pv.id=a.plan_version_id WHERE a.company_id=$1 AND a.id=$2 FOR UPDATE OF a',[principal.companyId,id])).rows[0];ensure(current,404,'NOT_FOUND','资源不存在');ensure(Number(current.version)===version,412,'VERSION_CONFLICT','指派已变化，请重新查询');
 if(kind==='assignment-revoke'){
  ensure(current.state==='offered'&&current.expires_at>Date.now(),409,'ASSIGNMENT_NOT_REVOCABLE','仅未过期的待接受指派可撤回');await orderEvidence(client,principal,current.order_id,input.evidenceFileIds);const next=await transitionAssignment(client,principal,current,'revoked','REVOKED',{reason:input.reason.trim(),evidenceFileIds:input.evidenceFileIds});await closeExecution(client,principal,current.execution_id,'REVOKED');return next;
 }
 ensure(current.state==='offered'&&current.expires_at>Date.now(),409,'ASSIGNMENT_NOT_REASSIGNABLE','仅未过期且未接收的指派可改派');const order=await getOrder(client,principal,current.order_id,true),prepared=await prepareOffer(client,principal,order,input);await transitionAssignment(client,principal,current,'superseded','SUPERSEDED',{replacementVehicleId:input.vehicleId,replacementDriverId:input.driverId});await closeExecution(client,principal,current.execution_id,'SUPERSEDED');return createOffer(client,principal,order,input,prepared);
}
