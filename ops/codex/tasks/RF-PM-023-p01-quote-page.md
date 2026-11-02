# RF-PM-023 · P01-B 报价生成、明细与客户确认

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | feat / 中 |
| 版本 | v0.3.0 |
| 执行人 | 大旺＋Codex |
| 基线 SHA | RF-PM-022 合并后的 `develop` |
| 分支 | `feat/RF-PM-023-quote-page`，PR 目标 `develop` |
| 依赖 | RF-PM-022 |
| 需人类批准 | 否 |
| 状态 | 已合并（PR #37）· 事后审查 CHANGES_REQUESTED，缺口转 RF-PM-028 |

## 背景

报价接口已实现，但“当前没有报价表单/详情页”（`prototype/ORDER-ENTRY-CONTRACT.md`）。任务拆解见 [需求会后任务拆解](../../../PRD/docs/tasks/post-meeting-task-breakdown-v0.1.md)。

## 要做

按 [订单报价接口](../../../contracts/order-quotes-api.md) 与 [预付接口](../../../contracts/prepayment-api.md) 中的客户确认：

1. **生成报价**：已受理（validating）订单可选择已发布费率策略、是否投保，`POST /orders/{id}/quotes`。策略列表只列已发布、当前有效的。
2. **报价明细**：币种、基础费、超距计费米数/单价/取整、独享费、保费、总应收、规则与策略版本、有效期、来源订单快照。保费单列，不计入配送分成（会议 M05）。
3. **有效性**：`GET /quotes/{id}` 的 state（issued／expired／superseded）与 unusableReasons 必须显示；不能以订单状态代替报价有效性。重放响应后要重新 GET 核对。
4. **客户确认**：`POST /quotes/{id}/actions/record-customer-confirmation`，记录联系人、方式、依据和确认时间。
5. 错误：412 VERSION_CONFLICT、409 INVALID_STATE／POLICY_NOT_PUBLISHED、422 INTAKE_BLOCKED／POLICY_NOT_EFFECTIVE／SERVICE_NOT_SUPPORTED／FEE_NOT_ENABLED 均有可读提示和下一步。
6. 不提供及时送（S1）选项。

前端不另写计价逻辑：金额以服务端报价为准，页面只展示。

## 不做

不做付款、核销和派单（属 v0.4.0）；不做改单候选报价（属 RF-PM-025）。

## 验收

- 单元测试：明细渲染、各 state 与 unusableReasons、错误码映射、确认请求体。
- 用实施计划 §4 固定场景核对页面金额：基础 $10、超距 $5、独享 $3、配送报价 $18、保费 $2、总应收 $20。
- 浏览器（合成数据）：受理 → 生成报价 → 明细 → 客户确认；过期与被替代报价不能确认。
- CI 三项通过。

## 交付证据

PR 描述写明 PASS／FAIL／NOT_RUN 和“发现但未处理”。

## 审查记录

**2026-10-27 · Claude · 事后审查 · CHANGES_REQUESTED**（PR #37，提交 `75e306d`，合并于 `5eace9c`；合并前未经审查）

已做到：从 validating 订单按策略 ID 生成报价（含是否投保）、读取当前报价、显示 state 与 unusableReasons、非 issued 时隐藏确认表单、客户确认（联系人、方式、依据、时间）、错误码文案齐全、页面不自行算价。策略只能按 ID 读取是因为契约没有策略列表接口，PR 已记入“发现但未处理”，接受。

未满足验收，转 [RF-PM-028](RF-PM-028-p01-acceptance-gaps.md)：

1. 报价明细直接输出 JSON，金额显示为“最小货币单位”整数；卡片要求逐项可读展示：基础费、超距计费米数／单价／取整、独享费、保费（单列且标明不计入配送分成，M05）、总应收、规则与策略版本、有效期、来源订单快照。
2. 生成报价后直接使用 POST 响应，没有按契约在重放后重新 GET 报价核对有效性（`Idempotency-Replayed` 时必须 GET）。
3. 没有新增单元测试（明细渲染、各 state 与 unusableReasons、错误码映射、确认请求体）。
4. 没有用实施计划 §4 固定场景（$10＋$5＋$3＝$18，保费 $2，总应收 $20）核对页面金额；浏览器脚本只用了单一基础费 1000。
5. 浏览器脚本缺“过期与被替代报价不能确认”。
6. 确认时间留空时静默取当前时间；应要求填写或在页面明示默认值。浏览器脚本用报价 createdAt 反推确认时间，属于绕过而不是验证。
