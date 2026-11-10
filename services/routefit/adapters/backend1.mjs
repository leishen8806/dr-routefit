import {randomUUID} from 'node:crypto';

export async function createCouponBatch({client,companyId},{discountType,amountMinor,currency,budgetMinor,minimumSpendMinor=0}){
 const kind=discountType==='fixed'?'AMOUNT_OFF':'THRESHOLD_OFF';
 const result=await client.query(`INSERT INTO marketing.coupon_batch
  (id,company_id,kind,currency,amount_minor,minimum_spend_minor,budget_minor,state,version)
  VALUES($1,$2,$3,$4,$5,$6,$7,'DRAFT',1)
  RETURNING id,version,budget_minor`,[randomUUID(),companyId,kind,currency,amountMinor,minimumSpendMinor,budgetMinor]);
 const row=result.rows[0];
 return {id:row.id,version:Number(row.version),budgetMinor:Number(row.budget_minor)};
}
