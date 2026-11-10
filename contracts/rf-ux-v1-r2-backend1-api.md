# RF-UX-V1 R2 Backend1 API 清单

状态：模块草案，供 `contracts/rf-ux-v1-r2-api-index.md` 汇总；不修改总稿 `openapi.json`。所有金额均为整数最小货币单位；示例业务数值必须在后台配置并标注“示例”。

本清单覆盖：客户下单报价、运营端计价配置与商户资料、订单优惠券动作、后台用户冻结。权限名是接口索引所需的暂定标识，认证、授权判定、RLS、跨步骤支付/核销事务均不在本模块实现范围，须经安全复核后才可接线。

## 接口一览

| 路径 | 用途和页面 | 请求 / 返回 | 错误码 | 权限（待安全复核） | 幂等键 |
| --- | --- | --- | --- | --- | --- |
| `POST /api/customer/v1/route-quotes` | 客户下单报价页：体积重、车型/里程、增值服务、汇率与 KHR 取整；报价有效 10 分钟 | 请求：货件尺寸/重量、服务方式、车型、里程、服务项、币种；返回计费重、费用明细、总价、货币、`expiresAt`、配置版本 | `EXCLUSIVE_VEHICLE_REQUIRED`、`INVALID_ROUTE_PRICING_INPUT`、`AMOUNT_OUT_OF_RANGE` | `customer:quote:create` | 必需 |
| `GET /api/ops/v1/route-pricing/configurations` | 运营后台计价配置页：读取当前维度规则、车型价、增值服务、汇率 | 查询可选生效时间；返回版本化配置列表 | `NOT_FOUND` | `pricing:read` | 不适用 |
| `POST /api/ops/v1/route-pricing/configurations` | 运营后台计价配置页：新增示例/正式配置版本 | 请求：维度规则、车型价、服务费、汇率、生效时间；返回新版本 | `VERSION_REQUIRED`、`AMOUNT_OUT_OF_RANGE`、`VALIDATION_FAILED` | `pricing:write` | 必需 |
| `GET /api/ops/v1/coupons` | 运营后台优惠券页：查询批次、券、预算和锁定状态 | 查询批次/状态/游标；返回券及核销状态 | `NOT_FOUND` | `marketing:coupon:read` | 不适用 |
| `POST /api/ops/v1/coupons/batches` | 运营后台优惠券页：创建立减或满减券批次 | 请求：规则、金额、最低消费、预算及审批引用；返回批次和初始版本 | `COUPON_NOT_APPROVED`、`VALIDATION_FAILED` | `marketing:coupon:write` | 必需 |
| `POST /api/customer/v1/orders/{orderId}/actions/lock-coupon` | 客户下单页：一单锁定一券 | 请求：`couponId`；返回锁定记录、优惠额、司机计佣基数 | `ORDER_ALREADY_HAS_COUPON`、`COUPON_ALREADY_USED`、`COD_NOT_ELIGIBLE`、`COUPON_MINIMUM_NOT_MET`、`COUPON_BUDGET_EXCEEDED`、`COUPON_REDEMPTION_PAUSED` | `customer:order:write` | 必需 |
| `POST /api/customer/v1/orders/{orderId}/actions/redeem-coupon` | 订单付款确认后的内部动作；页面只读取结果 | 请求：锁定记录引用；返回核销记录 | `COUPON_NOT_LOCKED`、`PAYMENT_REQUIRED` | `order:payment:confirm` | 必需；支付确认事务由 BackendSenior/安全复核负责 |
| `POST /api/customer/v1/orders/{orderId}/actions/release-coupon` | 客户取消订单页：释放已锁定或已核销券 | 请求：核销记录引用；返回释放记录 | `COUPON_NOT_RELEASABLE` | `customer:order:write` | 必需 |
| `GET /api/ops/v1/merchants/{merchantId}/contract` | 运营后台商户合同页：读取合同和版本 | 返回价格档、代收结算周期/手续费、月结额度、开户审批引用、状态和版本 | `NOT_FOUND` | `merchant:contract:read` | 不适用 |
| `POST /api/ops/v1/merchants/{merchantId}/contract` | 运营后台商户合同页：创建草稿合同 | 请求：价格档、代收结算周期/手续费、月结额度、开户审批引用；返回 `DRAFT` 合同及版本 | `INVALID_CONTRACT_INPUT` | `merchant:contract:write` | 必需 |
| `POST /api/ops/v1/merchants/{merchantId}/contract/actions/activate` | 运营后台商户合同页：草稿生效 | 请求：`If-Match`；返回 `ACTIVE` 合同和追加事件 | `INVALID_CONTRACT_TRANSITION`、`VERSION_CONFLICT` | `merchant:contract:write` | 必需 |
| `POST /api/ops/v1/merchants/{merchantId}/contract/actions/expire` | 运营后台商户合同页：生效合同到期 | 请求：`If-Match`；返回 `EXPIRED` 合同和追加事件 | `INVALID_CONTRACT_TRANSITION`、`VERSION_CONFLICT` | `merchant:contract:write` | 必需 |
| `GET /api/ops/v1/merchants/{merchantId}/sku-dimensions` | 运营后台货品尺寸页：读取 SKU 尺寸和计费重 | 返回长宽高、实重、体积重、计费重、仅包车标记 | `NOT_FOUND` | `merchant:catalog:read` | 不适用 |
| `POST /api/ops/v1/merchants/{merchantId}/sku-dimensions` | 运营后台货品尺寸页：登记 SKU 尺寸 | 请求：名称、长宽高、实重；返回尺寸、体积重、计费重、仅包车标记 | `INVALID_CARGO_INPUT` | `merchant:catalog:write` | 必需 |
| `POST /api/ops/v1/users/{userId}/actions/freeze` | 运营后台用户详情页：人工冻结 | 请求：原因、`If-Match`；返回冻结状态和版本 | `FREEZE_REASON_REQUIRED`、`INVALID_FREEZE_TRANSITION`、`VERSION_CONFLICT` | `user:freeze:write` | 必需 |
| `POST /api/ops/v1/users/{userId}/actions/unfreeze` | 运营后台用户详情页：人工解冻 | 请求：`If-Match`；返回活动状态和版本 | `INVALID_FREEZE_TRANSITION`、`VERSION_CONFLICT` | `user:freeze:write` | 必需 |

