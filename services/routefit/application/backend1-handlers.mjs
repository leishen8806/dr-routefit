import {ApiError} from '../domain/errors.mjs';
import {createCouponBatch,listCoupons} from '../adapters/backend1.mjs';

const definitions={
 createRouteQuote:{status:201},
 listRoutePricingConfigurations:{status:200},
 createRoutePricingConfiguration:{status:201},
 listCoupons:{status:200},
 createCouponBatch:{status:201},
 lockOrderCoupon:{status:200},
 redeemOrderCoupon:{status:200},
 releaseOrderCoupon:{status:200},
 getMerchantContract:{status:200},
 createMerchantContract:{status:201},
 activateMerchantContract:{status:200},
 expireMerchantContract:{status:200},
 listMerchantSkuDimensions:{status:200},
 createMerchantSkuDimension:{status:201},
 freezeUser:{status:200},
 unfreezeUser:{status:200}
};

export function createBackend1Handlers(repositories){
 return Object.fromEntries(Object.entries(definitions).map(([operation,{status}])=>[operation,async(context,body)=>{
  const repository=repositories[operation];
  if(typeof repository!=='function')throw new ApiError(501,'BACKEND1_HANDLER_UNAVAILABLE',`Backend1 handler ${operation} is unavailable`);
  return {status,body:await repository(context,body)};
 }]));
}

export const backend1Handlers=createBackend1Handlers({createCouponBatch,listCoupons});
