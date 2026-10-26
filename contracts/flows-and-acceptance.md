# 接口调用流程与服务端验收 v0.1

本文件使用 [接口目录](endpoint-catalog.md) 中的 operationId。费用草稿闭环的本地验证见下节；其余下列业务链仍是**待开发的服务端验收要求**，不是已通过的业务测试。已执行的结构校验见 [校验记录](verification/2026-10-24/result.json)。示例均为合成数据；请求字段以 [OpenAPI](openapi.json) 为准。

后续增量：[订单录入](orders-api.md)的客户查询、草稿创建／列表／详情／编辑已通过本地PG技术测试；下文包含正式报价、提交、支付、派单的整条业务链仍未完成，不能据此标全部通过。

## 0. 已实现的费用草稿闭环

`pricingCatalog → createPricingTariff → savePricingFee（基础费）→ savePricingFee（保险）→ getPricingTariff → createPricingTrial → getPricingTrial / pricingRevisions`。另可用listPricingTariffs查询本企业草稿。详见[逐步联调](pricing-api.md)及[HTTP请求模板](examples/pricing.http)。此链只生成草稿和模拟快照，不生成订单或应收。

实际测试覆盖金额／保险排除、同键并发、版本冲突、跨企业HTTP与RLS、回滚、历史只追加和重启持久化，见[服务端验证记录](../services/routefit/verification/2026-10-25/README.md)。这不代表下列订单、财务、KESS或全平台验收已通过。

费用试算POST的ETag是父价表tariffVersion；不要按下文其他子资源的通用约定理解为试算自身版本。

## 1. 共同前置条件

开发环境准备同一运营企业 A 下两个独立货主 H1/H2、对应成员、司机 D1/D2、仓管、经办 M、复核 R、审批 A、出纳 X。M/R/A 是三个不同自然人，不能靠切换角色绕过。企业 B 用于跨租户反例。真实渠道使用独立测试商户；未有商户资料前用明确标注的适配器测试替身。

每步先取得本步资源最新版本。HTTP `If-Match: "3"` 表示操作的主资源版本 3，不是页面全局版本。创建子记录后，响应 ETag 属于响应对象；下一步操作父订单前重新读取父订单。业务命令须带唯一 Idempotency-Key，重试沿用同键、同内容；登录验证例外见开发指南。

每个用例同时断言响应、数据库变更、审计、发件箱事件、未发生的副作用。仅看页面提示或返回 200 不算通过。订单履约、收款、交款、结算分别断言。

## 2. 自营配送：预付 → 派单 → 交付

| 步骤 | 调用 | 预期事实与下一步 |
|---|---|---|
| 录单 | createOrder → getOrder → orderSubmit | 服务器生成订单及稳定货件 ID；校验尺寸、重量、地址、服务范围，进入核价流程 |
| 报价 | createQuote → confirmQuote | 客户确认特定报价版本与证据；按批准报价产生应收，重复确认不重复计费 |
| 可行性与承诺 | checkPromise → createPromise | 先满足安全/装载/时窗；承诺绑定检查结果和客户同意。检查过期或输入变化需重算 |
| 取得客户付款对象 | customerOrder → customerQuote → customerLedgerItems | 只可读取 H1 自己订单及账项，不能把 H2 账项带入支付 |
| KESS 支付 | customerPaymentIntent → customerPaymentStatus / customerQueryPayment | 金额来自服务端账项；前端跳转成功不确认收款。服务端可信查单成功生成一次渠道收款事实 |
| 核销 | draftFinanceDocument(ALLOCATION) → documentSubmit → documentReview → documentApprove → documentPost | 三名不同人员；收款确认和分配核销分离。未结服务应收归零，保险独立归属 |
| 派单 | dispatchCandidates → createLoadReview → createAssignment | 再校验付款/月结、承诺、车辆、各路段容量；生成 offered，还没有司机接单 |
| 接单 | driverAssignment → driverAccept | 司机在线确认最新提案和路线；原子占用有效执行，成为 accepted |
| 装车交接 | createTransfer → driverConfirmTransfer → driverDepart | 逐件核对，发出方与接收方独立确认；交接差异不得静默放行 |
| 收货授权 | recordRecipientAuthorization → driverRecipientAuthorization | 内部授权人员核验登记收货人/受托人并留证，司机不能自批；授权有有效期并绑定订单版本 |
| 交付 | driverDelivery → getOrder | 已交付与剩余货件不重叠且覆盖当前交付范围；全量有效签收才成为 delivered，部分签收另有退回/异常 |
| 财务检查 | moneyOverview → ledgerReport → getFinanceLedgerItem | 签收不会把未收、司机待交、COD 待返或应付自动清零 |

