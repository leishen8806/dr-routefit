# RF-PM-022 · P01-A 订单受理页接线

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | feat / 中 |
| 版本 | v0.3.0 |
| 执行人 | 大旺＋Codex |
| 基线 SHA | `a12b15fb3ea48733a212f0063a816e0c5ffa634c`（`develop`） |
| 分支 | `feat/RF-PM-022-order-intake-page`，PR 目标 `develop` |
| 依赖 | 无 |
| 需人类批准 | 否 |
| 状态 | TODO |

## 背景

订单录入（`orders.html`）已接通创建、编辑、列表与冲突重试；受理接口已在服务端实现，但页面没有受理依据登记、受理检查和提交入口（见 `prototype/ORDER-ENTRY-CONTRACT.md` 中 validating 只读的说明）。任务拆解见 [需求会后任务拆解](../../../PRD/docs/tasks/post-meeting-task-breakdown-v0.1.md)。

## 要做

按 [订单受理接口](../../../contracts/order-intake-api.md) 的“受理顺序”在订单详情接入：

1. **登记受理依据**：`POST /orders/{id}/intake-evidence`，取送确认渠道（PHONE／IN_PERSON／MESSAGE）、reference、具体入口，每行货物的来源；使用当前订单版本 If-Match。登记人和时间不由页面填写。
2. **受理检查**：`GET /orders/{id}/intake-check`，展示 ready 与每个阻断项（字段级），包括“没有发布区域”“取送点不在有效区域”。
3. **提交受理**：`POST /orders/{id}/actions/submit`；422 INTAKE_BLOCKED 按 error.fields 定位到字段。
4. **退回草稿**：`POST /orders/{id}/actions/return-to-draft`，必须填写原因。
5. validating 状态只读；任何修改都要先退回草稿并重新登记依据。
6. 412 版本冲突：提示并重新读取，不覆盖。
7. 不提供及时送（S1）选项（会议 M03：PILOT-0 不启用）。
8. 合成配送区域用现有 `service-areas` 接口和样例，不默认全城可送。

## 不做

不生成报价、应收、付款或指派；不改服务端接口和迁移；不接真实地图或地理编码。

## 验收

- 单元测试覆盖：依据登记的请求体、阻断项到字段的映射、412 与 422 的处理、退回原因必填。
- 浏览器（Playwright MCP，合成数据）：草稿 → 登记依据 → 检查 ready → 提交 → validating 只读 → 退回草稿；区域外订单被阻断并能看到原因。
- CI 三项通过。

## 交付证据

PR 描述写明 PASS／FAIL／NOT_RUN（含浏览器脚本结果与原因）和“发现但未处理”。

## 审查记录

（Claude 填写）
