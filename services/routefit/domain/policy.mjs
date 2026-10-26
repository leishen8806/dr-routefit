import {ensure} from './errors.mjs';
import {validateFee} from './pricing.mjs';

export function validatePolicy(tariff,input,now=Date.now()){
 ensure(tariff.owner==='DR',422,'CAPABILITY_DISABLED','本地策略发布仅支持DR客户收费，采购价不得作为客户报价');
 const active=tariff.rules.filter(r=>r.enabled);
 ensure(active.some(r=>r.code==='base'),422,'BASE_FEE_REQUIRED','必须明确配置启用的基础费，即使金额为零');
 for(const rule of active){
  validateFee(rule,tariff);
  ensure(['base','flash','insurance'].includes(rule.code)&&rule.method==='fixed',422,'CAPABILITY_DISABLED','当前发布切片只支持固定基础费、独享费和保险费，其他计费依据尚未接通');
 }
 ensure(input.reason.trim(),422,'REASON_REQUIRED','提交依据不能为空');
 ensure(Date.parse(input.validFrom)<Date.parse(input.validUntil)&&Date.parse(input.validUntil)>now,422,'INVALID_POLICY_WINDOW','策略有效期必须有序且尚未结束');
}

export function assertIndependent(contributors,actor,reviewer=null){
 ensure(!contributors.includes(actor)&&actor!==reviewer,403,'INDEPENDENT_REVIEW_REQUIRED','费率经办、复核和批准须由不同主体完成，历史费率编制人不能复核或批准');
}
