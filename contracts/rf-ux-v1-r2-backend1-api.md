# RF-UX-V1 R2 Backend1 API 清单

状态：模块草案，供 `contracts/rf-ux-v1-r2-api-index.md` 汇总；不修改总稿 `openapi.json`。所有金额均为整数最小货币单位；示例业务数值必须在后台配置并标注“示例”。

本清单覆盖：客户下单报价、运营端计价配置与商户资料、订单优惠券动作、后台用户冻结。标准 20 的权限点、阶段、实现状态、版本对象、负责岗位及双示例以 `contracts/modules/backend1.json` 为事实源；认证、授权判定、RLS、跨步骤支付/核销事务均不在本模块实现范围，须经安全复核后才可接线。

## 接口一览

| 路径 | 用途和页面 | 请求 / 返回 | 错误码 | 权限（待安全复核） | 幂等键 |
| --- | --- | --- | --- | --- | --- |
| `POST /api/customer/v1/route-quotes` | 客户下单报价页：体积重、车型/里程、增值服务、汇率与 KHR 取整；报价有效 10 分钟 | 返回计费重、费用明细、总价、货币、`expiresAt`、配置版本 | `EXCLUSIVE_VEHICLE_REQUIRED`、`INVALID_ROUTE_PRICING_INPUT`、`AMOUNT_OUT_OF_RANGE` | `customer:quote:create` | 必需 |
| `GET /api/ops/v1/route-pricing/configurations` | 运营后台计价配置页：读取当前配置 | 返回版本化配置列表 | `NOT_FOUND` | `pricing:read` | 不适用 |
| `POST /api/ops/v1/route-pricing/configurations` | 运营后台计价配置页：新增配置版本 | 返回新版本 | `VERSION_REQUIRED`、`AMOUNT_OUT_OF_RANGE`、`VALIDATION_FAILED` | `pricing:write` | 必需 |
| `GET /api/ops/v1/coupons` | 运营后台优惠券页：查询批次、券、预算和锁定状态 | 返回券及核销状态 | `NOT_FOUND` | `marketing:coupon:read` | 不适用 |
| `POST /api/ops/v1/coupons/batches` | 运营后台优惠券页：创建券批次 | 返回初始版本 | `COUPON_NOT_APPROVED`、`VALIDATION_FAILED` | `marketing:coupon:write` | 必需 |
| `POST /api/customer/v1/orders/{orderId}/actions/lock-coupon` | 客户下单页：一单锁定一券 | 返回锁定记录、优惠额、司机计佣基数 | `ORDER_ALREADY_HAS_COUPON`、`COUPON_ALREADY_USED`、`COD_NOT_ELIGIBLE`、`COUPON_MINIMUM_NOT_MET`、`COUPON_BUDGET_EXCEEDED`、`COUPON_REDEMPTION_PAUSED` | `customer:order:write` | 必需 |
| `POST /api/customer/v1/orders/{orderId}/actions/redeem-coupon` | 订单付款确认后的内部动作 | 返回核销记录 | `COUPON_NOT_LOCKED`、`PAYMENT_REQUIRED` | `order:payment:confirm` | 必需；支付确认事务由 BackendSenior/安全复核负责 |
| `POST /api/customer/v1/orders/{orderId}/actions/release-coupon` | 客户取消订单页：释放券 | 返回释放记录 | `COUPON_NOT_RELEASABLE` | `customer:order:write` | 必需 |
| `GET /api/ops/v1/merchants/{merchantId}/contract` | 运营后台商户合同页：读取合同和版本 | 返回合同、状态和版本 | `NOT_FOUND` | `merchant:contract:read` | 不适用 |
| `POST /api/ops/v1/merchants/{merchantId}/contract` | 运营后台商户合同页：创建草稿合同 | 返回草稿合同及版本 | `INVALID_CONTRACT_INPUT` | `merchant:contract:write` | 必需 |
| `POST /api/ops/v1/merchants/{merchantId}/contract/actions/activate` | 运营后台商户合同页：草稿生效 | 返回生效合同和追加事件 | `INVALID_CONTRACT_TRANSITION`、`VERSION_CONFLICT` | `merchant:contract:write` | 必需 |
| `POST /api/ops/v1/merchants/{merchantId}/contract/actions/expire` | 运营后台商户合同页：生效合同到期 | 返回到期合同和追加事件 | `INVALID_CONTRACT_TRANSITION`、`VERSION_CONFLICT` | `merchant:contract:write` | 必需 |
| `GET /api/ops/v1/merchants/{merchantId}/sku-dimensions` | 运营后台货品尺寸页：读取 SKU 尺寸和计费重 | 返回尺寸、计费重、仅包车标记 | `NOT_FOUND` | `merchant:catalog:read` | 不适用 |
| `POST /api/ops/v1/merchants/{merchantId}/sku-dimensions` | 运营后台货品尺寸页：登记 SKU 尺寸 | 返回尺寸、计费重、仅包车标记 | `INVALID_CARGO_INPUT` | `merchant:catalog:write` | 必需 |
| `POST /api/ops/v1/users/{userId}/actions/freeze` | 运营后台用户详情页：人工冻结 | 返回冻结状态和版本 | `FREEZE_REASON_REQUIRED`、`INVALID_FREEZE_TRANSITION`、`VERSION_CONFLICT` | `user:freeze:write` | 必需 |
| `POST /api/ops/v1/users/{userId}/actions/unfreeze` | 运营后台用户详情页：人工解冻 | 返回活动状态和版本 | `INVALID_FREEZE_TRANSITION`、`VERSION_CONFLICT` | `user:freeze:write` | 必需 |

