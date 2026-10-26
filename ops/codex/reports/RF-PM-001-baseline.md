# RF-PM-001 · 本地全量测试基线

基线：`2ac993ec20adb24feeb6b5035fb15a69990b608c`。执行时间：2026-10-26（Asia/Phnom_Penh）。不改业务代码、契约或迁移。

环境：macOS 26.7.1 (25G241), arm64；Node v24.22.1；npm 11.19.1；PostgreSQL 16.15 (Homebrew)。显式使用 Node24 PATH，不替换系统默认 Node22。一次性集群 `/tmp/routefit-rf001-pg`，仅监听127.0.0.1:55436，仅合成数据；没有业务环境或真实银行、地图、设备调用。

## 命令证据

以下命令在 services/routefit 下执行，prototype 命令在仓库根执行。计数为 tests/pass/fail/skip；— 表示非测试命令，无计数。

| 命令 | 退出码 | 结果 | 计数 | 耗时 |
| --- | --- | --- | --- | --- |
| `node -v && npm -v && psql --version && sw_vers` | 0 | PASS | —/—/—/— | 0.425s |
| `npm ci` | 0 | PASS | —/—/—/— | 0.531s |
| `npm test` | 0 | PASS | 101/101/0/0 | 0.434s |
| `npm run test:integration` | 1 | FAIL | 7/0/7/0 | 1.884s |
| `node --test prototype/*.test.mjs` | 0 | PASS | 65/65/0/0 | 0.095s |
| `npm run dev:bootstrap` | 1 | FAIL | —/—/—/— | 0.317s |
| `npm run start:dev` | 9 | FAIL | —/—/—/— | 0.104s |
| `npm run smoke` | 1 | FAIL | —/—/—/— | 0.101s |
| `npm run smoke:orders` | 1 | FAIL | —/—/—/— | 0.093s |
| `npm run smoke:policy` | 9 | FAIL | —/—/—/— | 0.079s |
| `npm run smoke:intake` | 1 | FAIL | —/—/—/— | 0.094s |
| `npm run smoke:quotes` | 9 | FAIL | —/—/—/— | 0.077s |
| `npm run smoke:prepayment` | 9 | FAIL | —/—/—/— | 0.078s |
| `npm run smoke:reversals` | 9 | FAIL | —/—/—/— | 0.097s |

集成测试仅完成7个顶层测试的初始化，全部失败，未执行后续子案例；不能据此声称业务集成通过。npm ci 审计0漏洞。initdb 和 pg_ctl start 均exit0。

## 失败与归因

- `npm run test:integration`：7/7 首错均为 PostgreSQL `42601 syntax error at or near "customer_scope"`，位置5929。初步归因：代码，`db/migrations/051_service_intake.sql:97` 使用 `ALTER TABLE orders.draft DROP POLICY customer_scope;`，PostgreSQL不接受此语法。未修复，需另卡审查迁移及后续失败。
- `npm run dev:bootstrap`：同一迁移语法错误，exit1；未生成 `.local`。
- `npm run start:dev` 与 smoke:policy/quotes/prepayment/reversals：首错 `node: .local/dev.env: not found`，exit9。归因：数据/初始化依赖，根因上游迁移失败。
- smoke/smoke:orders/smoke:intake：首错 `ENOENT ... .local/client.json`，exit1；同为上游初始化失败。所有7个冒烟均实际尝试，但业务链路未运行。
- NOT_RUN：正式服务启动后的 `/dev/openapi.json`、端点真实业务调用、浏览器独立脚本、真机、真实银行与地图。原因：服务初始化被迁移阻塞；本卡不修复、不用Mock替代。

## 接口数字与差异

迁移文件63个，最高063；这表示仓库文件版本，不表示63个已成功应用。契约目录标记 `LOCAL_IMPLEMENTED_NOT_DEPLOYED` 的操作235个。

正式服务无法完成bootstrap，因此**实际可调用操作数无法验证（不是已验证235，也不是确认实现0个）**。为隔离排查，另以未修改的 `localBrowser` HTTP适配器在127.0.0.1:4181临时提供 `/dev/openapi.json`；未连接数据库、未执行业务API。HTTP200，文档暴露操作235个，与目录比较：catalog-only `[]`；adapter-only `[]`。该检查仅证明文档投影一致，不证明业务路由可执行。

尚未获得运行时验证的235个operationId如下，全部因同一启动阻塞未逐项调用：

