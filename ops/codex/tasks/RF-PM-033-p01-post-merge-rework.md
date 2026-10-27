# RF-PM-033 · P01 合并后返工：#40、#41、#43、#44 审查缺口

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | fix / 中（影响受理阻断定位、改单重核价展示与各角色提醒） |
| 版本 | v0.3.0 |
| 执行人 | 大旺＋Codex |
| 基线 SHA | `4a0dffe`（`develop`，PR #50 合并后）或更新的 `develop` |
| 分支 | `fix/RF-PM-033-p01-post-merge-rework`，PR 目标 `develop` |
| 依赖 | 无（#40、#41、#43、#44 均已合并） |
| 需人类批准 | 若需新增或修改迁移：是；否则否 |
| 状态 | TODO |

## 背景

2026-10-27 Claude 对 #40（RF-PM-024-R1）、#41（RF-PM-022-R1）、#43（RF-PM-029）、#44（RF-PM-025）发出 CHANGES_REQUESTED。约 35 分钟后四个 PR 被合并，审查后只加了 “SYNC: merge develop” 同步提交，审查意见一项未改。其中 #40、#41 合并时解决冲突的方式，覆盖了已合并的 #45（RF-PM-028）的部分页面功能和浏览器检查。

本卡把四份审查中仍未处理的缺口合成一次返工，不重开原 PR。下文每项都已在 `4a0dffe` 上核实仍然存在。四份审查原文：[#40](https://github.com/leishen8806/dr-routefit/pull/40)、[#41](https://github.com/leishen8806/dr-routefit/pull/41)、[#43](https://github.com/leishen8806/dr-routefit/pull/43)、[#44](https://github.com/leishen8806/dr-routefit/pull/44)。

## 要做

### A 订单受理：恢复 #45 被覆盖的部分（来自 #41）

1. **阻断列表恢复可点击跳转。** #45 的 `renderBlockers` 把有对应字段的阻断项渲染成按钮（`data-field`），点击后聚焦字段。现在 `showIntakeCheck`（`prototype/orders.mjs:94`）只输出纯文本列表，不能跳转。按 #45（提交 `a2b7128`）的行为恢复；没有对应字段的阻断项（如 `/coverage`）仍只在列表中显示。
2. **删除未使用的重复函数。** `prototype/order-intake-view.mjs` 里的 `blockerFieldPath`、`normalizePoint` 页面没有调用，只有测试在用；`blockerFieldPath` 还会把 `/pickup/point` 映射到不存在的字段 `pickup.point`。删除这两个函数及其测试。阻断映射统一用 `intakeFieldForPath`，坐标沿用统一用 `retainedPoint`。`intakeInputFromValues` 保留。
3. **受理浏览器脚本恢复 #45 的断言**（`prototype/browser-order-intake-acceptance.mjs`）：
   - 区域外阻断：断言 `delivery.lng` 带 `aria-invalid="true"`，点击 `#intake-check [data-field="delivery.lng"]` 后该字段获得焦点；截图名用 `00-outside-area-blocker.png`（RF-QA-02 第 7 步按此名核对）。
   - 现在的检查名 “outside area blocks intake and focuses field” 并没有断言焦点：要么补断言，要么改名。
   - 退回草稿：恢复“地址框可编辑”断言，不能只看面板可见。
   - 删除第 21 行的固定等待 `waitForTimeout(500)`，改为等待具体元素或状态。
   - 输出 JSON 的 `task` 改回 `RF-PM-022`，`screenshots` 列表与实际文件一致。

### B 费率策略：恢复 #45 被覆盖的检查（来自 #40）

4. **策略浏览器脚本补回四项页面检查**（`prototype/browser-policy-approval-acceptance.mjs`）。#40 合并后只剩 5 项检查，#45 的这四项丢了：本人不能复核（按钮禁用）、复核说明为空不发请求、复核人不能发布（按钮禁用）、发布说明为空不发请求。补回这四项，同时保留 #40 新增的两项服务端 403 检查（`same principal review rejected`、`same reviewer publish rejected`）。完成后共 9 项。

### C 改址／改时重核价（来自 #44，即 [RF-PM-025](RF-PM-025-p01-requote-consistency.md) 第 1–5 步）

#44 只做了第 3 步的一部分（候选报价块和 1 个单元测试）。范围仍按 2026-10-27 收窄后的 RF-PM-025：只做地址／时间变更＋固定费。

5. **核实清单（RF-PM-025 第 1 步）。** 在 PR 描述里逐条写“已满足（测试名）”或“缺口”，共三条：
   - 未确认报价在订单修改后被替代；
   - 已确认报价普通重报被拒，只能经服务申请生成候选；
   - 候选报价不改写原报价、原收款、核销、付款准入。
6. **已确认报价普通重报被拒，补独立的集成测试。** 现有覆盖只是 `services/routefit/tests/quotes.integration.mjs:88` 在别的测试里顺带断言了一句 409。新增一个独立命名的测试，断言：
   - 状态码和错误码；
   - 原报价的 state、金额和 `quoteId` 都不变。
7. **候选状态按 state 显示。** `prototype/quote-view.mjs:4` 目前只要不是 `confirmed` 就显示“等待客户确认”，候选已过期或被替代时也这么写。改为：
   - `issued` 显示“等待客户确认”；
   - `expired`、`superseded` 显示“不可确认”，并列出 `unusableReasons`；
   - `confirmed` 显示“客户已确认候选报价”。

   每种 state 各补一个单元测试。
8. **跨端一致（RF-PM-025 第 4 步）。** 同一订单在运营端、客户查询、司机任务三处显示的总应收和保费一致，补测试。
9. **固定费边界（RF-PM-025 第 5 步）。** 以下每个场景各有测试：
   - 空费率（策略没有启用的费目）；
   - 超大金额；
   - 过期报价；
   - 改址后旧报价失效；
   - 改时后旧报价失效；
   - 同一确认请求重放不重复生效；
   - 候选报价被拒或过期后，原报价不变。

### D 角色提醒（来自 #43）

10. **运营看全部提醒。** `filterAlertsByRole`（`prototype/dispatch-ui.mjs:33`）让 `ops` 只看负责人含“运营”的提醒，但 `dispatchAlerts` 产生的负责人只有“调度”“财务”“调度 / 司机”“调度 / 仓库”，所以运营中心几乎为空。改为运营看全部提醒，补 `ops` 的单元测试。
11. **司机提醒恢复到 #43 之前的范围。** 司机端看本人订单的全部提醒，包括“司机上报待处理”；仍经 `driverAccess` 过滤，只看本人订单。映射表之外的角色也保持 #43 之前的行为，不能因为缺映射就返回空列表。两条都补单元测试。
12. **角色提醒浏览器脚本按约定重写。** 涉及 `prototype/rf029-browser.mjs` 和已提交的截图：
    - 改名为 `prototype/browser-role-notices-acceptance.mjs`。
    - 端口和证据目录按其他验收脚本的约定：`ROUTEFIT_ALLOWED_ORIGIN`、`ROUTEFIT_EVIDENCE_DIRECTORY`。
    - 断言各角色的提醒数量，以及 350px 下“更多”菜单能打开、能切换；保留“无横向溢出”断言。
    - 输出 `checks` 与 `allPass` 的 JSON。
    - 从仓库删除 `prototype/screenshots/rf029/` 下已提交的 8 张截图；证据不进仓库。

## 不做

- 距离计价，以及仓库、货物、服务类型变更后的重核价（转 [RF-PM-032](RF-PM-032-distance-pricing-and-change-requote.md)）。
- 策略列表接口：契约里没有这个接口，维持按 ID 读取。#40 描述中“策略列表接口等待 RF-PM-028”的说法不准确，以此为准。
- 不改 #42（RF-PM-031）的样式，不碰 #49（RF-PM-030）的费用草稿区。
- 不跑 P01 三个浏览器脚本的正式验收：实跑并入 [RF-QA-02](RF-QA-02-p01-acceptance.md) 第 7 步。

## 验收

- A–D 共 12 项各有对应改动；第 2、6–11 项有单元测试或集成测试，CI 的 `prototype`、`service-unit`、`service-integration` 能跑到。
- 受理脚本和策略脚本的断言清单与第 3、4 项一致：PR 描述列出每个脚本的全部检查名。
- 角色提醒脚本（第 12 项）不依赖 PostgreSQL，须在本 PR 实际运行，附输出 JSON。
- P01 受理、策略两个脚本：本机有 PostgreSQL 就运行并附输出；没有就记 NOT_RUN，写明原因。
- CI 三项通过。

## 交付证据

PR 描述须包括以下内容：

- 第 5 项的核实清单；
- 按 A–D 编号逐项写 PASS／FAIL／NOT_RUN（NOT_RUN 写原因）；
- “发现但未处理”。

提交信息以 `RF-PM-033` 开头。合并前须看板 APPROVED：PR 收到 CHANGES_REQUESTED 时，改完并再次审查通过后才能合并。

## 审查记录

（Claude 填写）
