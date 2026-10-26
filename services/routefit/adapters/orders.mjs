import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {validateOrderDraft,orderDetail} from '../domain/orders.mjs';

// shortcut: cursors last one local process; use a managed shared key when deploying multiple instances.
const cursorKey=randomBytes(32),sign=value=>createHmac('sha256',cursorKey).update(value).digest('base64url');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function orderQuery(url,kind,principal){
 const allowed=kind==='orders'?['limit','cursor','state','serviceLevel','customerId']:kind==='warehouse-queue'?['limit','cursor','warehouseId']:['customers','areas'].includes(kind)?['limit','cursor']:[];
 for(const key of url.searchParams.keys())ensure(allowed.includes(key)&&url.searchParams.getAll(key).length===1,422,'INVALID_QUERY','查询参数不支持或重复');
 const raw=url.searchParams.get('limit')??'50';ensure(/^[1-9][0-9]*$/.test(raw)&&Number(raw)<=100,422,'INVALID_LIMIT','limit须为1到100');
 const filters=Object.fromEntries(['state','serviceLevel','customerId','warehouseId'].filter(k=>url.searchParams.has(k)).map(k=>[k,url.searchParams.get(k)]));
 ensure(!('state' in filters)||['draft','validating','quoted','awaiting_dispatch','executing','delivered','cancelled','return_open','returned','closed_exception'].includes(filters.state),422,'INVALID_QUERY','订单状态无效');
 ensure(!('serviceLevel' in filters)||['S1','S2','S3','S4'].includes(filters.serviceLevel),422,'INVALID_QUERY','服务等级无效');
 if('customerId' in filters)ensure(uuid.test(filters.customerId),422,'INVALID_QUERY','客户ID无效');
 if('warehouseId' in filters)ensure(uuid.test(filters.warehouseId),422,'INVALID_QUERY','仓库ID无效');
 const binding=JSON.stringify([kind,principal.companyId,principal.principalId,Number(raw),filters]);
 let after=null;const token=url.searchParams.get('cursor');
 if(token!==null){
  try{
   const [payload,signature,...rest]=token.split('.');ensure(token.length<=2048&&signature&&rest.length===0&&signature.length===43&&timingSafeEqual(Buffer.from(signature),Buffer.from(sign(payload))),422,'INVALID_CURSOR','游标无效或已失效');
   const decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));ensure(decoded.binding===binding&&decoded.expiresAt>Date.now(),422,'INVALID_CURSOR','游标不属于当前身份或查询');after=decoded.after;
  }catch{ensure(false,422,'INVALID_CURSOR','游标无效或已失效');}
 }
 return {limit:Number(raw),filters,after,cursor:after=>{const payload=Buffer.from(JSON.stringify({binding,after,expiresAt:Date.now()+3600000})).toString('base64url');return payload+'.'+sign(payload);}};
}
export async function authorizedCustomer(client,principal,id){
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');
 const result=await client.query("SELECT c.id FROM party.customer c WHERE c.company_id=$1 AND c.id=$2 AND c.status='ACTIVE' AND (EXISTS(SELECT 1 FROM party.customer_access a WHERE a.company_id=c.company_id AND a.customer_id=c.id AND a.principal_id=$3) OR EXISTS(SELECT 1 FROM integration.service_binding b WHERE b.company_id=c.company_id AND b.customer_id=c.id AND b.principal_id=$3 AND b.state='ACTIVE'))",[principal.companyId,id,principal.principalId]);
 ensure(result.rowCount===1,404,'NOT_FOUND','资源不存在');
}
export async function currentCustomer(client,principal){
 const rows=(await client.query("SELECT c.id FROM party.customer c JOIN party.customer_access a ON (c.company_id,c.id)=(a.company_id,a.customer_id) WHERE c.company_id=$1 AND a.principal_id=$2 AND c.status='ACTIVE' ORDER BY c.id LIMIT 2",[principal.companyId,principal.principalId])).rows;
 ensure(rows.length===1,409,'CUSTOMER_CONTEXT_REQUIRED','当前会话必须唯一对应一个启用货主');return rows[0].id;
}
export async function getOrder(client,principal,id,lock=false){
 const result=await client.query('SELECT snapshot FROM orders.draft WHERE company_id=$1 AND id=$2'+(lock?' FOR UPDATE':''),[principal.companyId,id]);
 ensure(result.rowCount===1,404,'NOT_FOUND','资源不存在');const snapshot=result.rows[0].snapshot;
 return {...snapshot,order:{...snapshot.order,collectionState:await collectionState(client,principal,id)}};
}
export async function getCustomerOrder(client,principal,id){
 const order=await getOrder(client,principal,id);
 return {order:order.order,pickup:order.pickup,delivery:order.delivery,items:order.items,evidenceFileIds:[],quoteId:order.quoteId};
}
export async function collectionState(client,principal,id){
 const pending=await client.query("SELECT 1 FROM finance.allocation_reversal r WHERE r.company_id=$1 AND r.order_id=$2 AND NOT EXISTS(SELECT 1 FROM finance.reversal_event e WHERE e.company_id=r.company_id AND e.reversal_id=r.id AND e.action IN ('POSTED','REJECTED')) LIMIT 1",[principal.companyId,id]);
 if(pending.rowCount)return 'disputed';
 const r=(await client.query("SELECT count(*) AS reported FROM finance.prepayment_receipt WHERE company_id=$1 AND order_id=$2",[principal.companyId,id])).rows[0];
 if(Number(r.reported)===0)return 'unpaid';
 const amount=(await client.query("SELECT COALESCE(sum((a.snapshot->>'amountMinor')::bigint),0) AS paid FROM finance.prepayment_allocation a JOIN finance.allocation_event e ON (a.company_id,a.id)=(e.company_id,e.allocation_id) WHERE a.company_id=$1 AND a.order_id=$2 AND e.action='POSTED' AND NOT EXISTS(SELECT 1 FROM finance.reversal_event r WHERE r.company_id=a.company_id AND r.allocation_id=a.id AND r.action='POSTED')",[principal.companyId,id])).rows[0].paid;
 const q=(await client.query("SELECT q.snapshot#>>'{total,amountMinor}' AS total FROM pricing.order_quote q JOIN orders.draft o ON (q.company_id,q.id)=(o.company_id,o.quote_id) WHERE o.company_id=$1 AND o.id=$2",[principal.companyId,id])).rows[0];
 return BigInt(amount)>0n?(q&&BigInt(amount)===BigInt(q.total)?'allocated':'partial'):'reported';
}
export async function writeOrder(client,principal,id,body,version){
 validateOrderDraft(body);
 const previous=id?await getOrder(client,principal,id,true):null;
 if(previous){ensure(previous.order.version===version,412,'VERSION_CONFLICT','订单版本已变化，请重新查询');ensure(previous.order.state==='draft',409,'INVALID_STATE','仅草稿可修改');}
 await authorizedCustomer(client,principal,body.customerId);
 const result=orderDetail(body,previous);
 if(previous)await client.query('UPDATE orders.draft SET customer_id=$3,version=$4,snapshot=$5,updated_at=now() WHERE company_id=$1 AND id=$2',[principal.companyId,id,body.customerId,result.order.version,result]);
 else await client.query('INSERT INTO orders.draft(id,company_id,customer_id,version,snapshot) VALUES($1,$2,$3,$4,$5)',[result.order.id,principal.companyId,body.customerId,result.order.version,result]);
 await client.query('INSERT INTO orders.draft_revision(company_id,order_id,version,snapshot,principal_id) VALUES($1,$2,$3,$4,$5)',[principal.companyId,result.order.id,result.order.version,result,principal.principalId]);
 return result;
}
export async function writeOrderCancel(client,principal,id,body,version){
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');
 const order=await getOrder(client,principal,id,true);ensure(order.order.version===version,412,'VERSION_CONFLICT','订单版本已变化，请重新查询');
 ensure(['quoted','awaiting_dispatch'].includes(order.order.state),409,'INVALID_STATE','仅已确认且未取货订单可取消');
 ensure(new Set(body.evidenceFileIds).size===body.evidenceFileIds.length,422,'DUPLICATE_EVIDENCE','取消证据不得重复');
 const files=(await client.query("SELECT count(*)::integer AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND resource_type='ORDER' AND resource_id=$3 AND state='available'",[principal.companyId,body.evidenceFileIds,id])).rows[0];
 ensure(files.count===body.evidenceFileIds.length,422,'CANCELLATION_EVIDENCE_UNAVAILABLE','取消证据不存在、未完成或不属于本订单');
 const person=(await client.query('SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2',[principal.companyId,principal.principalId])).rows[0];
 ensure(person?.person_id,401,'SESSION_REVOKED','当前操作人员身份无效');
 const now=new Date().toISOString(),cancellation={orderId:id,sourceOrderVersion:version,principalId:principal.principalId,personId:person.person_id,reason:body.reason.trim(),evidenceFileIds:body.evidenceFileIds,cancelledAt:now};
 await client.query('INSERT INTO orders.cancellation(company_id,order_id,source_order_version,principal_id,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6)',[principal.companyId,id,version,principal.principalId,person.person_id,cancellation]);
 // dispatch.mjs imports this module; load it lazily to avoid a static import cycle.
 const {revokeOffersForCancelledOrder}=await import('./dispatch.mjs');
 await revokeOffersForCancelledOrder(client,principal,id,{reason:body.reason.trim(),evidenceFileIds:body.evidenceFileIds});
 if(order.order.promiseId){
  const released=await client.query("UPDATE dispatch.capacity_reservation SET released_at=$3,released_by_promise_id=NULL,release_reason='CANCELLED' WHERE company_id=$1 AND promise_id=$2 AND released_at IS NULL",[principal.companyId,order.order.promiseId,now]);
  ensure(released.rowCount===1,409,'PROMISE_RELEASE_CONFLICT','当前承诺预留已变化，不能取消');
 }
 const stored=(await client.query('SELECT snapshot FROM orders.draft WHERE company_id=$1 AND id=$2',[principal.companyId,id])).rows[0].snapshot;
 const next={...stored,order:{...stored.order,state:'cancelled',version:version+1,promiseId:null,updatedAt:now}};
 await client.query('UPDATE orders.draft SET version=$3,snapshot=$4,updated_at=now() WHERE company_id=$1 AND id=$2',[principal.companyId,id,version+1,next]);
 await client.query('INSERT INTO orders.draft_revision(company_id,order_id,version,snapshot,principal_id) VALUES($1,$2,$3,$4,$5)',[principal.companyId,id,version+1,next,principal.principalId]);
 return getOrder(client,principal,id);
}
export async function readOrders(client,principal,kind,id,page){
 if(kind==='order')return getOrder(client,principal,id);
 const {limit,filters,after}=page;
 if(kind==='customers'){
  const rows=(await client.query("SELECT c.id,c.name FROM party.customer c JOIN party.customer_access a ON (c.company_id,c.id)=(a.company_id,a.customer_id) WHERE c.company_id=$1 AND a.principal_id=$2 AND c.status='ACTIVE' AND ($3::uuid IS NULL OR c.id>$3) ORDER BY c.id LIMIT $4",[principal.companyId,principal.principalId,after,limit+1])).rows;
  const items=rows.slice(0,limit);return {items,nextCursor:rows.length>limit?page.cursor(items.at(-1).id):null};
 }
 const rows=(await client.query("SELECT snapshot,created_at::text AS created FROM orders.draft WHERE company_id=$1 AND ($2::text IS NULL OR snapshot#>>'{order,state}'=$2) AND ($3::text IS NULL OR snapshot#>>'{order,serviceLevel}'=$3) AND ($4::text IS NULL OR customer_id::text=$4) AND ($5::timestamptz IS NULL OR (created_at,id)<($5::timestamptz,$6::uuid)) ORDER BY created_at DESC,id DESC LIMIT $7",[principal.companyId,filters.state??null,filters.serviceLevel??null,filters.customerId??null,after?.created??null,after?.id??null,limit+1])).rows;
 const selected=rows.slice(0,limit),last=selected.at(-1),items=[];for(const r of selected)items.push({...r.snapshot.order,collectionState:await collectionState(client,principal,r.snapshot.order.id)});return {items,nextCursor:rows.length>limit?page.cursor({created:last.created,id:last.snapshot.order.id}):null};
}
