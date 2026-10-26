import {createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {collectionState,currentCustomer} from './orders.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cursorKey=randomBytes(32),sign=value=>createHmac('sha256',cursorKey).update(value).digest('base64url');

export function warehouseRequestQuery(url,principal,scope,type){
 for(const key of url.searchParams.keys())ensure(['limit','cursor'].includes(key)&&url.searchParams.getAll(key).length===1,422,'INVALID_QUERY','查询参数不支持或重复');
 const limit=Number(url.searchParams.get('limit')??50);ensure(Number.isInteger(limit)&&limit>=1&&limit<=100,422,'INVALID_LIMIT','limit须为1到100');
 const binding=JSON.stringify(['warehouse-request',scope,type,principal.companyId,principal.principalId,limit]),token=url.searchParams.get('cursor');let after=null;
 if(token!==null){try{const [payload,signature,...rest]=token.split('.');ensure(token.length<=2048&&signature&&rest.length===0&&signature.length===43&&timingSafeEqual(Buffer.from(signature),Buffer.from(sign(payload))),422,'INVALID_CURSOR','游标无效或已失效');const decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));ensure(decoded.binding===binding&&uuid.test(decoded.after)&&decoded.expiresAt>Date.now(),422,'INVALID_CURSOR','游标无效或已失效');after=decoded.after;}catch{ensure(false,422,'INVALID_CURSOR','游标无效或已失效');}}
 return {limit,after,cursor:id=>{const payload=Buffer.from(JSON.stringify({binding,after:id,expiresAt:Date.now()+3600000})).toString('base64url');return payload+'.'+sign(payload)}};
}

