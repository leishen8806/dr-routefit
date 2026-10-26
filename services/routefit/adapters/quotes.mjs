import {randomUUID} from 'node:crypto';
import {ApiError,ensure} from '../domain/errors.mjs';
import {quoteCalculation,quoteStatus} from '../domain/quotes.mjs';
import {getOrder} from './orders.mjs';
import {getPolicy} from './policy.mjs';
import {lockCoverage,readIntake,recheckIntake} from './intake.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function amendmentCase(client,principal,id,order){
 ensure(uuid.test(id),404,'NOT_FOUND','资源不存在');
 const row=(await client.query("SELECT c.snapshot,e.action FROM casework.service_case c LEFT JOIN casework.service_case_event e ON (c.company_id,c.id)=(e.company_id,e.case_id) WHERE c.company_id=$1 AND c.id=$2",[principal.companyId,id])).rows[0];
 ensure(row&&row.snapshot.orderId===order.order.id,404,'NOT_FOUND','资源不存在');ensure(row.action==='ACCEPT',409,'CHANGE_NOT_ACCEPTED','须先由独立运营人员受理变更申请');
 ensure(['ADDRESS_CHANGE','TIME_CHANGE'].includes(row.snapshot.type),422,'CHANGE_NOT_REQUOTEABLE','当前申请类型不能产生重报价');return row.snapshot;
}
const amendedOrder=(order,change)=>({
 ...order,
 draft:{...order.draft,...(change.requestedDelivery?{delivery:change.requestedDelivery}:{}),...(change.requestedWindow?{requestedDeliveryWindow:change.requestedWindow}:{})}
});
function amendmentStatus(quote,order,report,change){
 if(order.order.version!==quote.sourceOrderVersion||order.quoteId!==quote.amendment.baseQuoteId||!change||!report.ready)return {state:'superseded',unusableReasons:!report.ready?report.blockers.map(x=>x.code):['ORDER_CHANGED']};
 if(Date.now()>=Date.parse(quote.expiresAt))return {state:'expired',unusableReasons:['EXPIRED']};return {state:'issued',unusableReasons:[]};
}
export async function amendmentPosition(client,principal,quote){
 const base=await getQuote(client,principal,quote.amendment.baseQuoteId),company=principal.companyId;
 const confirmed=BigInt((await client.query("SELECT COALESCE(sum(r.amount_minor),0) AS total FROM finance.prepayment_receipt r JOIN finance.receipt_decision d ON (r.company_id,r.id)=(d.company_id,d.receipt_id) WHERE r.company_id=$1 AND r.quote_id=$2 AND d.outcome='CONFIRMED'",[company,base.id])).rows[0].total);
 const allocated=BigInt((await client.query("SELECT COALESCE(sum((a.snapshot->>'amountMinor')::bigint),0) AS total FROM finance.prepayment_allocation a JOIN finance.allocation_event e ON (a.company_id,a.id)=(e.company_id,e.allocation_id) WHERE a.company_id=$1 AND a.quote_id=$2 AND e.action='POSTED' AND NOT EXISTS(SELECT 1 FROM finance.reversal_event r WHERE r.company_id=a.company_id AND r.allocation_id=a.id AND r.action='POSTED')",[company,base.id])).rows[0].total);
 const candidate=BigInt(quote.total.amountMinor),baseTotal=BigInt(base.total.amountMinor),difference=candidate-baseTotal;
 return {baseQuoteId:base.id,candidateQuoteId:quote.id,currency:quote.total.currency,baseTotalMinor:Number(baseTotal),candidateTotalMinor:Number(candidate),differenceMinor:Number(difference),confirmedOriginalMinor:Number(confirmed),allocatedOriginalMinor:Number(allocated),unallocatedOriginalMinor:Number(confirmed-allocated),additionalRequiredMinor:Number(candidate>allocated?candidate-allocated:0n),creditPendingMinor:Number(allocated>candidate?allocated-candidate:0n),calculatedAt:new Date().toISOString()};
}

export async function getQuote(client,principal,id){
 const row=(await client.query('SELECT snapshot FROM pricing.order_quote WHERE company_id=$1 AND id=$2',[principal.companyId,id])).rows[0];ensure(row,404,'NOT_FOUND','资源不存在');
 const quote=row.snapshot,order=await getOrder(client,principal,quote.orderId),isAmendment=Boolean(quote.amendment),change=isAmendment?await amendmentCase(client,principal,quote.amendment.serviceCaseId,order):null,report=isAmendment?await recheckIntake(client,principal,quote.sourceOrderSnapshot):await readIntake(client,principal,'intake-check',quote.orderId);
 const confirmation=(await client.query('SELECT snapshot FROM pricing.quote_confirmation WHERE company_id=$1 AND quote_id=$2',[principal.companyId,id])).rows[0]?.snapshot;
 if(!confirmation)return {...quote,...(isAmendment?amendmentStatus(quote,order,report,change):quoteStatus(quote,order,report))};
 const position=isAmendment?(await client.query('SELECT snapshot FROM pricing.quote_change_position WHERE company_id=$1 AND quote_id=$2',[principal.companyId,id])).rows[0]?.snapshot:null;
 return {...quote,version:2,state:'confirmed',customerConfirmedAt:confirmation.confirmedAt,confirmation,unusableReasons:report.blockers.map(x=>x.code),...(position?{amendment:{...quote.amendment,financialPosition:position}}:{})};
}