合成订单 O1：配送费 10 USD、保险费 2 USD、无 COD。支付 12 USD 的请求不接受客户端金额：

```http
POST /api/customer/v1/payment-intents
Authorization: Bearer <H1会话>
Idempotency-Key: demo-o1-payment-001
Content-Type: application/json

{"orderId":"order-o1","orderVersion":5,"quoteId":"quote-o1","ledgerItems":[{"id":"ar-delivery-o1","version":1},{"id":"ar-insurance-o1","version":1}]}
```

服务端计算 1200 USD 最小单位；假设查单产生收款 R1、版本 1，核销制单示例：

```http
POST /api/ops/v1/finance/documents
Cookie: <运营会话>
X-CSRF-Token: <会话绑定值>
Idempotency-Key: demo-o1-allocation-001
Content-Type: application/json

{"kind":"ALLOCATION","receiptId":"receipt-r1","receiptVersion":1,"items":[{"ledgerItemId":"ar-delivery-o1","ledgerItemVersion":1,"amountMinor":1000},{"ledgerItemId":"ar-insurance-o1","ledgerItemVersion":1,"amountMinor":200}],"reason":"已核验渠道收款按原始收费项目分配"}
```

以上版本只为例子，不能在代码里固定。保险 200 不进入配送费分成基数。KESS 已收 1200 不等于公司银行余额增加 1200；渠道结算必须另核对实际银行到账、手续费及退款组成。

## 3. 合作车辆、人工快递、事故与退回

合作车辆沿用同一车辆提案、接单、保管、交付链；额外要求 partnerVerify 的准入有效、协议和车辆/司机资格有效、可用时段已确认。缺少合作可用时段不能把车辆闲置推断为可以派单。

人工快递：createPartner → partnerVerify → checkPromise（PARCEL_CARRIER 分支）→ createPromise → createBooking → bookingRequest → bookingConfirm → createTransfer/confirmTransfer → carrierEvent → bookingVerifyDelivery。外部“已送达”只是事件，核验凭证后才能形成业务交付。取消采用 bookingRequestCancel → bookingConfirmCancel；取消结果未知时保留有效执行约束，不能直接给另一辆车再派一份。

事故：createException → createRescuePlan → 每个救援分段 createTransfer/confirmTransfer → 后续交付。RescueLeg 使用稳定货件集合，不复制订单或原始运费。一个货件不能同时交给两辆救援车；转运前仍由原保管人负责。每段检查实际车型、空间、重量和既有承诺，事故不能跳过安全约束。

未交付货物：createReturn → returnAuthorize → 对退回任务安排受控执行及保管交接 → returnReceive → returnInspect → returnClose。收到退回不等于货物完好或财务退款完成。拒收和破损建立独立异常；费用调整和退款另走审核单。具体退回运力排程沿现有调度任务实现，不能把退回伪装为第二个原订单有效执行。

## 4. 现金、COD、承运商应付与差额

本例必须为**已获批月结例外**，否则与先付款再派单冲突。运费 20 USD、COD 200 USD、合作运力费 14 USD。