- `acceptInbound`
- `acceptOutbound`
- `accessGrants`
- `activateSettlementRule`
- `approveAllocationReversal`
- `approvePrepaymentAllocation`
- `bankTransactions`
- `bookingConfirm`
- `bookingConfirmCancel`
- `bookingRequest`
- `bookingRequestCancel`
- `bookingVerifyDelivery`
- `carrierEvent`
- `cashHandovers`
- `channelSettlement`
- `checkOrderIntake`
- `checkPromise`
- `confirmQuote`
- `confirmReceipt`
- `confirmTransfer`
- `countCash`
- `createAccessGrant`
- `createAllocationReversal`
- `createAssignment`
- `createBooking`
- `createException`
- `createInboundNotices`
- `createLoadReview`
- `createOrder`
- `createOutboundRequests`
- `createPartner`
- `createPrepaymentAllocation`
- `createPricingTariff`
- `createPricingTrial`
- `createPromise`
- `createQuote`
- `createRescuePlan`
- `createReturn`
- `createServiceArea`
- `createSettlementRule`
- `createTransfer`
- `customerAcknowledgeStatement`
- `customerCompleteUpload`
- `customerConfirmQuote`
- `customerCreateOrder`
- `customerEvidenceDownload`
- `customerFinanceRequests`
- `customerInboundNotices`
- `customerInventory`
- `customerLedgerItems`
- `customerMemberRevoke`
- `customerMemberSuspend`
- `customerMembers`
- `customerOrder`
- `customerOrders`
- `customerOutboundRequests`
- `customerPaymentIntent`
- `customerPaymentStatus`
- `customerQueryPayment`
- `customerQuote`
- `customerReceiptReport`
- `customerReceipts`
- `customerReport`
- `customerServiceRequest`
- `customerServiceRequestDetail`
- `customerServiceRequests`
- `customerSession`
- `customerSettlementAccounts`
- `customerStatement`
- `customerStatements`
- `customerSubmitOrder`
- `customerTimeline`
- `customerUpload`
- `decideServiceRequest`
- `dispatchBoard`
- `dispatchCandidates`
- `documentApprove`
- `documentPost`
- `documentRecordExecution`
- `documentRecordResult`
- `documentReject`
- `documentReview`
- `documentSubmit`
- `draftChannelSettlement`
- `draftFinanceDocument`
- `driverAccept`
- `driverAssignment`
- `driverAssignments`
- `driverCashReport`
- `driverCompleteUpload`
- `driverConfirmTransfer`
- `driverDelivery`
- `driverDepart`
- `driverEvidenceDownload`
- `driverHandover`
- `driverHandovers`
- `driverIncome`
- `driverLocations`
- `driverOrder`
- `driverRecipientAuthorization`
- `driverReject`
- `driverSettlementAccounts`
- `driverSync`
- `driverUpload`
- `driverWithdrawal`
- `driverWithdrawals`
- `editOrderDraft`
- `exceptionAssign`
- `exceptionClose`
- `exceptionResolve`
- `exportFinance`
- `externalDispatchRequest`
- `externalImportOrder`
- `externalImportStatus`
- `financeDocument`
- `financeDocuments`
- `financePaymentIntents`
- `financeQueryPayment`
- `financeReceipts`
- `financeStatement`
- `financeStatements`
- `financeTasks`
- `generateStatement`
- `getAllocationReversal`
- `getBooking`
- `getFinanceCashHandover`
- `getFinanceExport`
- `getFinanceLedgerItem`
- `getFinanceReceipt`
- `getInboundNotices`
- `getOrder`
- `getOutboundRequests`
- `getPrepaymentAllocation`
- `getPrepaymentReceipt`
- `getPricingPolicy`
- `getPricingTariff`
- `getPricingTrial`
- `getQuote`
- `getSession`
- `holdFinanceTask`
- `inviteCustomerMember`
- `ledgerItems`
- `ledgerReport`
- `listExceptions`
- `listInbound`
- `listOrderCustomers`
- `listOrders`
- `listOutbound`
- `listPartners`
- `listPricingTariffs`
- `listVehicles`
- `logout`
- `merchantLedger`
- `merchantSettlementAccounts`
- `merchantSettlementRequest`
- `merchantSettlements`
- `merchantStatements`
- `moneyOverview`
- `notificationStatus`
- `opsCompleteUpload`
- `opsEvidenceDownload`
- `opsServiceRequests`
- `opsSettlementAccounts`
- `opsSnapshot`
- `opsUpload`
- `orderCancel`
- `orderPaymentAdmission`
- `orderSubmit`
- `orderTimeline`
- `partnerExit`
- `partnerLedger`
- `partnerReinstate`
- `partnerSettlementAccounts`
- `partnerSettlementRequest`
- `partnerSettlements`
- `partnerStatements`
- `partnerSuspend`
- `partnerVerify`
- `postAllocationReversal`
- `postPrepaymentAllocation`
- `prepaymentAccounts`
- `previewSettlementRule`
- `pricingCatalog`
- `pricingRevisions`
- `promiseHistory`
- `publicTracking`
- `publishPricingPolicy`
- `publishServiceArea`
- `readFinanceTask`
- `reassignAssignment`
- `recipientAck`
- `recipientChallenge`
- `recipientCompleteUpload`
- `recipientDelivery`
- `recipientEvidenceDownload`
- `recipientServiceRequest`
- `recipientUpload`
- `recipientVerify`
- `recordOrderIntakeEvidence`
- `recordRecipientAuthorization`
- `registerBankTransaction`
- `reportPrepaymentReceipt`
- `reportReceipt`
- `requestCustomerRefund`
- `reserveStock`
- `retireServiceArea`
- `retryNotification`
- `returnAuthorize`
- `returnClose`
- `returnInspect`
- `returnOrderToDraft`
- `returnReceive`
- `reviewAllocationReversal`
- `reviewPrepaymentAllocation`
- `reviewPricingPolicy`
- `reviseFinanceDocument`
- `revokeAccessGrant`
- `revokeAssignment`
- `savePricingFee`
- `sendNotification`
- `serviceAreas`
- `settlementRules`
- `statementApprove`
- `statementIssue`
- `statementReview`
- `stockConsume`
- `stockRelease`
- `submitPricingPolicy`
- `transferDiscrepancy`
- `verifyPrepaymentReceipt`
- `warehouseDispatchRequest`
- `warehouseImportOrder`
- `warehouseImportStatus`
- `warehouseQueue`
- `wmsStockEvent`

## 证据与范围

逐命令日志、环境、退出码/耗时JSON、隔离适配器openapi响应与差异JSON在本机交接 `claude-bridge/outbox/RF-PM-001-evidence/`。报告PR只含此文件。隔离适配器检查exit0，235/235、差异0；不作为全服务启动PASS。发现但未处理：README与服务README进度数字过时，缺失PRD链接（由其他卡处理）。没有合并、部署或真实业务写入。
