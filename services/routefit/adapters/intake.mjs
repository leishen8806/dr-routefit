import {randomUUID} from 'node:crypto';
import {ApiError,ensure} from '../domain/errors.mjs';
import {areaPoints,validateEvidence,evaluateIntake} from '../domain/intake.mjs';
import {getOrder} from './orders.mjs';
const areaView=r=>({id:r.id,version:Number(r.version),state:r.state,data:r.data});
export const lockCoverage=(client,company)=>client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['coverage:'+company]);
async function coverage(client,company){
 const revision=Number((await client.query('SELECT COALESCE(max(revision),0) AS revision FROM coverage.publication WHERE company_id=$1',[company])).rows[0].revision);
 const areas=(await client.query("SELECT * FROM coverage.area WHERE company_id=$1 AND state='active' ORDER BY id",[company])).rows.map(areaView);return {revision,areas};
}
async function evidenceFor(client,principal,order){
 const stored=(await client.query('SELECT intake_source_version FROM orders.draft WHERE company_id=$1 AND id=$2',[principal.companyId,order.order.id])).rows[0];
 const source=stored?.intake_source_version??order.intake?.sourceOrderVersion??order.order.version;
 const r=(await client.query('SELECT snapshot FROM orders.intake_evidence WHERE company_id=$1 AND order_id=$2 AND source_version=$3 ORDER BY seq DESC LIMIT 1',[principal.companyId,order.order.id,source])).rows[0];return r?.snapshot??null;
}
export async function recheckIntake(client,principal,order){
 return evaluateIntake(order,await evidenceFor(client,principal,order),await coverage(client,principal.companyId));
}
export async function readIntake(client,principal,kind,id,page){
 if(kind==='areas'){
  const rows=(await client.query('SELECT * FROM coverage.area WHERE company_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',[principal.companyId,page.after,page.limit+1])).rows;
  const items=rows.slice(0,page.limit).map(areaView);return {items,nextCursor:rows.length>page.limit?page.cursor(items.at(-1).id):null};
 }
 const order=await getOrder(client,principal,id);return recheckIntake(client,principal,order);
}
export async function writeIntake(client,principal,kind,id,input,version){
 const company=principal.companyId;
 if(kind==='area-create'){
  areaPoints(input);const created=randomUUID();
  const r=(await client.query("INSERT INTO coverage.area(id,company_id,version,state,data,created_by) VALUES($1,$2,1,'draft',$3,$4) RETURNING *",[created,company,input,principal.principalId])).rows[0];return areaView(r);
 }
 if(kind.startsWith('area-')){
  ensure(input.reason.trim(),422,'REASON_REQUIRED','区域发布或停用必须说明依据');await lockCoverage(client,company);
  const r=(await client.query('SELECT * FROM coverage.area WHERE company_id=$1 AND id=$2 FOR UPDATE',[company,id])).rows[0];ensure(r,404,'NOT_FOUND','资源不存在');
  ensure(Number(r.version)===version,412,'VERSION_CONFLICT','区域版本已变化');const retire=kind==='area-retire';ensure(r.state===(retire?'active':'draft'),409,'INVALID_STATE','区域当前状态不支持此操作');areaPoints(r.data);
  const cfg=await coverage(client,company);ensure(retire||cfg.areas.length<50,422,'AREA_LIMIT','本地最多50个启用区域');
  const updated=areaView((await client.query('UPDATE coverage.area SET state=$3,version=version+1 WHERE company_id=$1 AND id=$2 RETURNING *',[company,id,retire?'superseded':'active'])).rows[0]);
  await client.query('INSERT INTO coverage.publication(company_id,revision,area_id,area_version,snapshot,reason,principal_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[company,cfg.revision+1,id,updated.version,updated,input.reason,principal.principalId]);return updated;
 }
 const order=await getOrder(client,principal,id,true);ensure(order.order.version===version,412,'VERSION_CONFLICT','订单版本已变化');
 if(kind==='intake-evidence'){
  ensure(order.order.state==='draft',409,'INVALID_STATE','仅草稿可登记受理依据');validateEvidence(order,input);
  const snapshot={id:randomUUID(),orderId:id,orderVersion:version,recordedBy:principal.principalId,recordedAt:new Date().toISOString(),sourceQuality:'MANUAL_RECORDED',data:input,sourceSnapshot:order.draft};
  await client.query('INSERT INTO orders.intake_evidence(id,company_id,order_id,source_version,snapshot,principal_id) VALUES($1,$2,$3,$4,$5,$6)',[snapshot.id,company,id,version,snapshot,principal.principalId]);return snapshot;
 }
 let result;
 if(kind==='intake-submit'){
  ensure(order.order.state==='draft',409,'INVALID_STATE','仅草稿可提交受理');await lockCoverage(client,company);
  const evidence=await evidenceFor(client,principal,order),report=evaluateIntake(order,evidence,await coverage(client,company));
  if(!report.ready)throw new ApiError(422,'INTAKE_BLOCKED','受理输入检查未通过；原订单不变',report.blockers);
  result={...order,order:{...order.order,state:'validating',version:version+1,updatedAt:report.checkedAt},intake:{evidenceId:evidence.id,sourceOrderVersion:version,acceptedOrderVersion:version+1,areaRevision:report.areaRevision,checkedAt:report.checkedAt,automationEligible:false}};
 }else{
  ensure(!order.quoteId||(await client.query('SELECT 1 FROM pricing.quote_confirmation WHERE company_id=$1 AND quote_id=$2',[company,order.quoteId])).rowCount===0,409,'CONFIRMED_QUOTE_LOCKED','已确认报价不能直接退回；须受控变更流程');
  ensure(['validating','quoted'].includes(order.order.state),409,'INVALID_STATE','仅核验中或未确认报价的订单可退回草稿');ensure(input.reason.trim(),422,'REASON_REQUIRED','退回须填写原因');
  result={...order,quoteId:null,order:{...order.order,state:'draft',version:version+1,updatedAt:new Date().toISOString()}};delete result.intake;
 }
 const intake=result.intake;
 await client.query('UPDATE orders.draft SET version=$3,snapshot=$4,intake_evidence_id=$5,intake_source_version=$6,intake_area_revision=$7,quote_id=NULL,updated_at=now() WHERE company_id=$1 AND id=$2',[company,id,result.order.version,result,intake?.evidenceId??null,intake?.sourceOrderVersion??null,intake?.areaRevision??null]);
 await client.query('INSERT INTO orders.draft_revision(company_id,order_id,version,snapshot,principal_id) VALUES($1,$2,$3,$4,$5)',[company,id,result.order.version,result,principal.principalId]);
 if(kind==='intake-return')await client.query('INSERT INTO orders.intake_return(company_id,order_id,version,reason,principal_id) VALUES($1,$2,$3,$4,$5)',[company,id,result.order.version,input.reason,principal.principalId]);
 return result;
}
