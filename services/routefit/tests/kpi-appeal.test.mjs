import test from 'node:test';
import assert from 'node:assert/strict';
import {createKpiAppeal,decideKpiAppeal} from '../domain/kpi-appeal.mjs';

const result={id:'result-1',driverId:'driver-1',state:'published',version:2,rewardPenaltyCreatedBy:'operator-1'};

test('only the assessed driver can appeal a published KPI result',()=>{
 assert.throws(()=>createKpiAppeal(result,'driver-2','wrong score'),{code:'KPI_RESULT_NOT_OWNED'});
 assert.deepEqual(createKpiAppeal(result,'driver-1',' wrong score '),{
  resultId:'result-1',driverId:'driver-1',reason:'wrong score',state:'submitted',version:1,rewardPenaltyCreatedBy:'operator-1'
 });
});

test('an appeal cannot be created without the authoritative reward or penalty author',()=>{
 assert.throws(()=>createKpiAppeal({...result,rewardPenaltyCreatedBy:null},'driver-1','wrong score'),{code:'KPI_RESULT_INVALID'});
});

test('the original reward or penalty author cannot decide its appeal',()=>{
 const appeal={id:'appeal-1',state:'submitted',version:1,rewardPenaltyCreatedBy:'operator-1'};
 assert.throws(()=>decideKpiAppeal(appeal,'operator-1','uphold'),{code:'CONFLICT_OF_INTEREST'});
});

test('an independent decider resolves a submitted appeal once',()=>{
 const appeal={id:'appeal-1',state:'submitted',version:1,rewardPenaltyCreatedBy:'operator-1'};
 assert.deepEqual(decideKpiAppeal(appeal,'operator-2','overturn'),{
  ...appeal,state:'overturned',version:2,decidedBy:'operator-2'
 });
 assert.throws(()=>decideKpiAppeal({...appeal,state:'overturned'},'operator-2','uphold'),{code:'INVALID_APPEAL_STATE'});
});
