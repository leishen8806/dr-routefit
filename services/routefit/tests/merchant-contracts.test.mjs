import test from 'node:test';
import assert from 'node:assert/strict';
import {activateMerchantContract,createCargoDimension,createMerchantContract,expireMerchantContract} from '../domain/merchant-contracts.mjs';

const draft={merchantId:'merchant-1',pricingPlan:'CONTRACT_B',codSettlementCycle:'WEEKLY',codFeeBps:100,monthlyCreditLimitMinor:0,payoutAccountRef:'account-1'};

test('merchant contract progresses draft to active to expired with required demo fields',()=>{
 const active=activateMerchantContract(createMerchantContract(draft));
 assert.equal(expireMerchantContract(active).state,'EXPIRED');
});

test('merchant contract rejects an invalid lifecycle transition and fee',()=>{
 assert.throws(()=>expireMerchantContract(createMerchantContract(draft)),{code:'INVALID_CONTRACT_TRANSITION'});
 assert.throws(()=>createMerchantContract({...draft,codFeeBps:10001}),{code:'INVALID_CONTRACT_INPUT'});
});

test('cargo dimensions derive chargeable weight and exclusive-vehicle risk',()=>{
 const cargo=createCargoDimension({merchantId:'merchant-1',name:'Example pipe bundle',lengthCm:400,widthCm:20,heightCm:20,weightGrams:18000});
 assert.deepEqual(cargo,{merchantId:'merchant-1',name:'Example pipe bundle',lengthCm:400,widthCm:20,heightCm:20,weightGrams:18000,volumetricWeightKg:27,chargeableWeightKg:27,exclusiveVehicleRequired:true});
});
