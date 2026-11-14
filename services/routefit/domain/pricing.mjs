import catalog from '../../../contracts/pricing-catalog.json' with {type:'json'};
import {ensure} from './errors.mjs';
export {catalog};
const maximum=9000000000000n;
const bounded=n=>{ensure(n>=0n&&n<=maximum,422,'AMOUNT_OUT_OF_RANGE','费用超出允许范围');return Number(n);};
const positiveInteger=(value,code)=>{ensure(Number.isSafeInteger(value)&&value>0,422,code,'Route pricing configuration and dimensions must be positive integers');return value;};

export function calculateRouteQuote({shipment,currency,configuration,now=Date.now()}){
 const {weightGrams,lengthCm,widthCm,heightCm,exclusiveVehicle}=shipment;
 const {baseMinor,perKgMinor,longItemFeeMinor,volumetricDivisor,khrRoundingMinor}=configuration;
 for(const value of [weightGrams,lengthCm,widthCm,heightCm,baseMinor,perKgMinor,volumetricDivisor,khrRoundingMinor])positiveInteger(value,'INVALID_ROUTE_PRICING_INPUT');
 ensure(Number.isSafeInteger(longItemFeeMinor)&&longItemFeeMinor>=0,422,'INVALID_ROUTE_PRICING_INPUT','Long-item fee must be a non-negative integer');
 ensure(typeof exclusiveVehicle==='boolean',422,'INVALID_ROUTE_PRICING_INPUT','Exclusive vehicle flag must be boolean');
 ensure(lengthCm<=300||exclusiveVehicle,422,'EXCLUSIVE_VEHICLE_REQUIRED','Items longer than 3 metres require an exclusive vehicle');
 const actualWeightKg=Math.ceil(weightGrams/1000),volumetricWeightKg=Math.ceil((lengthCm*widthCm*heightCm)/volumetricDivisor),chargeableWeightKg=Math.max(actualWeightKg,volumetricWeightKg),surchargeMinor=lengthCm>200?longItemFeeMinor:0;
 const vehicle=configuration.vehicleTariff;
 const distanceKm=configuration.distanceKm;
 let subtotal=BigInt(baseMinor)+BigInt(perKgMinor)*BigInt(chargeableWeightKg)+BigInt(surchargeMinor);
 let sourceCurrency=currency;
 if(vehicle){
  ensure(typeof vehicle.vehicleType==='string'&&vehicle.vehicleType.trim(),422,'INVALID_ROUTE_PRICING_INPUT','Vehicle type is required');
  for(const value of [vehicle.baseMinor,vehicle.includedKm,vehicle.extraKmMinor,distanceKm])ensure(Number.isSafeInteger(value)&&value>=0,422,'INVALID_ROUTE_PRICING_INPUT','Vehicle pricing values must be non-negative integers');
  ensure(['USD','KHR'].includes(vehicle.currency),422,'INVALID_ROUTE_PRICING_INPUT','Vehicle tariff currency is invalid');
  sourceCurrency=vehicle.currency;
  subtotal+=BigInt(vehicle.baseMinor)+BigInt(Math.max(0,distanceKm-vehicle.includedKm))*BigInt(vehicle.extraKmMinor);
  for(const service of configuration.valueAddedServices??[]){
   ensure(Number.isSafeInteger(service.amountMinor)&&service.amountMinor>=0&&service.currency===sourceCurrency,422,'INVALID_ROUTE_PRICING_INPUT','Value-added service amount or currency is invalid');
   subtotal+=BigInt(service.amountMinor);
  }
 }
 if(sourceCurrency!==currency){
  const fx=configuration.fxRate;
  ensure(fx?.sourceCurrency===sourceCurrency&&fx.targetCurrency===currency,422,'INVALID_ROUTE_PRICING_INPUT','Matching FX rate is required');
  for(const value of [fx.rateNumerator,fx.rateDenominator,fx.roundingMinor])positiveInteger(value,'INVALID_ROUTE_PRICING_INPUT');
  subtotal=(subtotal*BigInt(fx.rateNumerator)+BigInt(Math.floor(fx.rateDenominator/2)))/BigInt(fx.rateDenominator);
 }
 const rounding=configuration.fxRate?.targetCurrency===currency?configuration.fxRate.roundingMinor:khrRoundingMinor;
 const rounded=currency==='KHR'?((subtotal+BigInt(rounding/2))/BigInt(rounding))*BigInt(rounding):subtotal;
 const quote={chargeableWeightKg,surchargeMinor,totalMinor:bounded(rounded)};
 if(configuration.version!==undefined){
  positiveInteger(configuration.version,'INVALID_ROUTE_PRICING_INPUT');
  const observedAt=typeof now==='string'?Date.parse(now):now;
  ensure(Number.isSafeInteger(observedAt),422,'INVALID_ROUTE_PRICING_INPUT','Quote time is invalid');
  quote.configurationVersion=configuration.version;
  quote.expiresAt=new Date(observedAt+10*60*1000).toISOString();
 }
 return quote;
}

