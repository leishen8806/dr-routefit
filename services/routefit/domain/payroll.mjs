import {ensure} from './errors.mjs';

export function calculatePayrollLine(amounts,scheme){
 const values=['baseMinor','commissionMinor','rewardMinor','deductionMinor'];
 for(const key of values)ensure(Number.isSafeInteger(amounts[key])&&amounts[key]>=0,422,'INVALID_PAYROLL_AMOUNT','工资金额必须是非负整数');
 const earnedMinor=amounts.baseMinor+amounts.commissionMinor+amounts.rewardMinor;
 const deductionsEnabled=scheme.deductionsEnabled===true;
 const deductionMinor=deductionsEnabled?amounts.deductionMinor:0;
 ensure(deductionMinor<=earnedMinor,422,'PAYROLL_DEDUCTION_EXCEEDS_EARNINGS','扣款不能超过应得工资');
 return {...amounts,deductionMinor,netMinor:earnedMinor-deductionMinor,currency:scheme.currency,deductionsEnabled};
}
