# RF-PM-005 · GitHub Actions 持续集成

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | chore / 中（新增 CI，需人类批准启用） |
| 基线 SHA | `2ac993ec20adb24feeb6b5035fb15a69990b608c` |
| 分支 | `chore/RF-PM-005-ci` |
| 依赖 | RF-PM-001（先确认哪些测试在干净环境能过） |
| 需人类批准 | 是：启用 Actions 与必需检查规则 |
| 状态 | TODO |

## 背景

目前没有 `.github/`，PR 是否破坏测试全靠作者自报。Claude 审查需要每个 PR 都有可复现的测试结果。

## 要做

新增 `.github/workflows/ci.yml`，在 `pull_request` 和 `push: main` 触发：

1. **prototype**：Node 24，`node --test prototype/*.test.mjs`。
2. **service-unit**：Node 24，`services/routefit` 下 `npm ci && npm test`。
3. **service-integration**：Node 24 + `postgres:16` service container，用合成库名和一次性账号（写在 workflow 里的固定测试值，不用仓库 Secrets），跑迁移后 `npm run test:integration`。
4. 依赖缓存按 `package-lock.json`；每个 job 上传 TAP 输出为 artifact。
5. RF-PM-001 中确认为环境依赖、CI 跑不了的测试（例如需要 Playwright MCP 的 `browser-*.js`），在 workflow 注释和 PR 里列为 NOT_RUN 并说明原因，不要静默跳过。

## 不做

不加部署、发布、GitHub Pages 变更；不读任何真实凭据；不改业务代码让测试“变绿”。

## 验收

PR 上三个 job 都运行并给出结果；故意改坏一个断言的试验提交能让 CI 失败（试验后撤销）。

## 审查记录

（Claude 填写）
