# DR RouteFit · Claude → Codex 任务通道

Claude 负责调研、规划、任务拆分、审查与评审；Codex（【Dr.RouteFit 项目开发】）负责按任务卡实现、测试、提交。人类集成负责人批准合并与部署。

## 工作流

1. Claude 在 `ops/codex/tasks/` 发布任务卡，并在下方看板登记。
2. Codex 领取：把卡片状态改为 `IN_PROGRESS`，按卡片里的“基线 SHA”开分支。
3. Codex 完成：推送独立分支、开 PR，PR 描述按卡片“交付证据”逐项填写；卡片状态改为 `IN_REVIEW`。
4. Claude 审查固定 SHA 与限定 diff，结论写回卡片“审查记录”：`APPROVED` 或 `CHANGES_REQUESTED`。
5. 人类集成负责人批准合并；合并与部署是两次独立授权。

## 硬规则（摘自 PRD 附录 D 与开发标准）

- 一张卡一个分支、一个 PR；分支名 `<类型>/<任务编号>-<简述>`，提交信息以任务编号开头。
- 测试结果写 PASS／FAIL／NOT_RUN，NOT_RUN 必须说明原因；Mock 通过不能代替真机、银行或地图验证。
- 只用合成数据；不提交凭据、真实个人资料、`.local/`、`node_modules`。
- **高风险项须人类集成负责人本人批准后才能执行**：部署、数据库迁移上线、身份认证、资金与 KESS、服务器、DNS、对外发布。卡片标了 `需人类批准` 的，Codex 只做到 PR，不合并、不部署。
- 卡片范围外的问题记入 PR 的“发现但未处理”，不顺手改。

## 看板

| 编号 | 标题 | 类型 | 风险 | 依赖 | 状态 |
| --- | --- | --- | --- | --- | --- |
| [RF-PM-000](tasks/RF-PM-000-push-claude-branches.md) | 推送 Claude 准备的两个分支并开 PR | chore | 低 | 无 | TODO |
| [RF-PM-001](tasks/RF-PM-001-baseline-test-report.md) | Node 24 + PostgreSQL 16 全量测试基线报告 | test | 低 | 无 | TODO |
| [RF-PM-002](tasks/RF-PM-002-customer-form-validation.md) | 应用客户下单表单校验修复 | fix | 低 | 000 | TODO |
| [RF-PM-003](tasks/RF-PM-003-readme-status-sync.md) | README 进度与 main 实际状态对齐 | docs | 低 | 001 | TODO |
| [RF-PM-004](tasks/RF-PM-004-missing-docs.md) | 补齐 10 份被引用但缺失的 PRD 文档 | docs | 低 | 无 | TODO |
| [RF-PM-005](tasks/RF-PM-005-ci-pipeline.md) | GitHub Actions 持续集成 | chore | 中 | 001 | TODO |
| [RF-PM-022](tasks/RF-PM-022-p01-order-intake-page.md) | P01-A 订单受理页接线（大旺＋Codex） | feat | 中 | 无 | 已合并（PR #35）· 事后审查 CHANGES_REQUESTED，缺口转 028 |
| [RF-PM-023](tasks/RF-PM-023-p01-quote-page.md) | P01-B 报价生成、明细与客户确认（大旺＋Codex） | feat | 中 | 022 | 已合并（PR #37）· 事后审查 CHANGES_REQUESTED，缺口转 028 |
| [RF-PM-024](tasks/RF-PM-024-p01-pricing-policy-page.md) | P01-C 费率策略审核与发布页（大旺＋Codex） | feat | 中 | 无 | 已合并（PR #36）· 事后审查 CHANGES_REQUESTED，缺口转 028 |
| [RF-PM-025](tasks/RF-PM-025-p01-requote-consistency.md) | P01-D 改址／改时重核价与跨端金额一致，仅固定费（项目负责人＋Codex） | feat | 中 | 023 | IN_PROGRESS（PR #44）· 2026-10-27 收窄范围 |
| RF-PM-026 | 仓库版本计划同步（PR #33，合并时沿用了 RF-PM-022 标题，此处补登正式编号） | docs | 低 | 无 | 已合并 |
| RF-PM-027 | `main` 同步回 `develop`（PR #34） | chore | 低 | 无 | 已合并 |
| [RF-PM-028](tasks/RF-PM-028-p01-acceptance-gaps.md) | P01 页面验收缺口补齐（大旺＋Codex） | fix | 中 | 022–024 | 已合并（PR #45）· 审查 CHANGES_REQUESTED（证据不全），转 028-R1 与 QA-02 |
| [RF-PM-028-R1](tasks/RF-PM-028-R1-unit-tests.md) | P01 页面单元测试补齐（大旺＋Codex） | test | 低 | 028 | TODO |
| [RF-PM-032](tasks/RF-PM-032-distance-pricing-and-change-requote.md) | 服务端需求：距离计价与仓库／货物／服务类型变更重核价（项目负责人＋Codex） | feat | 高 | 025；开工前决策 | 待决策（不进 v0.3.0） |
| [RF-QA-02](tasks/RF-QA-02-p01-acceptance.md) | P01 独立浏览器验收，含 P01 浏览器脚本实跑与固定费等价场景（项目负责人） | test | 低 | 025、028、028-R1 | TODO |

