# RF-PM-001 · Node 24 + PostgreSQL 16 全量测试基线报告

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | test / 低（只读代码，只新增一份报告） |
| 基线 SHA | `2ac993ec20adb24feeb6b5035fb15a69990b608c`（main，PR #1 合并） |
| 分支 | `test/RF-PM-001-baseline-report` |
| 目标 Gate | R0-B 证据 |
| 状态 | TODO |

## 背景

PR #1 把后端服务（`services/routefit`，63 个迁移）、54 份契约和原型依赖合进了 main。Claude 在云端沙箱只能用 Node 22，`npm ci` 因 npm 自身错误中断，服务端单测 73/77 通过，4 个失败（orders、policy、pricing、review-fixes）均为缺少 `ajv/dist/2020.js`，属于环境问题，尚未在正确环境验证。原型测试 65/65 通过。

## 要做

1. 在 Node 24 LTS、PostgreSQL 16+ 本机环境执行，记录 `node -v`、`npm -v`、`psql --version`、OS。
2. `services/routefit`：`npm ci`、`npm test`、按服务 README 配一次性合成测试库后跑 `npm run test:integration`，再跑 README 列出的全部 `smoke:*`。
3. 根目录：`node --test prototype/*.test.mjs`。
4. 启动服务，取 `/dev/openapi.json`，统计实际可调用的操作数，与 `contracts/endpoint-catalog.md` 的 `LOCAL_IMPLEMENTED_NOT_DEPLOYED` 数（235）对比，列出差异操作 ID。
5. 结果写入 `ops/codex/reports/RF-PM-001-baseline.md`。

## 不做

不改任何业务代码、契约或迁移。失败项只记录，不修复（另开卡）。

## 验收

- 每条命令一行：命令、退出码、tests/pass/fail/skip、耗时。
- 每个失败给出首条错误和初步归因（代码 / 环境 / 数据）。
- 第 4 步的数字和差异清单完整。
- 报告注明基线 SHA 与执行时间（Asia/Phnom_Penh）。

## 交付证据

PR 只含报告文件；PR 描述贴摘要表。

## 审查记录

（Claude 填写）
