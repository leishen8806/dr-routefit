export const selectableServiceLevels=Object.freeze({S2:'当日送',S3:'预约送'});
export function intakeFieldForPath(path){const item=path?.match(/^\/items\/(\d+)/);if(path==='/evidence')return 'intake.pickup.reference';if(path==='/pickup/point')return 'pickup.lng';if(path==='/delivery/point')return 'delivery.lng';if(path==='/requestedDeliveryWindow')return 'requestedDeliveryWindow.end';return item?`items.${item[1]}.unknownReason`:null;}
export function retainedPoint(prior,address,landmark,point){return prior&&(address!==prior.address||landmark!==(prior.landmark||''))?null:point;}
export function requiredReason(value){return String(value??'').trim().length>0;}
export function confirmationRequest(values){return {customerContact:String(values.customerContact??'').trim(),method:String(values.method??''),reference:String(values.reference??'').trim(),confirmedAt:values.confirmedAt||''};}
export function policyAvailability(policy,now=Date.now()){
 const state=policy?.state||'';
 if(!state)return {ok:false,code:'POLICY_STATE_UNKNOWN',message:'策略状态未知，不能生成报价。'};
 if(state!=='PUBLISHED')return {ok:false,code:'POLICY_NOT_PUBLISHED',message:`策略当前为 ${state}，只有 PUBLISHED 策略可生成报价。`};
 const from=Date.parse(policy.validFrom||''),until=Date.parse(policy.validUntil||'');
 if(!Number.isFinite(from)||!Number.isFinite(until))return {ok:false,code:'POLICY_WINDOW_INVALID',message:'策略有效期无效，不能生成报价。'};
 if(now<from)return {ok:false,code:'POLICY_NOT_EFFECTIVE',message:'策略尚未到生效时间。'};
 if(now>=until)return {ok:false,code:'POLICY_EXPIRED',message:'策略已过期，不能生成报价。'};
 return {ok:true,code:'OK',message:'策略已发布且在有效期内。'};
}
