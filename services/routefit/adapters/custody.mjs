import {randomUUID} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {getOrder} from './orders.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const transferView=(row,signedPersonIds=[])=>({id:row.id,version:Number(row.version),orderId:row.order_id,state:row.state,fromCustodianId:row.from_custodian_id,toCustodianId:row.to_custodian_id,items:row.snapshot.items,signedPersonIds});
async function identity(client,principal,{driver=false}={}){
 const row=(await client.query("SELECT kind,person_id FROM org.principal WHERE company_id=$1 AND id=$2 AND status='ACTIVE'",[principal.companyId,principal.principalId])).rows[0];
 ensure(row?.person_id&&(driver?['DRIVER','PARTNER_DRIVER'].includes(row.kind):row.kind==='STAFF'),403,driver?'DRIVER_IDENTITY_REQUIRED':'CUSTODY_OPERATOR_REQUIRED',driver?'当前会话不是有效司机身份':'当前会话不是有效运营人员');return row;
}
async function evidence(client,principal,orderId,ids){
 ensure(new Set(ids).size===ids.length,422,'DUPLICATE_EVIDENCE','证据不得重复');
 const found=(await client.query("SELECT count(*)::integer AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND resource_type='ORDER' AND resource_id=$3 AND state='available'",[principal.companyId,ids,orderId])).rows[0].count;
 ensure(found===ids.length,422,'EVIDENCE_UNAVAILABLE','证据不存在、未完成或不属于本订单');
}
function packages(order,items){
 const ownership=new Map(order.items.flatMap(item=>item.packageIds.map(packageId=>[packageId,item.id]))),seen=new Set(),result=[];
 ensure(new Set(items.map(item=>item.itemId)).size===items.length,422,'DUPLICATE_ITEM','交接品项不得重复');
 for(const item of items){
  ensure(new Set(item.packageIds).size===item.packageIds.length,422,'DUPLICATE_PACKAGE','交接件不得重复');
  for(const packageId of item.packageIds){ensure(ownership.get(packageId)===item.itemId&&!seen.has(packageId),422,'PACKAGE_NOT_IN_ORDER','交接件必须精确属于订单品项');seen.add(packageId);result.push({itemId:item.itemId,packageId});}
 }
 return result;
}
async function signatures(client,principal,id){return (await client.query('SELECT person_id FROM custody.transfer_signature WHERE company_id=$1 AND transfer_id=$2 ORDER BY created_at',[principal.companyId,id])).rows.map(row=>row.person_id);}
async function record(client,principal,id,lock=false){
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');const row=(await client.query('SELECT * FROM custody.transfer WHERE company_id=$1 AND id=$2'+(lock?' FOR UPDATE':''),[principal.companyId,id])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');return row;
}
async function sign(client,principal,transfer,side,input,who){
 const already=(await client.query('SELECT 1 FROM custody.transfer_signature WHERE company_id=$1 AND transfer_id=$2 AND person_id=$3',[principal.companyId,transfer.id,who.person_id])).rowCount;
 ensure(!already,409,'SAME_PERSON_CANNOT_SIGN_BOTH','同一自然人不能代双方签认');await evidence(client,principal,transfer.order_id,input.evidenceFileIds);
 ensure(input.reason.trim(),422,'EMPTY_REASON','签认理由不能为空');
 await client.query('INSERT INTO custody.transfer_signature(company_id,transfer_id,side,principal_id,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6)',[principal.companyId,transfer.id,side,principal.principalId,who.person_id,{transferId:transfer.id,side,principalId:principal.principalId,personId:who.person_id,reason:input.reason.trim(),evidenceFileIds:input.evidenceFileIds,recordedAt:new Date().toISOString()}]);
}
async function advance(client,principal,transfer,state){
 const signedPersonIds=await signatures(client,principal,transfer.id),next={...transferView(transfer,signedPersonIds),state,version:Number(transfer.version)+1};
 await client.query('UPDATE custody.transfer SET state=$3,version=$4,snapshot=$5,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,transfer.id,state,next.version,{...transfer.snapshot,...next}]);return next;
}
async function assertCreateable(client,principal,input,order){
 ensure(input.fromCustodianId===principal.principalId,403,'FROM_CUSTODIAN_REQUIRED','发起人必须是当前交出保管人');ensure(input.fromCustodianId!==input.toCustodianId,422,'CUSTODIAN_SAME','交接双方必须不同');
 ensure(order.order.state==='executing'&&order.order.version===input.orderVersion,409,'ORDER_VERSION_OR_STATE_CONFLICT','订单当前状态或版本不能交接');
 ensure(Date.parse(input.observedAt)<=Date.now()+300000,422,'OBSERVATION_IN_FUTURE','交接时间不能显著晚于当前时间');
 const assignment=(await client.query("SELECT a.id FROM dispatch.assignment a JOIN dispatch.load_review r ON r.company_id=a.company_id AND r.id=a.load_review_id AND r.result='RELEASED' JOIN org.principal d ON d.company_id=a.company_id AND d.id=a.driver_id AND d.status='ACTIVE' AND d.kind IN ('DRIVER','PARTNER_DRIVER') WHERE a.company_id=$1 AND a.id=$2 AND a.order_id=$3 AND a.version=$4 AND a.driver_id=$5 AND a.load_review_id=$6 AND a.state='accepted'",[principal.companyId,input.assignmentId,input.orderId,input.assignmentVersion,input.toCustodianId,input.loadReviewId])).rowCount;
 ensure(assignment,409,'ASSIGNMENT_NOT_CUSTODY_READY','指派、司机或装载复核当前不能交接');
}
async function assertCurrentCustody(client,principal,orderId,from,entries,ownTransferId=null){
 const ids=entries.map(entry=>entry.packageId),locked=(await client.query('SELECT package_id FROM custody.package_transfer_lock WHERE company_id=$1 AND package_id=ANY($2::uuid[]) AND released_at IS NULL AND ($3::uuid IS NULL OR transfer_id<>$3) FOR UPDATE',[principal.companyId,ids,ownTransferId])).rows;
 ensure(!locked.length,409,'PACKAGE_TRANSFER_LOCKED','存在尚未完成的件级交接');
 const positions=(await client.query('SELECT package_id,custodian_id FROM custody.package_position WHERE company_id=$1 AND order_id=$2 AND package_id=ANY($3::uuid[]) FOR UPDATE',[principal.companyId,orderId,ids])).rows;
 ensure(positions.every(row=>row.custodian_id===from),409,'CUSTODY_MISMATCH','件当前保管人不匹配');
}
async function createException(client,principal,transfer,reason,evidenceFileIds,personId){
 const result={id:randomUUID(),version:1,orderId:transfer.order_id,state:'open',category:'MISSING',ownerId:null,dueAt:null,blockingActions:['CUSTODY_TRANSFER']},snapshot={...result,transferId:transfer.id,reason,evidenceFileIds,packageIds:transfer.snapshot.items.flatMap(item=>item.packageIds),observedAt:transfer.observed_at.toISOString()};
 await client.query('INSERT INTO casework.dispatch_exception(id,company_id,order_id,category,state,owner_id,due_at,version,snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[result.id,principal.companyId,result.orderId,result.category,result.state,null,null,result.version,snapshot,principal.principalId]);
 await client.query('INSERT INTO casework.dispatch_exception_event(company_id,exception_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[principal.companyId,result.id,1,'REPORTED',principal.principalId,personId,{exceptionId:result.id,version:1,action:'REPORTED',principalId:principal.principalId,personId,...snapshot,recordedAt:new Date().toISOString()}]);
}
export async function writeCustody(client,principal,kind,id,input,version){
 if(kind==='create'){
  await identity(client,principal);const order=await getOrder(client,principal,input.orderId,true);await assertCreateable(client,principal,input,order);await evidence(client,principal,input.orderId,input.evidenceFileIds);const entries=packages(order,input.items);await assertCurrentCustody(client,principal,input.orderId,input.fromCustodianId,entries);
  const result={id:randomUUID(),version:1,orderId:input.orderId,state:'proposed',fromCustodianId:input.fromCustodianId,toCustodianId:input.toCustodianId,items:input.items,signedPersonIds:[]};
  await client.query('INSERT INTO custody.transfer(id,company_id,order_id,assignment_id,order_version,assignment_version,from_custodian_id,to_custodian_id,load_review_id,observed_at,state,version,snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[result.id,principal.companyId,input.orderId,input.assignmentId,input.orderVersion,input.assignmentVersion,input.fromCustodianId,input.toCustodianId,input.loadReviewId,input.observedAt,result.state,result.version,{...result,evidenceFileIds:input.evidenceFileIds,observedAt:input.observedAt},principal.principalId]);
  for(const entry of entries)await client.query('INSERT INTO custody.transfer_item(company_id,transfer_id,item_id,package_id) VALUES($1,$2,$3,$4)',[principal.companyId,result.id,entry.itemId,entry.packageId]);
  for(const entry of entries)await client.query('INSERT INTO custody.package_transfer_lock(company_id,package_id,transfer_id) VALUES($1,$2,$3)',[principal.companyId,entry.packageId,result.id]);
  return result;
 }
 const transfer=await record(client,principal,id,true);ensure(Number(transfer.version)===version,412,'VERSION_CONFLICT','交接已变化，请重新查询');
 if(kind==='confirm'){
  const who=await identity(client,principal);ensure(transfer.from_custodian_id===principal.principalId&&transfer.state==='proposed',409,'TRANSFER_NOT_CONFIRMABLE','当前交接不能由此保管人签认');await sign(client,principal,transfer,'FROM',input,who);return advance(client,principal,transfer,'partially_signed');
 }
 if(kind==='discrepancy'){
  const who=await identity(client,principal);ensure(transfer.from_custodian_id===principal.principalId&&['proposed','partially_signed'].includes(transfer.state),409,'TRANSFER_NOT_DISCREPANCY_REPORTABLE','当前交接不能报告差异');await evidence(client,principal,transfer.order_id,input.evidenceFileIds);ensure(input.reason.trim(),422,'EMPTY_REASON','差异说明不能为空');await createException(client,principal,transfer,input.reason.trim(),input.evidenceFileIds,who.person_id);return advance(client,principal,transfer,'discrepancy');
 }
 const who=await identity(client,principal,{driver:true});ensure(transfer.to_custodian_id===principal.principalId&&transfer.state==='partially_signed',409,'TRANSFER_NOT_CONFIRMABLE','当前交接不能由此司机签认');await sign(client,principal,transfer,'TO',input,who);
 const entries=transfer.snapshot.items.flatMap(item=>item.packageIds.map(packageId=>({itemId:item.itemId,packageId})));await assertCurrentCustody(client,principal,transfer.order_id,transfer.from_custodian_id,entries,transfer.id);
 for(const entry of entries)await client.query('INSERT INTO custody.package_position(company_id,order_id,item_id,package_id,custodian_id,transfer_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(company_id,order_id,package_id) DO UPDATE SET custodian_id=EXCLUDED.custodian_id,transfer_id=EXCLUDED.transfer_id,updated_at=clock_timestamp()',[principal.companyId,transfer.order_id,entry.itemId,entry.packageId,transfer.to_custodian_id,transfer.id]);
 return advance(client,principal,transfer,'confirmed');
}
