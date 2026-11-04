export const selectableServiceLevels=Object.freeze({S2:'当日送',S3:'预约送'});
export function serviceLevelOptions(value){const options=Object.entries(selectableServiceLevels).map(([id,label])=>({id,label,disabled:false}));if(value==='S1')options.unshift({id:'S1',label:'及时送（历史草稿，仅可改为 S2/S3）',disabled:true});return options;}
export function policyDisplayTime(value){const fmt=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Phnom_Penh',dateStyle:'short',timeStyle:'short'});return value?fmt.format(new Date(value)):'未知';}
export function policyOptionLabel(policy){const validFrom=policyDisplayTime(policy?.validFrom),validUntil=policyDisplayTime(policy?.validUntil);const name=String(policy?.tariffName||'未命名费率').trim();const reason=String(policy?.reason||'未提供提交依据').trim();return `${name} · ${reason} · ${validFrom}–${validUntil} · ${String(policy?.id||'').slice(0,8)}`;}
export function policyOverlapHint(items){const count=(items||[]).length;return count>1?`当前有 ${count} 条有效策略，请核对后选择`:(count===1?'当前只有 1 条有效策略':'');}
export function policyDisplayDetails(policy){if(!policy)return '';return `费率名称：${policy.tariffName||'未命名费率'}\n提交依据：${policy.reason||'未提供提交依据'}\n有效期（UTC+7）：${policyDisplayTime(policy.validFrom)} – ${policyDisplayTime(policy.validUntil)}\n发布时间（UTC+7）：${policyDisplayTime(policy.publishedAt)}\n策略 ID：${String(policy.id||'')}`;}
export function policyPrecheckFailure(error){return !!error&&![403,404].includes(error.status);}
export function policyReadFailure(error){if(error?.status===404)return {code:'POLICY_NOT_FOUND',message:'未找到该费率策略，不能生成报价。'};if(error?.status===401)return {code:'POLICY_READ_UNAUTHENTICATED',message:'策略读取会话已失效，不能生成报价。'};if(error?.status===429)return {code:'POLICY_READ_RATE_LIMITED',message:'请求过于频繁，请稍后重试。'};return {code:'POLICY_READ_FAILED',message:'策略读取失败，不能生成报价，请重试。'};}
export function policyListReadFailure(error){return policyPrecheckFailure(error)?null:{code:'POLICY_LIST_READ_FAILED',message:'策略列表读取失败，请改用手填策略 ID'};}
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