const view=row=>({id:row.id,version:Number(row.version),type:row.type,ownerAccountId:row.owner_account_id,warehouseId:row.warehouse_id,state:row.state,relatedOrderId:row.snapshot.relatedOrderId??null,createdAt:new Date(row.created_at).toISOString(),nextAction:row.snapshot.nextAction});
async function person(client,principal){const row=(await client.query("SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2 AND status='ACTIVE'",[principal.companyId,principal.principalId])).rows[0];ensure(row?.person_id,401,'SESSION_REVOKED','当前人员身份无效');return row.person_id;}
async function activeWarehouse(client,principal,id){ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');const row=(await client.query("SELECT id FROM warehouse.site WHERE company_id=$1 AND id=$2 AND state='ACTIVE'",[principal.companyId,id])).rows[0];ensure(row,404,'NOT_FOUND','仓库不存在或未启用');}
function validLines(lines){ensure(new Set(lines.map(line=>line.skuId)).size===lines.length,422,'DUPLICATE_SKU','同一申请不得重复SKU');for(const line of lines)ensure((line.inventoryId===undefined)===(line.inventoryVersion===undefined),422,'INVENTORY_VERSION_REQUIRED','库存行ID和版本须同时提供');}
async function requestRecord(client,principal,id,{ownerId=null,lock=false}={}){ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');const row=(await client.query('SELECT * FROM warehouse.request WHERE company_id=$1 AND id=$2'+(ownerId?' AND owner_account_id=$3':'')+(lock?' FOR UPDATE':''),ownerId?[principal.companyId,id,ownerId]:[principal.companyId,id])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');return row;}
async function requestEvidence(client,principal,requestId,ids){ensure(new Set(ids).size===ids.length,422,'DUPLICATE_EVIDENCE','证据不得重复');const count=(await client.query("SELECT count(*)::integer AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND resource_type='WAREHOUSE_REQUEST' AND resource_id=$3 AND state='available'",[principal.companyId,ids,requestId])).rows[0].count;ensure(count===ids.length,422,'EVIDENCE_UNAVAILABLE','证据不存在、未完成或不属于本仓储申请');}
async function submittedEvidence(client,principal,ids){ensure(new Set(ids).size===ids.length,422,'DUPLICATE_EVIDENCE','证据不得重复');if(!ids.length)return;const count=(await client.query("SELECT count(*)::integer AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND principal_id=$3 AND state='available'",[principal.companyId,ids,principal.principalId])).rows[0].count;ensure(count===ids.length,422,'EVIDENCE_UNAVAILABLE','包装证据不存在、未完成或不属于当前人员');}
async function event(client,principal,row,action,detail={}){const who=await person(client,principal),snapshot={requestId:row.id,version:Number(row.version),action,principalId:principal.principalId,personId:who,recordedAt:new Date().toISOString(),...detail};await client.query('INSERT INTO warehouse.request_event(company_id,request_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[principal.companyId,row.id,row.version,action,principal.principalId,who,snapshot]);}

export async function readCustomerWarehouseRequests(client,principal,type,id,query){
 const customerId=await currentCustomer(client,principal);
 if(id)return view(await requestRecord(client,principal,id,{ownerId:customerId}));
 const rows=(await client.query('SELECT * FROM warehouse.request WHERE company_id=$1 AND owner_account_id=$2 AND type=$3 AND ($4::uuid IS NULL OR id>$4) ORDER BY id LIMIT $5',[principal.companyId,customerId,type,query.after,query.limit+1])).rows,selected=rows.slice(0,query.limit);
 return {items:selected.map(view),nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}

export async function createCustomerWarehouseRequest(client,principal,type,input){
 const customerId=await currentCustomer(client,principal);await activeWarehouse(client,principal,input.warehouseId);validLines(input.lines);
 const window=type==='INBOUND_NOTICE'?input.expectedWindow:input.requestedWindow;ensure(Date.parse(window.start)<Date.parse(window.end),422,'INVALID_TIME_WINDOW','时间窗开始必须早于结束');
 const packingEvidenceFileIds=input.packingEvidenceFileIds??[];await submittedEvidence(client,principal,packingEvidenceFileIds);
 const id=randomUUID(),createdAt=new Date().toISOString(),snapshot={id,version:1,type,ownerAccountId:customerId,warehouseId:input.warehouseId,state:'submitted',relatedOrderId:null,createdAt,nextAction:type==='INBOUND_NOTICE'?'等待仓库受理；预报不等于实收库存':'等待仓库受理；申请不等于库存预留或派车',request:input};
 await client.query('INSERT INTO warehouse.request(id,company_id,owner_account_id,warehouse_id,type,state,version,snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,principal.companyId,customerId,input.warehouseId,type,'submitted',1,snapshot,principal.principalId]);
 const row={id,version:1};await event(client,principal,row,'SUBMITTED');for(const evidenceId of packingEvidenceFileIds)await client.query("INSERT INTO warehouse.request_evidence(company_id,request_id,evidence_file_id,role) VALUES($1,$2,$3,'PACKING')",[principal.companyId,id,evidenceId]);
 return view({id,version:1,type,owner_account_id:customerId,warehouse_id:input.warehouseId,state:'submitted',snapshot,created_at:createdAt});
}

export async function readWarehouseRequests(client,principal,type,id,query){
 if(id)return view(await requestRecord(client,principal,id));
 const rows=(await client.query("SELECT * FROM warehouse.request WHERE company_id=$1 AND type=$2 AND state='submitted' AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4",[principal.companyId,type,query.after,query.limit+1])).rows,selected=rows.slice(0,query.limit);
 return {items:selected.map(view),nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}

export async function acceptWarehouseRequest(client,principal,type,id,input,version){
 const current=await requestRecord(client,principal,id,{lock:true});ensure(current.type===type,404,'NOT_FOUND','资源不存在');ensure(Number(current.version)===version,412,'VERSION_CONFLICT','仓储申请已变化');ensure(current.state==='submitted',409,'REQUEST_NOT_ACCEPTABLE','仅已提交仓储申请可受理');await activeWarehouse(client,principal,current.warehouse_id);await requestEvidence(client,principal,id,input.evidenceFileIds);
 const state='accepted',next={...current.snapshot,version:Number(current.version)+1,state,nextAction:type==='INBOUND_NOTICE'?'等待实际交接和库存权威确认':'等待原子库存预留与实际出库交接',acceptedAt:new Date().toISOString(),acceptanceReason:input.reason.trim(),acceptanceEvidenceFileIds:input.evidenceFileIds};
 await client.query('UPDATE warehouse.request SET state=$3,version=$4,snapshot=$5,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,id,state,next.version,next]);const row={...current,state,version:next.version};await event(client,principal,row,'ACCEPTED',{reason:input.reason.trim(),evidenceFileIds:input.evidenceFileIds});for(const evidenceId of input.evidenceFileIds)await client.query("INSERT INTO warehouse.request_evidence(company_id,request_id,evidence_file_id,role) VALUES($1,$2,$3,'ACCEPTANCE')",[principal.companyId,id,evidenceId]);return view({...row,snapshot:next,created_at:current.created_at});
}

export async function readWarehouseQueue(client,principal,page){
 const {limit,filters,after}=page;
 const rows=(await client.query("SELECT o.snapshot,r.updated_at::text AS updated FROM dispatch.return_task r JOIN orders.draft o ON (o.company_id,o.id)=(r.company_id,r.order_id) WHERE r.company_id=$1 AND r.state IN ('authorized','received','inspected') AND ($2::uuid IS NULL OR r.warehouse_id=$2) AND ($3::timestamptz IS NULL OR (r.updated_at,r.id)<($3::timestamptz,$4::uuid)) ORDER BY r.updated_at DESC,r.id DESC LIMIT $5",[principal.companyId,filters.warehouseId??null,after?.updated??null,after?.id??null,limit+1])).rows;
 const selected=rows.slice(0,limit),last=selected.at(-1),items=[];
 for(const row of selected)items.push({...row.snapshot.order,collectionState:await collectionState(client,principal,row.snapshot.order.id)});
 return {items,nextCursor:rows.length>limit?page.cursor({updated:last.updated,id:last.snapshot.order.id}):null};
}
