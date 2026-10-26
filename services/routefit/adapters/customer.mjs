import {createHash,randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {currentCustomer} from './orders.mjs';
import {readEvidenceDownload,writeEvidence} from './evidence.mjs';

const cursorKey=randomBytes(32),sign=value=>createHmac('sha256',cursorKey).update(value).digest('base64url');
const timelineId=value=>{const hash=createHash('sha256').update(value).digest('hex');return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;};

export async function authorizeCustomerEvidence(client,principal,type,id){
 ensure(['ORDER','WAREHOUSE_REQUEST'].includes(type)&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),422,'EVIDENCE_RESOURCE_UNSUPPORTED','客户门户仅支持本人订单或仓储申请证据');
 const customerId=await currentCustomer(client,principal);
 if(type==='WAREHOUSE_REQUEST'){
  const request=(await client.query('SELECT id FROM warehouse.request WHERE company_id=$1 AND id=$2 AND owner_account_id=$3',[principal.companyId,id,customerId])).rows[0];
  ensure(request,404,'NOT_FOUND','资源不存在');return;
 }
 const row=(await client.query('SELECT snapshot FROM orders.draft WHERE company_id=$1 AND id=$2',[principal.companyId,id])).rows[0];
 ensure(row?.snapshot?.order?.customerId===customerId,404,'NOT_FOUND','资源不存在');
}
export const writeCustomerEvidence=(client,principal,kind,id,input,version,options)=>writeEvidence(client,principal,kind==='evidence-create'?'create':'complete',id,input,version,{...options,authorizeOrder:authorizeCustomerEvidence});
export const readCustomerEvidenceDownload=(client,principal,id,options)=>readEvidenceDownload(client,principal,id,{...options,authorizeOrder:authorizeCustomerEvidence});

export async function customerSession(client,principal){
 const actor=(await client.query('SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2',[principal.companyId,principal.principalId])).rows[0];ensure(actor?.person_id,401,'UNAUTHENTICATED','需要有效会话');
 const subjectIds=(await client.query('SELECT customer_id FROM party.customer_access WHERE company_id=$1 AND principal_id=$2 ORDER BY customer_id',[principal.companyId,principal.principalId])).rows.map(row=>row.customer_id);
 return {actor:{id:principal.principalId,personId:actor.person_id,operatingCompanyId:principal.companyId,subjectIds,permissions:principal.permissions,locale:'en'},expiresAt:principal.expiresAt};
}
export function timelineQuery(url,principal){
 for(const key of url.searchParams.keys())ensure(['limit','cursor'].includes(key)&&url.searchParams.getAll(key).length===1,422,'INVALID_QUERY','查询参数不支持或重复');
 const limit=Number(url.searchParams.get('limit')??50);ensure(Number.isInteger(limit)&&limit>=1&&limit<=100,422,'INVALID_LIMIT','limit须为1到100');const binding=JSON.stringify([principal.companyId,principal.principalId,limit]);let after=null;const token=url.searchParams.get('cursor');
 if(token!==null){try{const [payload,signature,...rest]=token.split('.');ensure(token.length<=2048&&signature&&rest.length===0&&signature.length===43&&timingSafeEqual(Buffer.from(signature),Buffer.from(sign(payload))),422,'INVALID_CURSOR','游标无效或已失效');const decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));ensure(decoded.binding===binding&&Date.parse(decoded.occurredAt)&&typeof decoded.sourceKey==='string'&&decoded.expiresAt>Date.now(),422,'INVALID_CURSOR','游标无效或已失效');after=decoded;}catch{ensure(false,422,'INVALID_CURSOR','游标无效或已失效');}}
 return {limit,after,cursor:row=>{const payload=Buffer.from(JSON.stringify({binding,occurredAt:row.occurred_at,sourceKey:row.source_key,expiresAt:Date.now()+3600000})).toString('base64url');return payload+'.'+sign(payload)}};
}
export async function customerTimeline(client,principal,orderId,query){
 const access=await client.query('SELECT 1 FROM orders.draft WHERE company_id=$1 AND id=$2',[principal.companyId,orderId]);ensure(access.rowCount,404,'NOT_FOUND','资源不存在');
 const rows=(await client.query(`SELECT occurred_at::text,source_key,type,summary FROM (
  SELECT created_at AS occurred_at,'order:'||version::text AS source_key,'ORDER_RECORDED' AS type,'订单信息已记录' AS summary FROM orders.draft_revision WHERE company_id=$1 AND order_id=$2
  UNION ALL SELECT created_at,'quote:'||id::text,'QUOTE_ISSUED','已生成报价' FROM pricing.order_quote WHERE company_id=$1 AND order_id=$2
  UNION ALL SELECT created_at,'quote-confirmation:'||quote_id::text,'QUOTE_CONFIRMED','报价确认已记录' FROM pricing.quote_confirmation WHERE company_id=$1 AND order_id=$2
  UNION ALL SELECT (snapshot->>'createdAt')::timestamptz,'service-case:'||id::text,'SERVICE_REQUESTED','已提交服务申请' FROM casework.service_case WHERE company_id=$1 AND order_id=$2
 ) event WHERE ($3::timestamptz IS NULL OR (occurred_at,source_key)<($3::timestamptz,$4::text)) ORDER BY occurred_at DESC,source_key DESC LIMIT $5`,[principal.companyId,orderId,query.after?.occurredAt??null,query.after?.sourceKey??null,query.limit+1])).rows;
 const selected=rows.slice(0,query.limit);return {items:selected.map(row=>({id:timelineId(`${principal.companyId}:${orderId}:${row.source_key}`),type:row.type,occurredAt:new Date(row.occurred_at).toISOString(),summary:row.summary,evidenceFileIds:[]})),nextCursor:rows.length>query.limit?query.cursor(selected.at(-1)):null};
}
