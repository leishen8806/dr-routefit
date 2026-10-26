import {randomUUID} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const view=row=>({id:row.id,version:Number(row.version),state:row.state,resourceId:row.resource_id,readAt:null,failureCode:row.failure_code});
async function person(client,principal){const row=(await client.query("SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2 AND status='ACTIVE'",[principal.companyId,principal.principalId])).rows[0];ensure(row?.person_id,401,'SESSION_REVOKED','当前人员身份无效');return row.person_id;}
async function resource(client,principal,input){
 if(input.resourceType==='ORDER'){
  const row=(await client.query('SELECT customer_id,version FROM orders.draft WHERE company_id=$1 AND id=$2',[principal.companyId,input.resourceId])).rows[0];ensure(row&&row.customer_id===input.subjectId&&Number(row.version)===input.resourceVersion,409,'NOTIFICATION_RESOURCE_STALE','订单主体或版本已变化');return;
 }
 if(input.resourceType==='CASE'){
  const row=(await client.query('SELECT c.customer_id,CASE WHEN e.case_id IS NULL THEN 1 ELSE 2 END AS version FROM casework.service_case c LEFT JOIN casework.service_case_event e ON e.company_id=c.company_id AND e.case_id=c.id WHERE c.company_id=$1 AND c.id=$2',[principal.companyId,input.resourceId])).rows[0];ensure(row&&row.customer_id===input.subjectId&&Number(row.version)===input.resourceVersion,409,'NOTIFICATION_RESOURCE_STALE','申请主体或版本已变化');return;
 }
 ensure(false,422,'NOTIFICATION_RESOURCE_UNAVAILABLE','账单通知须等待账单来源接通');
}
async function template(client,principal,input){const row=(await client.query("SELECT id FROM notification.template WHERE company_id=$1 AND id=$2 AND state='approved' AND resource_type=$3 AND channel=$4",[principal.companyId,input.templateId,input.resourceType,input.channel])).rows[0];ensure(row,409,'NOTIFICATION_TEMPLATE_UNAVAILABLE','通知模板未批准、渠道或对象类型不匹配');}
async function record(client,principal,id,lock=false){ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');const row=(await client.query('SELECT * FROM notification.message WHERE company_id=$1 AND id=$2'+(lock?' FOR UPDATE':''),[principal.companyId,id])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');return row;}
export async function readNotification(client,principal,id){return view(await record(client,principal,id));}
export async function writeNotification(client,principal,kind,id,input,version){
 const who=await person(client,principal);
 if(kind==='create'){
  await resource(client,principal,input);await template(client,principal,input);
  const existing=(await client.query('SELECT * FROM notification.message WHERE company_id=$1 AND subject_id=$2 AND resource_type=$3 AND resource_id=$4 AND resource_version=$5 AND template_id=$6 AND channel=$7',[principal.companyId,input.subjectId,input.resourceType,input.resourceId,input.resourceVersion,input.templateId,input.channel])).rows[0];if(existing)return view(existing);
  const result={id:randomUUID(),version:1,state:'queued',resourceId:input.resourceId,readAt:null,failureCode:null};await client.query('INSERT INTO notification.message(id,company_id,subject_id,resource_type,resource_id,resource_version,template_id,channel,state,version,failure_code,snapshot,created_by,person_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,$11,$12,$13)',[result.id,principal.companyId,input.subjectId,input.resourceType,input.resourceId,input.resourceVersion,input.templateId,input.channel,result.state,result.version,{...result,reason:input.reason.trim(),templateId:input.templateId,subjectId:input.subjectId,channel:input.channel,queuedAt:new Date().toISOString()},principal.principalId,who]);return result;
 }
 const current=await record(client,principal,id,true);ensure(Number(current.version)===version,412,'VERSION_CONFLICT','通知状态已变化');ensure(current.state==='failed',409,'NOTIFICATION_NOT_RETRYABLE','只有明确失败的通知可重试；未知结果须先查询原渠道');
 const next={...view(current),version:Number(current.version)+1,state:'queued',failureCode:null};await client.query('UPDATE notification.message SET state=$3,version=$4,failure_code=NULL,snapshot=$5,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,id,next.state,next.version,{...current.snapshot,...next,retryReason:input.reason.trim(),retriedAt:new Date().toISOString(),retriedBy:who}]);return next;
}
