import {randomUUID} from 'node:crypto';
import {ApiError} from '../domain/errors.mjs';

export async function createCouponBatch({client,companyId,idempotencyKey},{discountType,amountMinor,currency,budgetMinor,minimumSpendMinor=0}){
 const kind=discountType==='fixed'?'AMOUNT_OFF':'THRESHOLD_OFF';
 const result=await client.query(`INSERT INTO marketing.coupon_batch
  (id,company_id,kind,currency,amount_minor,minimum_spend_minor,budget_minor,idempotency_key,state,version)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,'DRAFT',1)
  RETURNING id,version,budget_minor`,[randomUUID(),companyId,kind,currency,amountMinor,minimumSpendMinor,budgetMinor,idempotencyKey]);
 const row=result.rows[0];
 return {id:row.id,version:Number(row.version),budgetMinor:Number(row.budget_minor)};
}

export async function listCoupons({client,companyId}){
 const result=await client.query(`SELECT id,state
  FROM marketing.coupon
  WHERE company_id=$1 AND state <> 'VOID'
  ORDER BY id`,[companyId]);
 return {items:result.rows.map(row=>({id:row.id,state:row.state==='ISSUED'?'AVAILABLE':row.state}))};
}

export async function listMerchantSkuDimensions({client,companyId,merchantId}){
 const result=await client.query(`SELECT id,length_cm,width_cm,height_cm,weight_grams
  FROM party.sku_dimension
  WHERE company_id=$1 AND merchant_id=$2
  ORDER BY id`,[companyId,merchantId]);
 return {items:result.rows.map(row=>{
  const volumetricWeightGrams=Math.ceil((Number(row.length_cm)*Number(row.width_cm)*Number(row.height_cm))/6000)*1000;
  return {id:row.id,chargeableWeightGrams:Math.max(Number(row.weight_grams),volumetricWeightGrams),exclusiveVehicleOnly:Number(row.length_cm)>300};
 })};
}

export async function getMerchantContract({client,companyId,merchantId}){
 const result=await client.query(`SELECT id,state,version
  FROM party.merchant_contract
  WHERE company_id=$1 AND merchant_id=$2
  ORDER BY created_at DESC
  LIMIT 1`,[companyId,merchantId]);
 const row=result.rows[0];
 if(!row)throw new ApiError(404,'MERCHANT_CONTRACT_NOT_FOUND','Merchant contract was not found');
 return {id:row.id,state:row.state,version:Number(row.version)};
}
