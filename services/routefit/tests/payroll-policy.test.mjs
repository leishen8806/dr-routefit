import test from 'node:test';
import assert from 'node:assert/strict';
import {calculatePayrollLine} from '../domain/payroll.mjs';

test('payroll keeps deductions disabled by default for a configured scheme',()=>{
 const result=calculatePayrollLine({baseMinor:10000,commissionMinor:2500,rewardMinor:500,deductionMinor:1200},{currency:'USD'});
 assert.deepEqual(result,{baseMinor:10000,commissionMinor:2500,rewardMinor:500,deductionMinor:0,netMinor:13000,currency:'USD',deductionsEnabled:false});
});

test('payroll only applies a deduction when the approved scheme explicitly enables it',()=>{
 const result=calculatePayrollLine({baseMinor:10000,commissionMinor:2500,rewardMinor:500,deductionMinor:1200},{currency:'USD',deductionsEnabled:true,state:'approved',approvedByPrincipalId:'principal-2'});
 assert.equal(result.deductionMinor,1200);
 assert.equal(result.netMinor,11800);
});

test('payroll rejects a deduction larger than the earned amount',()=>{
 assert.throws(()=>calculatePayrollLine({baseMinor:100,commissionMinor:0,rewardMinor:0,deductionMinor:101},{currency:'USD',deductionsEnabled:true,state:'approved',approvedByPrincipalId:'principal-2'}),{code:'PAYROLL_DEDUCTION_EXCEEDS_EARNINGS'});
});

test('payroll refuses deductions without an approved scheme reference',()=>{
 assert.throws(()=>calculatePayrollLine({baseMinor:100,commissionMinor:0,rewardMinor:0,deductionMinor:1},{currency:'USD',deductionsEnabled:true}),{code:'PAYROLL_DEDUCTION_APPROVAL_REQUIRED'});
});
