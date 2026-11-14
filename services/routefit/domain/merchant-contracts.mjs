import {ensure} from './errors.mjs';

const nonEmpty=(value,code)=>ensure(typeof value==='string'&&value.trim(),422,code,'Merchant contract field is required');
const nonNegativeInteger=(value,code)=>ensure(Number.isSafeInteger(value)&&value>=0,422,code,'Merchant contract value must be a non-negative integer');

export function createMerchantContract(input){
 const contract={...input};
 for(const field of ['merchantId','pricingPlan','codSettlementCycle','payoutAccountRef'])nonEmpty(contract[field],'INVALID_CONTRACT_INPUT');
 nonNegativeInteger(contract.codFeeBps,'INVALID_CONTRACT_INPUT');
 ensure(contract.codFeeBps<=10000,422,'INVALID_CONTRACT_INPUT','COD fee cannot exceed 100 percent');
 nonNegativeInteger(contract.monthlyCreditLimitMinor,'INVALID_CONTRACT_INPUT');
 return {...contract,state:'DRAFT'};
}

export function activateMerchantContract(contract){
 ensure(contract.state==='DRAFT',409,'INVALID_CONTRACT_TRANSITION','Only draft contracts can activate');
 return {...contract,state:'ACTIVE'};
}

export function expireMerchantContract(contract){
 ensure(contract.state==='ACTIVE',409,'INVALID_CONTRACT_TRANSITION','Only active contracts can expire');
 return {...contract,state:'EXPIRED'};
}

export function createCargoDimension(input){
 const cargo={...input};
 for(const field of ['merchantId','name'])nonEmpty(cargo[field],'INVALID_CARGO_INPUT');
 for(const field of ['lengthCm','widthCm','heightCm','weightGrams'])ensure(Number.isSafeInteger(cargo[field])&&cargo[field]>0,422,'INVALID_CARGO_INPUT','Cargo dimensions must be positive integers');
 const volumetricWeightKg=Math.ceil((cargo.lengthCm*cargo.widthCm*cargo.heightCm)/6000),chargeableWeightKg=Math.max(Math.ceil(cargo.weightGrams/1000),volumetricWeightKg);
 return {...cargo,volumetricWeightKg,chargeableWeightKg,exclusiveVehicleRequired:cargo.lengthCm>300};
}