export function validateFee(rule,tariff){
 const item=catalog.find(x=>x.code===rule.code);
 ensure(item,422,'UNKNOWN_FEE','未知费用项目');
 ensure(rule.scope.trim()&&rule.evidence.trim(),422,'EVIDENCE_REQUIRED','适用范围及配置依据不能为空');
 ensure(!rule.share||(tariff.owner==='DR'&&!item.locked),422,'INVALID_SHARE_BASIS','保险、COD服务费、仓储及采购费用不能参与配送分成');
 if(rule.method==='unit'){
  ensure(item.units.includes(rule.unit)&&rule.stepMilli>0,422,'INVALID_FEE_UNIT','单位或计费步长无效');
 }else ensure(rule.unit===null&&rule.includedMilli===0&&rule.stepMilli===1000,422,'UNUSED_UNIT_FIELDS','固定和比例费用的单位须为空，包含量为0，步长为1000');
 if(rule.method==='percent')ensure(item.basis&&rule.amount<=10000,422,'INVALID_PERCENT_FEE','比例仅适用于保险及COD服务费，且不得超过100%');
 return structuredClone(rule);
}
export function calculate(tariff,inputs){
 ensure(new Set(inputs.map(x=>x.code)).size===inputs.length,422,'DUPLICATE_FEE','同一费目不可重复试算');
 const lines=inputs.map(input=>{
  const rule=tariff.rules.find(x=>x.code===input.code);
  ensure(rule?.enabled,422,'FEE_NOT_ENABLED','所选费用尚未配置或已停用');
  let amount,units=1;
  if(rule.method==='unit'){
   ensure(input.basisMinor===null&&Number.isSafeInteger(input.quantityMilli),422,'INVALID_FEE_INPUT','按单位费用须填写计费量，金额基数须为空');
   const delta=BigInt(input.quantityMilli)-BigInt(rule.includedMilli),extra=delta>0n?delta:0n;
   units=bounded((extra+BigInt(rule.stepMilli)-1n)/BigInt(rule.stepMilli));amount=BigInt(units)*BigInt(rule.amount);
  }else if(rule.method==='percent'){
   ensure(input.quantityMilli===null&&Number.isSafeInteger(input.basisMinor),422,'INVALID_FEE_INPUT','比例费用须填写货值或COD本金，单位数量须为空');
   amount=(BigInt(input.basisMinor)*BigInt(rule.amount)+5000n)/10000n;
  }else{
   ensure(input.quantityMilli===null&&input.basisMinor===null,422,'INVALID_FEE_INPUT','固定费用不接受数量或金额基数');amount=BigInt(rule.amount);
  }
  return {code:input.code,amountMinor:bounded(amount),units,input:structuredClone(input),rule:structuredClone(rule)};
 });
 const sum=fn=>bounded(lines.filter(fn).reduce((n,x)=>n+BigInt(x.amountMinor),0n));
 return {currency:tariff.currency,totalMinor:sum(()=>true),insuranceMinor:sum(x=>x.code==='insurance'),shareMinor:sum(x=>x.rule.share),separateMinor:sum(x=>!x.rule.share),lines};
}
