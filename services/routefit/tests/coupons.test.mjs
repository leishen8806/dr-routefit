import test from 'node:test';
import assert from 'node:assert/strict';
import {lockCoupon,redeemCoupon,releaseCoupon} from '../domain/coupons.mjs';

const coupon={id:'coupon-1',amountMinor:300,minimumSpendMinor:1000,budgetRemainingMinor:1000,approved:true};
const order={id:'order-1',merchandiseMinor:1200,codMinor:400,insuranceMinor:100,paymentMethod:'PREPAID'};

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

test('coupon rule 5: discount excludes COD and insurance',()=>{
 const locked=lockCoupon({coupon,order});
 assert.equal(locked.discountMinor,300);
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
 assert.throws(()=>lockCoupon({coupon:{...coupon,budgetRemainingMinor:299},order}),{code:'COUPON_BUDGET_EXCEEDED'});
});
