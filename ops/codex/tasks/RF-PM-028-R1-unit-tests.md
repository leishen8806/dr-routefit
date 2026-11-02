# RF-PM-028-R1 · P01 页面单元测试补齐

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | test / 低 |
| 版本 | v0.3.0 |
| 执行人 | 大旺＋Codex |
| 基线 SHA | `eb06e2e`（`develop`，PR #45、#46 合并后）或更新的 `develop` |
| 分支 | `test/RF-PM-028-R1-p01-unit-tests`，PR 目标 `develop` |
| 依赖 | RF-PM-028（已合并） |
| 需人类批准 | 否 |
| 状态 | TODO |

## 背景

PR #45 补齐了 RF-PM-028 的页面缺口，但单元测试只补了 4 项（S1 不可选、阻断路径到字段映射、坐标清空、重放标记）。审查结论见 [RF-PM-028 审查记录](RF-PM-028-p01-acceptance-gaps.md#审查记录)。本卡只补单元测试；浏览器脚本实跑与固定费等价场景核对并入 [RF-QA-02](RF-QA-02-p01-acceptance.md)，不在本卡。

## 要做

页面逻辑目前写在 `orders.mjs`、`fee-api-ui.mjs` 中，直接依赖 DOM。先把下列判断抽成无 DOM 的纯函数，放进现有模块（`orders-ui-rules.mjs`、`quote-view.mjs`、`fee-api-model.mjs`），页面改为调用这些函数，行为不变；再为它们写 `node --test` 单元测试。

### 订单受理

1. **受理依据请求体**：给定取送两侧的渠道、reference、入口和每行货物来源，生成的请求体与 [订单受理接口](../../../contracts/order-intake-api.md) 一致；`clientItemId` 与货物行一一对应；不含登记人和登记时间。
2. **受理接口错误处理**：412 VERSION_CONFLICT 显示冲突提示，且不清空已填依据；422 INTAKE_BLOCKED 的 `error.fields` 逐条映射到字段，没有对应字段的（如 `/coverage`）只在阻断列表中显示。
3. **退回原因必填**：原因为空或只有空白时不发请求，并给出字段提示。

### 报价

4. **错误码映射**：412 VERSION_CONFLICT、409 INVALID_STATE／POLICY_NOT_PUBLISHED／QUOTE_NOT_USABLE、422 INTAKE_BLOCKED／POLICY_NOT_EFFECTIVE／SERVICE_NOT_SUPPORTED／FEE_NOT_ENABLED 都映射到可读提示；未知错误码有兜底文案。
5. **客户确认请求体**：联系人、方式、依据、确认时间（金边时间输入转 ISO，UTC+07）；任一项为空时不发请求，并指出缺哪一项。

### 费率策略

6. **策略接口错误提示**：412 VERSION_CONFLICT 与 403 INDEPENDENT_REVIEW_REQUIRED 映射到各自提示，不落入通用 403 文案。
7. **说明为空不发请求**：复核、发布说明为空或只有空白时不调用 `mutate`，并标记对应输入框。

已有覆盖不必重复：`order-client.test.mjs` 已测客户端层 412 不重试、不覆盖；`fee-api.test.mjs` 已测 `FeeClient` 的 412 与权限路由。本卡测的是页面层的映射与拦截。

## 不做

不改页面行为与文案（抽函数只是搬移）；不改服务端；不跑浏览器脚本；不处理超距行（转 [RF-PM-032](RF-PM-032-distance-pricing-and-change-requote.md)）。

## 验收

- 上述 7 项各有至少一个单元测试，CI 的 `prototype` 任务能跑到（`prototype/*.test.mjs`）。
- 抽函数前后页面行为一致：PR 描述列出被搬移的函数和调用点。
- CI 三项通过。

## 交付证据

PR 描述写明 PASS／FAIL／NOT_RUN 和“发现但未处理”。提交信息以 `RF-PM-028-R1` 开头。合并前须看板 APPROVED。

## 审查记录

（Claude 填写）