## 一致性约束

- 所有可变配置与合同、冻结动作使用版本号；更新以 `If-Match` 传递，冲突不覆盖历史。
- 优惠券只抵运费，不抵代收或保价；到付订单不可用；一单仅一券；司机计佣基数取优惠前金额。
- `lock-coupon`、`redeem-coupon`、`release-coupon` 是动作接口。重复写请求以同一幂等键返回原结果；不同请求体复用同一键返回冲突。
- 冻结仅支持后台人工动作，自动冻结默认关闭；下单和付款入口均返回 `ACCOUNT_FROZEN`。账户授权与审计细节待安全复核。

## 对齐记录

本清单依据本卡的领域模块与迁移 `065`–`069`，而非 `contracts/` 总稿。BackendSenior 汇总时如路径、权限名或幂等口径与正式契约不一致，应在索引中记录差异原因；安全相关的权限/RLS/跨步骤事务不由 Backend1 自行实现。

## 供 BackendSenior 粘贴的 path 片段草案

以下是 JSON 格式的增量草案；仅供 `contracts/openapi.json` 的负责人审核、调整并粘贴。本草案不修改总稿，也不定义认证、授权、RLS 或付款核销事务。所有金额字段均使用整数最小货币单位（`int64`）；示例值均须标注为「示例」且后台可配置。

