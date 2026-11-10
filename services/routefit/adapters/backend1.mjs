import {randomUUID} from 'node:crypto';
import {ApiError,ensure} from '../domain/errors.mjs';
import {activateMerchantContract as activateContract} from '../domain/merchant-contracts.mjs';

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

export async function activateMerchantContract({client,companyId,merchantId,version}){
 const current=await getMerchantContract({client,companyId,merchantId});
 ensure(current.version===version,412,'VERSION_CONFLICT','Merchant contract version has changed');
 const next=activateContract(current);
 const result=await client.query(`WITH updated AS (
  UPDATE party.merchant_contract
  SET state=$4,version=version+1,updated_at=clock_timestamp()
  WHERE company_id=$1 AND id=$2 AND merchant_id=$3 AND version=$5
  RETURNING id,state,version
 ), event AS (
  INSERT INTO party.merchant_contract_event(id,company_id,contract_id,version,state)
  SELECT $6,$1,id,version,state FROM updated
 )
 SELECT id,state,version FROM updated`,[companyId,current.id,merchantId,next.state,version,randomUUID()]);
 const row=result.rows[0];
 if(!row)throw new ApiError(412,'VERSION_CONFLICT','Merchant contract version has changed');
 return {id:row.id,state:row.state,version:Number(row.version)};
}
