import {randomUUID} from 'node:crypto';
import {ensure} from '../domain/errors.mjs';
import {getOrder,currentCustomer} from './orders.mjs';
import {getQuote,amendmentPosition} from './quotes.mjs';
import {createQuoteLedgerItems} from './finance.mjs';
import {lockCoverage,readIntake} from './intake.mjs';
const max=9000000000000n;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const amount=n=>{ensure(n>=0n&&n<=max,422,'AMOUNT_OUT_OF_RANGE','累计金额超出本地支持范围');return Number(n);};
const stamp=(principal,input,personId)=>({principalId:principal.principalId,personId,...input,recordedAt:new Date().toISOString(),sourceQuality:'MANUAL_RECORDED'});
const person=async(c,p)=>(await c.query('SELECT person_id FROM org.principal WHERE company_id=$1 AND id=$2',[p.companyId,p.principalId])).rows[0].person_id;
const reason=input=>ensure(input.reason.trim(),422,'REASON_REQUIRED','必须记录处理依据');
export async function receipt(c,p,id){
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');
 const r=(await c.query('SELECT snapshot FROM finance.prepayment_receipt WHERE company_id=$1 AND id=$2',[p.companyId,id])).rows[0];ensure(r,404,'NOT_FOUND','资源不存在');
 const d=(await c.query('SELECT snapshot FROM finance.receipt_decision WHERE company_id=$1 AND receipt_id=$2',[p.companyId,id])).rows[0]?.snapshot;
 return {...r.snapshot,version:d?2:1,state:d?(d.approve?'CONFIRMED':'REJECTED'):'REPORTED',verification:d??null};
}
export async function allocation(c,p,id){
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');
 const r=(await c.query('SELECT snapshot FROM finance.prepayment_allocation WHERE company_id=$1 AND id=$2',[p.companyId,id])).rows[0];ensure(r,404,'NOT_FOUND','资源不存在');
 const events=(await c.query('SELECT snapshot FROM finance.allocation_event WHERE company_id=$1 AND allocation_id=$2 ORDER BY version',[p.companyId,id])).rows.map(x=>x.snapshot);
 const reversed=(await c.query("SELECT reversal_id FROM finance.reversal_event WHERE company_id=$1 AND allocation_id=$2 AND action='POSTED'",[p.companyId,id])).rows[0];
 return {...r.snapshot,version:reversed?5:events.at(-1)?.version??1,state:reversed?'REVERSED':events.at(-1)?.action??'SUBMITTED',events,...(reversed?{reversalId:reversed.reversal_id}:{})};
}
async function posted(c,p,orderId){return (await c.query("SELECT a.snapshot FROM finance.prepayment_allocation a JOIN finance.allocation_event e ON (a.company_id,a.id)=(e.company_id,e.allocation_id) WHERE a.company_id=$1 AND a.order_id=$2 AND e.action='POSTED' AND NOT EXISTS(SELECT 1 FROM finance.reversal_event r WHERE r.company_id=a.company_id AND r.allocation_id=a.id AND r.action='POSTED')",[p.companyId,orderId])).rows.map(x=>x.snapshot);}
async function allocationBalance(c,p,a){
 const r=await receipt(c,p,a.receiptId),q=await getQuote(c,p,a.quoteId);ensure(r.state==='CONFIRMED'&&r.orderId===a.orderId&&r.quoteId===a.quoteId,422,'RECEIPT_NOT_AVAILABLE','须使用本订单已核验收款');
 ensure(q.state==='confirmed',409,'QUOTE_NOT_CONFIRMED','报价未确认');
 const history=await posted(c,p,a.orderId),used=history.filter(x=>x.receiptId===a.receiptId).reduce((sum,x)=>sum+BigInt(x.amountMinor),0n);
 ensure(used+BigInt(a.amountMinor)<=BigInt(r.money.amountMinor),422,'ALLOCATION_EXCEEDS_RECEIPT','核销额超过可分配收款');
 for(const line of a.lines){const fee=q.fees.find(x=>x.id===line.feeId);ensure(fee,422,'INVALID_FEE','必须对应当前确认报价费用');const allocated=history.flatMap(x=>x.lines).filter(x=>x.feeId===line.feeId).reduce((sum,x)=>sum+BigInt(x.amountMinor),0n);ensure(allocated+BigInt(line.amountMinor)<=BigInt(fee.money.amountMinor),422,'ALLOCATION_EXCEEDS_FEE','核销超过费用未结余额');}
}
export async function admission(c,p,id){
 const order=await getOrder(c,p,id),q=order.quoteId?await getQuote(c,p,order.quoteId):null,history=await posted(c,p,id);
 const receipts=(await c.query('SELECT id FROM finance.prepayment_receipt WHERE company_id=$1 AND order_id=$2 ORDER BY id',[p.companyId,id])).rows;
 const rows=[];for(const r of receipts)rows.push(await receipt(c,p,r.id));
 const confirmed=amount(rows.filter(r=>r.state==='CONFIRMED').reduce((n,r)=>n+BigInt(r.money.amountMinor),0n));
 const applied=amount(history.reduce((n,a)=>n+BigInt(a.amountMinor),0n));
 const fees=q?q.fees.map(f=>({...f,allocatedMinor:amount(history.flatMap(a=>a.lines).filter(x=>x.feeId===f.id).reduce((n,x)=>n+BigInt(x.amountMinor),0n))})):[];
 const reversals=await orderReversals(c,p,id);
 const report=await readIntake(c,p,'intake-check',id),blockers=[];
 if(reversals.some(r=>!['POSTED','REJECTED'].includes(r.state)))blockers.push('ALLOCATION_REVERSAL_PENDING');
 if(q?.state!=='confirmed')blockers.push('QUOTE_NOT_CONFIRMED');
 if(!report.ready)blockers.push(...report.blockers.map(x=>x.code));
 const remaining=q?amount(BigInt(q.total.amountMinor)-BigInt(applied)):null;
 if(remaining===null||remaining>0)blockers.push('PAYMENT_NOT_ALLOCATED');
 return {orderId:id,orderVersion:order.order.version,quoteId:q?.id??null,currency:q?.total.currency??null,requiredMinor:q?.total.amountMinor??null,confirmedMinor:confirmed,allocatedMinor:applied,unallocatedMinor:amount(BigInt(confirmed)-BigInt(applied)),remainingMinor:remaining,fees,receipts:rows,reversals,allocationIds:history.map(a=>a.id),paymentSatisfied:blockers.length===0,dispatchAllowed:false,blockers:[...new Set(blockers)],checkedAt:new Date().toISOString()};
}
export async function readPrepayment(c,p,kind,id){
 if(kind==='reversal')return reversal(c,p,id);
 if(kind==='accounts')return {items:(await c.query('SELECT id,label,currency FROM finance.receiving_account WHERE company_id=$1 AND active ORDER BY id LIMIT 100',[p.companyId])).rows};
 if(kind==='receipt')return receipt(c,p,id);
 if(kind==='allocation')return allocation(c,p,id);
 return admission(c,p,id);
}
export async function authorizePrepayment(c,p,kind,id){
 if(kind==='reversal-create')return allocation(c,p,id);
 if(kind.startsWith('reversal-'))return reversal(c,p,id);
 if(kind==='confirm')return getQuote(c,p,id);
 if(kind.startsWith('receipt-')&&kind!=='receipt-create')return receipt(c,p,id);
 if(kind.startsWith('allocation-')&&kind!=='allocation-create')return allocation(c,p,id);
 return getOrder(c,p,id);
}
export async function writePrepayment(c,p,kind,id,input,version){
 const who=await person(c,p),company=p.companyId;
 if(kind.startsWith('reversal-'))return writeReversal(c,p,kind,id,input,version,who);
 if(kind==='customer-confirm'){
  let q=await getQuote(c,p,id),o=await getOrder(c,p,q.orderId,true);ensure(o.order.customerId===await currentCustomer(c,p),404,'NOT_FOUND','资源不存在');await lockCoverage(c,company);q=await getQuote(c,p,id);
  ensure(q.version===version,412,'VERSION_CONFLICT','报价版本已变化，请重新查询');ensure(q.state==='issued',409,'QUOTE_NOT_USABLE','报价不可确认，请读取最新状态');reason(input);ensure(new Set(input.evidenceFileIds).size===input.evidenceFileIds.length,422,'DUPLICATE_EVIDENCE','确认依据不得重复');
  const evidence=(await c.query("SELECT count(*)::integer AS count FROM evidence.file WHERE company_id=$1 AND id=ANY($2::uuid[]) AND resource_type='ORDER' AND resource_id=$3 AND state='available'",[company,input.evidenceFileIds,q.orderId])).rows[0];ensure(evidence.count===input.evidenceFileIds.length,422,'CONFIRMATION_EVIDENCE_UNAVAILABLE','确认依据不存在、未完成或不属于本订单');
  const now=new Date().toISOString(),snapshot={principalId:p.principalId,personId:who,recordedAt:now,sourceQuality:'CUSTOMER_PORTAL',customerContact:'customer:'+o.order.customerId,method:'PORTAL',reference:input.reason.trim(),confirmedAt:now,evidenceFileIds:input.evidenceFileIds};await c.query('INSERT INTO pricing.quote_confirmation(company_id,quote_id,order_id,snapshot,principal_id) VALUES($1,$2,$3,$4,$5)',[company,id,q.orderId,snapshot,p.principalId]);
  if(q.amendment){const position=await amendmentPosition(c,p,q);await c.query('INSERT INTO pricing.quote_change_position(company_id,quote_id,order_id,case_id,snapshot) VALUES($1,$2,$3,$4,$5)',[company,id,q.orderId,q.amendment.serviceCaseId,position]);}else await createQuoteLedgerItems(c,p,q,o);
  return getQuote(c,p,id);
 }
 if(kind==='confirm'){
  let q=await getQuote(c,p,id);const order=await getOrder(c,p,q.orderId,true);await lockCoverage(c,company);q=await getQuote(c,p,id);
  ensure(q.version===version,412,'VERSION_CONFLICT','报价版本已变化');ensure(q.state==='issued',409,'QUOTE_NOT_USABLE','报价不可确认，请读取最新状态');ensure(input.method!=='PORTAL',422,'PORTAL_CONFIRMATION_REQUIRED','客户门户确认必须使用客户接口');
  for(const k of ['customerContact','reference'])ensure(input[k].trim(),422,'EVIDENCE_REQUIRED','须记录客户身份及确认依据');
  ensure(Date.parse(input.confirmedAt)<=Date.now()&&Date.parse(input.confirmedAt)>=Date.parse(q.createdAt),422,'INVALID_CONFIRMATION_TIME','确认时间须在报价生成之后且不得在未来');
  const snapshot=stamp(p,input,who);await c.query('INSERT INTO pricing.quote_confirmation(company_id,quote_id,order_id,snapshot,principal_id) VALUES($1,$2,$3,$4,$5)',[company,id,q.orderId,snapshot,p.principalId]);
  if(q.amendment){const position=await amendmentPosition(c,p,q);await c.query('INSERT INTO pricing.quote_change_position(company_id,quote_id,order_id,case_id,snapshot) VALUES($1,$2,$3,$4,$5)',[company,id,q.orderId,q.amendment.serviceCaseId,position]);}
  else await createQuoteLedgerItems(c,p,q,order);
  return getQuote(c,p,id);
 }
 if(kind==='receipt-create'){
  const o=await getOrder(c,p,id,true);ensure(o.order.version===version,412,'VERSION_CONFLICT','订单版本已变化');const q=o.quoteId?await getQuote(c,p,o.quoteId):null;ensure(q?.state==='confirmed',409,'QUOTE_NOT_CONFIRMED','须先记录客户确认报价');
  ensure(input.reference.trim()&&input.bankReference.trim(),422,'EVIDENCE_REQUIRED','必须记录银行交易号与人工依据');ensure(Date.parse(input.observedAt)<=Date.now(),422,'INVALID_RECEIPT_TIME','实际到账时间不得在未来');
  const acct=(await c.query('SELECT * FROM finance.receiving_account WHERE company_id=$1 AND id::text=$2 AND active',[company,input.receivingAccountId])).rows[0];ensure(acct,404,'NOT_FOUND','资源不存在');ensure(acct.currency===q.total.currency&&input.money.currency===q.total.currency,422,'CURRENCY_MISMATCH','币种必须一致，不隐式换汇');
  // shortcut: bound the local detail response; add paginated financial ledgers before pilot use.
  ensure((await c.query('SELECT count(*) FROM finance.prepayment_receipt WHERE company_id=$1 AND order_id=$2',[company,id])).rows[0].count<100,422,'LOCAL_LIMIT_REACHED','本地每单最多100笔收款申报');
  const snapshot={id:randomUUID(),orderId:id,quoteId:q.id,preparedBy:p.principalId,personId:who,...input,bankReference:input.bankReference.trim().toUpperCase(),recordedAt:new Date().toISOString()};
  await c.query('INSERT INTO finance.prepayment_receipt(id,company_id,order_id,quote_id,account_id,bank_reference,amount_minor,currency,prepared_by,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[snapshot.id,company,id,q.id,acct.id,snapshot.bankReference,input.money.amountMinor,input.money.currency,p.principalId,who,snapshot]);return receipt(c,p,snapshot.id);
 }
 if(kind==='receipt-verify'){
  let r=await receipt(c,p,id);await getOrder(c,p,r.orderId,true);r=await receipt(c,p,id);ensure(r.version===version,412,'VERSION_CONFLICT','收款申报已处理');reason(input);ensure(r.personId!==who,403,'INDEPENDENT_REVIEW_REQUIRED','不能核验本人申报，包括同人不同账号');
  if(input.approve){await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['bank:'+company+':'+r.receivingAccountId+':'+r.bankReference]);const duplicate=(await c.query("SELECT 1 FROM finance.receipt_decision WHERE company_id=$1 AND account_id=$2 AND bank_reference=$3 AND outcome='CONFIRMED'",[company,r.receivingAccountId,r.bankReference])).rowCount;ensure(!duplicate,409,'BANK_TRANSACTION_USED','银行交易已登记，不得重复确认为资金事实');}
  if(input.approve){const sum=(await c.query("SELECT COALESCE(sum(r.amount_minor),0) AS total FROM finance.prepayment_receipt r JOIN finance.receipt_decision d ON (r.company_id,r.id)=(d.company_id,d.receipt_id) WHERE r.company_id=$1 AND r.order_id=$2 AND d.outcome='CONFIRMED'",[company,r.orderId])).rows[0].total;amount(BigInt(sum)+BigInt(r.money.amountMinor));}
  const snapshot=stamp(p,input,who);try{await c.query('INSERT INTO finance.receipt_decision(company_id,receipt_id,account_id,bank_reference,outcome,principal_id,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[company,id,r.receivingAccountId,r.bankReference,input.approve?'CONFIRMED':'REJECTED',p.principalId,who,snapshot]);}catch(e){if(e.code==='23505')ensure(false,409,'BANK_TRANSACTION_USED','交易或申报已被处理，请核对原记录');throw e;}return receipt(c,p,id);
 }
 if(kind==='allocation-create'){
  const o=await getOrder(c,p,id,true);ensure(o.order.version===version,412,'VERSION_CONFLICT','订单版本已变化');reason(input);ensure(new Set(input.lines.map(x=>x.feeId)).size===input.lines.length,422,'DUPLICATE_FEE','同一费用不可重复列入');
  ensure((await c.query('SELECT count(*) FROM finance.prepayment_allocation WHERE company_id=$1 AND order_id=$2',[company,id])).rows[0].count<100,422,'LOCAL_LIMIT_REACHED','本地每单最多100笔核销申请');
  const snapshot={id:randomUUID(),orderId:id,quoteId:o.quoteId,preparedBy:p.principalId,personId:who,...input,amountMinor:amount(input.lines.reduce((n,x)=>n+BigInt(x.amountMinor),0n)),createdAt:new Date().toISOString()};await allocationBalance(c,p,snapshot);
  await c.query('INSERT INTO finance.prepayment_allocation(id,company_id,receipt_id,order_id,quote_id,prepared_by,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[snapshot.id,company,input.receiptId,id,o.quoteId,p.principalId,who,snapshot]);return allocation(c,p,snapshot.id);
 }
 let a=await allocation(c,p,id);await getOrder(c,p,a.orderId,true);a=await allocation(c,p,id);ensure(a.version===version,412,'VERSION_CONFLICT','核销单版本已变化');reason(input);
 const target={'allocation-review':['SUBMITTED','REVIEWED'],'allocation-approve':['REVIEWED','APPROVED'],'allocation-post':['APPROVED','POSTED']}[kind];ensure(a.state===target[0],409,'INVALID_STATE','审核/入账顺序不符');
 if(kind!=='allocation-post')ensure(who!==a.personId&&(kind!=='allocation-approve'||who!==a.events[0].personId),403,'INDEPENDENT_REVIEW_REQUIRED','经办、复核、审批必须是三个不同人员');
 if(kind==='allocation-post'||input.approve)await allocationBalance(c,p,a);
 const action=kind!=='allocation-post'&&!input.approve?'REJECTED':target[1],snapshot={...stamp(p,input,who),version:version+1,action};
 await c.query('INSERT INTO finance.allocation_event(company_id,allocation_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[company,id,snapshot.version,action,p.principalId,who,snapshot]);return allocation(c,p,id);
}

async function reversal(c,p,id){
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');
 const row=(await c.query('SELECT snapshot FROM finance.allocation_reversal WHERE company_id=$1 AND id=$2',[p.companyId,id])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');
 const events=(await c.query('SELECT snapshot FROM finance.reversal_event WHERE company_id=$1 AND reversal_id=$2 ORDER BY version',[p.companyId,id])).rows.map(r=>r.snapshot);
 return {...row.snapshot,version:events.at(-1)?.version??1,state:events.at(-1)?.action??'SUBMITTED',events};
}
async function orderReversals(c,p,orderId){
 const ids=(await c.query('SELECT id FROM finance.allocation_reversal WHERE company_id=$1 AND order_id=$2 ORDER BY id',[p.companyId,orderId])).rows,out=[];
 for(const r of ids)out.push(await reversal(c,p,r.id));return out;
}
async function writeReversal(c,p,kind,id,input,version,who){
 reason(input);
 if(kind==='reversal-create'){
  let a=await allocation(c,p,id);const order=await getOrder(c,p,a.orderId,true);a=await allocation(c,p,id);
  ensure(a.version===version,412,'VERSION_CONFLICT','原核销版本已变化');ensure(a.state==='POSTED',409,'ALLOCATION_NOT_POSTED','只能撤销已入账且未撤销的核销');
  ensure(!order.activeExecution&&order.order.state==='quoted',409,'CORRECTION_NOT_AVAILABLE','本切片只支持未派单订单纠错');
  ensure(input.reference.trim(),422,'EVIDENCE_REQUIRED','撤销必须有核查依据');
  const previous=await orderReversals(c,p,a.orderId);
  ensure(previous.length<100,422,'LOCAL_LIMIT_REACHED','本地每单最多100次撤销申请');
  ensure(!previous.some(r=>r.allocationId===id&&r.state!=='REJECTED'),409,'REVERSAL_ALREADY_REQUESTED','已有待处理或已入账撤销，请读取原件');
  const snapshot={id:randomUUID(),orderId:a.orderId,allocationId:id,preparedBy:p.principalId,personId:who,sourceAllocation:a,...input,createdAt:new Date().toISOString()};
  await c.query('INSERT INTO finance.allocation_reversal(id,company_id,order_id,allocation_id,prepared_by,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[snapshot.id,p.companyId,a.orderId,id,p.principalId,who,snapshot]);return reversal(c,p,snapshot.id);
 }
 let r=await reversal(c,p,id);const order=await getOrder(c,p,r.orderId,true);r=await reversal(c,p,id);
 ensure(r.version===version,412,'VERSION_CONFLICT','撤销申请已变化');
 const target={'reversal-review':['SUBMITTED','REVIEWED'],'reversal-approve':['REVIEWED','APPROVED'],'reversal-post':['APPROVED','POSTED']}[kind];ensure(r.state===target[0],409,'INVALID_STATE','撤销必须依次复核、审批、入账');
 if(kind!=='reversal-post')ensure(who!==r.personId&&(kind!=='reversal-approve'||who!==r.events[0].personId),403,'INDEPENDENT_REVIEW_REQUIRED','撤销经办、复核、审批必须是三个不同人员');
 if(kind==='reversal-post'||input.approve){
  ensure(!order.activeExecution&&order.order.state==='quoted',409,'CORRECTION_NOT_AVAILABLE','已进入履约，不能使用本地纠错切片');
  const a=await allocation(c,p,r.allocationId);ensure(a.state==='POSTED'&&a.version===r.sourceAllocation.version,409,'ALLOCATION_NOT_POSTED','原核销已撤销或版本变化');
 }
 const snapshot={...stamp(p,input,who),version:version+1,action:kind!=='reversal-post'&&!input.approve?'REJECTED':target[1]};
 await c.query('INSERT INTO finance.reversal_event(company_id,reversal_id,allocation_id,version,action,principal_id,person_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[p.companyId,id,r.allocationId,snapshot.version,snapshot.action,p.principalId,who,snapshot]);return reversal(c,p,id);
}
