# RF-PM-024 · P01-C 费率策略审核与发布页

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | feat / 中（影响报价金额来源） |
| 版本 | v0.3.0 |
| 执行人 | 大旺＋Codex |
| 基线 SHA | `a12b15fb3ea48733a212f0063a816e0c5ffa634c`（`develop`） |
| 分支 | `feat/RF-PM-024-pricing-policy-page`，PR 目标 `develop` |
| 依赖 | 无（与 RF-PM-022 可并行） |
| 需人类批准 | 否 |
| 状态 | TODO |

## 背景

费用页（`fees.html`）已接通价表草稿、版本与试算；报价只能引用已发布的费率策略，但策略的提交、复核、发布还没有页面。任务拆解见 [需求会后任务拆解](../../../PRD/docs/tasks/post-meeting-task-breakdown-v0.1.md)。

## 要做

按 [费率策略审核发布接口](../../../contracts/pricing-policy-api.md)，在费用页接入：

1. **提交策略**：从价表当前版本 `POST /pricing/tariffs/{tariffId}/policy-versions`。
2. **查看策略**：`GET /pricing/policy-versions/{policyId}`，显示状态（SUBMITTED／REVIEWED／PUBLISHED）、冻结快照与适用范围。
3. **复核**、**发布**：`…/actions/review`、`…/actions/publish`，各自带 If-Match。
4. **职责分离**：提交人和来源草稿的编制人不能复核或批准，复核人不能发布同一策略。页面按会话权限和服务端错误隐藏或禁用按钮，但以服务端拒绝为准，不在前端自行判定身份。
5. 复用 `fee-api-client.mjs` 的会话、CSRF、幂等重试与身份变更处理，不另写一套。

## 不做

不改计价规则和服务端；不在页面里计算金额；不接真实收款。

## 验收

- 单元测试：三个动作的请求、版本冲突、职责分离被拒时的提示。
- 浏览器（三个独立身份：编制、复核、发布）：提交 → 复核 → 发布；同一人复核被拒；复核人发布被拒。
- 发布后的策略能在 RF-PM-023 的策略选择中出现（若 023 尚未合并，用接口 GET 验证）。
- CI 三项通过。

## 交付证据

PR 描述写明 PASS／FAIL／NOT_RUN 和“发现但未处理”。

## 审查记录

（Claude 填写）