1. driverCashReport 分别关联运费与 COD 归属，合计司机持有 22000 最小单位；申报本身不等于核验或核销。货款受益方 H1，司机保管关系 D1。
2. reportReceipt/confirmReceipt 只用于实际来源核验；既有司机收款不得再新建第二笔。draftFinanceDocument(ALLOCATION) 将同一来源分配到运费和 COD，三人审核后 documentPost。
3. driverHandover 引用原收款 → countCash → 系统生成 CASH_HANDOVER 审核单 → submit/review/approve/post。点收 22000 时只转移保管；点收 21000 时仍有 1000 差额，进入查证，不自动减货款或扣工资。
4. COD 形成商户返还义务；合作费通过 PAYABLE 制单核对协议/履约证据，审核后入账。不能用客户运费直接替代合作成本。
5. opsSettlementAccounts 取得核验账户及版本 → PAYMENT 制单 → submit/review/approve → record-execution → record-result → post。首期出纳在银行端人工付款，系统没有自动划款动作。
6. 付款未知保持占用；已审批不算付款成功，截图不算最终到账；独立核对实际执行结果后才核销。

最终分别断言：运费 2000、COD 20000、承运费 1400；不把现金交回再加一次客户实收，不把 22000 记为营业收入，不把运输差额 600 自动记为净利润。账户余额、保管余额和往来余额不能直接相加。

## 5. 货主门户、仓储与收货人

C0：publicTracking 只读、脱敏、可撤销。C1：customerOrders/customerOrder/customerTimeline、customerEvidenceDownload、customerStatements/customerStatement、customerLedgerItems、customerServiceRequest；H1 的财务成员可看账，普通物流成员不自动获得财务权限。

customerAcknowledgeStatement 只改变客户确认维度，不调用内部 documentApprove、statementApprove 或修改未结余额。customerReceiptReport 上传证明后仍待核验。merchantLedger/partnerLedger 仅返回对应商户 COD 或合作应付，不能借前缀切换身份。

C2：customerInventory → createInboundNotices / createOutboundRequests → 内部 acceptInbound/acceptOutbound → reserveStock → 有实际出库事件后 stockConsume。只有指定库存权威可以发布 wmsStockEvent；库存未知返回 null，不补零。两名成员同时申请最后一件：最多一次受理预留成功，另一请求明确缺货。入库预报不能产生实收库存。

收货人：recipientChallenge → recipientVerify → recipientDelivery → recipientServiceRequest 或 recipientAck。验证凭据只绑定本订单，不能访问货主账单。recipientAck 是收货声明，服务端还需校验保管、签收证据与状态，不能凭一个链接直接 delivered。改地址/时间进入申请队列；内部 decideServiceRequest 受理后，重新核价、检查、确认新承诺再更新执行，接受申请与改完路线不是同一动作。

## 6. 按对象账期、通知与报表

createSettlementRule → previewSettlementRule → activateSettlementRule；同一对象、方向、币种采用明确版本与生效日期。后台按业务时区计算期间和到期，不依赖浏览器常开。

generateStatement → statementReview → statementApprove → statementIssue → sendNotification。账单任务唯一键含公司、对象、方向、币种、规则版本、期间、任务类型。任务重启不重复出账；通知未知先查 notificationStatus，不盲目再次发送。提醒前重新检查未结余额、争议/暂停与收件授权。收款后金额下降或结清，后续催收相应减额或停止。

moneyOverview 必须指定币种。ledgerReport 按账项下钻到来源、分配、审核、保管与更正。导出只包含授权字段、固定查询快照和短期下载链接；权限撤回后不可继续下载。

## 7. 服务端最低验收集（候选，不改正式 AT 编号）

