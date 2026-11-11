import {randomUUID} from 'node:crypto';
import {ApiError,ensure} from '../domain/errors.mjs';
import {activateMerchantContract as activateContract,expireMerchantContract as expireContract} from '../domain/merchant-contracts.mjs';
import {lockCoupon as lockCouponDomain} from '../domain/coupons.mjs';
import {freezeUser as freezeUserDomain,unfreezeUser as unfreezeUserDomain} from '../domain/user-freeze.mjs';

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

async function transitionMerchantContract({client,companyId,merchantId,version},transition){
 const current=await getMerchantContract({client,companyId,merchantId});
 ensure(current.version===version,412,'VERSION_CONFLICT','Merchant contract version has changed');
 const next=transition(current);
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

export const activateMerchantContract=context=>transitionMerchantContract(context,activateContract);
export const expireMerchantContract=context=>transitionMerchantContract(context,expireContract);

async function getUserFreezeState({client,companyId,userId}){
 const result=await client.query(`SELECT action,reason,version
  FROM party.account_freeze
  WHERE company_id=$1 AND principal_id=$2
  ORDER BY version DESC
  LIMIT 1`,[companyId,userId]);
 const row=result.rows[0];
 if(!row)return {state:'ACTIVE',version:0};
 return row.action==='FREEZE'
  ?{state:'FROZEN',freezeReason:row.reason,version:Number(row.version)}
  :{state:'ACTIVE',version:Number(row.version)};
}

export async function freezeUser({client,companyId,userId,version},{reason}){
 const current=await getUserFreezeState({client,companyId,userId});
 ensure(current.version===version,412,'VERSION_CONFLICT','User freeze version has changed');
 const next=freezeUserDomain(current,{reason});
 const nextVersion=current.version+1;
 const result=await client.query(`INSERT INTO party.account_freeze
  (id,company_id,principal_id,action,reason,version)
  VALUES($1,$2,$3,'FREEZE',$4,$5)
  RETURNING principal_id,action,version`,[randomUUID(),companyId,userId,next.freezeReason,nextVersion]);
 const row=result.rows[0];
 return {userId:row.principal_id,state:'FROZEN',version:Number(row.version)};
}

export async function unfreezeUser({client,companyId,userId,version}){
 const current=await getUserFreezeState({client,companyId,userId});
 ensure(current.version===version,412,'VERSION_CONFLICT','User freeze version has changed');
 const next=unfreezeUserDomain(current);
 const nextVersion=current.version+1;
 const result=await client.query(`INSERT INTO party.account_freeze
  (id,company_id,principal_id,action,reason,version)
  VALUES($1,$2,$3,'UNFREEZE',$4,$5)
  RETURNING principal_id,action,version`,[randomUUID(),companyId,userId,current.freezeReason,nextVersion]);
 const row=result.rows[0];
 return {userId:row.principal_id,state:next.state,version:Number(row.version)};
}

export async function lockOrderCoupon({client,companyId,orderId},{couponId}){
 const couponRow=(await client.query(`SELECT c.id,c.state,b.state AS batch_state,b.amount_minor,b.minimum_spend_minor,
  b.budget_minor-COALESCE((SELECT sum(r.discount_minor) FROM marketing.coupon_redemption r
   WHERE r.company_id=b.company_id AND r.state<>'RELEASED'),0) AS budget_remaining_minor
  FROM marketing.coupon c
  JOIN marketing.coupon_batch b ON (b.company_id,b.id)=(c.company_id,c.batch_id)
  WHERE c.company_id=$1 AND c.id=$2`,[companyId,couponId])).rows[0];
 if(!couponRow)throw new ApiError(404,'NOT_FOUND','Coupon was not found');
 const orderRow=(await client.query(`SELECT snapshot,cod_amount_minor,payment_method
  FROM orders.draft WHERE company_id=$1 AND id=$2`,[companyId,orderId])).rows[0];
 if(!orderRow)throw new ApiError(404,'NOT_FOUND','Order was not found');
 const existing=(await client.query(`SELECT coupon_id FROM marketing.coupon_redemption
  WHERE company_id=$1 AND order_id=$2`,[companyId,orderId])).rows[0];
 const risk=(await client.query(`SELECT 1 FROM marketing.risk_flag
  WHERE company_id=$1 AND state='OPEN' AND (coupon_id=$2 OR order_id=$3)
  LIMIT 1`,[companyId,couponId,orderId])).rows[0];
 const storedOrder=orderRow.snapshot.order;
 const locked=lockCouponDomain({
  coupon:{id:couponRow.id,approved:couponRow.batch_state==='APPROVED',amountMinor:Number(couponRow.amount_minor),minimumSpendMinor:Number(couponRow.minimum_spend_minor),budgetRemainingMinor:Number(couponRow.budget_remaining_minor)},
  order:{id:orderId,merchandiseMinor:Number(storedOrder.merchandiseMinor),shippingMinor:Number(storedOrder.shippingMinor),codMinor:Number(orderRow.cod_amount_minor??0),insuranceMinor:Number(storedOrder.insuranceMinor??0),paymentMethod:orderRow.payment_method},
  existingCouponId:existing?.coupon_id??null,
  alreadyUsed:couponRow.state==='REDEEMED',
  risk:{state:risk?'PAUSED':'CLEAR'}
 });
 const result=await client.query(`WITH locked_coupon AS (
  UPDATE marketing.coupon SET state='LOCKED'
  WHERE company_id=$1 AND id=$2 AND state='ISSUED'
  RETURNING id
 ), redemption AS (
  INSERT INTO marketing.coupon_redemption(id,company_id,coupon_id,order_id,state,discount_minor)
  SELECT $3,$1,id,$4,'LOCKED',$5 FROM locked_coupon
  RETURNING coupon_id,order_id,state,discount_minor
 ) SELECT coupon_id,order_id,state,discount_minor FROM redemption`,[companyId,couponId,randomUUID(),orderId,locked.discountMinor]);
 const row=result.rows[0];
 if(!row)throw new ApiError(409,'COUPON_ALREADY_USED','Coupon is no longer available');
 return {...locked,couponId:row.coupon_id,orderId:row.order_id,state:row.state,discountMinor:Number(row.discount_minor)};
}
