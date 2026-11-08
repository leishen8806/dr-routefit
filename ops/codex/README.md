# DR RouteFit · Claude → Codex 任务通道

Claude 负责调研、规划、任务拆分、审查与评审；Codex（【Dr.RouteFit 项目开发】）负责按任务卡实现、测试、提交。人类集成负责人批准合并与部署。

## 工作流

派单与执行细则见 [DISPATCH.md](DISPATCH.md)：任务以 GitHub Issues 为准，只执行负责人创建并指派的 issue。

1. Claude 在 `ops/codex/tasks/` 发布任务卡，并在下方看板登记。
2. Codex 领取：把卡片状态改为 `IN_PROGRESS`，按卡片里的“基线 SHA”开分支。
3. Codex 完成：推送独立分支、开 PR，PR 描述按卡片“交付证据”逐项填写；卡片状态改为 `IN_REVIEW`。
4. Claude 审查固定 SHA 与限定 diff，结论写回卡片“审查记录”：`APPROVED` 或 `CHANGES_REQUESTED`。
5. 人类集成负责人批准合并；合并与部署是两次独立授权。

## 硬规则（摘自 PRD 附录 D 与开发标准）

- 一个批次一个分支、一个 PR。同一模块、同一风险等级、同一套验收步骤的卡可以合并成一个批次（一个 issue）；涉及身份认证、资金与 KESS、数据库迁移、删除数据的高风险卡单独成批，不与其他卡合并。一个 PR 只覆盖一个验收场景，代码改动控制在约 500 行以内；PR 描述按卡逐项写 PASS／FAIL／NOT_RUN。分支名 `<类型>/<任务编号>-<简述>`，提交信息以任务编号开头。
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
| [RF-PM-025](tasks/RF-PM-025-p01-requote-consistency.md) | P01-D 改址／改时重核价与跨端金额一致，仅固定费（项目负责人＋Codex） | feat | 中 | 023 | 已合并（PR #44）· 审查 CHANGES_REQUESTED 未处理即合并，缺口转 033 |
| RF-PM-026 | 仓库版本计划同步（PR #33，合并时沿用了 RF-PM-022 标题，此处补登正式编号） | docs | 低 | 无 | 已合并 |
| RF-PM-027 | `main` 同步回 `develop`（PR #34） | chore | 低 | 无 | 已合并 |
| [RF-PM-028](tasks/RF-PM-028-p01-acceptance-gaps.md) | P01 页面验收缺口补齐（大旺＋Codex） | fix | 中 | 022–024 | 已合并（PR #45）· 审查 CHANGES_REQUESTED（证据不全），转 028-R1 与 QA-02 |
| [RF-PM-028-R1](tasks/RF-PM-028-R1-unit-tests.md) | P01 页面单元测试补齐（大旺＋Codex） | test | 低 | 028 | 已合并（PR #48、#50）· 未经审查，待补审 |
| RF-PM-022-R1、023-R1、024-R1、029、031 | 未建卡即提交的 PR：受理校验（#41）、报价明细（#39）、策略快照（#40）、角色提醒与移动端顶栏（#43）、下拉箭头样式（#42） | — | — | — | 已合并 · #40、#41、#43 审查 CHANGES_REQUESTED 未处理即合并，缺口转 033；#42 APPROVED；#39 未审查 |
| [RF-PM-033](tasks/RF-PM-033-p01-post-merge-rework.md) | P01 合并后返工：#40、#41、#43、#44 审查缺口（大旺＋Codex） | fix | 中 | 无 | 已合并（PR #54）· 审查 CHANGES_REQUESTED 未改即合并，遗留 4 项由 033-R1（#69）解决 |
| [RF-PM-033-R1](tasks/RF-PM-033-R1-acceptance-checks.md) | P01 验收脚本与报价确认不变量补强（大旺＋Codex） | test+fix | 中 | 033 | 已合并（PR #69 → `e083202`）· 审查 APPROVED（`604815c`） |
| RF-PM-041 | v0.3.0 发布说明与发布 PR（Claude） | docs | 低 | — | 发布说明初稿已合并（PR #64，未经审查），修订见 #70；发布 PR 待“发布前必须解决”关闭（未建卡，编号已占用） |
| [RF-PM-042](tasks/RF-PM-042-test-windows-path.md) | local-browser 测试 Windows 根目录路径修复 | test | 低 | 无 | 已合并（PR #72 → `5db5849`）· 审查 APPROVED（`c2a1314`，Windows 实测 128/128） |
| [RF-PM-043](tasks/RF-PM-043-quote-guard-flake.md) | 报价脚本未发布策略守卫间歇性超时（根因：固定窗口限流） | fix | 中 | 无 | 已合并（PR #75 → `faa6a2c`）· 审查 APPROVED（`bee9c87`）；待负责人报价复验 |
| RF-PM-044 | 审查遗留小项：Windows 文件地址、客户端导航检查、幂等头名统一、R4/R5 小建议；11-03 追加：R5 证据目录两条单测在 Windows 上跳过并说明、部署模板 `<NODE24_PATH>` 占位符渲染校验、无会话文件时 `trial:start` 的行为（大旺＋Codex） | test+fix | 低 | 无 | TODO（v0.3.1） |
| [RF-PM-046](tasks/RF-PM-046-ops-address-change.md) | 运营代登记改址申请与候选报价关联回读（RF-QA-02 第 4 步缺口；大旺＋Codex，需人类批准） | fix | 高 | 025、038-R6 | 已合并（PR #85 → `86846be`，夹具 #86 → `1db5f73`）· 审查 APPROVED（`fd75645`）；RF-QA-02 第 4 步复验 PASS |
| [RF-PM-047](tasks/RF-PM-047-staff-customer-access.md) | 新增员工的客户访问授权与增量客户导入路径（11-03 部署缺口；大旺＋Codex，需人类批准） | fix | 中 | 038-R6 | 已合并（PR #94 → `e40fc3d`，2026-11-04）· 审查 APPROVED（`901c680`）；非阻塞跟进：导入授权依赖会话文件的说明、错误提示去掉 synthetic；11-04 本机升级演练（v0.3.0 → develop）FAIL：旧会话无 `authType`，重跑 `trial:staff` 重复建员工，修复见 RF-PM-047-R1 |
| [RF-PM-047-R1](tasks/RF-PM-047-R1-legacy-staff-compat.md) | 新员工命令兼容 v0.3.0 创建的员工数据（11-04 升级演练 FAIL：重跑 `trial:staff` 重复建员工；大旺＋Codex，需人类批准） | fix | 高 | 047 | TODO（v0.3.1，**部署门禁**） |
| [RF-PM-048](tasks/RF-PM-048-policy-picker-clarity.md) | 报价页策略选择显示依据，防止选错策略（列表接口新增只读字段；大旺＋Codex，需人类批准） | fix | 中 | 037、043 | 已合并（PR #93 → `0aee3a9`，2026-11-04）· 审查 APPROVED（`0477be4`）；11-04 本机真实链路浏览器验收：七个场景六个 PASS，到期标灰为瞬时状态未观察到（自动重读已移除过期项，卡片取"或"），判定 PASS |
| [RF-PM-051](tasks/RF-PM-051-init-scram-verifier.md) | `trial:init` 建角色改用 SCRAM 校验值，不向 PostgreSQL 发送明文口令（从 RF-PM-044 拆出；大旺＋Codex，需人类批准） | fix | 中 | 038-R4 | TODO（v0.3.x，不阻塞 v0.3.1；#95 合并后再同步） |
| [RF-PM-055](tasks/RF-PM-055-formal-auth-design.md) | 正式登录与会话设计：员工网页、司机 App、Telegram Mini App（苏晨＋Codex，需人类批准） | design | 高 | OPS-01、现有主体与授权模型 | IN_REVIEW（设计草稿；未写实现） |
| [RF-PM-056](tasks/RF-PM-056-driver-app-skeleton.md) | 司机 App 技术选型与 React Native（Expo）工程骨架（苏晨＋Codex，需人类批准） | feat | 中 | RF-PM-055 设计 | IN_REVIEW（草稿 PR） |
| [RF-PM-057](tasks/RF-PM-057-driver-app-task-actions.md) | 司机 App 任务查看与接单／拒单（苏晨＋Codex，需人类批准） | feat | 中 | RF-PM-056 | IN_PROGRESS |
| [RF-WEB-01](tasks/RF-WEB-01-website-foundation.md) | 官网批次 1：站点框架、三语切换、首页（苏晨＋Codex，需人类批准） | feat | 低 | 无 | DONE（#129 已合并；未部署） |
| [RF-PM-062](tasks/RF-PM-062-one-codebase.md) | 一套代码覆盖司机 App、Telegram Mini App 和 H5（批次 1：客户端网页骨架；苏晨＋Codex，需人类批准） | feat+refactor | 中 | 无 | 批次 1 DONE（#131 已合并）；批次 2 待 #127、#128 合并 |
| [RF-PM-060](tasks/RF-PM-060-driver-read-projections.md) | 司机端只读投影补齐：待签交接、出发就绪、开发夹具设备与当班（苏晨＋Codex，需人类批准） | feat | 中 | 无 | IN_REVIEW（#128） |
| [RF-PM-049](tasks/RF-PM-049-policy-retire.md) | 策略撤销／替代机制（先设计，设计批准后才实现） | feat | 高 | 048 | TODO（v0.4.0） |
| [RF-PM-050](tasks/RF-PM-050-test-data-class.md) | 测试数据分类与隔离（先设计） | feat | 中 | 049 的设计 | TODO（v0.4.0） |
| RF-PM-030、034、036 | 未建卡即提交的 PR：费用草稿选择区与测试库隔离（#49）、已发布策略列表接口（#55）、报价策略防护与费用页 S1 标注（#52） | — | — | — | 审查中 |
| [RF-PM-037](tasks/RF-PM-037-p01-trial-readiness.md) | P01 试运营就绪：订单页 S1 与重放回归、报价策略选择（大旺＋Codex） | fix | 中 | 030、033、034、036 | TODO |
| [RF-PM-038](tasks/RF-PM-038-single-machine-trial-tooling.md) | 受控试运营工具：身份续期、员工身份、主数据、备份与 VPS 登录辅助（大旺＋Codex，需人类批准） | chore | 高 | 无 | TODO（10-28 补第 7–9 项） |
| [RF-PM-038-R3](tasks/RF-PM-038-R3-db-access-scope.md) | 试运营数据库访问边界收口：运行/备份角色 pg_hba、授权范围测试、导入与员工的企业来源（大旺＋Codex，需人类批准） | fix | 高 | RF-PM-038-R2（#68） | 已合并（PR #71 → `4131325`）· 审查 APPROVED（`3dc90e2`）；pg_hba 连接核验待 RF-OPS-01 第 8 步 |
| [RF-PM-038-R4](tasks/RF-PM-038-R4-init-atomic.md) | trial:init 输出预检、原子回滚与企业配置恢复（大旺＋Codex，需人类批准） | fix | 高 | RF-PM-038-R3（#71） | 已合并（PR #74 → `9f5b867`）· claude-bridge 审查 APPROVED（`fce8935`），leishen8806 批准；负责人侧 Claude 事后审查无阻断 |
| [RF-PM-038-R5](tasks/RF-PM-038-R5-deploy-gaps.md) | 试运营部署链路：证据目录、不可写启动报错、Node 24 服务器命令表（大旺＋Codex，需人类批准） | fix | 高 | RF-PM-038-R4（#74） | 已合并（PR #76 → `fc7121e`）· 审查 APPROVED（`6c0527f`）；10-30 VPS 从干净状态验证 PASS |
| [RF-PM-038-R6](tasks/RF-PM-038-R6-start-staff-restore.md) | 试运营启动备份硬失败、员工角色严格校验、恢复失败清理（大旺＋Codex，需人类批准） | fix | 高 | RF-PM-038-R5（#76） | 已合并（PR #81 → `86a4b96`）· 审查 APPROVED（`524e128`） |
| [RF-OPS-01](tasks/RF-OPS-01-vps-trial-server.md) | 试运营 VPS 准备与加固：只允许 SSH 访问（苏晨＋Codex，需人类批准） | ops | 高 | 第 7 步依赖 038；第 8 步依赖 v0.3.0 标签 | 第 1–7 步通过（10-30 R5 验证 PASS）；第 8 步待 11-01，发布不再依赖第 8 步 |
| [RF-OPS-02](tasks/RF-OPS-02-daily-backup.md) | 每日自动备份定时器、备份状态检查、站外拷贝与恢复演练规程（11-04 核查：服务器无固定每日备份；大旺＋Codex 出模板，负责人 Codex 安装，需人类批准） | ops | 中 | 038-R6、OPS-01 | 已合并（PR #109 → `b45d7be`，2026-11-04）· 审查 APPROVED（`e0ad551`）；服务器安装与手动触发待做 |
| [RF-PM-032](tasks/RF-PM-032-distance-pricing-and-change-requote.md) | 服务端需求：距离计价与仓库／货物／服务类型变更重核价（项目负责人＋Codex） | feat | 高 | 025；开工前决策 | 待决策（不进 v0.3.0） |
| [RF-QA-02](tasks/RF-QA-02-p01-acceptance.md) | P01 独立浏览器验收，含 P01 浏览器脚本实跑与固定费等价场景（项目负责人） | test | 低 | 025、028、028-R1、030、033、034、036、037 | 已完成：第 1–5、7、8 步 PASS，第 6 步 NOT_RUN（RF-DEC-02 未签批） |
| [RF-PM-052](tasks/RF-PM-052-open-check-script.md) | 部署开工检查脚本入库并参数化：自动取最新备份、显式声明 SSH 连接依赖、期望值参数化（11-07 部署后续；大旺＋Codex，需人类批准） | chore+test | 中 | 无 | TODO（v0.3.2） |
| [RF-PM-053](tasks/RF-PM-053-legacy-customer-access.md) | 非客户范围员工的遗留客户授权收口（先设计，批准后实现；大旺＋Codex，需人类批准） | fix | 高 | 047、047-R1 | TODO（v0.3.2，先设计） |
| [RF-PM-054](tasks/RF-PM-054-remote-exec-standard.md) | 运维文档补充远端执行标准写法（PowerShell → ssh → sudo；大旺＋Codex） | docs | 低 | 无 | TODO（v0.3.2） |
| [RF-OPS-03](tasks/RF-OPS-03-import-list-missing.md) | 试运营服务器 11-03 正式客户导入名单缺失调查（只读；负责人＋Claude） | ops | 中 | 无 | TODO |