```json
{
  "paths": {
    "/api/customer/v1/route-quotes": {
      "post": {"operationId":"createRouteQuote","requestBody":{"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/RouteQuoteCreate"}}}},"responses":{"201":{"description":"报价","content":{"application/json":{"schema":{"$ref":"#/components/schemas/RouteQuote"}}}},"422":{"$ref":"#/components/responses/Error422"}}}
    },
    "/api/ops/v1/route-pricing/configurations": {
      "get": {"operationId":"listRoutePricingConfigurations","responses":{"200":{"description":"配置页","content":{"application/json":{"schema":{"$ref":"#/components/schemas/RoutePricingConfigurationPage"}}}}}},
      "post": {"operationId":"createRoutePricingConfiguration","requestBody":{"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/RoutePricingConfigurationCreate"}}}},"responses":{"201":{"description":"新配置版本","content":{"application/json":{"schema":{"$ref":"#/components/schemas/RoutePricingConfiguration"}}}},"422":{"$ref":"#/components/responses/Error422"}}}
    },
    "/api/ops/v1/coupons": {
      "get": {"operationId":"listCoupons","responses":{"200":{"description":"券页","content":{"application/json":{"schema":{"$ref":"#/components/schemas/CouponPage"}}}}}}
    },
    "/api/ops/v1/coupons/batches": {
      "post": {"operationId":"createCouponBatch","requestBody":{"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/CouponBatchCreate"}}}},"responses":{"201":{"description":"券批次","content":{"application/json":{"schema":{"$ref":"#/components/schemas/CouponBatch"}}}},"422":{"$ref":"#/components/responses/Error422"}}}
    },
    "/api/customer/v1/orders/{orderId}/actions/lock-coupon": {
      "post": {"operationId":"lockOrderCoupon","requestBody":{"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/CouponLockAction"}}}},"responses":{"200":{"description":"锁定结果","content":{"application/json":{"schema":{"$ref":"#/components/schemas/CouponLock"}}}},"409":{"$ref":"#/components/responses/Error409"}}}
    },
    "/api/customer/v1/orders/{orderId}/actions/redeem-coupon": {
      "post": {"operationId":"redeemOrderCoupon","requestBody":{"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/CouponRedeemAction"}}}},"responses":{"200":{"description":"核销结果","content":{"application/json":{"schema":{"$ref":"#/components/schemas/CouponRedemption"}}}},"409":{"$ref":"#/components/responses/Error409"}}}
    },
    "/api/customer/v1/orders/{orderId}/actions/release-coupon": {
      "post": {"operationId":"releaseOrderCoupon","requestBody":{"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/CouponReleaseAction"}}}},"responses":{"200":{"description":"释放结果","content":{"application/json":{"schema":{"$ref":"#/components/schemas/CouponRelease"}}}},"409":{"$ref":"#/components/responses/Error409"}}}
    },
    "/api/ops/v1/merchants/{merchantId}/contract": {
      "get": {"operationId":"getMerchantContract","responses":{"200":{"description":"合同","content":{"application/json":{"schema":{"$ref":"#/components/schemas/MerchantContract"}}}},"404":{"$ref":"#/components/responses/Error404"}}},
      "post": {"operationId":"createMerchantContract","requestBody":{"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/MerchantContractCreate"}}}},"responses":{"201":{"description":"草稿合同","content":{"application/json":{"schema":{"$ref":"#/components/schemas/MerchantContract"}}}},"422":{"$ref":"#/components/responses/Error422"}}}
    },
    "/api/ops/v1/merchants/{merchantId}/contract/actions/activate": {
      "post": {"operationId":"activateMerchantContract","requestBody":{"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/MerchantContractTransitionAction"}}}},"responses":{"200":{"description":"生效合同","content":{"application/json":{"schema":{"$ref":"#/components/schemas/MerchantContract"}}}},"409":{"$ref":"#/components/responses/Error409"}}}
    },
    "/api/ops/v1/merchants/{merchantId}/contract/actions/expire": {
      "post": {"operationId":"expireMerchantContract","requestBody":{"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/MerchantContractTransitionAction"}}}},"responses":{"200":{"description":"到期合同","content":{"application/json":{"schema":{"$ref":"#/components/schemas/MerchantContract"}}}},"409":{"$ref":"#/components/responses/Error409"}}}
    },
    "/api/ops/v1/merchants/{merchantId}/sku-dimensions": {
      "get": {"operationId":"listMerchantSkuDimensions","responses":{"200":{"description":"尺寸页","content":{"application/json":{"schema":{"$ref":"#/components/schemas/SkuDimensionPage"}}}}}},
      "post": {"operationId":"createMerchantSkuDimension","requestBody":{"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/SkuDimensionCreate"}}}},"responses":{"201":{"description":"尺寸","content":{"application/json":{"schema":{"$ref":"#/components/schemas/SkuDimension"}}}},"422":{"$ref":"#/components/responses/Error422"}}}
    },
    "/api/ops/v1/users/{userId}/actions/freeze": {
      "post": {"operationId":"freezeUser","requestBody":{"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/UserFreezeAction"}}}},"responses":{"200":{"description":"冻结状态","content":{"application/json":{"schema":{"$ref":"#/components/schemas/UserFreezeState"}}}},"409":{"$ref":"#/components/responses/Error409"}}}
    },
    "/api/ops/v1/users/{userId}/actions/unfreeze": {
      "post": {"operationId":"unfreezeUser","requestBody":{"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/UserUnfreezeAction"}}}},"responses":{"200":{"description":"解冻状态","content":{"application/json":{"schema":{"$ref":"#/components/schemas/UserFreezeState"}}}},"409":{"$ref":"#/components/responses/Error409"}}}
    }
  }
}
```

