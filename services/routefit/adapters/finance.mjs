import {createHash,randomBytes,randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {currentCustomer,getOrder} from './orders.mjs';
import {refundReserved} from './settlement.mjs';
import {driverIdentity} from './driver.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cursorKey=randomBytes(32),sign=value=>createHmac('sha256',cursorKey).update(value).digest('base64url');
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
export const phnomDate=value=>{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `${parts.year}-${parts.month}-${parts.day}`};
export function ledgerQuery(url,p){
 for(const key of url.searchParams.keys())ensure(['limit','cursor','orderId'].includes(key),422,'INVALID_QUERY','查询参数不支持');
 const raw=url.searchParams.get('limit')??'50';ensure(/^[1-9][0-9]*$/.test(raw)&&Number(raw)<=100,422,'INVALID_LIMIT','limit须为1到100');
 const orderIds=url.searchParams.getAll('orderId');ensure(orderIds.length<=20&&orderIds.every(value=>uuid.test(value)),422,'INVALID_QUERY','orderId无效');
 const binding=JSON.stringify([p.companyId,p.principalId,Number(raw),orderIds]),token=url.searchParams.get('cursor');let after=null;
 if(token!==null){try{const [payload,signature,...rest]=token.split('.');ensure(token.length<=2048&&signature&&rest.length===0&&signature.length===43&&timingSafeEqual(Buffer.from(signature),Buffer.from(sign(payload))),422,'INVALID_CURSOR','游标无效或已失效');const decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));ensure(decoded.binding===binding&&decoded.expiresAt>Date.now()&&uuid.test(decoded.after),422,'INVALID_CURSOR','游标无效或已失效');after=decoded.after;}catch{ensure(false,422,'INVALID_CURSOR','游标无效或已失效');}}
 return {limit:Number(raw),after,orderIds,cursor:id=>{const payload=Buffer.from(JSON.stringify({binding,after:id,expiresAt:Date.now()+3600000})).toString('base64url');return payload+'.'+sign(payload)}};
}
export function reportQuery(url,p,customer=false){
 const allowed=customer?['limit','cursor','currency']:['limit','cursor','currency','subjectId','dueBefore','direction'];
 for(const key of url.searchParams.keys())ensure(allowed.includes(key)&&url.searchParams.getAll(key).length===1,422,'INVALID_QUERY','查询参数不支持或重复');
 const limit=Number(url.searchParams.get('limit')??50),currency=url.searchParams.get('currency')??null,subjectId=customer?null:url.searchParams.get('subjectId')??null,dueBefore=customer?null:url.searchParams.get('dueBefore')??null,direction=customer?null:url.searchParams.get('direction')??null;
 ensure(Number.isInteger(limit)&&limit>=1&&limit<=100,422,'INVALID_LIMIT','limit须为1到100');ensure(!currency||['USD','KHR'].includes(currency),422,'INVALID_QUERY','币种无效');ensure(!subjectId||uuid.test(subjectId),422,'INVALID_QUERY','对象ID无效');ensure(!dueBefore||/^\d{4}-\d{2}-\d{2}$/.test(dueBefore),422,'INVALID_QUERY','到期日无效');ensure(!direction||['RECEIVABLE','PAYABLE'].includes(direction),422,'INVALID_QUERY','方向无效');
 const binding=JSON.stringify(['ledger-report',customer,p.companyId,p.principalId,limit,currency,subjectId,dueBefore,direction]),token=url.searchParams.get('cursor');let after=null;
 if(token!==null){try{const [payload,signature,...rest]=token.split('.');ensure(token.length<=2048&&signature&&rest.length===0&&signature.length===43&&timingSafeEqual(Buffer.from(signature),Buffer.from(sign(payload))),422,'INVALID_CURSOR','游标无效或已失效');const decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));ensure(decoded.binding===binding&&decoded.expiresAt>Date.now()&&uuid.test(decoded.after),422,'INVALID_CURSOR','游标无效或已失效');after=decoded.after;}catch{ensure(false,422,'INVALID_CURSOR','游标无效或已失效');}}
 return {limit,currency,subjectId,dueBefore,direction,after,cursor:id=>{const payload=Buffer.from(JSON.stringify({binding,after:id,expiresAt:Date.now()+3600000})).toString('base64url');return payload+'.'+sign(payload)}};
}
export function moneyOverviewQuery(url){
 for(const key of url.searchParams.keys())ensure(key==='currency'&&url.searchParams.getAll(key).length===1,422,'INVALID_QUERY','查询参数不支持或重复');
 const currency=url.searchParams.get('currency');ensure(['USD','KHR'].includes(currency),422,'INVALID_QUERY','必须指定有效币种');return {currency};
}
export function documentQuery(url,p){
 for(const key of url.searchParams.keys())ensure(['limit','cursor'].includes(key)&&url.searchParams.getAll(key).length===1,422,'INVALID_QUERY','查询参数不支持或重复');
 const limit=Number(url.searchParams.get('limit')??50);ensure(Number.isInteger(limit)&&limit>=1&&limit<=100,422,'INVALID_LIMIT','limit须为1到100');const binding=JSON.stringify(['documents',p.companyId,p.principalId,limit]),token=url.searchParams.get('cursor');let after=null;
 if(token!==null){try{const [payload,signature,...rest]=token.split('.');ensure(token.length<=2048&&signature&&rest.length===0&&signature.length===43&&timingSafeEqual(Buffer.from(signature),Buffer.from(sign(payload))),422,'INVALID_CURSOR','游标无效或已失效');const decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));ensure(decoded.binding===binding&&decoded.expiresAt>Date.now()&&uuid.test(decoded.after),422,'INVALID_CURSOR','游标无效或已失效');after=decoded.after;}catch{ensure(false,422,'INVALID_CURSOR','游标无效或已失效');}}
 return {limit,after,cursor:id=>{const payload=Buffer.from(JSON.stringify({binding,after:id,expiresAt:Date.now()+3600000})).toString('base64url');return payload+'.'+sign(payload)} };
}
export function receiptQuery(url,p,kind='receipts'){
 for(const key of url.searchParams.keys())ensure(['limit','cursor'].includes(key)&&url.searchParams.getAll(key).length===1,422,'INVALID_QUERY','查询参数不支持或重复');
 const limit=Number(url.searchParams.get('limit')??50);ensure(Number.isInteger(limit)&&limit>=1&&limit<=100,422,'INVALID_LIMIT','limit须为1到100');const binding=JSON.stringify([kind,p.companyId,p.principalId,limit]),token=url.searchParams.get('cursor');let after=null;
 if(token!==null){try{const [payload,signature,...rest]=token.split('.');ensure(token.length<=2048&&signature&&rest.length===0&&signature.length===43&&timingSafeEqual(Buffer.from(signature),Buffer.from(sign(payload))),422,'INVALID_CURSOR','游标无效或已失效');const decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));ensure(decoded.binding===binding&&decoded.expiresAt>Date.now()&&uuid.test(decoded.after),422,'INVALID_CURSOR','游标无效或已失效');after=decoded.after;}catch{ensure(false,422,'INVALID_CURSOR','游标无效或已失效');}}
 return {limit,after,cursor:id=>{const payload=Buffer.from(JSON.stringify({binding,after:id,expiresAt:Date.now()+3600000})).toString('base64url');return payload+'.'+sign(payload)} };
}
export function driverIncomeQuery(url,p){
 for(const key of url.searchParams.keys())ensure(['limit','cursor'].includes(key)&&url.searchParams.getAll(key).length===1,422,'INVALID_QUERY','查询参数不支持或重复');
 const limit=Number(url.searchParams.get('limit')??50);ensure(Number.isInteger(limit)&&limit>=1&&limit<=100,422,'INVALID_LIMIT','limit须为1到100');
 const binding=JSON.stringify(['driver-income',p.companyId,p.principalId,limit]),token=url.searchParams.get('cursor');let after=null;
 if(token!==null){try{const [payload,signature,...rest]=token.split('.');ensure(token.length<=2048&&signature&&rest.length===0&&signature.length===43&&timingSafeEqual(Buffer.from(signature),Buffer.from(sign(payload))),422,'INVALID_CURSOR','游标无效或已失效');const decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));ensure(decoded.binding===binding&&decoded.expiresAt>Date.now()&&uuid.test(decoded.after),422,'INVALID_CURSOR','游标无效或已失效');after=decoded.after;}catch{ensure(false,422,'INVALID_CURSOR','游标无效或已失效');}}
 return {limit,after,cursor:id=>{const payload=Buffer.from(JSON.stringify({binding,after:id,expiresAt:Date.now()+3600000})).toString('base64url');return payload+'.'+sign(payload)}};
}
export function taskQuery(url,p){
 for(const key of url.searchParams.keys())ensure(['limit','cursor','type','currency','subjectId'].includes(key)&&url.searchParams.getAll(key).length===1,422,'INVALID_QUERY','查询参数不支持或重复');
 const limit=Number(url.searchParams.get('limit')??50);ensure(Number.isInteger(limit)&&limit>=1&&limit<=100,422,'INVALID_LIMIT','limit须为1到100');
 const type=url.searchParams.get('type'),currency=url.searchParams.get('currency'),subjectId=url.searchParams.get('subjectId');
 ensure(!type||['RECEIPT_REVIEW','CASH_COUNT','DOCUMENT_REVIEW','APPROVAL','EXECUTE','RECONCILE','ISSUE_STATEMENT','COLLECT','PAY','CHANNEL_SETTLEMENT','DIFFERENCE'].includes(type),422,'INVALID_QUERY','待办类型无效');
 ensure(!currency||['USD','KHR'].includes(currency),422,'INVALID_QUERY','币种无效');ensure(!subjectId||uuid.test(subjectId),422,'INVALID_QUERY','对象ID无效');
 const binding=JSON.stringify(['tasks',p.companyId,p.principalId,limit,type,currency,subjectId]),token=url.searchParams.get('cursor');let after=null;
 if(token!==null){try{const [payload,signature,...rest]=token.split('.');ensure(token.length<=2048&&signature&&rest.length===0&&signature.length===43&&timingSafeEqual(Buffer.from(signature),Buffer.from(sign(payload))),422,'INVALID_CURSOR','游标无效或已失效');const decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));ensure(decoded.binding===binding&&decoded.expiresAt>Date.now()&&uuid.test(decoded.after?.id)&&Number.isFinite(Date.parse(decoded.after?.dueAt)),422,'INVALID_CURSOR','游标无效或已失效');after=decoded.after;}catch{ensure(false,422,'INVALID_CURSOR','游标无效或已失效');}}
 return {limit,type,currency,subjectId,after,cursor:after=>{const payload=Buffer.from(JSON.stringify({binding,after,expiresAt:Date.now()+3600000})).toString('base64url');return payload+'.'+sign(payload)}};
}
const person=async(c,p)=>(await c.query('SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2',[p.companyId,p.principalId])).rows[0].person_id;
const stateOf=events=>events.length?({SUBMITTED:'submitted',REVIEWED:'reviewed',APPROVED:'approved',REJECTED:'rejected',POSTED:'posted'}[events.at(-1).action]):'draft';
const roleOf=action=>({SUBMITTED:'MAKER',REVIEWED:'REVIEWER',APPROVED:'APPROVER',REJECTED:'REVIEWER',POSTED:'APPROVER'}[action]);
async function adjustmentRecord(c,p,id){
 const row=(await c.query('SELECT snapshot FROM finance.amendment_adjustment WHERE company_id=$1 AND id=$2',[p.companyId,id])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');
 const events=(await c.query('SELECT version,action,person_id,snapshot FROM finance.amendment_adjustment_event WHERE company_id=$1 AND adjustment_id=$2 ORDER BY version',[p.companyId,id])).rows;
 return {snapshot:row.snapshot,events};
}
export async function financeDocument(c,p,id){
 const {snapshot,events}=await adjustmentRecord(c,p,id),output=(await c.query('SELECT id FROM finance.amendment_ledger_adjustment WHERE company_id=$1 AND adjustment_id=$2',[p.companyId,id])).rows[0];
 const contentHash=digest(snapshot.details),history=[{personId:snapshot.makerPersonId,role:'MAKER',documentVersion:1,contentHash,at:snapshot.createdAt,comment:snapshot.reason},...events.map(event=>({personId:event.person_id,role:roleOf(event.action),documentVersion:Number(event.version),contentHash,at:event.snapshot.recordedAt,comment:event.snapshot.reason}))];
 return {id:snapshot.id,version:events.length?Number(events.at(-1).version):1,kind:'ADJUSTMENT',state:stateOf(events),money:snapshot.details.money,subjectId:snapshot.subjectId,makerPersonId:snapshot.makerPersonId,contentHash,sourceIds:[snapshot.details.ledgerItemId,snapshot.details.candidateQuoteId,...(output?[output.id]:[])],accountSnapshot:null,history,reason:snapshot.reason,details:snapshot.details};
}
export async function readFinanceDocuments(c,p,kind,id,query){
 if(kind==='document')return financeDocument(c,p,id);
 const rows=(await c.query('SELECT id FROM finance.amendment_adjustment WHERE company_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',[p.companyId,query.after,query.limit+1])).rows,selected=rows.slice(0,query.limit),items=[];
 for(const row of selected)items.push(await financeDocument(c,p,row.id));return {items,nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}
const minor=value=>{const result=Number(value);ensure(Number.isSafeInteger(result)&&result>=0&&result<=9000000000000,500,'INVALID_RECEIPT_BALANCE','收款余额数据无效');return result;};
async function genericReceipt(c,p,id){
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');
 const row=(await c.query('SELECT snapshot FROM finance.receipt WHERE company_id=$1 AND id=$2',[p.companyId,id])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');
 const confirmation=(await c.query('SELECT snapshot FROM finance.receipt_confirmation WHERE company_id=$1 AND receipt_id=$2',[p.companyId,id])).rows[0]?.snapshot;
 const snapshot=row.snapshot,reserved=confirmation?await refundReserved(c,p,'generic',id):0;return {id:snapshot.id,version:confirmation?2:1,payerSubjectId:snapshot.payerSubjectId,money:snapshot.money,method:snapshot.method,state:confirmation?'confirmed':'reported',custodyType:snapshot.custodyType,custodianSubjectId:snapshot.custodianSubjectId,confirmedAt:confirmation?.recordedAt??null,allocatedMinor:0,unallocatedMinor:confirmation?minor(BigInt(snapshot.money.amountMinor)-BigInt(reserved)):0,refundReservedMinor:reserved,refundedMinor:0,evidenceFileIds:snapshot.evidenceFileIds};
}
async function receiptOrders(c,p,input,customerId){
 ensure(new Set(input.orderIds).size===input.orderIds.length,422,'DUPLICATE_ORDER','同一订单不得重复关联收款');
 const orders=[];for(const id of input.orderIds){const order=await getOrder(c,p,id,true);ensure(!customerId||order.order.customerId===customerId,404,'NOT_FOUND','资源不存在');orders.push(order);}
 const payer=customerId??input.payerSubjectId;ensure(orders.every(order=>order.order.customerId===payer),422,'PAYER_ORDER_MISMATCH','付款主体必须与所有订单货主一致');return {orders,payer};
}
async function receiptEvidence(c,p,orderIds,ids){
 ensure(new Set(ids).size===ids.length,422,'DUPLICATE_EVIDENCE','证据不得重复');
 const sql=orderIds.length?"SELECT count(*)::integer AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND resource_type='ORDER' AND resource_id=ANY($3::uuid[]) AND state='available'":'SELECT count(*)::integer AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND state=\'available\'';
 const found=(await c.query(sql,orderIds.length?[p.companyId,ids,orderIds]:[p.companyId,ids])).rows[0].count;
 ensure(found===ids.length,422,'EVIDENCE_UNAVAILABLE','证据不存在、未完成或不属于关联订单');
}
export async function writeReceipt(c,p,kind,id,input,version){
 const who=await person(c,p);
 if(kind==='receipt-report'||kind==='customer-receipt-report'){
  const customerId=kind==='customer-receipt-report'?await currentCustomer(c,p):null,{orders,payer}=await receiptOrders(c,p,input,customerId);
  if(!orders.length){const payerRow=(await c.query("SELECT id FROM party.customer WHERE company_id=$1 AND id=$2 AND status='ACTIVE'",[p.companyId,payer])).rows[0];ensure(payerRow,404,'NOT_FOUND','付款主体不存在');}
  ensure(input.externalReference.trim()&&Date.parse(input.observedAt)<=Date.now(),422,'INVALID_RECEIPT','交易引用不能为空且到账时间不得在未来');
  const method=kind==='customer-receipt-report'?'BANK_TRANSFER':input.method;
  ensure(method==='BANK_TRANSFER'||method==='CASH',422,'INVALID_RECEIPT_METHOD','收款方式不支持');
  if(method==='BANK_TRANSFER')ensure(input.receivingAccountId,422,'RECEIVING_ACCOUNT_REQUIRED','银行收款须指定公司收款账户');
  const account=input.receivingAccountId?(await c.query('SELECT id,currency FROM finance.receiving_account WHERE company_id=$1 AND id=$2 AND active',[p.companyId,input.receivingAccountId])).rows[0]:null;
  ensure(!input.receivingAccountId||account,404,'NOT_FOUND','收款账户不存在');ensure(!account||account.currency===input.money.currency,422,'CURRENCY_MISMATCH','收款账户币种不一致');
  await receiptEvidence(c,p,orders.map(order=>order.order.id),input.evidenceFileIds);
  const snapshot={id:randomUUID(),payerSubjectId:payer,money:input.money,method,custodyType:'COMPANY',custodianSubjectId:p.companyId,receivingAccountId:input.receivingAccountId??null,externalReference:input.externalReference.trim().toUpperCase(),orderIds:orders.map(order=>order.order.id),evidenceFileIds:input.evidenceFileIds,observedAt:input.observedAt,preparedBy:p.principalId,personId:who,recordedAt:new Date().toISOString()};
  await c.query('INSERT INTO finance.receipt(id,company_id,payer_subject_id,money_amount_minor,money_currency,method,receiving_account_id,external_reference,custody_type,custodian_subject_id,observed_at,prepared_by,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[snapshot.id,p.companyId,payer,snapshot.money.amountMinor,snapshot.money.currency,snapshot.method,snapshot.receivingAccountId,snapshot.externalReference,snapshot.custodyType,snapshot.custodianSubjectId,snapshot.observedAt,p.principalId,who,snapshot]);
  for(const orderId of snapshot.orderIds)await c.query('INSERT INTO finance.receipt_order(company_id,receipt_id,order_id) VALUES($1,$2,$3)',[p.companyId,snapshot.id,orderId]);
  for(const evidenceId of snapshot.evidenceFileIds)await c.query('INSERT INTO finance.receipt_evidence(company_id,receipt_id,evidence_file_id) VALUES($1,$2,$3)',[p.companyId,snapshot.id,evidenceId]);
  return genericReceipt(c,p,snapshot.id);
 }
 const current=await genericReceipt(c,p,id);ensure(current.version===version,412,'VERSION_CONFLICT','收款申报已变化');ensure(current.state==='reported',409,'RECEIPT_NOT_CONFIRMABLE','收款当前不可确认');
 const base=(await c.query('SELECT snapshot FROM finance.receipt WHERE company_id=$1 AND id=$2',[p.companyId,id])).rows[0].snapshot;ensure(base.personId!==who,403,'INDEPENDENT_REVIEW_REQUIRED','不能确认本人申报，包括同人不同账号');ensure(input.reason.trim(),422,'REASON_REQUIRED','须记录确认依据');
 await receiptEvidence(c,p,base.orderIds,input.evidenceFileIds);
 const snapshot={receiptId:id,version:2,principalId:p.principalId,personId:who,reason:input.reason.trim(),evidenceFileIds:input.evidenceFileIds,receivingAccountId:base.receivingAccountId,externalReference:base.externalReference,recordedAt:new Date().toISOString()};
 try{await c.query('INSERT INTO finance.receipt_confirmation(company_id,receipt_id,version,principal_id,person_id,snapshot) VALUES($1,$2,2,$3,$4,$5)',[p.companyId,id,p.principalId,who,snapshot]);}catch(error){if(error.code==='23505')ensure(false,409,'RECEIPT_ALREADY_CONFIRMED','收款已确认或交易引用已使用');throw error;}
 return genericReceipt(c,p,id);
}
async function receiptItem(c,p,row){
 const decision=(await c.query('SELECT snapshot FROM finance.receipt_decision WHERE company_id=$1 AND receipt_id=$2',[p.companyId,row.id])).rows[0]?.snapshot;
 const allocated=BigInt((await c.query("SELECT COALESCE(sum((a.snapshot->>'amountMinor')::bigint),0) AS total FROM finance.prepayment_allocation a JOIN finance.allocation_event e ON (a.company_id,a.id)=(e.company_id,e.allocation_id) WHERE a.company_id=$1 AND a.receipt_id=$2 AND e.action='POSTED' AND NOT EXISTS(SELECT 1 FROM finance.reversal_event r WHERE r.company_id=a.company_id AND r.allocation_id=a.id AND r.action='POSTED')",[p.companyId,row.id])).rows[0].total),confirmed=decision?.approve===true,total=BigInt(row.snapshot.money.amountMinor),reserved=confirmed?await refundReserved(c,p,'prepayment',row.id):0;
 return {id:row.id,version:decision?2:1,payerSubjectId:row.customer_id,money:row.snapshot.money,method:'BANK_TRANSFER',state:confirmed?'confirmed':decision?'disputed':'reported',custodyType:'COMPANY',custodianSubjectId:p.companyId,confirmedAt:confirmed?decision.recordedAt:null,allocatedMinor:minor(allocated),unallocatedMinor:confirmed?minor(total-allocated-BigInt(reserved)):0,refundReservedMinor:reserved,refundedMinor:0,evidenceFileIds:[]};
}
export async function readReceipts(c,p,query){
 const rows=(await c.query("SELECT id,'GENERIC' AS source FROM finance.receipt WHERE company_id=$1 AND ($2::uuid IS NULL OR id>$2) UNION ALL SELECT id,'PREPAYMENT' AS source FROM finance.prepayment_receipt WHERE company_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3",[p.companyId,query.after,query.limit+1])).rows,selected=rows.slice(0,query.limit),items=[];
 for(const row of selected)items.push(row.source==='GENERIC'?await genericReceipt(c,p,row.id):await receiptItem(c,p,(await c.query('SELECT r.id,r.snapshot,d.customer_id FROM finance.prepayment_receipt r JOIN orders.draft d ON (d.company_id,d.id)=(r.company_id,r.order_id) WHERE r.company_id=$1 AND r.id=$2',[p.companyId,row.id])).rows[0]));return {items,nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}
export async function readReceipt(c,p,id){
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');
 const generic=(await c.query('SELECT 1 FROM finance.receipt WHERE company_id=$1 AND id=$2',[p.companyId,id])).rowCount;if(generic)return genericReceipt(c,p,id);
 const row=(await c.query('SELECT r.id,r.snapshot,d.customer_id FROM finance.prepayment_receipt r JOIN orders.draft d ON (d.company_id,d.id)=(r.company_id,r.order_id) WHERE r.company_id=$1 AND r.id=$2',[p.companyId,id])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');
 return receiptItem(c,p,row);
}
export async function readFinanceTasks(c,p,query,taskId=null){
 const rows=(await c.query(`WITH tasks AS (
  SELECT r.id,1::bigint AS version,'RECEIPT_REVIEW'::text AS type,d.customer_id AS subject_id,r.id AS source_id,jsonb_build_object('amountMinor',r.amount_minor,'currency',r.currency) AS money,NULL::uuid AS owner_id,(r.snapshot->>'recordedAt')::timestamptz AS due_at,'核对银行交易、金额、币种和收款账户'::text AS next_action FROM finance.prepayment_receipt r JOIN orders.draft d ON (d.company_id,d.id)=(r.company_id,r.order_id) LEFT JOIN finance.receipt_decision rd ON (rd.company_id,rd.receipt_id)=(r.company_id,r.id) WHERE r.company_id=$1 AND rd.receipt_id IS NULL
  UNION ALL SELECT r.id,1::bigint,'RECEIPT_REVIEW',r.payer_subject_id,r.id,jsonb_build_object('amountMinor',r.money_amount_minor,'currency',r.money_currency),NULL::uuid,(r.snapshot->>'recordedAt')::timestamptz,'核对银行交易、金额、币种和收款账户' FROM finance.receipt r LEFT JOIN finance.receipt_confirmation rc ON (rc.company_id,rc.receipt_id)=(r.company_id,r.id) WHERE r.company_id=$1 AND rc.receipt_id IS NULL
  UNION ALL SELECT a.id,e.version::bigint,CASE e.action WHEN 'SUBMITTED' THEN 'DOCUMENT_REVIEW' WHEN 'REVIEWED' THEN 'APPROVAL' END,(a.snapshot->>'subjectId')::uuid,a.id,a.snapshot#>'{details,money}',NULL::uuid,COALESCE((e.snapshot->>'recordedAt')::timestamptz,(a.snapshot->>'createdAt')::timestamptz),CASE e.action WHEN 'SUBMITTED' THEN '独立复核调整依据、金额和关联账项' WHEN 'REVIEWED' THEN '独立审批已复核的调整单' END FROM finance.amendment_adjustment a JOIN LATERAL (SELECT version,action,snapshot FROM finance.amendment_adjustment_event e WHERE e.company_id=a.company_id AND e.adjustment_id=a.id ORDER BY version DESC LIMIT 1) e ON true WHERE a.company_id=$1 AND e.action IN ('SUBMITTED','REVIEWED')
  UNION ALL SELECT l.id,1::bigint,'COLLECT',(l.snapshot->>'subjectId')::uuid,l.id,jsonb_build_object('amountMinor',GREATEST(0::bigint,(l.snapshot->>'originalMinor')::bigint-COALESCE((SELECT sum((line->>'amountMinor')::bigint) FROM finance.prepayment_allocation a JOIN finance.allocation_event e ON (a.company_id,a.id)=(e.company_id,e.allocation_id) CROSS JOIN LATERAL jsonb_array_elements(a.snapshot->'lines') line WHERE a.company_id=l.company_id AND a.quote_id=l.quote_id AND line->>'feeId'=l.fee_id::text AND e.action='POSTED' AND NOT EXISTS(SELECT 1 FROM finance.reversal_event r WHERE r.company_id=a.company_id AND r.allocation_id=a.id AND r.action='POSTED')),0::bigint)),'currency',l.snapshot->>'currency'),NULL::uuid,((l.snapshot->>'dueDate')||'T00:00:00+07:00')::timestamptz,'客户尚有费用未结；按账期跟进收款' FROM finance.ledger_item l WHERE l.company_id=$1 AND l.snapshot->>'direction'='RECEIVABLE' AND GREATEST(0::bigint,(l.snapshot->>'originalMinor')::bigint-COALESCE((SELECT sum((line->>'amountMinor')::bigint) FROM finance.prepayment_allocation a JOIN finance.allocation_event e ON (a.company_id,a.id)=(e.company_id,e.allocation_id) CROSS JOIN LATERAL jsonb_array_elements(a.snapshot->'lines') line WHERE a.company_id=l.company_id AND a.quote_id=l.quote_id AND line->>'feeId'=l.fee_id::text AND e.action='POSTED' AND NOT EXISTS(SELECT 1 FROM finance.reversal_event r WHERE r.company_id=a.company_id AND r.allocation_id=a.id AND r.action='POSTED')),0::bigint))>0
  UNION ALL SELECT l.id,1::bigint,'COLLECT',(l.snapshot->>'subjectId')::uuid,l.id,l.snapshot#>'{money}',NULL::uuid,((l.snapshot->>'dueDate')||'T00:00:00+07:00')::timestamptz,'客户尚有费用未结；按账期跟进收款' FROM finance.amendment_ledger_adjustment l WHERE l.company_id=$1 AND l.snapshot->>'direction'='RECEIVABLE' AND COALESCE((l.snapshot->>'outstandingMinor')::bigint,0)>0
 ), visible AS (
  SELECT t.*,h.version AS hold_version,h.until_at FROM tasks t LEFT JOIN LATERAL (SELECT version,until_at FROM finance.task_hold_event h WHERE h.company_id=$1 AND h.task_id=t.id AND h.task_type=t.type ORDER BY version DESC LIMIT 1) h ON true
 ) SELECT id,version,type,subject_id,source_id,money,owner_id,due_at,next_action,hold_version,until_at FROM visible WHERE ($2::text IS NULL OR type=$2) AND ($3::text IS NULL OR money->>'currency'=$3) AND ($4::uuid IS NULL OR subject_id=$4) AND ($5::uuid IS NULL OR id=$5) AND ($6::timestamptz IS NULL OR (due_at,id)<($6::timestamptz,$7::uuid)) ORDER BY due_at DESC,id DESC LIMIT $8`,[p.companyId,query.type,query.currency,query.subjectId,taskId,query.after?.dueAt??null,query.after?.id??null,query.limit+1])).rows;
 const selected=rows.slice(0,query.limit),last=selected.at(-1),items=[];
 for(const row of selected){const read=(await c.query('SELECT read_at FROM finance.task_read WHERE company_id=$1 AND task_id=$2 AND principal_id=$3',[p.companyId,row.id,p.principalId])).rows[0],held=Boolean(row.until_at)&&Date.parse(row.until_at)>Date.now();items.push({id:row.id,version:Number(row.version)+(read?1:0)+Number(row.hold_version??0),type:row.type,subjectId:row.subject_id,sourceId:row.source_id,money:row.money,ownerId:row.owner_id,dueAt:new Date(row.due_at).toISOString(),state:held?'held':'open',readAt:read?new Date(read.read_at).toISOString():null,nextAction:held?`暂缓至${new Date(row.until_at).toISOString()}；到期后重新检查未结` :row.next_action});}
 return {items,nextCursor:rows.length>query.limit?query.cursor({dueAt:new Date(last.due_at).toISOString(),id:last.id}):null};
}
export async function writeFinanceTask(c,p,kind,id,version,input={}){
 ensure(['task-read','task-hold'].includes(kind)&&uuid.test(id),404,'NOT_FOUND','资源不存在');
 const query={limit:1,type:null,currency:null,subjectId:null,after:null,cursor:()=>null},current=(await readFinanceTasks(c,p,query,id)).items[0];ensure(current,404,'NOT_FOUND','资源不存在');ensure(current.version===version,412,'VERSION_CONFLICT','财务待办已变化');
 if(kind==='task-read'){if(!current.readAt)await c.query('INSERT INTO finance.task_read(company_id,task_id,principal_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[p.companyId,id,p.principalId]);return (await readFinanceTasks(c,p,query,id)).items[0];}
 ensure(current.type==='COLLECT'&&current.state==='open',409,'TASK_NOT_HOLDABLE','仅未结应收催收待办可暂缓');ensure(typeof input.reason==='string'&&input.reason.trim().length>0&&input.reason.trim().length<=1000&&Array.isArray(input.evidenceFileIds)&&input.evidenceFileIds.length>=1&&input.evidenceFileIds.length<=20&&new Set(input.evidenceFileIds).size===input.evidenceFileIds.length&&input.evidenceFileIds.every(value=>uuid.test(value)),422,'INVALID_TASK_HOLD','暂缓理由或证据无效');
 const until=Date.parse(input.until);ensure(Number.isFinite(until)&&until>Date.now(),422,'INVALID_TASK_HOLD','暂缓截止时间必须在未来');const source=(await c.query('SELECT order_id FROM finance.ledger_item WHERE company_id=$1 AND id=$2 UNION ALL SELECT order_id FROM finance.amendment_ledger_adjustment WHERE company_id=$1 AND id=$2',[p.companyId,id])).rows[0];ensure(source,404,'NOT_FOUND','资源不存在');const evidence=(await c.query("SELECT count(*)::integer AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND resource_type='ORDER' AND resource_id=$3 AND state='available'",[p.companyId,input.evidenceFileIds,source.order_id])).rows[0];ensure(evidence.count===input.evidenceFileIds.length,422,'EVIDENCE_UNAVAILABLE','暂缓证据不可用或不属于本订单');
 await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`finance-task-hold:${p.companyId}:${id}`]);const prior=(await c.query("SELECT COALESCE(max(version),0)::bigint AS version FROM finance.task_hold_event WHERE company_id=$1 AND task_id=$2 AND task_type='COLLECT'",[p.companyId,id])).rows[0],who=await person(c,p);ensure(who,403,'FINANCE_OPERATOR_REQUIRED','当前会话不是有效财务人员');const holdVersion=Number(prior.version)+1,snapshot={taskId:id,taskType:'COLLECT',version:holdVersion,until:new Date(until).toISOString(),reason:input.reason.trim(),evidenceFileIds:input.evidenceFileIds,principalId:p.principalId,personId:who,recordedAt:new Date().toISOString()};await c.query("INSERT INTO finance.task_hold_event(company_id,task_id,task_type,version,until_at,reason,evidence_file_ids,principal_id,person_id,snapshot) VALUES($1,$2,'COLLECT',$3,$4,$5,$6,$7,$8,$9)",[p.companyId,id,holdVersion,snapshot.until,snapshot.reason,input.evidenceFileIds,p.principalId,who,snapshot]);
 return (await readFinanceTasks(c,p,query,id)).items[0];
}
export async function writeFinanceDocument(c,p,kind,id,input,version){
 if(kind==='document-create'){
  ensure(input.kind==='ADJUSTMENT',422,'UNSUPPORTED_DOCUMENT_KIND','当前本机切片仅支持候选报价价差调整单');const who=await person(c,p);
  const base=(await c.query('SELECT order_id,quote_id,fee_id,snapshot FROM finance.ledger_item WHERE company_id=$1 AND id=$2',[p.companyId,input.ledgerItemId])).rows[0];ensure(base,404,'NOT_FOUND','资源不存在');ensure(input.ledgerItemVersion===1,412,'VERSION_CONFLICT','原账项版本已变化');
  const candidate=(await c.query("SELECT q.snapshot FROM pricing.amendment_quote a JOIN pricing.order_quote q ON q.id=a.quote_id JOIN pricing.quote_confirmation c ON (c.company_id,q.id)=(q.company_id,c.quote_id) WHERE a.company_id=$1 AND a.quote_id=$2 AND a.order_id=$3 AND a.base_quote_id=$4",[p.companyId,input.candidateQuoteId,base.order_id,base.quote_id])).rows[0];ensure(candidate,409,'CANDIDATE_NOT_CONFIRMED','候选报价须属于原账项并已获客户确认');
  const source=base.snapshot,candidateFee=candidate.snapshot.fees.find(fee=>fee.purpose===source.purpose);ensure(candidateFee,422,'CANDIDATE_FEE_MISSING','候选报价缺少对应费用项');ensure(candidateFee.money.currency===source.currency&&input.money.currency===source.currency,422,'CURRENCY_MISMATCH','价差币种必须与原账项一致');
  const difference=BigInt(candidateFee.money.amountMinor)-BigInt(source.originalMinor),amount=difference<0n?-difference:difference;ensure(amount>0n&&amount===BigInt(input.money.amountMinor)&&input.direction===(difference>0n?'INCREASE':'DECREASE'),422,'AMENDMENT_DIFFERENCE_MISMATCH','调整金额和方向必须等于候选报价对应费用项的价差');
  const snapshot={id:randomUUID(),orderId:base.order_id,subjectId:source.subjectId,makerPersonId:who,reason:input.reason,createdAt:new Date().toISOString(),details:input,mapping:{candidateFeeId:candidateFee.id,candidateFeeMoney:candidateFee.money,baseQuoteId:base.quote_id,baseFeeId:base.fee_id}};
  await c.query('INSERT INTO finance.amendment_adjustment(id,company_id,order_id,candidate_quote_id,base_ledger_item_id,prepared_by,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[snapshot.id,p.companyId,snapshot.orderId,input.candidateQuoteId,input.ledgerItemId,p.principalId,who,snapshot]);return financeDocument(c,p,snapshot.id);
 }
 const current=await financeDocument(c,p,id);ensure(current.version===version,412,'VERSION_CONFLICT','审核单已变化');const who=await person(c,p),state=current.state;
 const expected={ 'document-submit':['draft','SUBMITTED'], 'document-review':['submitted','REVIEWED'], 'document-approve':['reviewed','APPROVED'], 'document-reject':['submitted','REJECTED'], 'document-post':['approved','POSTED'] }[kind];
 if(kind==='document-reject'&&state==='reviewed')expected[0]='reviewed';ensure(expected&&state===expected[0],409,'INVALID_STATE','当前审核单状态不允许该动作');
 if(kind==='document-submit')ensure(who===current.makerPersonId,403,'MAKER_REQUIRED','仅经办人可提交调整单');
 if(['document-review','document-reject'].includes(kind))ensure(who!==current.makerPersonId,403,'INDEPENDENT_REVIEW_REQUIRED','经办人与复核人必须是不同人员');
 if(kind==='document-approve')ensure(!current.history.some(event=>['MAKER','REVIEWER'].includes(event.role)&&event.personId===who),403,'INDEPENDENT_APPROVAL_REQUIRED','审批人必须与经办和复核人不同');
 const actionSnapshot={reason:input.reason,recordedAt:new Date().toISOString()};await c.query('INSERT INTO finance.amendment_adjustment_event(company_id,adjustment_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[p.companyId,id,version+1,expected[1],p.principalId,who,actionSnapshot]);
 if(kind==='document-post'){
  const {snapshot}=await adjustmentRecord(c,p,id),details=snapshot.details,base=(await c.query('SELECT snapshot FROM finance.ledger_item WHERE company_id=$1 AND id=$2',[p.companyId,details.ledgerItemId])).rows[0].snapshot,adjustmentId=randomUUID(),increase=details.direction==='INCREASE',amount=details.money.amountMinor;
  const ledger={id:adjustmentId,orderId:snapshot.orderId,subjectId:snapshot.subjectId,direction:increase?'RECEIVABLE':'PAYABLE',purpose:base.purpose,currency:details.money.currency,originalMinor:amount,adjustmentMinor:0,allocatedMinor:0,outstandingMinor:amount,reservedMinor:0,dueDate:phnomDate(actionSnapshot.recordedAt),sourceType:'AMENDMENT_DIFFERENCE',sourceId:id};
  await c.query('INSERT INTO finance.amendment_ledger_adjustment(id,company_id,adjustment_id,order_id,base_ledger_item_id,candidate_quote_id,candidate_fee_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[adjustmentId,p.companyId,id,snapshot.orderId,details.ledgerItemId,details.candidateQuoteId,snapshot.mapping.candidateFeeId,ledger]);
 }
 return financeDocument(c,p,id);
}
export async function createQuoteLedgerItems(c,p,quote,order){
 const dueDate=phnomDate(quote.createdAt),purpose={DELIVERY:'DELIVERY',EXCLUSIVE:'DELIVERY',INSURANCE:'INSURANCE'};
 for(const fee of quote.fees){
  const id=randomUUID(),snapshot={id,orderId:quote.orderId,subjectId:order.order.customerId,direction:'RECEIVABLE',purpose:purpose[fee.purpose]??'DELIVERY',currency:fee.money.currency,originalMinor:fee.money.amountMinor,adjustmentMinor:0,allocatedMinor:0,outstandingMinor:fee.money.amountMinor,reservedMinor:0,dueDate,sourceType:'QUOTE_FEE',sourceId:fee.id};
  await c.query('INSERT INTO finance.ledger_item(id,company_id,order_id,customer_id,quote_id,fee_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,p.companyId,quote.orderId,order.order.customerId,quote.id,fee.id,snapshot]);
 }
}
export async function ledgerItemOutstanding(c,p,row){
 if(row.snapshot.sourceType==='AMENDMENT_DIFFERENCE')return {...row.snapshot,version:1};
 const allocated=BigInt((await c.query("SELECT COALESCE(sum((line->>'amountMinor')::bigint),0) AS total FROM finance.prepayment_allocation a JOIN finance.allocation_event e ON (a.company_id,a.id)=(e.company_id,e.allocation_id) CROSS JOIN LATERAL jsonb_array_elements(a.snapshot->'lines') line WHERE a.company_id=$1 AND a.quote_id=$2 AND line->>'feeId'=$3 AND e.action='POSTED' AND NOT EXISTS(SELECT 1 FROM finance.reversal_event r WHERE r.company_id=a.company_id AND r.allocation_id=a.id AND r.action='POSTED')",[p.companyId,row.quote_id,row.fee_id])).rows[0].total),base=row.snapshot,original=BigInt(base.originalMinor),outstanding=original>allocated?original-allocated:0n;
 return {...base,version:1,allocatedMinor:Number(allocated),outstandingMinor:Number(outstanding)};
}
export async function readFinance(c,p,kind,query,id){
 if(kind==='ledger-item'){
  const row=(await c.query("SELECT id,quote_id,fee_id,snapshot FROM finance.ledger_item WHERE company_id=$1 AND id=$2 UNION ALL SELECT id,NULL::uuid,NULL::uuid,snapshot FROM finance.amendment_ledger_adjustment WHERE company_id=$1 AND id=$2",[p.companyId,id])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');return ledgerItemOutstanding(c,p,row);
 }
 ensure(kind==='ledger-items',500,'INVALID_ROUTE','未实现的财务读取');
 const rows=(await c.query("SELECT id,quote_id,fee_id,snapshot FROM finance.ledger_item WHERE company_id=$1 AND ($2::uuid IS NULL OR id>$2) AND (cardinality($3::uuid[])=0 OR order_id=ANY($3::uuid[])) UNION ALL SELECT id,NULL::uuid,NULL::uuid,snapshot FROM finance.amendment_ledger_adjustment WHERE company_id=$1 AND ($2::uuid IS NULL OR id>$2) AND (cardinality($3::uuid[])=0 OR order_id=ANY($3::uuid[])) ORDER BY id LIMIT $4",[p.companyId,query.after,query.orderIds,query.limit+1])).rows;
 const selected=rows.slice(0,query.limit),items=[];for(const row of selected)items.push(await ledgerItemOutstanding(c,p,row));return {items,nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}
export async function readSubjectLedger(c,p,subjectId,purpose,query,id=null){
 ensure(uuid.test(subjectId)&&['COD','CARRIER'].includes(purpose),500,'INVALID_SUBJECT_LEDGER','外部账项范围无效');
 const rows=(await c.query("WITH source AS (SELECT id,quote_id,fee_id,snapshot FROM finance.ledger_item WHERE company_id=$1 UNION ALL SELECT id,NULL::uuid,NULL::uuid,snapshot FROM finance.amendment_ledger_adjustment WHERE company_id=$1) SELECT * FROM source WHERE snapshot->>'subjectId'=$2::text AND snapshot->>'purpose'=$3 AND snapshot->>'direction'='PAYABLE' AND ($4::uuid IS NULL OR id=$4) AND ($5::uuid IS NULL OR id>$5) ORDER BY id LIMIT $6",[p.companyId,subjectId,purpose,id,query.after,query.limit+1])).rows;
 const selected=rows.slice(0,query.limit),items=[];for(const row of selected)items.push(await ledgerItemOutstanding(c,p,row));return {items,nextCursor:!id&&rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}
export async function readDriverIncome(c,p,query){
 await driverIdentity(c,p);
 const rows=(await c.query("WITH source AS (SELECT id,quote_id,fee_id,snapshot FROM finance.ledger_item WHERE company_id=$1 UNION ALL SELECT id,NULL::uuid,NULL::uuid,snapshot FROM finance.amendment_ledger_adjustment WHERE company_id=$1) SELECT * FROM source WHERE (snapshot->>'subjectId')::uuid=$2 AND snapshot->>'purpose'='DRIVER_INCOME' AND snapshot->>'direction'='PAYABLE' AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4",[p.companyId,p.principalId,query.after,query.limit+1])).rows;
 const selected=rows.slice(0,query.limit),items=[];for(const row of selected)items.push(await ledgerItemOutstanding(c,p,row));return {items,nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}
export async function readLedgerReport(c,p,query,customer=false){
 const subjectId=customer?await currentCustomer(c,p):query.subjectId;
 const rows=(await c.query("WITH source AS (SELECT id,snapshot FROM finance.ledger_item WHERE company_id=$1 UNION ALL SELECT id,snapshot FROM finance.amendment_ledger_adjustment WHERE company_id=$1) SELECT id,snapshot FROM source WHERE ($2::uuid IS NULL OR id>$2) AND ($3::text IS NULL OR snapshot->>'currency'=$3) AND ($4::uuid IS NULL OR (snapshot->>'subjectId')::uuid=$4) AND ($5::text IS NULL OR snapshot->>'dueDate'<=$5) AND ($6::text IS NULL OR snapshot->>'direction'=$6) ORDER BY id LIMIT $7",[p.companyId,query.after,query.currency,subjectId,query.dueBefore,query.direction,query.limit+1])).rows;
 const selected=rows.slice(0,query.limit),items=selected.map(row=>{const s=row.snapshot;return {sourceId:s.sourceId,orderId:s.orderId??null,subjectId:s.subjectId,purpose:s.purpose,direction:s.direction,currency:s.currency,originalMinor:s.originalMinor,adjustmentMinor:s.adjustmentMinor,allocatedMinor:s.allocatedMinor,outstandingMinor:s.outstandingMinor,dueDate:s.dueDate};});
 return {items,nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}
export async function readMoneyOverview(c,p,query){
 const ledger=(await c.query("WITH source AS (SELECT l.snapshot,GREATEST(0::bigint,(l.snapshot->>'originalMinor')::bigint-COALESCE((SELECT sum((line->>'amountMinor')::bigint) FROM finance.prepayment_allocation a JOIN finance.allocation_event e ON (a.company_id,a.id)=(e.company_id,e.allocation_id) CROSS JOIN LATERAL jsonb_array_elements(a.snapshot->'lines') line WHERE a.company_id=l.company_id AND a.quote_id=l.quote_id AND line->>'feeId'=l.fee_id::text AND e.action='POSTED' AND NOT EXISTS(SELECT 1 FROM finance.reversal_event r WHERE r.company_id=a.company_id AND r.allocation_id=a.id AND r.action='POSTED')),0::bigint)) AS outstanding FROM finance.ledger_item l WHERE l.company_id=$1 UNION ALL SELECT l.snapshot,COALESCE((l.snapshot->>'outstandingMinor')::bigint,(l.snapshot->>'originalMinor')::bigint) FROM finance.amendment_ledger_adjustment l WHERE l.company_id=$1) SELECT COALESCE(sum(outstanding) FILTER (WHERE snapshot->>'direction'='RECEIVABLE'),0)::bigint AS receivable,COALESCE(sum(outstanding) FILTER (WHERE snapshot->>'direction'='PAYABLE'),0)::bigint AS payable FROM source WHERE snapshot->>'currency'=$2",[p.companyId,query.currency])).rows[0];
 const custody=(await c.query("WITH driver_cash AS (SELECT COALESCE(sum(r.money_amount_minor),0)::bigint AS reported FROM finance.receipt r JOIN finance.receipt_confirmation c ON (c.company_id,c.receipt_id)=(r.company_id,r.id) WHERE r.company_id=$1 AND r.custody_type='DRIVER' AND r.money_currency=$2),handed AS (SELECT COALESCE(sum(l.amount_minor),0)::bigint AS transferred FROM finance.cash_handover_line l JOIN finance.cash_handover h ON (h.company_id,h.id)=(l.company_id,l.handover_id) WHERE h.company_id=$1 AND h.currency=$2 AND h.state IN ('submitted','counted','disputed','reviewed','posted')),company_cash AS (SELECT COALESCE(sum(r.money_amount_minor),0)::bigint AS held FROM finance.receipt r JOIN finance.receipt_confirmation c ON (c.company_id,c.receipt_id)=(r.company_id,r.id) WHERE r.company_id=$1 AND r.custody_type='COMPANY' AND r.money_currency=$2),counted_handover AS (SELECT COALESCE(sum(counted_amount_minor),0)::bigint AS held FROM finance.cash_handover WHERE company_id=$1 AND currency=$2 AND state='counted') SELECT GREATEST((SELECT reported FROM driver_cash)-(SELECT transferred FROM handed),0)::bigint AS driver_held,((SELECT held FROM company_cash)+(SELECT held FROM counted_handover))::bigint AS company_held",[p.companyId,query.currency])).rows[0];
 const funds=(await c.query("SELECT COALESCE(sum(amount_minor) FILTER (WHERE direction='IN'),0)::bigint AS unmatched,0::bigint AS reserved FROM finance.bank_transaction WHERE company_id=$1 AND currency=$2 UNION ALL SELECT 0::bigint,COALESCE(sum(money_amount_minor),0)::bigint FROM finance.driver_withdrawal_request WHERE company_id=$1 AND money_currency=$2 AND state='submitted'",[p.companyId,query.currency])).rows;
 const unmatched=BigInt(funds[0]?.unmatched??0),reserved=funds.reduce((sum,row)=>sum+BigInt(row.reserved??0),0n);
 return {currency:query.currency,asOf:new Date().toISOString(),receivableMinor:minor(ledger.receivable),payableMinor:minor(ledger.payable),driverHeldMinor:minor(custody.driver_held),codLiabilityMinor:0,channelHeldMinor:0,companyHeldMinor:minor(custody.company_held),paymentReservedMinor:minor(reserved),unmatchedMinor:minor(unmatched),quality:'partial'};
}