## 一致性约束

- 所有可变配置与合同、冻结动作使用版本号；更新以 `If-Match` 传递，冲突不覆盖历史。
- 优惠券只抵运费，不抵代收或保价；到付订单不可用；一单仅一券；司机计佣基数取优惠前金额。
- `lock-coupon`、`redeem-coupon`、`release-coupon` 是动作接口。重复写请求以同一幂等键返回原结果；不同请求体复用同一键返回冲突。
- 冻结仅支持后台人工动作，自动冻结默认关闭；下单和付款入口均返回 `ACCOUNT_FROZEN`。账户授权与审计细节待安全复核。

## 对齐记录

本清单依据本卡的领域模块与迁移 `065`–`069`，而非 `contracts/` 总稿。安全相关的权限、RLS 与跨步骤事务不由 Backend1 自行实现。

## 正式契约差异核验（e6c2916）

以 BackendSenior 的 `e6c2916` 为事实源复核后，13 条路径和 16 个 operationId 均已在正式 `openapi.json.paths` 中存在，故本次没有可预制的剩余 path；不重复粘贴已落地条目。下列 JSON 是每个 Backend1 操作可直接合并进其 `responses` 对象的通用错误响应补全建议；其中写操作额外要求 `412` 与 `428`。

```json
{
  "missingPaths": [],
  "responses": {
    "400": {"$ref": "#/components/responses/Error400"},
    "401": {"$ref": "#/components/responses/Error401"},
    "403": {"$ref": "#/components/responses/Error403"},
    "404": {"$ref": "#/components/responses/Error404"},
    "412": {"$ref": "#/components/responses/Error412"},
    "428": {"$ref": "#/components/responses/Error428"},
    "429": {"$ref": "#/components/responses/Error429"},
    "503": {"$ref": "#/components/responses/Error503"}
  }
}
```

本草案不修改 `openapi.json`、接口索引、认证、授权、RLS 或付款核销事务；总稿负责人可按正式契约决定是否采纳补全建议。

## 基准后到的路径映射

基准文件在既有 16 条路径通过契约复核后才落盘。路径或模块划分不一致的项已在本卡 Q-V1 提问中逐项记录，故不在此重命名路径；影响面包括 `openapi.json`、接口索引、模块 handler 路由表、相关测试及 Reviewer3 一致性复核。模块契约对基准已有权限点使用原码；未覆盖或语义不等价的动作以空 `x-permissions` 加裁定注记 fail-closed。
