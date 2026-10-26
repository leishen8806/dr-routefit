import {createHash,randomUUID} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {writeOrder} from './orders.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
const view=(row,duplicate=false)=>({id:row.id,version:Number(row.version),externalOrderId:row.external_order_id,orderId:row.order_id,state:row.state,duplicate});
const stockView=row=>({id:row.id,version:Number(row.version),ownerAccountId:row.owner_account_id,warehouseId:row.warehouse_id,skuId:row.sku_id,lotRef:row.lot_ref,unit:row.unit,quantities:{bookQty:Number(row.book_qty),reservedQty:Number(row.reserved_qty),quarantineQty:Number(row.quarantine_qty),requestableQty:Number(row.book_qty)-Number(row.reserved_qty)-Number(row.quarantine_qty)},source:row.source,observedAt:new Date(row.observed_at).toISOString(),quality:'fresh',unknownReason:null});

async function binding(c,p,channel){
 const row=(await c.query("SELECT b.* FROM integration.service_binding b JOIN org.principal p ON (p.company_id,p.id)=(b.company_id,b.principal_id) WHERE b.company_id=$1 AND b.principal_id=$2 AND b.channel=$3 AND b.state='ACTIVE' AND p.kind='SERVICE' AND p.status='ACTIVE'",[p.companyId,p.principalId,channel])).rows[0];
 ensure(row,404,'NOT_FOUND','资源不存在');return row;
}
function importedDraft(b,input){
 return {customerId:b.customer_id,pickup:input.pickup,delivery:input.delivery,items:input.items.map(({skuId,measurementEvidenceIds,...item})=>({...item,measurementEvidenceIds:[]})),serviceLevel:input.serviceLevel,exclusiveVehicle:false,requestedPickupWindow:input.requestedPickupWindow,requestedDeliveryWindow:input.requestedDeliveryWindow,paymentTerms:'PREPAID',creditAgreementId:null,cod:null,merchantBeneficiaryId:null,notes:`Imported from ${input.sourcePlatform.trim()}`};
}
async function event(c,p,row,action){await c.query('INSERT INTO integration.external_intake_event(company_id,intake_id,version,action,principal_id,snapshot) VALUES($1,$2,$3,$4,$5,$6)',[p.companyId,row.id,row.version,action,p.principalId,row.snapshot]);}

