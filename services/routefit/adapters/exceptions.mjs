import {randomUUID} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {caseQuery} from './cases.mjs';
import {getOrder} from './orders.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const exceptionQuery=caseQuery;

const view=row=>({id:row.id,version:Number(row.version),orderId:row.order_id,state:row.state,category:row.category,ownerId:row.owner_id,dueAt:row.due_at?.toISOString()??null,blockingActions:row.snapshot.blockingActions??[]});
async function record(client,principal,id,lock=false){
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');
 const row=(await client.query('SELECT * FROM casework.dispatch_exception WHERE company_id=$1 AND id=$2'+(lock?' FOR UPDATE':''),[principal.companyId,id])).rows[0];
 ensure(row,404,'NOT_FOUND','资源不存在');return row;
}
async function person(client,principal){
 const row=(await client.query('SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2 AND status=\'ACTIVE\'',[principal.companyId,principal.principalId])).rows[0];
 ensure(row?.person_id,401,'SESSION_REVOKED','当前人员身份无效');return row.person_id;
}
async function evidence(client,principal,orderId,ids){
 ensure(new Set(ids).size===ids.length,422,'DUPLICATE_EVIDENCE','证据不得重复');
 if(!ids.length)return;
 const found=(await client.query("SELECT count(*)::integer AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND resource_type='ORDER' AND resource_id=$3 AND state='available'",[principal.companyId,ids,orderId])).rows[0].count;
 ensure(found===ids.length,422,'EVIDENCE_UNAVAILABLE','证据不存在、未完成或不属于本订单');
}
function packageIds(order){return new Set(order.items.flatMap(item=>item.packageIds));}
async function event(client,principal,exception,action,detail){
 const personId=await person(client,principal),snapshot={exceptionId:exception.id,version:exception.version,action,principalId:principal.principalId,personId,...detail,recordedAt:new Date().toISOString()};
 await client.query('INSERT INTO casework.dispatch_exception_event(company_id,exception_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[principal.companyId,exception.id,exception.version,action,principal.principalId,personId,snapshot]);
}
export async function readExceptions(client,principal,query){
 const rows=(await client.query('SELECT * FROM casework.dispatch_exception WHERE company_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',[principal.companyId,query.after,query.limit+1])).rows;
 const items=rows.slice(0,query.limit).map(view);return {items,nextCursor:rows.length>query.limit?query.cursor(items.at(-1).id):null};
}
export async function writeException(client,principal,kind,id,input,version){
 if(kind==='create'){
  const order=await getOrder(client,principal,input.orderId,true);const packages=packageIds(order);
  ensure(new Set(input.packageIds).size===input.packageIds.length&&input.packageIds.every(value=>packages.has(value)),422,'PACKAGE_NOT_IN_ORDER','异常包裹必须属于订单');
  await evidence(client,principal,input.orderId,input.evidenceFileIds);
  ensure(Date.parse(input.observedAt)<=Date.now()+300000,422,'OBSERVATION_IN_FUTURE','异常发现时间不能显著晚于当前时间');
  const result={id:randomUUID(),version:1,orderId:input.orderId,state:'open',category:input.category,ownerId:null,dueAt:null,blockingActions:[]};
  await client.query('INSERT INTO casework.dispatch_exception(id,company_id,order_id,category,state,owner_id,due_at,version,snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[result.id,principal.companyId,result.orderId,result.category,result.state,null,null,result.version,{...result,description:input.description.trim(),packageIds:input.packageIds,evidenceFileIds:input.evidenceFileIds,observedAt:input.observedAt},principal.principalId]);
  await event(client,principal,result,'REPORTED',{description:input.description.trim(),packageIds:input.packageIds,evidenceFileIds:input.evidenceFileIds,observedAt:input.observedAt});return result;
 }
 const current=await record(client,principal,id,true);ensure(Number(current.version)===version,412,'VERSION_CONFLICT','异常已变化，请重新查询');
 if(kind==='assign'){
  ensure(['open','assigned','resolving'].includes(current.state),409,'INVALID_STATE','当前异常不能再指派');
  ensure(Date.parse(input.dueAt)>Date.now(),422,'DUE_AT_INVALID','处理期限必须在当前时间之后');
  const owner=(await client.query("SELECT id FROM org.principal WHERE company_id=$1 AND id=$2 AND status='ACTIVE'",[principal.companyId,input.ownerId])).rows[0];ensure(owner,404,'NOT_FOUND','负责人不存在');
  const next={...view(current),version:Number(current.version)+1,state:'assigned',ownerId:input.ownerId,dueAt:input.dueAt,blockingActions:current.snapshot.blockingActions??[]};
  await client.query('UPDATE casework.dispatch_exception SET state=$3,owner_id=$4,due_at=$5,version=$6,snapshot=$7,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,id,next.state,next.ownerId,next.dueAt,next.version,{...current.snapshot,...next,assignmentReason:input.reason.trim()}]);
  await event(client,principal,next,'ASSIGNED',{reason:input.reason.trim()});return next;
 }
 if(kind==='close'){
  ensure(current.state==='resolved',409,'INVALID_STATE','仅已解决异常可关闭');ensure((current.snapshot.blockingActions??[]).length===0,409,'BLOCKING_ACTIONS_OPEN','存在未闭合的阻断事项');await evidence(client,principal,current.order_id,input.evidenceFileIds);ensure(input.reason.trim(),422,'EMPTY_REASON','关闭说明不能为空');
  const next={...view(current),version:Number(current.version)+1,state:'closed',blockingActions:[]};await client.query('UPDATE casework.dispatch_exception SET state=$3,version=$4,snapshot=$5,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,id,next.state,next.version,{...current.snapshot,...next,closeReason:input.reason.trim(),closeEvidenceFileIds:input.evidenceFileIds}]);await event(client,principal,next,'CLOSED',{reason:input.reason.trim(),evidenceFileIds:input.evidenceFileIds});return next;
 }
 ensure(current.state==='assigned',409,'INVALID_STATE','仅已指派异常可解决');
 await evidence(client,principal,current.order_id,input.evidenceFileIds);
 const next={...view(current),version:Number(current.version)+1,state:'resolved',blockingActions:current.snapshot.blockingActions??[]};
 await client.query('UPDATE casework.dispatch_exception SET state=$3,version=$4,snapshot=$5,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,id,next.state,next.version,{...current.snapshot,...next,resolutionReason:input.reason.trim(),resolutionEvidenceFileIds:input.evidenceFileIds}]);
 await event(client,principal,next,'RESOLVED',{reason:input.reason.trim(),evidenceFileIds:input.evidenceFileIds});return next;
}
