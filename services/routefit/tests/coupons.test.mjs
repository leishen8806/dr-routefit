import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCouponRisk,lockCoupon,redeemCoupon,releaseCoupon} from '../domain/coupons.mjs';

const coupon={id:'coupon-1',amountMinor:300,minimumSpendMinor:1000,budgetRemainingMinor:1000,approved:true};
const order={id:'order-1',merchandiseMinor:1200,shippingMinor:200,codMinor:400,insuranceMinor:100,paymentMethod:'PREPAID'};

test('coupon rule 1: a coupon can be used only once',()=>{
 assert.throws(()=>lockCoupon({coupon,order,alreadyUsed:true}),{code:'COUPON_ALREADY_USED'});
});

test('coupon rule 2: checkout locks a coupon before it is redeemed',()=>{
 assert.equal(lockCoupon({coupon,order}).state,'LOCKED');
});

test('coupon rule 3: a locked coupon redeems only after payment',()=>{
 const locked=lockCoupon({coupon,order});
 assert.throws(()=>redeemCoupon({coupon,order,locked,paid:false}),{code:'PAYMENT_REQUIRED'});
 const redeemed=redeemCoupon({coupon,order,locked,paid:true});
 assert.equal(redeemed.state,'REDEEMED');
});

test('coupon rule 4: cancellation releases a locked or redeemed coupon',()=>{
 const locked=lockCoupon({coupon,order});
 const redeemed=redeemCoupon({coupon,order,locked,paid:true});
 assert.deepEqual(releaseCoupon(redeemed),{...redeemed,state:'RELEASED'});
});

test('coupon rule 5: discount applies only to shipping, excluding COD and insurance',()=>{
 const locked=lockCoupon({coupon,order});
 assert.equal(locked.discountMinor,200);
});

test('coupon rule 6: COD orders cannot use coupons',()=>{
 assert.throws(()=>lockCoupon({coupon,order:{...order,paymentMethod:'COD'}}),{code:'COD_NOT_ELIGIBLE'});
});

test('coupon rule 7: an order has one coupon and commission stays before discount',()=>{
 assert.throws(()=>lockCoupon({coupon,order,existingCouponId:'coupon-2'}),{code:'ORDER_ALREADY_HAS_COUPON'});
 const locked=lockCoupon({coupon,order});
 assert.equal(locked.driverCommissionBaseMinor,1700);
});

test('coupon rule 8: coupon lock records anti-fraud review and requires approved budget',()=>{
 const locked=lockCoupon({coupon,order});
 assert.equal(locked.fraudReviewRequired,true);
 assert.throws(()=>lockCoupon({coupon:{...coupon,approved:false},order}),{code:'COUPON_NOT_APPROVED'});
 assert.throws(()=>lockCoupon({coupon:{...coupon,budgetRemainingMinor:199},order}),{code:'COUPON_BUDGET_EXCEEDED'});
});

test('coupon rule 8: repeated device or phone accounts pause redemption without storing raw phone data',()=>{
 const risk=assessCouponRisk({deviceId:'device-hash',phoneHash:'phone-hash',accountIds:['account-1','account-2','account-3']});
 assert.deepEqual(risk,{state:'PAUSED',reason:'MULTI_ACCOUNT_DEVICE_OR_PHONE',accountCount:3});
 assert.throws(()=>lockCoupon({coupon,order,risk}),{code:'COUPON_REDEMPTION_PAUSED'});
 assert.deepEqual(assessCouponRisk({deviceId:'device-hash',phoneHash:'phone-hash',accountIds:['account-1','account-2']}),{state:'CLEAR',reason:null,accountCount:2});
});

test('coupon lock rejects a batch before it starts or after it expires',()=>{
 assert.throws(()=>lockCoupon({coupon:{...coupon,startsAt:'2026-11-12T00:00:00Z',endsAt:'2026-11-13T00:00:00Z'},order,now:'2026-11-11T00:00:00Z'}),{code:'COUPON_NOT_ACTIVE'});
 assert.throws(()=>lockCoupon({coupon:{...coupon,startsAt:'2026-11-09T00:00:00Z',endsAt:'2026-11-10T00:00:00Z'},order,now:'2026-11-11T00:00:00Z'}),{code:'COUPON_EXPIRED'});
});
