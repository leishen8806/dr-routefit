import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePolicy,assertIndependent} from '../domain/policy.mjs';
import {policyRoutes} from '../application/policy.mjs';
import {specification} from '../adapters/contract.mjs';
const base={code:'base',enabled:true,method:'fixed',amount:200,unit:null,includedMilli:0,stepMilli:1000,share:true,scope:'DEMO',evidence:'DEMO agreed fee'};
const tariff={owner:'DR',rules:[base]},input={validFrom:'2026-10-25T00:00:00Z',validUntil:'2026-10-26T00:00:00Z',reason:'DEMO scope'};
test('policy routes require the documented distinct permissions and version owners',()=>{
 for(const r of policyRoutes){const op=Object.values(specification.paths).flatMap(Object.values).find(o=>o.operationId===r.operation);assert.deepEqual(op['x-permissions'],[r.permission]);assert.equal(op['x-implementation-status'],'LOCAL_IMPLEMENTED_NOT_DEPLOYED');}
});
test('publication excludes unsupported bases, blank evidence and expired periods',()=>{
 validatePolicy(tariff,input,Date.parse(input.validFrom));
 for(const value of [{...tariff,owner:'VET'},{...tariff,rules:[{...base,method:'unit',unit:'kg'}]},{...tariff,rules:[]},{...tariff,rules:[base,{...base,code:'insurance',share:true}]}])assert.throws(()=>validatePolicy(value,input,Date.parse(input.validFrom)));
 assert.throws(()=>validatePolicy(tariff,input,Date.parse(input.validUntil)),{code:'INVALID_POLICY_WINDOW'});
 assert.throws(()=>validatePolicy(tariff,{...input,reason:' '},Date.parse(input.validFrom)),{code:'REASON_REQUIRED'});
});
test('all contributors and the reviewer are excluded from approval',()=>{
 for(const actor of ['creator','prior-editor','reviewer'])assert.throws(()=>assertIndependent(['creator','prior-editor'],actor,'reviewer'),{code:'INDEPENDENT_REVIEW_REQUIRED'});
 assertIndependent(['creator','prior-editor'],'approver','reviewer');
});
