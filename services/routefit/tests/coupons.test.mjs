import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCouponRisk,lockCoupon,redeemCoupon,releaseCoupon} from '../domain/coupons.mjs';

const coupon={id:'coupon-1',amountMinor:300,minimumSpendMinor:1000,budgetRemainingMinor:1000,approved:true};
const order={id:'order-1',merchandiseMinor:1200,codMinor:400,insuranceMinor:100,paymentMethod:'PREPAID'};

test('coupon redemption locks an approved eligible coupon and preserves pre-discount commission',()=>{
 const locked=lockCoupon({coupon,order});
 assert.deepEqual(locked,{couponId:'coupon-1',orderId:'order-1',state:'LOCKED',discountMinor:300,driverCommissionBaseMinor:1700,fraudReviewRequired:true});
});

test('coupon redemption rejects reused, unapproved, underfunded and COD coupon uses',()=>{
 assert.throws(()=>lockCoupon({coupon,order,alreadyUsed:true}),{code:'COUPON_ALREADY_USED'});
 assert.throws(()=>lockCoupon({coupon:{...coupon,approved:false},order}),{code:'COUPON_NOT_APPROVED'});
 assert.throws(()=>lockCoupon({coupon:{...coupon,budgetRemainingMinor:299},order}),{code:'COUPON_BUDGET_EXCEEDED'});
 assert.throws(()=>lockCoupon({coupon,order:{...order,paymentMethod:'COD'}}),{code:'COD_NOT_ELIGIBLE'});
});

test('coupon state changes only after payment and can then be released',()=>{
 const locked=lockCoupon({coupon,order});
 assert.throws(()=>redeemCoupon({coupon,order,locked,paid:false}),{code:'PAYMENT_REQUIRED'});
 assert.equal(releaseCoupon(redeemCoupon({coupon,order,locked,paid:true})).state,'RELEASED');
});

test('three linked accounts pause coupon redemption without raw phone data',()=>{
 const risk=assessCouponRisk({deviceId:'device-hash',phoneHash:'phone-hash',accountIds:['account-1','account-2','account-3']});
 assert.deepEqual(risk,{state:'PAUSED',reason:'MULTI_ACCOUNT_DEVICE_OR_PHONE',accountCount:3});
 assert.throws(()=>lockCoupon({coupon,order,risk}),{code:'COUPON_REDEMPTION_PAUSED'});
});