```json
{
  "components": {
    "schemas": {
      "RouteQuote": {"type":"object","required":["chargeableWeightGrams","totalMinor","currency","expiresAt","configurationVersion"],"properties":{"chargeableWeightGrams":{"type":"integer","minimum":1},"totalMinor":{"type":"integer","format":"int64","description":"最小货币单位；示例值由后台配置"},"currency":{"type":"string","enum":["USD","KHR"]},"expiresAt":{"$ref":"#/components/schemas/Timestamp"},"configurationVersion":{"type":"integer","minimum":1}}},
      "RoutePricingConfiguration": {"type":"object","required":["id","version","effectiveAt"],"properties":{"id":{"$ref":"#/components/schemas/Id"},"version":{"type":"integer","minimum":1},"effectiveAt":{"$ref":"#/components/schemas/Timestamp"}}},
      "RoutePricingConfigurationPage": {"type":"object","required":["items"],"properties":{"items":{"type":"array","items":{"$ref":"#/components/schemas/RoutePricingConfiguration"}}}},
      "CouponBatch": {"type":"object","required":["id","version","budgetMinor"],"properties":{"id":{"$ref":"#/components/schemas/Id"},"version":{"type":"integer","minimum":1},"budgetMinor":{"type":"integer","format":"int64","description":"最小货币单位；示例值由后台配置"}}},
      "CouponPage": {"type":"object","required":["items"],"properties":{"items":{"type":"array","items":{"$ref":"#/components/schemas/Coupon"}}}},
      "Coupon": {"type":"object","required":["id","state"],"properties":{"id":{"$ref":"#/components/schemas/Id"},"state":{"type":"string","enum":["AVAILABLE","LOCKED","REDEEMED","RELEASED"]}}},
      "CouponLock": {"type":"object","required":["couponId","discountMinor","driverCommissionBaseMinor"],"properties":{"couponId":{"$ref":"#/components/schemas/Id"},"discountMinor":{"type":"integer","format":"int64"},"driverCommissionBaseMinor":{"type":"integer","format":"int64","description":"优惠前金额"}}},
      "CouponRedemption": {"type":"object","required":["id","couponId","state"],"properties":{"id":{"$ref":"#/components/schemas/Id"},"couponId":{"$ref":"#/components/schemas/Id"},"state":{"const":"REDEEMED"}}},
      "CouponRelease": {"type":"object","required":["couponId","state"],"properties":{"couponId":{"$ref":"#/components/schemas/Id"},"state":{"const":"RELEASED"}}},
      "MerchantContract": {"type":"object","required":["id","state","version"],"properties":{"id":{"$ref":"#/components/schemas/Id"},"state":{"type":"string","enum":["DRAFT","ACTIVE","EXPIRED"]},"version":{"type":"integer","minimum":1}}},
      "SkuDimension": {"type":"object","required":["id","chargeableWeightGrams","exclusiveVehicleOnly"],"properties":{"id":{"$ref":"#/components/schemas/Id"},"chargeableWeightGrams":{"type":"integer","minimum":1},"exclusiveVehicleOnly":{"type":"boolean"}}},
      "SkuDimensionPage": {"type":"object","required":["items"],"properties":{"items":{"type":"array","items":{"$ref":"#/components/schemas/SkuDimension"}}}},
      "UserFreezeState": {"type":"object","required":["userId","state","version"],"properties":{"userId":{"$ref":"#/components/schemas/Id"},"state":{"type":"string","enum":["ACTIVE","FROZEN"]},"version":{"type":"integer","minimum":1}}}
    }
  }
}
```
