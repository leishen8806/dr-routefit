import {randomUUID,randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {getOrder} from './orders.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cursorKey=randomBytes(32),sign=value=>createHmac('sha256',cursorKey).update(value).digest('base64url');
const person=async(c,p)=>(await c.query('SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2',[p.companyId,p.principalId])).rows[0].person_id;
const stamp=(p,input,personId)=>({principalId:p.principalId,personId,...input,recordedAt:new Date().toISOString(),sourceQuality:'MANUAL_RECORDED'});
function page(url,p){
 for(const key of url.searchParams.keys())ensure(['limit','cursor'].includes(key)&&url.searchParams.getAll(key).length===1,422,'INVALID_QUERY','查询参数不支持或重复');
 const limit=Number(url.searchParams.get('limit')??50);ensure(Number.isInteger(limit)&&limit>=1&&limit<=100,422,'INVALID_LIMIT','limit须为1到100');
 const binding=JSON.stringify([p.companyId,p.principalId,limit]),token=url.searchParams.get('cursor');let after=null;
 if(token!==null){try{const [payload,signature,...rest]=token.split('.');ensure(token.length<=2048&&signature&&rest.length===0&&signature.length===43&&timingSafeEqual(Buffer.from(signature),Buffer.from(sign(payload))),422,'INVALID_CURSOR','游标无效或已失效');const decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));ensure(decoded.binding===binding&&decoded.expiresAt>Date.now()&&uuid.test(decoded.after),422,'INVALID_CURSOR','游标无效或已失效');after=decoded.after;}catch{ensure(false,422,'INVALID_CURSOR','游标无效或已失效');}}
 return {limit,after,cursor:id=>{const payload=Buffer.from(JSON.stringify({binding,after:id,expiresAt:Date.now()+3600000})).toString('base64url');return payload+'.'+sign(payload)}};
}
export function caseQuery(url,p){return page(url,p);}
async function caseRecord(c,p,id){
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');
 const row=(await c.query('SELECT snapshot FROM casework.service_case WHERE company_id=$1 AND id=$2',[p.companyId,id])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');
 const event=(await c.query('SELECT snapshot FROM casework.service_case_event WHERE company_id=$1 AND case_id=$2',[p.companyId,id])).rows[0]?.snapshot;
 const amendment=(await c.query('SELECT quote_id FROM pricing.amendment_quote WHERE company_id=$1 AND case_id=$2',[p.companyId,id])).rows[0]?.quote_id??null;
 return {snapshot:row.snapshot,event,amendment};
}
export async function serviceCase(c,p,id){
 const {snapshot,event,amendment}=await caseRecord(c,p,id);
 const state=event?({ACCEPT:'accepted',REJECT:'rejected',REQUEST_CUSTOMER_CONSENT:'needs_customer_consent'}[event.decision]):'submitted';
 return {id:snapshot.id,version:event?2:1,orderId:snapshot.orderId,type:snapshot.type,state,ownerDisplayName:event?.ownerDisplayName??null,nextAction:event?.nextAction??'等待运营受理',relatedQuoteId:amendment??event?.newQuoteId??null,relatedFinanceDocumentId:event?.financeDocumentId??null};
}
export async function readCases(c,p,kind,id,query){
 if(kind==='detail')return serviceCase(c,p,id);
 const rows=(await c.query('SELECT id FROM casework.service_case WHERE company_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',[p.companyId,query.after,query.limit+1])).rows;
 const selected=rows.slice(0,query.limit),items=[];for(const row of selected)items.push(await serviceCase(c,p,row.id));return {items,nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}
export async function writeCase(c,p,kind,id,input,version){
 const who=await person(c,p);
 if(kind==='ops-create'){
  const order=await getOrder(c,p,input.orderId,true);
  ensure(order.order.version===input.orderVersion,412,'VERSION_CONFLICT','订单版本已变化');
  ensure(input.type==='ADDRESS_CHANGE',422,'CHANGE_TYPE_NOT_SUPPORTED','运营代登记当前只支持改址');
  ensure(input.requestedDelivery,422,'CHANGE_DETAILS_REQUIRED','改地址须提供新的送达地点');
  ensure(order.order.state==='quoted'&&!order.activeExecutionId,409,'CHANGE_NOT_AVAILABLE','当前订单不允许申请变更');
  const customerConsent={channel:input.customerConsentChannel,reference:input.customerConsentReference,confirmedAt:input.customerConsentConfirmedAt};
  ensure(customerConsent.channel&&customerConsent.reference&&customerConsent.confirmedAt,422,'CUSTOMER_CONSENT_REQUIRED','缺少客户同意依据');
  const snapshot={id:randomUUID(),orderId:input.orderId,customerId:order.order.customerId,type:input.type,preparedBy:p.principalId,personId:who,...input,customerConsent,createdAt:new Date().toISOString()};
  await c.query('INSERT INTO casework.service_case(id,company_id,customer_id,order_id,prepared_by,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[snapshot.id,p.companyId,snapshot.customerId,snapshot.orderId,p.principalId,who,snapshot]);
  return serviceCase(c,p,snapshot.id);
 }
 if(kind==='create'){
  const order=await getOrder(c,p,input.orderId,true);ensure(order.order.version===input.orderVersion,412,'VERSION_CONFLICT','订单版本已变化');
  const restricted=['ADDRESS_CHANGE','TIME_CHANGE'];
  if(input.type==='ADDRESS_CHANGE')ensure(input.requestedDelivery,422,'CHANGE_DETAILS_REQUIRED','改地址须提供新的送达地点');
  if(input.type==='TIME_CHANGE')ensure(input.requestedWindow,422,'CHANGE_DETAILS_REQUIRED','改时间须提供新的送达窗口');
  if(restricted.includes(input.type))ensure(order.order.state==='quoted'&&!order.activeExecutionId,409,'CHANGE_NOT_AVAILABLE','当前订单不允许申请变更');
  const snapshot={id:randomUUID(),orderId:input.orderId,customerId:order.order.customerId,type:input.type,preparedBy:p.principalId,personId:who,...input,createdAt:new Date().toISOString()};
  await c.query('INSERT INTO casework.service_case(id,company_id,customer_id,order_id,prepared_by,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[snapshot.id,p.companyId,snapshot.customerId,snapshot.orderId,p.principalId,who,snapshot]);return serviceCase(c,p,snapshot.id);
 }
 let current=await serviceCase(c,p,id);ensure(current.version===version,412,'VERSION_CONFLICT','申请已变化');ensure(current.state==='submitted',409,'INVALID_STATE','申请已处理');
 const order=await getOrder(c,p,current.orderId,true);current=await serviceCase(c,p,id);ensure(current.version===version,412,'VERSION_CONFLICT','申请已变化');
 ensure(order.order.state==='quoted'&&!order.activeExecutionId,409,'CHANGE_NOT_AVAILABLE','当前订单不允许受理变更');
 const record=await caseRecord(c,p,id);ensure(input.reason.trim(),422,'REASON_REQUIRED','须说明处理依据');ensure(who!==record.snapshot.personId,403,'INDEPENDENT_REVIEW_REQUIRED','经办人与受理人必须是不同人员');
 if(input.newQuoteId)ensure(uuid.test(input.newQuoteId),422,'INVALID_REFERENCE','报价引用无效');
 if(input.newPromiseId)ensure(uuid.test(input.newPromiseId),422,'INVALID_REFERENCE','承诺引用无效');
 if(input.financeDocumentId)ensure(uuid.test(input.financeDocumentId),422,'INVALID_REFERENCE','财务单据引用无效');
 const snapshot={...stamp(p,input,who),ownerDisplayName:null,nextAction:input.decision==='ACCEPT'?'等待独立领域动作生效':input.decision==='REQUEST_CUSTOMER_CONSENT'?'等待客户确认新的费用或承诺':'申请已拒绝'};
 await c.query('INSERT INTO casework.service_case_event(company_id,case_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,2,$3,$4,$5,$6)',[p.companyId,id,input.decision,p.principalId,who,snapshot]);return serviceCase(c,p,id);
}