| 编号 | 场景 | 应得到的响应/不变量 |
|---|---|---|
| API-CASE-01 | 同键同请求重试录单 | 原响应/同一订单；无第二次业务写入 |
| API-CASE-02 | 同键改金额或对象 | 409 IDEMPOTENCY_KEY_REUSED；无新资金事实 |
| API-CASE-03 | 两个版本相同的并发改派 | 最多一个成功；其余 412/409，不双占车或有效执行 |
| API-CASE-04 | 同企业 H1 读取 H2 订单/文件/账单 | 404；无对象存在性与字段泄露 |
| API-CASE-05 | 跨企业核销或关联凭证 | 404；同公司但币种/归属不符为 422；余额不变 |
| API-CASE-06 | 未付款、无有效月结派单 | 422 PAYMENT_REQUIRED/CREDIT_NOT_ACTIVE；无提案 |
| API-CASE-07 | 体积够但长边/门口/载重不符 | 422 HARD_CONSTRAINT_VIOLATION；不能人工强制派发 |
| API-CASE-08 | 插单导致已承诺订单超时 | 422；原路线与承诺不被覆盖 |
| API-CASE-09 | 同订单车辆与快递同时指派 | 最多一个有效执行；取消未知仍阻止另一执行 |
| API-CASE-10 | 离线接受提案 | 400（同步事件类型不接受 ACCEPT）；不能绕过在线约束 |
| API-CASE-11 | 重复/乱序离线交付 | 重复返回原结果；过时因果事件 REJECTED/NEEDS_REVIEW，不倒退状态 |
| API-CASE-12 | 一件分配给两辆事故救援车 | 409 SOURCE_CONFLICT；保管账无重复 |
| API-CASE-13 | 已交付与剩余集合重叠/漏件 | 422 HARD_CONSTRAINT_VIOLATION；不整单签收 |
| API-CASE-14 | 无效/过期收货授权、旧地址版本 | 422；建立异常，不自动交付 |
| API-CASE-15 | 客户声明已付/伪造 KESS 状态 | 非法字段 400；截图申报仍待核验 |
| API-CASE-16 | 相同渠道交易重复查询/通知/导入 | 一笔来源事实；异常金额不覆盖原记录 |
| API-CASE-17 | 两张分配单同时抢同一收款余额 | 最多分配可用余额；超额 422，事务原子 |
| API-CASE-18 | 同人不同账号复核并审批 | 403 FORBIDDEN；必须自然人级分离 |
| API-CASE-19 | 审批后更改账户、金额、凭证 | 旧审核失效；未重新审核不得执行 |
| API-CASE-20 | 付款结果未知后重复发起 | 409 INVALID_TRANSITION；保留原付款号和占用 |
| API-CASE-21 | 司机交回已收现金 | 仅保管转移，客户累计实收不增加 |
| API-CASE-22 | 220 应交、210 实交 | 差额 10 可追溯；COD/运费不被抹平 |
| API-CASE-23 | 配送费 10 + 保险 2 分成 | 仅 10 参与分成，2 独立记账 |
| API-CASE-24 | KESS 已收未结算到银行 | 渠道保管增加；公司可用余额不增加 |
| API-CASE-25 | 客户确认账单 | 客户确认变更，内部复核审批/收款不变 |
| API-CASE-26 | 分享入口过期/撤销、越权 token | 404/401；不返回地址、证据或资金资料 |
| API-CASE-27 | 无库存来源、并发出库、重复 WMS 事件 | 未知非零；单次预留/扣减，旧事件不覆盖 |
| API-CASE-28 | 到期任务重跑、部分支付后催收 | 单个有效任务；只提醒当前未结额 |
| API-CASE-29 | 只读中控尝试写、脱敏导出越权 | 无写路由；403/404；无真实资金或运单变化 |
| API-CASE-30 | 审核后撤销成员/账户暂停 | 重新鉴权及检查账户；已有批准不能绕过撤权 |

实施时把这些候选用例落入服务端测试，并记录原 PRD AT / FIN-AT 的对应关系。本轮仅运行机器契约与样例校验，不能将此表标为全部通过。
