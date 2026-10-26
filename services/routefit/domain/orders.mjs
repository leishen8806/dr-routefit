import {randomUUID} from 'node:crypto';
import {ensure} from './errors.mjs';

export function validateOrderDraft(draft){
 ensure(draft.paymentTerms==='PREPAID'&&!draft.creditAgreementId,422,'CAPABILITY_DISABLED','当前切片仅录入预付草稿，月结授信尚未接通');
 ensure(draft.serviceLevel!=='S4',422,'CAPABILITY_DISABLED','经济拼单当前关闭');
 ensure(!draft.cod&&!draft.merchantBeneficiaryId,422,'CAPABILITY_DISABLED','COD受益方与代收账尚未接通，不能忽略提交的代收要求');
 for(const location of [draft.pickup,draft.delivery])ensure(location.address.trim()&&location.contactName.trim(),422,'EMPTY_LOCATION','地址与联系人不能为空');
 for(const window of [draft.requestedPickupWindow,draft.requestedDeliveryWindow])ensure(Date.parse(window.start)<Date.parse(window.end),422,'INVALID_TIME_WINDOW','时间窗开始必须早于结束');
 ensure(Date.parse(draft.requestedPickupWindow.start)<Date.parse(draft.requestedDeliveryWindow.end),422,'INVALID_TIME_WINDOW','送货窗口不能完全早于取货窗口');
 const keys=new Set();let quantity=0;
 for(const item of draft.items){
  ensure(item.name.trim()&&!keys.has(item.clientItemId),422,'INVALID_CARGO','货品名称不能为空，clientItemId不能重复');keys.add(item.clientItemId);
  ensure(!item.skuId&&item.measurementEvidenceIds.length===0,422,'CAPABILITY_DISABLED','商品与凭证服务尚未接通，不能接受未经核验的引用');
  ensure(!['lengthCm','widthCm','heightCm','weightKg'].some(k=>item[k]===null)||item.unknownReason?.trim(),422,'MEASUREMENT_REASON_REQUIRED','尺寸或重量未知时须填写原因');
  quantity+=item.quantity;
 }
 ensure(quantity<=1000,422,'PACKAGE_LIMIT','本地订单切片每单最多1000件');
}

export function orderDetail(draft,previous){
 const id=previous?.order.id??randomUUID();
 const prior=new Map((previous?.items??[]).map(item=>[item.clientItemId,item]));
 return {order:{id,orderNo:previous?.order.orderNo??'RF-'+id,version:(previous?.order.version??0)+1,state:'draft',serviceLevel:draft.serviceLevel,fulfillmentStage:'none',customerId:draft.customerId,promiseId:null,collectionState:'unpaid',updatedAt:new Date().toISOString()},
  draft,pickup:draft.pickup,delivery:draft.delivery,
  items:draft.items.map(item=>{const old=prior.get(item.clientItemId);return {...item,id:old?.id??randomUUID(),packageIds:Array.from({length:item.quantity},(_,i)=>old?.packageIds[i]??randomUUID())};}),
  activeExecutionId:null,quoteId:null,blockingExceptionIds:[]};
}
