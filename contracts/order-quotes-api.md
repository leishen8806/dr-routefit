# 固定费订单报价 API

v0.1 本机开发切片，2026-10-25；正式 PRD／RULE／AT 未改。先读 [受理接口](order-intake-api.md)、[价格策略审核](pricing-policy-api.md)及 [开发会话](local-development-api.md)。

| 方法 | 路径 | 权限与版本 |
|---|---|---|
| POST | `/api/ops/v1/orders/{orderId}/quotes` | quotes:create；If-Match 为当前订单版本；返回201 Quote |
| GET | `/api/ops/v1/quotes/{quoteId}` | quotes:read；返回当前有效性和原始计价来源 |

普通报价 POST body：`{"pricingPolicyVersionId":"<已发布策略UUID>","insuranceRequested":true}`。已确认报价的地址／时间变更候选报价必须额外提供已受理的 `serviceCaseId`；它不会替换原订单当前报价。写请求同源Cookie＋CSRF＋Idempotency-Key；禁止传总价、费项、操作者或伪造付款。distanceEvidenceId 当前返回422 CAPABILITY_DISABLED，不能将未接通的距离依据当作已核验。

## 输入检查与计费

订单必须处于validating或quoted。锁定订单后重新检查人工受理依据、当前区域、取送点和期望送达窗口；与区域发布共享企业锁，失败不改变状态。

策略须已独立复核并批准，处于 `[validFrom,validUntil)` 且支持订单服务等级。使用冻结的tariff快照，不读取随后修改的费率草稿。当前仅支持DR固定基础费、固定独享费、固定保险费，策略文字scope保留但不等于完整合同自动匹配，人工应选定本单适用策略。

- 基础费必须明确配置，可为0。
- 订单exclusiveVehicle=true时必须有启用的flash费；不允许因为未配置而默认为免费。
- insuranceRequested=true时必须有启用保险费；false不计保险，即使策略中已配置。
- amountMinor为整数最小货币单位，币种由策略决定。calculate沿用BigInt边界和确定性算法。
- `totalMinor=shareMinor+separateMinor`，保险包含于separateMinor，不参与配送分成。shareMinor是可参与分成基数，不是平台或司机最终收入。报价不等于商业保险承保。

有效期取“生成时间＋策略quoteValiditySeconds、策略validUntil、期望送达窗口结束”的最早值；到expiresAt瞬间失效。没有可靠距离、装箱或道路时效证据，不生成这些费用/承诺。

## 版本与快照

例：受理后的订单v2 → 创建报价Q1 → 订单v3、state=quoted、quoteId=Q1。报价自己的version固定为1，POST/GET ETag也是`"1"`；`quote.orderVersion=3`，`sourceOrderVersion=2`。下一次订单动作须先GET订单或使用返回的orderVersion，不能误把报价ETag当订单版本。

响应包含fees、total、expiresAt、源策略ID、calculation（费项及规则快照）、sourceOrderSnapshot、policySnapshot、createdAt、insuranceRequested。sourceOrderSnapshot保留当时受理依据引用；登记人和依据详情通过受理来源记录追溯。所有源码可查看字段由企业及客户授权限定，不开放给公开收货链接。

原报价不可编辑/删除。未确认报价再次报价使订单版本递增并换新quoteId；旧报价GET返回superseded。退回草稿清除当前报价引用，旧报价同样不可用。修改后须重新受理和报价，不能套用旧金额。

确认后，普通重报被拒绝。只有已受理的地址／时间申请可生成一份候选报价：候选使用新地址／时间重新核验并冻结源快照，返回 `amendment.serviceCaseId`、`baseQuoteId`、`differenceMinor`、方向；确认候选时再冻结原确认收款、有效核销、未分配原款、待补款和待处理贷项位置。候选确认不改订单当前报价、付款准入或原收款。原费用项的有效核销与未结额可通过[应收台账](finance-ledger-api.md)读取；差额应收／贷项、原收款跨报价映射、退款和报价切换尚未实现。

GET动态派生state，不改写历史：

| 条件（优先顺序） | state / unusableReasons |
|---|---|
| 订单版本、当前quoteId或quoted状态不一致 | superseded / ORDER_CHANGED |
| now ≥ expiresAt | expired / EXPIRED |
| 当前区域或受理检查不通过 | superseded / 当前阻断码，包括COVERAGE_CHANGED |
| 其余 | issued / 空数组 |

issued只表示当前可供确认的报价，客户尚未确认。新报价和读取都不写应收、收款、承保、时效承诺或执行指派。初次生成时`customerConfirmedAt=null`；客户确认由006预付接口独立记录，见文末。

**重放返回的是原成功响应**，即使随后已过期或被替代，也不会重新算价或改订单。拿到重放后必须GET报价核对当前有效性；确认与付款接口均须在自己的事务内重新检查，不能信任前端或先前GET。

## 错误与接入

- 412 VERSION_CONFLICT：订单已变，不覆盖；读最新后重新决定。
- 409 INVALID_STATE / POLICY_NOT_PUBLISHED：先受理或完成策略审核。
- 422 INTAKE_BLOCKED：见error.fields，退回重核；区域变化不靠新报价绕过。
- 422 POLICY_NOT_EFFECTIVE / SERVICE_NOT_SUPPORTED / FEE_NOT_ENABLED：选择适用的已发布策略或完成配置审核。
- 跨企业或客户授权撤销返回404，包括GET和幂等重放。报价只追加表有RLS与源订单/已发布策略复合外键。

迁移005，001–004不改；bootstrap身份0／1新增quotes:read/create，旧会话不自动扩权。`npm run smoke:quotes`在干净合成环境复用三人审核并验证报价与退回；不要复制他人.local。

大旺：当前录单页只显示已生成报价的只读状态，尚无报价表单/明细页。通过订单quoteId调用GET报价展示金额分解、有效期和不可用原因；前端不得自行计算正式总价。验证见 [order-quotes](../services/routefit/verification/order-quotes/README.md)。

## 006后续：客户确认

[预付接口](prepayment-api.md)增加record-customer-confirmation。已接受报价以version2/state confirmed返回，保留原金额与确认记录；expiresAt限制接受时间，不自动撤销已确认价格。区域/时窗仍由unusableReasons及付款准入反映。确认后禁止直接退回和重报；受控变更待开发。本文件前面的未确认报价过期/退回规则仅适用于issued阶段。