2026-10-28 项目负责人把 7 天目标定为受控试运营，方案见 [P01 受控试运营方案](../trial/p01-controlled-trial-plan.md)。

2026-10-27 需求会后的完整拆解（含不经 Codex 的决策落盘任务 RF-DEC-01–06 与执行人）见 [需求会后任务拆解](../../PRD/docs/tasks/post-meeting-task-breakdown-v0.1.md)。上表 RF-PM-000–005 的状态未随实际合并更新，以 GitHub PR 为准。

Claude 自留：PRD V1.4 与实现方向差异的决策备忘（收款模式、钱包/分成/提现、Telegram/iOS 端、库存归属），供人类负责人拍板后再派发 PRD V1.5 同步任务。


## 分支与版本

自 2026-10-26 16:07 起，小改动不再逐个合进 `main`：

- 日常任务卡从最新 `origin/develop` 开分支，PR 目标为 `develop`。
- 合进 `develop` 前须同时满足看板 `APPROVED` 与当前 head 的 CI 八项（`prototype`、`service-integration`、`service-unit`、`trial-tooling-macos`、`trial-tooling-windows`、`driver-app`、`website`、`customer-app`）全部 completed/success（2026-10-27 PR #35–#37 未经审查即合并，已事后补审，缺口统一进 RF-PM-028；同日 #40、#41、#43、#44 在审查 CHANGES_REQUESTED 后未改即合并，缺口进 RF-PM-033；此后仍按本条执行，CHANGES_REQUESTED 须改完并重新审查通过才能合并）；普通任务可由 Codex 普通 merge，不 squash、不 rebase、不强推。标注“需人类批准”的高风险任务仍须负责人批准。
- 大版本完成后由 Claude 发布 `develop → main` 版本发布 PR；需要 CI 全绿、Claude 版本评审 APPROVED、负责人在 GitHub 点 Approve 后由负责人合并，并打 `vX.Y.0` 标签。
- `main` 规则集要求三项必需检查、分支与 main 同步（strict）及 1 个审批；`develop` 规则集要求三项必需检查和 1 个非作者审批，并自 2026-10-30 起开启“推送新提交后作废已有批准”。高风险任务合并前，须负责人侧 Claude 审查通过，且由作者以外的人批准最终 head；有未解决的 CHANGES_REQUESTED 时不得发合并指令。

