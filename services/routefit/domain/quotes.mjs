import {ensure} from './errors.mjs';
import {calculate} from './pricing.mjs';
import {validatePolicy} from './policy.mjs';

export function quoteCalculation(order,policy,input,now=Date.now()){
 ensure(policy.state==='PUBLISHED',409,'POLICY_NOT_PUBLISHED','只能使用已独立复核批准的策略');
 ensure(Date.parse(policy.validFrom)<=now&&now<Date.parse(policy.validUntil),422,'POLICY_NOT_EFFECTIVE','策略尚未生效或已过期');
 ensure(policy.serviceLevels.includes(order.order.serviceLevel),422,'SERVICE_NOT_SUPPORTED','策略不适用于本单服务等级');
 ensure(input.distanceEvidenceId===undefined,422,'CAPABILITY_DISABLED','当前固定费报价不接受未经接通的距离依据');
 validatePolicy(policy.tariff,policy,now);
 const codes=['base',...(order.draft.exclusiveVehicle?['flash']:[]),...(input.insuranceRequested?['insurance']:[])];
 const calculation=calculate(policy.tariff,codes.map(code=>({code,quantityMilli:null,basisMinor:null})));
 const expiresAt=new Date(Math.min(now+policy.quoteValiditySeconds*1000,Date.parse(policy.validUntil),Date.parse(order.draft.requestedDeliveryWindow.end))).toISOString();
 ensure(Date.parse(expiresAt)>now,422,'QUOTE_WINDOW_EXPIRED','没有剩余有效报价窗口');
 return {calculation,expiresAt};
}

export function quoteStatus(quote,order,report,now=Date.now()){
 if(order.quoteId!==quote.id||order.order.version!==quote.orderVersion||order.order.state!=='quoted')return {state:'superseded',unusableReasons:['ORDER_CHANGED']};
 if(now>=Date.parse(quote.expiresAt))return {state:'expired',unusableReasons:['EXPIRED']};
 if(!report.ready)return {state:'superseded',unusableReasons:report.blockers.map(x=>x.code)};
 return {state:'issued',unusableReasons:[]};
}
