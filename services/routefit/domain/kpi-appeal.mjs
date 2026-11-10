import {ensure} from './errors.mjs';

export function createKpiAppeal(result,driverId,reason){
 ensure(result.state==='published',409,'INVALID_KPI_RESULT_STATE','当前考核结果不能申诉');
 ensure(result.driverId===driverId,404,'KPI_RESULT_NOT_OWNED','考核结果不存在');
 ensure(typeof reason==='string'&&reason.trim(),422,'APPEAL_REASON_REQUIRED','申诉理由不能为空');
 return {resultId:result.id,driverId,reason:reason.trim(),state:'submitted',version:1};
}

export function decideKpiAppeal(appeal,deciderId,decision){
 ensure(appeal.state==='submitted',409,'INVALID_APPEAL_STATE','申诉当前不能裁定');
 ensure(appeal.rewardPenaltyCreatedBy!==deciderId,403,'CONFLICT_OF_INTEREST','原奖惩经办人不能裁定申诉');
 ensure(['uphold','overturn'].includes(decision),422,'INVALID_APPEAL_DECISION','申诉裁定无效');
 return {...appeal,state:decision==='overturn'?'overturned':'upheld',version:appeal.version+1,decidedBy:deciderId};
}
