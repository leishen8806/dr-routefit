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

Claude 自留：PRD V1.4 与实现方向差异的决策备忘（收款模式、钱包/分成/提现、Telegram/iOS 端、库存归属），供人类负责人拍板后再派发 PRD V1.5 同步任务。


## 分支与版本

自 2026-10-26 16:07 起，小改动不再逐个合进 `main`：

- 日常任务卡从最新 `origin/develop` 开分支，PR 目标为 `develop`。
- 合进 `develop` 前须同时满足看板 `APPROVED` 与当前 head 的 CI 三项全部 completed/success；普通任务可由 Codex 普通 merge，不 squash、不 rebase、不强推。标注“需人类批准”的高风险任务仍须负责人批准。
- 大版本完成后由 Claude 发布 `develop → main` 版本发布 PR；需要 CI 全绿、Claude 版本评审 APPROVED、负责人在 GitHub 点 Approve 后由负责人合并，并打 `vX.Y.0` 标签。
- `main` 规则集要求三项必需检查、分支与 main 同步（strict）及 1 个审批；`develop` 规则集只要求三项必需检查，不要求审批。

## 版本计划

| 版本 | 范围 | 状态 |
| --- | --- | --- |
| v0.1.0 | 截至 main `6cf5f0c` 的基线、CI、迁移修复、费用页设计与真实接线 | 已在 main |
| v0.2.0 | RF-PM-012、RF-PM-013、RF-PM-014 费用页闭环与 RF-QA-01 独立验收 | 进行中 |
| v0.3.0 | P01 订单与报价页面：受理、报价表单与明细、策略审核与正式报价 | 待拆卡 |
| v0.4.0 | P02 付款准入页面：预付财务表单、核销撤销入口、公共入口改接数据库 | 待拆卡 |

大版本完成标准：版本内所有任务卡已合进 `develop`，`develop` CI 全绿，发布 PR 写明变更、PASS/FAIL/NOT_RUN 与已知限制，跨端验收按分工文档由另一方完成。
