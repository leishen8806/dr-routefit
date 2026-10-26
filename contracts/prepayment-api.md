# 订单预付与核销 API · v0.1 本地开发

2026-10-25。首期单订单、单币种、人工银行核验切片。正式 PRD／RULE／AT 不变；不代表支付渠道或生产财务已上线。与既有 [报价接口](order-quotes-api.md)、[本机会话](local-development-api.md) 配套。机器字段以 openapi.json 为准。

## 操作与版本

共同前缀 `/api/ops/v1`。所有 POST 要求同源 CSRF、Idempotency-Key、带双引号 If-Match；同键重试必须保留路径、正文和版本。GET 无副作用。

| 方法及路径 | 权限 | If-Match 对象 / 结果 |
|---|---|---|
| POST /quotes/{id}/actions/record-customer-confirmation | quotes:confirm | Quote 1 → 2 confirmed |
| GET /finance/receiving-accounts | prepayment:read | 本企业预置合成收款账户 |
| POST /orders/{id}/prepayment-receipts | prepayment:write | Order，201 收款申报 version 1 |
| GET /prepayment-receipts/{id} | prepayment:read | 收款申报及核验结果 |
| POST /prepayment-receipts/{id}/actions/verify | prepayment:verify | Receipt 1 → 2，CONFIRMED 或 REJECTED |
| POST /orders/{id}/prepayment-allocations | prepayment:write | Order，201 核销申请 version 1 |
| GET /prepayment-allocations/{id} | prepayment:read | 核销明细及审核事件 |
| POST /prepayment-allocations/{id}/actions/review | prepayment:review | Allocation 1 → 2，REVIEWED 或 REJECTED |
| POST /prepayment-allocations/{id}/actions/approve | prepayment:approve | Allocation 2 → 3，APPROVED 或 REJECTED |
| POST /prepayment-allocations/{id}/actions/post | prepayment:post | Allocation 3 → 4 POSTED |
| GET /orders/{id}/payment-admission | prepayment:read | 当次付款准入检查，不派单 |

客户确认是运营人员记录的客户同意依据（联系人、渠道、reference、confirmedAt），不是客户登录签名或银行证据。只接受当前有效 issued 报价。确认后金额快照保留，报价原到期时间只限制接受时间；后续时窗、区域改变仍阻断付款准入。已确认订单暂不允许退回、改价或重报，等待受控变更流程。

## 页面接线顺序

1. GET 当前 Quote，展示币种、逐项费用及总额。人工记录确认依据后 POST confirmation，再刷新 Quote，不能把本地勾选当成服务端确认。
2. GET receiving-accounts，选同币种账户；填写 money、bankReference、reference、observedAt，POST receipt。金额为最小币种单位整数，范围 1–9000000000000。本切片只记录银行收款，不接受现金/KESS 通知伪装成银行核验。
3. 独立核验身份 POST verify `{ "approve": true, "reason": "核对依据" }`。必须核对金额、币种、账户、交易号和实际证据；reference 目前为人工说明，无附件真实性认证。重复交易号按企业＋收款账户唯一，ASCII 交易号转大写，不因换订单或幂等键产生第二笔资金事实。
4. 经办 POST allocation：`receiptId`、`lines: [{feeId, amountMinor}]`、`reason`。只使用本单已核验收款和当前确认报价的费用 ID。支持分次、部分核销；待审申请不占用余额，审核和最终入账都重新检查。
5. 复核、审批分别操作，同一人不能换账号兼任；两人也均不能是该申请经办。通过后另 POST post `{ "reason": "入账依据" }`。post 是账务分配入账，不是对银行发起付款。只有 POSTED 减少未结额。
6. GET payment-admission 展示 requiredMinor、confirmedMinor、allocatedMinor、unallocatedMinor、remainingMinor、fees、完整 receipts、已入账 allocationIds 和 blockers。`paymentSatisfied` 还要求当前受理依据有效；`dispatchAllowed` 始终 false，后续调度仍须独立检查车辆、装载、承诺和唯一有效执行。

例：配送费200＋保险25；先核验100并核销100，再核验150并核销125。应收225、已核验250、已核销225、剩余0、未分配25。保险25对应独立 feeId，不参与配送分成。多收25不生成收入、不自动退款或自动核销其他订单。

Order.collectionState 是读取时从资金记录派生：unpaid / reported（有申报资料待处理）/ partial / allocated。订单版本不因收款或核销增长，收款和核销各有版本；不要用订单 ETag 缓存财务余额，重新 GET。业务状态仍 quoted，且没有 promise 或 activeExecution。已确认免费报价可以满足付款检查而不制造零金额收款。

## 拒绝与恢复

- 404：不存在、跨企业、未获客户授权。权限或客户授权撤销后，旧幂等结果也不可重放。
- 403：权限不足、本人核验、经办／复核／审批人员重合。
- 409：报价不可用、已确认订单直接修改、交易重复、状态顺序不符。
- 412：版本已变化。先读取，不更换幂等键盲重试。
- 422：币种不一致、金额超界、超额核销、重复费用、未来时间或缺少依据。
- 结果未知：GET 收款／核销及准入，原键原请求重试；禁止默认成功或再新增一笔。

复核/审批拒绝的申请终止，修正后另建申请，原件保留。已确认银行事实仍不能冲正；已入账核销可经007独立审核后整笔撤销，见 [撤销契约](allocation-reversals-api.md)。不提供管理员改余额捷径。

## 联调边界

新空目录 bootstrap 应用001–006，生成0企业A经办、1企业B经办、2策略复核、3策略批准、4财务核验/复核、5财务审批/入账。各身份分别激活；不同账号的生产同人归并仍需可信身份系统，本地 person_id 仅为合成映射。

运行 `npm run smoke:prepayment`；用五个独立会话跑通策略→报价→确认→收款→复核审批→入账→准入。脚本结束停用测试区域，故其后再次检查会出现 COVERAGE_CHANGED，资金记录保留。模板见 [prepayment.http](examples/prepayment.http)。

每单最多100笔收款申报、100笔核销申请；同币种单订单，不含跨单分配、现金、月结、COD、应付、退款、银行事实冲正、账户变更和生产身份。通用 `/finance/receipts` 等接口仍为设计，不用本切片冒充整套财务系统。受理、报价、财务表单尚待大旺接线；现有 orders.html 只同步真实收款状态。

007增量：PaymentAdmission.reversals包含本单撤销链；待审时blockers新增ALLOCATION_REVERSAL_PENDING，collectionState=disputed。撤销入账后allocationIds仅含仍有效核销；被撤销原件GET为REVERSED/version5，不能凭旧POST重放结果判断已结清。
