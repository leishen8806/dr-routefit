import {randomUUID} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {caseQuery} from './cases.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const partnerQuery=caseQuery;
const view=row=>({id:row.id,version:Number(row.version),name:row.name,kind:row.kind,state:row.state,agreementVersionId:row.agreement_version_id});
const sameIds=(left,right)=>left.length===right.length&&new Set(left).size===left.length&&left.every(id=>right.includes(id));
async function person(client,principal){
 const row=(await client.query("SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2 AND status='ACTIVE'",[principal.companyId,principal.principalId])).rows[0];
 ensure(row?.person_id,401,'SESSION_REVOKED','当前人员身份无效');return row.person_id;
}
async function record(client,principal,id,lock=false){
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');
 const row=(await client.query('SELECT * FROM partner.carrier WHERE company_id=$1 AND id=$2'+(lock?' FOR UPDATE':''),[principal.companyId,id])).rows[0];
 ensure(row,404,'NOT_FOUND','资源不存在');return row;
}
async function bundle(client,principal,ids){
 ensure(new Set(ids).size===ids.length,422,'DUPLICATE_EVIDENCE','证照文件不得重复');
 const rows=(await client.query("SELECT id,resource_id FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND resource_type='PARTNER' AND purpose='QUALIFICATION' AND state='available'",[principal.companyId,ids])).rows;
 ensure(rows.length===ids.length&&new Set(rows.map(row=>row.resource_id)).size===1,422,'QUALIFICATION_UNAVAILABLE','证照协议不存在、未完成或不属于同一预登记包');
 return rows[0].resource_id;
}
async function event(client,principal,row,action,detail){
 const personId=await person(client,principal),snapshot={partnerId:row.id,version:row.version,action,principalId:principal.principalId,personId,...detail,recordedAt:new Date().toISOString()};
 await client.query('INSERT INTO partner.carrier_event(company_id,partner_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[principal.companyId,row.id,row.version,action,principal.principalId,personId,snapshot]);
 return personId;
}
export async function readPartners(client,principal,query){
 const rows=(await client.query('SELECT * FROM partner.carrier WHERE company_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',[principal.companyId,query.after,query.limit+1])).rows;
 const items=rows.slice(0,query.limit).map(view);return {items,nextCursor:rows.length>query.limit?query.cursor(items.at(-1).id):null};
}
export async function writePartner(client,principal,kind,id,input,version){
 if(kind==='create'){
  const bundleId=await bundle(client,principal,input.qualificationFileIds),result={id:randomUUID(),version:1,name:input.name.trim(),kind:input.kind,state:'draft',agreementVersionId:null};
  const snapshot={...result,contact:input.contact.trim(),phone:input.phone.trim(),qualificationBundleId:bundleId,qualificationFileIds:input.qualificationFileIds,createdAt:new Date().toISOString()};
  await client.query('INSERT INTO partner.carrier(id,company_id,name,kind,contact,phone,state,evidence_bundle_id,agreement_version_id,version,snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[result.id,principal.companyId,result.name,result.kind,snapshot.contact,snapshot.phone,result.state,bundleId,null,result.version,snapshot,principal.principalId]);
  await event(client,principal,result,'CREATED',{qualificationFileIds:input.qualificationFileIds});return result;
 }
 const current=await record(client,principal,id,true);ensure(Number(current.version)===version,412,'VERSION_CONFLICT','合作方已变化，请重新查询');
 const originalIds=current.snapshot.qualificationFileIds;
 ensure(sameIds(input.evidenceFileIds,originalIds),422,'QUALIFICATION_MISMATCH','动作证据必须是已登记的完整证照协议包');
 const bundleId=await bundle(client,principal,input.evidenceFileIds);ensure(bundleId===current.evidence_bundle_id,422,'QUALIFICATION_MISMATCH','证照协议包不匹配');
 if(kind==='verify'){
  ensure(current.state==='draft',409,'INVALID_STATE','仅草稿合作方可核验');
  const prepared=(await client.query('SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2',[principal.companyId,current.created_by])).rows[0];
  const verifier=await person(client,principal);ensure(prepared?.person_id&&prepared.person_id!==verifier,403,'INDEPENDENT_REVIEW_REQUIRED','登记人与准入核验人必须为不同自然人');
  const agreementId=randomUUID(),agreement={id:agreementId,partnerId:id,qualificationFileIds:originalIds,verifiedPersonId:verifier,verifiedAt:new Date().toISOString()};
  await client.query('INSERT INTO partner.agreement_version(id,company_id,partner_id,snapshot,verified_by,verified_person_id) VALUES($1,$2,$3,$4,$5,$6)',[agreementId,principal.companyId,id,agreement,principal.principalId,verifier]);
  const next={...view(current),version:Number(current.version)+1,state:'active',agreementVersionId:agreementId};
  await client.query('UPDATE partner.carrier SET state=$3,agreement_version_id=$4,version=$5,snapshot=$6,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,id,next.state,agreementId,next.version,{...current.snapshot,...next,verificationReason:input.reason.trim()}]);
  await event(client,principal,next,'VERIFIED',{reason:input.reason.trim(),evidenceFileIds:input.evidenceFileIds});return next;
 }
 const action=kind==='exit'?{states:['active','suspended'],next:'exited',event:'EXITED'}:{suspend:{states:['active'],next:'suspended',event:'SUSPENDED'},reinstate:{states:['suspended'],next:'active',event:'REINSTATED'}}[kind];
 ensure(action.states.includes(current.state),409,'INVALID_STATE','当前合作方不支持此动作');
 const next={...view(current),version:Number(current.version)+1,state:action.next};
 await client.query('UPDATE partner.carrier SET state=$3,version=$4,snapshot=$5,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,id,next.state,next.version,{...current.snapshot,...next,lastActionReason:input.reason.trim()}]);
 await event(client,principal,next,action.event,{reason:input.reason.trim(),evidenceFileIds:input.evidenceFileIds});return next;
}