2026-10-27 需求会后的完整拆解（含不经 Codex 的决策落盘任务 RF-DEC-01–06 与执行人）见 [需求会后任务拆解](../../PRD/docs/tasks/post-meeting-task-breakdown-v0.1.md)。上表 RF-PM-000–005 的状态未随实际合并更新，以 GitHub PR 为准。

Claude 自留：PRD V1.4 与实现方向差异的决策备忘（收款模式、钱包/分成/提现、Telegram/iOS 端、库存归属），供人类负责人拍板后再派发 PRD V1.5 同步任务。


## 分支与版本

自 2026-10-26 16:07 起，小改动不再逐个合进 `main`：

- 日常任务卡从最新 `origin/develop` 开分支，PR 目标为 `develop`。
- 合进 `develop` 前须同时满足看板 `APPROVED` 与当前 head 的 CI 三项全部 completed/success（2026-10-27 PR #35–#37 未经审查即合并，已事后补审，缺口统一进 RF-PM-028；此后仍按本条执行）；普通任务可由 Codex 普通 merge，不 squash、不 rebase、不强推。标注“需人类批准”的高风险任务仍须负责人批准。
- 大版本完成后由 Claude 发布 `develop → main` 版本发布 PR；需要 CI 全绿、Claude 版本评审 APPROVED、负责人在 GitHub 点 Approve 后由负责人合并，并打 `vX.Y.0` 标签。
- `main` 规则集要求三项必需检查、分支与 main 同步（strict）及 1 个审批；`develop` 规则集只要求三项必需检查，不要求审批。

## 版本计划

| 版本 | 范围 | 状态 |
| --- | --- | --- |
| v0.1.0 | 截至 main `6cf5f0c` 的基线、CI、迁移修复、费用页设计与真实接线 | 已发布，标签 v0.1.0 → `6cf5f0c` |
| v0.2.0 | RF-PM-012–016、PR #22、RF-PM-019（PR #23） | 已发布到 main（PR #24 → `beca3b1`），标签 v0.2.0 → `beca3b1` |
| v0.3.0 | RF-PM-018 浏览器验收遗留项、RF-PM-020、RF-PM-021（PR #26）、RF-PM-026 仓库版本计划同步（PR #33）、RF-PM-027 `main` 同步回 `develop`（PR #34）；P01 订单与报价页面：受理、报价表单与明细、策略审核与正式报价（RF-PM-022–025、RF-PM-028、RF-PM-028-R1、RF-QA-02） | 进行中（022–024、028 已合并；025、028-R1、QA-02 未完成）；已知限制见 [v0.3.0 发布说明草稿](releases/v0.3.0.md) |
| v0.4.0 | P02 付款准入页面：预付财务表单、核销撤销入口、公共入口改接数据库 | 待拆卡 |

大版本完成标准：版本内所有任务卡已合进 `develop`，`develop` CI 全绿，发布 PR 写明变更、PASS/FAIL/NOT_RUN 与已知限制，跨端验收按分工文档由另一方完成。发布说明底稿放在 `releases/vX.Y.0.md`，已知限制随决策即时登记。