整体计划与目标方案（阶段划分、路线图、质量门禁、风险）见 [roadmap.md](roadmap.md)（草案，待负责人确认）。

## 版本计划

| 版本 | 范围 | 状态 |
| --- | --- | --- |
| v0.1.0 | 截至 main `6cf5f0c` 的基线、CI、迁移修复、费用页设计与真实接线 | 已发布，标签 v0.1.0 → `6cf5f0c` |
| v0.2.0 | RF-PM-012–016、PR #22、RF-PM-019（PR #23） | 已发布到 main（PR #24 → `beca3b1`），标签 v0.2.0 → `beca3b1` |
| v0.3.0 | RF-PM-018 浏览器验收遗留项、RF-PM-020、RF-PM-021（PR #26）、RF-PM-026 仓库版本计划同步（PR #33）、RF-PM-027 `main` 同步回 `develop`（PR #34）；P01 订单与报价页面：受理、报价表单与明细、策略审核与正式报价（RF-PM-022–025、RF-PM-028、RF-PM-028-R1、RF-PM-033、RF-PM-033-R1、RF-QA-02）；受控试运营（RF-PM-037–040、038-R1/R2/R3/R4/R5、RF-OPS-01）；测试修复 RF-PM-042、RF-PM-043；未建卡即合并的 RF-PM-022-R1、023-R1、024-R1、029、031 | 已发布（发布 PR #87 于 2026-11-02 合并，`main` 为 `dde7e72`，标签 `v0.3.0`）；正式部署（RF-OPS-01 第 8 步）尚未执行；标签内的发布说明是旧稿，以 develop 上 #88 合并后的版本为准；已知限制见 [v0.3.0 发布说明](releases/v0.3.0.md) |
| v0.3.1 | 试运营加固补丁：RF-PM-044（#95）、RF-PM-047（#94）、RF-PM-047-R1（#108）、RF-PM-048（#93）均已于 11-04 合并到 `develop`；RF-OPS-02（#109）11-04 合并并纳入本版本（服务器安装待做）；RF-PM-051（#102）不含在本版本 | 待发布（说明见 [v0.3.1 发布说明](releases/v0.3.1.md)）；**部署前须本机"v0.3.0 → v0.3.1 标签"升级演练全部 PASS** |
| v0.4.0 | P02 付款准入页面：预付财务表单、核销撤销入口、公共入口改接数据库；RF-PM-032 距离计价；RF-PM-049 策略撤销／替代设计；RF-PM-050 测试数据分类设计 | 待拆卡 |

大版本完成标准：版本内所有任务卡已合进 `develop`，`develop` CI 全绿，发布 PR 写明变更、PASS/FAIL/NOT_RUN 与已知限制，跨端验收按分工文档由另一方完成。发布说明底稿放在 `releases/vX.Y.0.md`，已知限制随决策即时登记。