export async function createQuote(client,principal,id,input,version){
 const order=await getOrder(client,principal,id,true);
 ensure(order.order.version===version,412,'VERSION_CONFLICT','订单版本已变化');
 ensure(['validating','quoted'].includes(order.order.state),409,'INVALID_STATE','须先完成订单受理输入检查');
 const baseConfirmed=order.quoteId&&(await client.query('SELECT 1 FROM pricing.quote_confirmation WHERE company_id=$1 AND quote_id=$2',[principal.companyId,order.quoteId])).rowCount===1;
 ensure(!input.serviceCaseId||uuid.test(input.serviceCaseId),422,'INVALID_REFERENCE','变更申请引用无效');
 ensure(!baseConfirmed||input.serviceCaseId,409,'CONFIRMED_QUOTE_LOCKED','客户已确认报价，须引用已受理的变更申请');
 ensure(baseConfirmed||!input.serviceCaseId,422,'UNEXPECTED_CHANGE_CASE','未确认报价不接受变更申请引用');
 if(input.serviceCaseId)ensure((await client.query('SELECT 1 FROM pricing.amendment_quote WHERE company_id=$1 AND case_id=$2',[principal.companyId,input.serviceCaseId])).rowCount===0,409,'CHANGE_ALREADY_REQUOTED','该变更申请已生成候选报价');
 const change=baseConfirmed?await amendmentCase(client,principal,input.serviceCaseId,order):null,candidate=change?amendedOrder(order,change):order;
 await lockCoverage(client,principal.companyId);
 const report=change?await recheckIntake(client,principal,candidate):await readIntake(client,principal,'intake-check',id);
 if(!report.ready)throw new ApiError(422,'INTAKE_BLOCKED','受理依据已失效，须退回重核',report.blockers);
 ensure(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.pricingPolicyVersionId),404,'NOT_FOUND','资源不存在');
 const policy=await getPolicy(client,principal,input.pricingPolicyVersionId),now=Date.now(),{calculation,expiresAt}=quoteCalculation(candidate,policy,input,now),quoteId=randomUUID();
 const purpose={base:'DELIVERY',flash:'EXCLUSIVE',insurance:'INSURANCE'};
 const baseQuote=change?await getQuote(client,principal,order.quoteId):null,difference=baseQuote?calculation.totalMinor-baseQuote.total.amountMinor:0;
 const amendment=change?{serviceCaseId:input.serviceCaseId,baseQuoteId:order.quoteId,differenceMinor:difference,differenceDirection:difference>0?'INCREASE':difference<0?'DECREASE':'NONE'}:undefined;
 const quote={id:quoteId,version:1,orderId:id,orderVersion:version+1,sourceOrderVersion:version,state:'issued',fees:calculation.lines.map(x=>({id:randomUUID(),purpose:purpose[x.code],money:{amountMinor:x.amountMinor,currency:calculation.currency},direction:'CHARGE',basis:x.rule.evidence})),total:{amountMinor:calculation.totalMinor,currency:calculation.currency},expiresAt,pricingPolicyVersionId:policy.id,customerConfirmedAt:null,createdAt:new Date(now).toISOString(),insuranceRequested:input.insuranceRequested,calculation,sourceOrderSnapshot:candidate,policySnapshot:policy,unusableReasons:[],...(amendment?{amendment}:{})};
 await client.query('INSERT INTO pricing.order_quote(id,company_id,order_id,source_version,policy_id,snapshot,principal_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[quoteId,principal.companyId,id,version,policy.id,quote,principal.principalId]);
 if(amendment)await client.query('INSERT INTO pricing.amendment_quote(company_id,quote_id,order_id,case_id,base_quote_id,snapshot) VALUES($1,$2,$3,$4,$5,$6)',[principal.companyId,quoteId,id,input.serviceCaseId,order.quoteId,amendment]);
 if(amendment)return quote;
 const result={...order,quoteId,order:{...order.order,state:'quoted',version:version+1,updatedAt:quote.createdAt}};
 await client.query('UPDATE orders.draft SET version=$3,snapshot=$4,quote_id=$5,updated_at=now() WHERE company_id=$1 AND id=$2',[principal.companyId,id,version+1,result,quoteId]);
 await client.query('INSERT INTO orders.draft_revision(company_id,order_id,version,snapshot,principal_id) VALUES($1,$2,$3,$4,$5)',[principal.companyId,id,version+1,result,principal.principalId]);
 return quote;
}
