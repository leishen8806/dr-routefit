import {createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cursorKey=randomBytes(32),sign=value=>createHmac('sha256',cursorKey).update(value).digest('base64url');
const money=(amountMinor,currency)=>({amountMinor:Number(amountMinor),currency});
const maxMoney=9000000000000n;
const cashMinor=value=>{ensure(Number.isSafeInteger(value)&&value>=0&&value<=Number(maxMoney),422,'CASH_AMOUNT_OUT_OF_RANGE','现金金额超出允许范围');return BigInt(value);};
const total=values=>{const amount=values.reduce((sum,value)=>sum+cashMinor(value),0n);ensure(amount>0n,422,'CASH_AMOUNT_REQUIRED','至少须登记一项现金金额');ensure(amount<=maxMoney,422,'CASH_AMOUNT_OUT_OF_RANGE','现金总额超出允许范围');return Number(amount);};

async function driver(client,principal){
 const row=(await client.query("SELECT kind,person_id FROM org.principal WHERE company_id=$1 AND id=$2 AND status='ACTIVE'",[principal.companyId,principal.principalId])).rows[0];
 ensure(row&&['DRIVER','PARTNER_DRIVER'].includes(row.kind)&&row.person_id,403,'DRIVER_IDENTITY_REQUIRED','当前会话不是有效司机身份');return row;
}
async function staff(client,principal){
 const row=(await client.query("SELECT kind,person_id FROM org.principal WHERE company_id=$1 AND id=$2 AND status='ACTIVE'",[principal.companyId,principal.principalId])).rows[0];
 ensure(row?.kind==='STAFF'&&row.person_id,403,'CASH_COUNTER_IDENTITY_REQUIRED','当前会话不是有效财务点收人员');return row;
}
function cursorPage(url,principal,scope){
 for(const key of url.searchParams.keys())ensure(['limit','cursor'].includes(key)&&url.searchParams.getAll(key).length===1,422,'INVALID_QUERY','查询参数不支持或重复');
 const limit=Number(url.searchParams.get('limit')??50);ensure(Number.isInteger(limit)&&limit>=1&&limit<=100,422,'INVALID_LIMIT','limit须为1到100');
 const binding=JSON.stringify(['cash-handovers',scope,principal.companyId,principal.principalId,limit]),token=url.searchParams.get('cursor');let after=null;
 if(token!==null){try{const [payload,signature,...rest]=token.split('.');ensure(token.length<=2048&&signature&&rest.length===0&&signature.length===43&&timingSafeEqual(Buffer.from(signature),Buffer.from(sign(payload))),422,'INVALID_CURSOR','游标无效或已失效');const decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));ensure(decoded.binding===binding&&decoded.expiresAt>Date.now()&&uuid.test(decoded.after),422,'INVALID_CURSOR','游标无效或已失效');after=decoded.after;}catch{ensure(false,422,'INVALID_CURSOR','游标无效或已失效');}}
 return {limit,after,cursor:id=>{const payload=Buffer.from(JSON.stringify({binding,after:id,expiresAt:Date.now()+3600000})).toString('base64url');return payload+'.'+sign(payload)}};
}
export const cashHandoverQuery=(url,principal,scope)=>cursorPage(url,principal,scope);
function receiptView(snapshot){return {id:snapshot.id,version:1,payerSubjectId:snapshot.payerSubjectId,money:snapshot.money,method:'CASH',state:'reported',custodyType:'DRIVER',custodianSubjectId:snapshot.custodianSubjectId,confirmedAt:null,allocatedMinor:0,unallocatedMinor:0,refundReservedMinor:0,refundedMinor:0,evidenceFileIds:snapshot.evidenceFileIds};}
function handoverView(row){return row.snapshot;}
async function orderEvidence(client,principal,orderIds,evidenceFileIds){
 ensure(new Set(evidenceFileIds).size===evidenceFileIds.length,422,'DUPLICATE_EVIDENCE','证据不得重复');
 const found=Number((await client.query("SELECT count(*) AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND resource_type='ORDER' AND resource_id=ANY($3::uuid[]) AND state='available'",[principal.companyId,evidenceFileIds,orderIds])).rows[0].count);
 ensure(found===evidenceFileIds.length,422,'EVIDENCE_UNAVAILABLE','证据不存在、未完成或不属于关联订单');
}
async function driverReceiptTotals(client,principal,orderId){
 const rows=(await client.query("SELECT r.snapshot FROM finance.receipt r JOIN finance.receipt_order ro ON (ro.company_id,ro.receipt_id)=(r.company_id,r.id) WHERE r.company_id=$1 AND ro.order_id=$2 AND r.custody_type='DRIVER' AND r.custodian_subject_id=$3",[principal.companyId,orderId,principal.principalId])).rows;
 return rows.reduce((sum,row)=>{const b=row.snapshot.cashBreakdown??{};sum.DELIVERY+=Number(b.deliveryAmountMinor??0);sum.INSURANCE+=Number(b.insuranceAmountMinor??0);sum.COD+=Number(b.codAmountMinor??0);return sum;},{DELIVERY:0,INSURANCE:0,COD:0});
}
async function ledgerDue(client,principal,orderId,currency){
 const rows=(await client.query('SELECT quote_id,fee_id,snapshot FROM finance.ledger_item WHERE company_id=$1 AND order_id=$2 FOR UPDATE',[principal.companyId,orderId])).rows;
 const result={DELIVERY:0,INSURANCE:0,COD:0};
 for(const row of rows){
  const s=row.snapshot,purpose=s.purpose; if(!Object.hasOwn(result,purpose)||s.currency!==currency)continue;
  const allocated=BigInt((await client.query("SELECT COALESCE(sum((line->>'amountMinor')::bigint),0) AS total FROM finance.prepayment_allocation a JOIN finance.allocation_event e ON (a.company_id,a.id)=(e.company_id,e.allocation_id) CROSS JOIN LATERAL jsonb_array_elements(a.snapshot->'lines') line WHERE a.company_id=$1 AND a.quote_id=$2 AND line->>'feeId'=$3 AND e.action='POSTED' AND NOT EXISTS(SELECT 1 FROM finance.reversal_event r WHERE r.company_id=a.company_id AND r.allocation_id=a.id AND r.action='POSTED')",[principal.companyId,row.quote_id,row.fee_id])).rows[0].total);
  const due=BigInt(s.originalMinor)-allocated;result[purpose]+=Number(due>0n?due:0n);
 }
 return result;
}
export async function writeDriverCashReport(client,principal,input){
 const amount=total([input.deliveryAmountMinor,input.insuranceAmountMinor,input.codAmountMinor]),driverIdentity=await driver(client,principal);ensure(Date.parse(input.observedAt)<=Date.now()+300000,422,'CASH_TIME_INVALID','现金观测时间不能超过当前五分钟');ensure(input.cashVoucherRef.trim(),422,'CASH_VOUCHER_REQUIRED','现金凭证号不能为空');
 const orderRow=(await client.query('SELECT snapshot FROM orders.draft WHERE company_id=$1 AND id=$2 FOR UPDATE',[principal.companyId,input.orderId])).rows[0];ensure(orderRow,404,'NOT_FOUND','资源不存在');const order=orderRow.snapshot;ensure(order.order.version===input.orderVersion,412,'VERSION_CONFLICT','订单已变化，请重新查询');
 const assigned=(await client.query("SELECT 1 FROM dispatch.assignment WHERE company_id=$1 AND order_id=$2 AND driver_id=$3 AND state IN ('accepted','completed')",[principal.companyId,input.orderId,principal.principalId])).rowCount;ensure(assigned,404,'NOT_FOUND','资源不存在');
 await orderEvidence(client,principal,[input.orderId],input.evidenceFileIds);await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['driver-cash:'+principal.companyId+':'+input.orderId+':'+input.currency]);
 // shortcut: COD order intake is explicitly disabled; enable this branch only with an authoritative COD receivable source.
 ensure(input.codAmountMinor===0,422,'COD_NOT_CONFIGURED','当前订单模型尚未启用COD代收，不能登记无来源的代收款');
 const due=await ledgerDue(client,principal,input.orderId,input.currency),reported=await driverReceiptTotals(client,principal,input.orderId);const requested={DELIVERY:input.deliveryAmountMinor,INSURANCE:input.insuranceAmountMinor};
 for(const purpose of Object.keys(requested))ensure(requested[purpose]<=due[purpose]-reported[purpose],422,'CASH_AMOUNT_EXCEEDS_DUE','现金金额超过该用途尚待收余额');
 const snapshot={id:randomUUID(),payerSubjectId:order.order.customerId,money:money(amount,input.currency),method:'CASH',custodyType:'DRIVER',custodianSubjectId:principal.principalId,receivingAccountId:null,externalReference:input.cashVoucherRef.trim().toUpperCase(),orderIds:[input.orderId],evidenceFileIds:input.evidenceFileIds,observedAt:input.observedAt,preparedBy:principal.principalId,personId:driverIdentity.person_id,cashBreakdown:{deliveryAmountMinor:input.deliveryAmountMinor,insuranceAmountMinor:input.insuranceAmountMinor,codAmountMinor:0},recordedAt:new Date().toISOString()};
 try{await client.query('INSERT INTO finance.receipt(id,company_id,payer_subject_id,money_amount_minor,money_currency,method,receiving_account_id,external_reference,custody_type,custodian_subject_id,observed_at,prepared_by,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,NULL,$7,$8,$9,$10,$11,$12,$13)',[snapshot.id,principal.companyId,snapshot.payerSubjectId,snapshot.money.amountMinor,snapshot.money.currency,snapshot.method,snapshot.externalReference,snapshot.custodyType,snapshot.custodianSubjectId,snapshot.observedAt,principal.principalId,driverIdentity.person_id,snapshot]);}catch(error){if(error.code==='23505')ensure(false,409,'CASH_VOUCHER_DUPLICATE','同一司机现金凭证已登记');throw error;}
 await client.query('INSERT INTO finance.receipt_order(company_id,receipt_id,order_id) VALUES($1,$2,$3)',[principal.companyId,snapshot.id,input.orderId]);for(const evidenceId of input.evidenceFileIds)await client.query('INSERT INTO finance.receipt_evidence(company_id,receipt_id,evidence_file_id) VALUES($1,$2,$3)',[principal.companyId,snapshot.id,evidenceId]);return receiptView(snapshot);
}
async function receiptForHandover(client,principal,driverId,line){
 const row=(await client.query("SELECT r.id,r.snapshot FROM finance.receipt r JOIN finance.receipt_confirmation c ON (c.company_id,c.receipt_id)=(r.company_id,r.id) WHERE r.company_id=$1 AND r.id=$2 AND r.custody_type='DRIVER' AND r.custodian_subject_id=$3 FOR UPDATE",[principal.companyId,line.receiptId,driverId])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');ensure(line.receiptVersion===2,412,'VERSION_CONFLICT','现金申报尚未独立确认');return row;
}
async function handoverEvidenceOrders(client,principal,receiptIds){return (await client.query('SELECT DISTINCT order_id FROM finance.receipt_order WHERE company_id=$1 AND receipt_id=ANY($2::uuid[])',[principal.companyId,receiptIds])).rows.map(row=>row.order_id);}
export async function writeDriverHandover(client,principal,input){
 const driverIdentity=await driver(client,principal);ensure(new Set(input.items.map(item=>item.receiptId)).size===input.items.length,422,'DUPLICATE_RECEIPT','同一现金申报不得重复交回');const receipts=[];
 for(const line of input.items)receipts.push({line,row:await receiptForHandover(client,principal,principal.principalId,line)});
 const currencies=new Set(receipts.map(item=>item.row.snapshot.money.currency));ensure(currencies.size===1&&currencies.has(input.currency),422,'CURRENCY_MISMATCH','交款必须使用同一币种且与现金申报一致');
 for(const item of receipts){const used=BigInt((await client.query("SELECT COALESCE(sum(l.amount_minor),0) AS total FROM finance.cash_handover_line l JOIN finance.cash_handover h ON (h.company_id,h.id)=(l.company_id,l.handover_id) WHERE l.company_id=$1 AND l.receipt_id=$2 AND h.state IN ('submitted','counted','disputed','reviewed','posted')",[principal.companyId,item.line.receiptId])).rows[0].total);ensure(BigInt(item.line.amountMinor)+used<=BigInt(item.row.snapshot.money.amountMinor),422,'CASH_HANDOVER_EXCEEDS_CUSTODY','交回金额超过司机尚未交回的已确认现金');}
 const orderIds=await handoverEvidenceOrders(client,principal,input.items.map(item=>item.receiptId));ensure(orderIds.length>0,409,'CASH_RECEIPT_ORDER_MISSING','现金申报缺少关联订单');await orderEvidence(client,principal,orderIds,input.evidenceFileIds);
 const amount=total(input.items.map(item=>item.amountMinor)),result={id:randomUUID(),version:1,driverSubjectId:principal.principalId,declared:money(amount,input.currency),counted:null,differenceMinor:null,differenceDirection:'UNKNOWN',state:'submitted',reviewDocumentId:null};
 await client.query('INSERT INTO finance.cash_handover(id,company_id,driver_principal_id,driver_person_id,currency,declared_amount_minor,counted_amount_minor,difference_minor,difference_direction,state,version,review_document_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,NULL,NULL,$7,$8,$9,NULL,$10)',[result.id,principal.companyId,principal.principalId,driverIdentity.person_id,input.currency,amount,result.differenceDirection,result.state,result.version,result]);
 for(const item of input.items)await client.query('INSERT INTO finance.cash_handover_line(company_id,handover_id,receipt_id,receipt_version,amount_minor) VALUES($1,$2,$3,$4,$5)',[principal.companyId,result.id,item.receiptId,item.receiptVersion,item.amountMinor]);for(const evidenceId of input.evidenceFileIds)await client.query('INSERT INTO finance.cash_handover_evidence(company_id,handover_id,evidence_file_id) VALUES($1,$2,$3)',[principal.companyId,result.id,evidenceId]);return result;
}
async function handover(client,principal,id,lock=false){ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');const row=(await client.query('SELECT * FROM finance.cash_handover WHERE company_id=$1 AND id=$2'+(lock?' FOR UPDATE':''),[principal.companyId,id])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');return row;}
export async function readCashHandovers(client,principal,query,scope){
 if(scope==='driver')await driver(client,principal);
 const own=scope==='driver'?principal.principalId:null,rows=(await client.query('SELECT * FROM finance.cash_handover WHERE company_id=$1 AND ($2::uuid IS NULL OR driver_principal_id=$2) AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4',[principal.companyId,own,query.after,query.limit+1])).rows,selected=rows.slice(0,query.limit);
 return {items:selected.map(handoverView),nextCursor:rows.length>query.limit?query.cursor(selected.at(-1).id):null};
}
export async function readCashHandover(client,principal,id){return handoverView(await handover(client,principal,id));}
export async function writeCashCount(client,principal,id,input,version){
 const counter=await staff(client,principal),current=await handover(client,principal,id,true);ensure(Number(current.version)===version,412,'VERSION_CONFLICT','现金交接已变化，请重新查询');ensure(current.state==='submitted',409,'CASH_HANDOVER_NOT_COUNTABLE','当前现金交接不可点收');ensure(counter.person_id!==current.driver_person_id,403,'INDEPENDENT_CASH_COUNT_REQUIRED','点收人必须与司机申报人不同');ensure(input.actual.currency===current.currency,422,'CURRENCY_MISMATCH','实际点收币种必须与申报一致');
 const receiptIds=(await client.query('SELECT receipt_id FROM finance.cash_handover_line WHERE company_id=$1 AND handover_id=$2',[principal.companyId,id])).rows.map(row=>row.receipt_id),orderIds=await handoverEvidenceOrders(client,principal,receiptIds);await orderEvidence(client,principal,orderIds,input.evidenceFileIds);
 const declared=BigInt(current.declared_amount_minor),actual=BigInt(input.actual.amountMinor),difference=declared>actual?declared-actual:actual-declared,direction=difference===0n?'NONE':actual<declared?'SHORT':'OVER',state=difference===0n?'counted':'disputed',result={...handoverView(current),version:Number(current.version)+1,counted:input.actual,differenceMinor:Number(difference),differenceDirection:direction,state};
 await client.query('INSERT INTO finance.cash_handover_count(company_id,handover_id,counter_principal_id,counter_person_id,actual_amount_minor,snapshot) VALUES($1,$2,$3,$4,$5,$6)',[principal.companyId,id,principal.principalId,counter.person_id,input.actual.amountMinor,{handoverId:id,actual:input.actual,reason:input.reason.trim(),evidenceFileIds:input.evidenceFileIds,recordedAt:new Date().toISOString()}]);
 for(const evidenceId of input.evidenceFileIds)await client.query('INSERT INTO finance.cash_handover_count_evidence(company_id,handover_id,evidence_file_id) VALUES($1,$2,$3)',[principal.companyId,id,evidenceId]);await client.query('UPDATE finance.cash_handover SET counted_amount_minor=$3,difference_minor=$4,difference_direction=$5,state=$6,version=$7,snapshot=$8,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2',[principal.companyId,id,input.actual.amountMinor,result.differenceMinor,direction,state,result.version,result]);return result;
}
