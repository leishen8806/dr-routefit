# RF-PM-063 · 本机司机演示场景脚本，补跑 RF-PM-058 Android 模拟器链路

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | chore（开发工具）＋验收 / 低（只在本机开发库运行；不改业务规则） |
| 版本 | v0.7（司机 App 与地图） |
| 执行人 | 苏晨＋Codex |
| 基线 SHA | 最新 `develop`（须已含 #127 RF-PM-058） |
| 分支 | `chore/RF-PM-063-driver-dev-scenario`，PR 目标 `develop` |
| 依赖 | #127 合并 |
| 需人类批准 | 是：合并前须负责人侧 Claude 审查，并由作者以外的人批准最终 head |
| 状态 | IN_PROGRESS |

## 背景

RF-PM-058 的代码已审查通过，但 Android 模拟器完整链路没跑成：后端没有能一键造出“已接单、待签交接、可出发”状态的本机演示数据，拿集成测试拼装两次失败（集成测试里其他场景互相干扰，前置的策略和订单数据被跳过）。负责人决定先合并 #127，由本卡补一份可重复使用的演示场景脚本，再补跑模拟器链路。这份脚本后续 RF-PM-059（拍照与签收）和客户端也要用。

## 要做

1. **演示场景脚本** `services/routefit/scripts/driver-scenario.mjs`，`package.json` 增加 `scenario:driver`（`node --env-file=.local/dev.env scripts/driver-scenario.mjs`）：
   - 前提：本机已 `dev:bootstrap` 并 `start:dev`；脚本只连 `127.0.0.1`，发现目标不是本机地址就拒绝运行；
   - **只走现有业务接口**造数据（参考 `scripts/policy-smoke.mjs` 的现有链路：策略 → 订单 → 报价 → 付款准入 → 调度 → 装载复核 → 指派给夹具司机），不直接写业务表、不关闭触发器；
   - 参数 `--stage` 选择停在哪一步：`offered`（待接单）、`custody-pending`（已接单、仓库已签、等司机签）、`ready-to-depart`（司机已签、可出发）；默认 `custody-pending`；
   - 每次运行生成一套新的合成数据（名称带 `DEMO` 前缀），不改已有数据，可重复运行；
   - 输出：订单 ID、指派 ID、设备 ID、当班 ID、一个已上传完成的合成证据文件 ID；司机开发会话令牌和 CSRF 只写到 `services/routefit/.local/driver-scenario.json`（已被 git 忽略），终端里不打印令牌。
2. **测试：** 新增一个集成测试，在一次性 PostgreSQL 上依次跑三个 `--stage`，断言各自停在预期状态（指派状态、待签交接条数、出发就绪 `ready` 值）。
3. **补跑 RF-PM-058 Android 模拟器链路**（用本脚本造数据，不改司机 App 代码；发现 App 问题只记录，另行处理）：
   - `offered`：列表 → 详情 → 接单；
   - `custody-pending`：待签交接显示 → 签认 → 出发就绪变为 ready → 出发；
   - 离线：调试入口写合成到达事件 → 杀进程 → 重开仍在 → 补传 APPLIED；
   - 截图放仓库外 `E:\RouteFit-QA\evidence\RF-PM-063\`，不得含令牌。
4. **文档：** `services/routefit/README.md` 和 `apps/driver/README.md` 各加一段“本机演示场景”用法。

## 不做

- 不改业务接口、校验规则、迁移、`openapi.json`；
- 不改司机 App 代码（发现问题写进“发现但未处理”）；
- 不在试运营服务器或任何非本机数据库运行；
- 不把脚本接进试运营初始化。

## 验收

- CI 八项全绿；新增集成测试 PASS；
- 第 3 条三段链路 PASS，或逐项写 NOT_RUN／FAIL 原因；
- 仓库中没有令牌、CSRF、真实地址或真实客户资料；
- 本卡合并且第 3 条 PASS 后，在 #127 留言“RF-PM-058 模拟器链路已由 RF-PM-063 补齐”，看板把 RF-PM-058 标为 DONE；
- PR 描述按“要做”逐项写 PASS／FAIL／NOT_RUN。

## 审查记录

（待填）
