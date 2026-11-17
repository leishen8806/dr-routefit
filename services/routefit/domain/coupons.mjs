import {ensure} from './errors.mjs';

const validMoney=value=>Number.isSafeInteger(value)&&value>=0;

export function assessCouponRisk({deviceId,phoneHash,accountIds}){
 ensure(typeof deviceId==='string'&&deviceId.length>0,422,'INVALID_RISK_SIGNAL','A device identifier is required');
 ensure(typeof phoneHash==='string'&&phoneHash.length>0,422,'INVALID_RISK_SIGNAL','A phone hash is required');
 ensure(Array.isArray(accountIds),422,'INVALID_RISK_SIGNAL','Account identifiers are required');
 const accountCount=new Set(accountIds).size;
 return accountCount>=3
  ? {state:'PAUSED',reason:'MULTI_ACCOUNT_DEVICE_OR_PHONE',accountCount}
  : {state:'CLEAR',reason:null,accountCount};
}

export function lockCoupon({coupon,order,existingCouponId=null,alreadyUsed=false,risk={state:'CLEAR'}}){
 ensure(!existingCouponId,409,'ORDER_ALREADY_HAS_COUPON','Each order may use one coupon');
 ensure(!alreadyUsed,409,'COUPON_ALREADY_USED','A coupon may only be used once');
 ensure(risk.state!=='PAUSED',409,'COUPON_REDEMPTION_PAUSED','Coupon redemption is paused for risk review');
 ensure(coupon.approved===true,409,'COUPON_NOT_APPROVED','Coupon budget requires approval');
 ensure(order.paymentMethod!=='COD',422,'COD_NOT_ELIGIBLE','Cash-on-delivery orders cannot use coupons');
 ensure(validMoney(order.merchandiseMinor)&&validMoney(coupon.amountMinor)&&validMoney(coupon.minimumSpendMinor)&&validMoney(coupon.budgetRemainingMinor),422,'INVALID_COUPON_INPUT','Coupon values must be non-negative integers');
 ensure(order.merchandiseMinor>=coupon.minimumSpendMinor,422,'COUPON_MINIMUM_NOT_MET','Order does not meet the coupon minimum');
 const discountMinor=Math.min(coupon.amountMinor,order.merchandiseMinor);
 ensure(coupon.budgetRemainingMinor>=discountMinor,409,'COUPON_BUDGET_EXCEEDED','Coupon budget is insufficient');
 return {couponId:coupon.id,orderId:order.id,state:'LOCKED',discountMinor,driverCommissionBaseMinor:order.merchandiseMinor+order.codMinor+order.insuranceMinor,fraudReviewRequired:true};
}

export function redeemCoupon({coupon,order,locked,paid}){
 ensure(locked.state==='LOCKED'&&locked.couponId===coupon.id&&locked.orderId===order.id,409,'COUPON_NOT_LOCKED','Coupon must be locked for this order');
 ensure(paid===true,409,'PAYMENT_REQUIRED','Coupon is redeemed only after payment');
 return {...locked,state:'REDEEMED'};
}

export function releaseCoupon(redemption){
 ensure(redemption.state==='REDEEMED'||redemption.state==='LOCKED',409,'COUPON_NOT_RELEASABLE','Only locked or redeemed coupons can be released');
 return {...redemption,state:'RELEASED'};
}
