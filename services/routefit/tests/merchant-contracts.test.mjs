import test from 'node:test';
import assert from 'node:assert/strict';
import {activateMerchantContract,createCargoDimension,createMerchantContract,expireMerchantContract} from '../domain/merchant-contracts.mjs';

const draft={merchantId:'merchant-1',pricingPlan:'CONTRACT_B',codSettlementCycle:'WEEKLY',codFeeBps:100,monthlyCreditLimitMinor:0,payoutAccountRef:'account-1'};

test('merchant contract begins as a draft and activates with the minimum demo fields',()=>{
 const contract=createMerchantContract(draft);
 assert.equal(contract.state,'DRAFT');
 assert.equal(activateMerchantContract(contract).state,'ACTIVE');
});

test('merchant contract expires only after activation',()=>{
 const active=activateMerchantContract(createMerchantContract(draft));
 assert.equal(expireMerchantContract(active).state,'EXPIRED');
 assert.throws(()=>expireMerchantContract(createMerchantContract(draft)),{code:'INVALID_CONTRACT_TRANSITION'});
});

test('cargo dimensions preserve physical and volumetric weights and flag exclusive-vehicle risk',()=>{
 const cargo=createCargoDimension({merchantId:'merchant-1',name:'Example pipe bundle',lengthCm:400,widthCm:20,heightCm:20,weightGrams:18000});
 assert.deepEqual(cargo,{merchantId:'merchant-1',name:'Example pipe bundle',lengthCm:400,widthCm:20,heightCm:20,weightGrams:18000,volumetricWeightKg:27,chargeableWeightKg:27,exclusiveVehicleRequired:true});
});
