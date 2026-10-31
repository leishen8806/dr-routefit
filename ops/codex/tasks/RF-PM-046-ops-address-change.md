# RF-PM-046 · 运营代登记改址申请与候选报价关联回读

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | fix / 高（新增权限与接口契约） |
| 版本 | v0.3.0 |
| 执行人 | 大旺＋Codex |
| 基线 SHA | 最新 `develop`（含 RF-PM-038-R6） |
| 分支 | `fix/RF-PM-046-ops-address-change`，PR 目标 `develop` |
| 依赖 | RF-PM-025（#44）、RF-PM-038-R6（#81） |
| 需人类批准 | **是**：新增权限与接口契约；合并前须负责人侧 Claude 审查通过，并由作者以外的人批准最终 head |
| 状态 | TODO（2026-10-31 派发；v0.3.0 发布条件） |

## 背景

2026-10-31 RF-QA-02 手工验收第 4 步（已确认报价后申请改址 → 候选报价显示差额 → 客户确认候选）在 `develop` `5baaae8` 上失败，原因有两处：

1. **没有任何人能发起改址申请。** 创建服务申请只有客户端 `/api/customer/v1/service-requests` 和收货人端 `/api/recipient/v1/service-requests`；运营端 `/api/ops/v1/service-requests` 只有列表和 `decide`。v0.3.0 不提供客户登录（发布说明已知限制第 5 条），所以试运营期间没有入口，订单页也没有对应界面。RF-PM-025 的卡片只要求“显示候选报价差额与确认状态”，没有写这个入口，合并时没有发现。
2. **案件读取回不到候选报价。** 候选报价通过 `POST /api/ops/v1/orders/{orderId}/quotes` 带 `serviceCaseId` 生成，关联写入 `pricing.amendment_quote`；`services/routefit/adapters/cases.mjs` 读取案件时只返回决定事件里的 `newQuoteId`，候选报价生成后不回写，所以 `relatedQuoteId` 为 `null`，刷新页面后无法恢复候选报价。（来源：验收方读源码，需在本卡测试中坐实。）

运维说明 `ops/trial/manual-ops-guide.md` 第 4 节开头写的是“系统重新生成候选报价后……”，默认系统能触发，目前触发不了。

## 要做

1. **服务端：**
   - 运营端“代客户登记服务申请”接口（本卡只做改址）：必须记录代登记人和客户同意依据（渠道、reference、时间），与受理依据同一风格；
   - 新增权限只给确实需要的角色，不给策略编制、复核、发布角色；
   - 职责分离：登记人不能是同一申请的决定人，沿用已有的 `INDEPENDENT_REVIEW_REQUIRED` 思路；
   - 案件读取时从 `pricing.amendment_quote` 动态回读候选报价，使 `relatedQuoteId` 在候选报价生成后、刷新后都正确；
   - `contracts/openapi.json` 和 `contracts/service-cases-api.md` 同步更新。
2. **页面（`orders.html`、`orders.mjs`）：**
   - 已确认报价的订单上提供“申请改址”入口；
   - 另一人独立决定；
   - 生成候选报价，显示差额和方向；
   - 客户确认候选；
   - 页面写明“原报价、原收款不被覆盖，候选报价只作为客户同意与价差的证据”；
   - 刷新或重新打开订单后，状态必须能恢复。
3. **测试：**
   - 真实 PostgreSQL 集成测试：运营代登记成功；缺客户同意依据被拒；登记人与决定人相同被拒；跨企业读取返回 404；候选报价生成后读案件，`relatedQuoteId` 正确；原报价、原订单不变；
   - 单元测试：请求体构造与字段校验；
   - 浏览器验收脚本：按 RF-QA-02 第 4 步走完整流程，含刷新后恢复；连跑 3 次，输出 JSON 放进 `services/routefit/verification/rf046/`；不接入现有 CI。
4. **文档：** `ops/trial/manual-ops-guide.md` 第 4 节开头改为说明候选报价由“运营代登记并决定后生成”。

## 不做

- 退款、补差收款、付款准入、核销（v0.4.0）。候选报价确认后不产生任何资金动作；
- 改时：与改址是同一条代码路径、几乎不增加工作量时一并做，否则不做，并在 PR 里说明；
- 仓库、货物、服务类型变更后的重核价（RF-PM-032）；
- 距离计价（RF-PM-032）。

## 验收

- 上述集成测试、单元测试在 CI 的真实 PostgreSQL 上通过；CI 五项全绿；
- 浏览器验收脚本连跑 3 次全部 PASS；
- PR 描述按 PASS / FAIL / NOT_RUN 逐项写明，并注明新增了哪个权限、给了哪些角色；
- 合并后，由项目负责人的 Codex 在新 `develop` 上复验 RF-QA-02 第 4 步，结果写进验收报告和本卡审查记录。

## 审查记录