export async function importExternalOrder(c,p,channel,input){
 const b=await binding(c,p,channel),hash=digest(input),externalOrderId=input.externalOrderId.trim();
 const prior=(await c.query('SELECT i.*,d.snapshot AS order_snapshot FROM integration.external_intake i JOIN orders.draft d ON (d.company_id,d.id)=(i.company_id,i.order_id) WHERE i.company_id=$1 AND i.channel=$2 AND i.source_system=$3 AND i.customer_id=$4 AND i.external_order_id=$5 FOR UPDATE',[p.companyId,channel,b.source_system,b.customer_id,externalOrderId])).rows[0];
 if(prior){
  if(Number(prior.external_revision)===input.externalRevision&&prior.content_hash===hash)return view(prior,true);
  ensure(input.externalRevision>Number(prior.external_revision),409,'EXTERNAL_REVISION_CONFLICT','来源订单版本未前进或内容不一致');
  ensure(prior.state==='pending_review'&&prior.order_snapshot.order.state==='draft',409,'EXTERNAL_REVISION_LOCKED','订单已进入受理流程，不能由来源系统覆盖');
  const order=await writeOrder(c,p,prior.order_id,importedDraft(b,input),Number(prior.order_snapshot.order.version));
  const version=Number(prior.version)+1,next={id:prior.id,version,externalOrderId,externalRevision:input.externalRevision,orderId:prior.order_id,state:'pending_review',channel:b.channel,sourceSystem:b.source_system,sourcePlatform:input.sourcePlatform.trim(),sourcePricing:{deliveryPrice:input.deliveryPrice,insurancePrice:input.insurancePrice},request:input,action:'REVISED',recordedAt:new Date().toISOString()};
  await c.query('UPDATE integration.external_intake SET external_revision=$3,content_hash=$4,version=$5,snapshot=$6,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[p.companyId,prior.id,input.externalRevision,hash,version,next]);
  const row={...prior,version,snapshot:next};await event(c,p,row,'REVISED');return view(row);
 }
 const order=await writeOrder(c,p,null,importedDraft(b,input)),id=randomUUID(),result={id,version:1,externalOrderId,orderId:order.order.id,state:'pending_review'},stored={...result,channel:b.channel,sourceSystem:b.source_system,sourcePlatform:input.sourcePlatform.trim(),sourcePricing:{deliveryPrice:input.deliveryPrice,insurancePrice:input.insurancePrice},request:input,action:'IMPORTED',recordedAt:new Date().toISOString()};
 await c.query('INSERT INTO integration.external_intake(id,company_id,channel,service_principal_id,source_system,customer_id,external_order_id,external_revision,content_hash,order_id,state,version,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[id,p.companyId,channel,p.principalId,b.source_system,b.customer_id,externalOrderId,input.externalRevision,hash,order.order.id,'pending_review',1,stored]);
 await event(c,p,{...result,snapshot:stored},'IMPORTED');return {...result,duplicate:false};
}
export async function readExternalImport(c,p,channel,id){
 await binding(c,p,channel);ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');const row=(await c.query('SELECT * FROM integration.external_intake WHERE company_id=$1 AND id=$2 AND channel=$3',[p.companyId,id,channel])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');return view(row);
}
export async function requestExternalDispatch(c,p,channel,id,input,version){
 await binding(c,p,channel);ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');const row=(await c.query('SELECT * FROM integration.external_intake WHERE company_id=$1 AND id=$2 AND channel=$3 FOR UPDATE',[p.companyId,id,channel])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');ensure(Number(row.version)===version,412,'VERSION_CONFLICT','来源受理状态已变化');ensure(row.state==='pending_review',409,'DISPATCH_REQUEST_NOT_ACTIONABLE','当前来源订单不能申请派单');
 const quote=(await c.query('SELECT snapshot FROM pricing.order_quote WHERE company_id=$1 AND id=$2 AND order_id=$3',[p.companyId,input.quoteId,row.order_id])).rows[0];ensure(quote&&Number(quote.snapshot.version)===input.quoteVersion,409,'QUOTE_VERSION_CONFLICT','报价不存在、订单不匹配或版本已变化');ensure(new Set(input.consentEvidenceFileIds).size===input.consentEvidenceFileIds.length,422,'DUPLICATE_EVIDENCE','确认依据不得重复');
 const evidence=(await c.query("SELECT count(*)::integer AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND resource_type='ORDER' AND resource_id=$3 AND state='available'",[p.companyId,input.consentEvidenceFileIds,row.order_id])).rows[0];ensure(evidence.count===input.consentEvidenceFileIds.length,422,'CONSENT_EVIDENCE_UNAVAILABLE','确认依据不存在、未完成或不属于本订单');
 const nextVersion=Number(row.version)+1,next={...row.snapshot,version:nextVersion,state:'dispatch_requested',action:'DISPATCH_REQUESTED',dispatchRequest:{quoteId:input.quoteId,quoteVersion:input.quoteVersion,consentEvidenceFileIds:input.consentEvidenceFileIds,requestedAt:new Date().toISOString()}};
 await c.query("UPDATE integration.external_intake SET state='dispatch_requested',version=$3,snapshot=$4,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2",[p.companyId,id,nextVersion,next]);const updated={...row,version:nextVersion,state:'dispatch_requested',snapshot:next};await event(c,p,updated,'DISPATCH_REQUESTED');return view(updated);
}
export async function writeWmsStockEvent(c,p,input){
 const b=await binding(c,p,'WAREHOUSE');ensure(input.warehouseId===b.warehouse_id&&input.ownerAccountId===b.customer_id,404,'NOT_FOUND','资源不存在');ensure(input.quantities.bookQty===input.quantities.reservedQty+input.quantities.quarantineQty+input.quantities.requestableQty,422,'INVALID_STOCK_QUANTITIES','可申请数量必须等于账面减预留减隔离');ensure(Date.parse(input.observedAt)<=Date.now(),422,'INVALID_STOCK_OBSERVATION','库存观测时间不得在未来');
 const hash=digest(input),duplicate=(await c.query('SELECT content_hash,inventory_id FROM integration.wms_stock_event WHERE company_id=$1 AND source_system=$2 AND external_event_id=$3',[p.companyId,b.source_system,input.externalEventId.trim()])).rows[0];
 if(duplicate){ensure(duplicate.content_hash===hash,409,'EXTERNAL_EVENT_CONFLICT','来源事件号已对应不同内容');const row=(await c.query('SELECT * FROM warehouse.inventory_snapshot WHERE company_id=$1 AND id=$2',[p.companyId,duplicate.inventory_id])).rows[0];ensure(row,409,'INVENTORY_EVENT_DANGLING','来源事件缺少库存快照');return stockView(row);}
 const lotKey=input.lotRef??'',current=(await c.query('SELECT * FROM warehouse.inventory_snapshot WHERE company_id=$1 AND owner_account_id=$2 AND warehouse_id=$3 AND sku_id=$4 AND lot_key=$5 AND unit=$6 FOR UPDATE',[p.companyId,b.customer_id,b.warehouse_id,input.skuId,lotKey,input.unit.trim()])).rows[0];
 let row;
 if(current){ensure(current.source==='EXTERNAL_WMS',409,'INVENTORY_AUTHORITY_CONFLICT','RouteFit WMS 已是该库存的物理权威');ensure(input.sourceVersion>Number(current.source_version),409,'STALE_STOCK_OBSERVATION','来源库存版本未前进');
  await c.query('UPDATE warehouse.inventory_snapshot SET book_qty=$3,reserved_qty=$4,quarantine_qty=$5,source_version=$6,observed_at=$7,version=version+1,snapshot=$8,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[p.companyId,current.id,input.quantities.bookQty,input.quantities.reservedQty,input.quantities.quarantineQty,input.sourceVersion,input.observedAt,{...input,source:'EXTERNAL_WMS'}]);
  row={...current,book_qty:input.quantities.bookQty,reserved_qty:input.quantities.reservedQty,quarantine_qty:input.quantities.quarantineQty,source_version:input.sourceVersion,observed_at:input.observedAt,version:Number(current.version)+1,source:'EXTERNAL_WMS'};
 }else{const id=randomUUID(),snapshot={...input,source:'EXTERNAL_WMS'};await c.query('INSERT INTO warehouse.inventory_snapshot(id,company_id,owner_account_id,warehouse_id,sku_id,lot_ref,lot_key,unit,book_qty,reserved_qty,quarantine_qty,source,source_version,observed_at,version,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,1,$15)',[id,p.companyId,b.customer_id,b.warehouse_id,input.skuId,input.lotRef,lotKey,input.unit.trim(),input.quantities.bookQty,input.quantities.reservedQty,input.quantities.quarantineQty,'EXTERNAL_WMS',input.sourceVersion,input.observedAt,snapshot]);row={id,owner_account_id:b.customer_id,warehouse_id:b.warehouse_id,sku_id:input.skuId,lot_ref:input.lotRef,unit:input.unit.trim(),book_qty:input.quantities.bookQty,reserved_qty:input.quantities.reservedQty,quarantine_qty:input.quantities.quarantineQty,source:'EXTERNAL_WMS',observed_at:input.observedAt,version:1};}
 const result=stockView(row);await c.query('INSERT INTO integration.wms_stock_event(company_id,service_principal_id,source_system,external_event_id,content_hash,inventory_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[p.companyId,p.principalId,b.source_system,input.externalEventId.trim(),hash,row.id,{input,result}]);return result;
}
