# RF-PM-042 · local-browser 测试 Windows 根目录路径修复

状态：已合并（PR #72 → `5db5849`，2026-10-29 14:15）

编号说明：RF-PM-041 已用于 v0.3.0 发布说明与发布 PR（#64），本卡改用 042。

## 背景

`services/routefit/tests/local-browser.test.mjs` 使用 URL `.pathname` 取文件系统路径，在 Windows 上会产生 `/C:/...`，导致路径拼接错误和本地浏览器测试 404。

## 改动

- 使用 `fileURLToPath` 转换 `import.meta.url` 路径。
- 同步修复 `sessionsFile` 及 `prototype/select-style-regression.mjs` 中同类 URL 路径用法。
- 不修改产品代码和 CI 工作流。

## 验证

- `services/routefit` 与 `prototype` 搜查无其他 `import.meta.url).pathname` 用法（保留历史 verification 快照不改）。
- macOS 本机 `npm test`：PASS，128/128。
- Windows 本机 `npm test`：PR 提交时 NOT_RUN（无 Windows 本机环境），审查时补跑 PASS，见审查记录。
- CI 五项：SUCCESS。

## 审查记录

### 2026-10-29 14:02 · APPROVED（PR #72 head `c2a1314`；负责人在 GitHub 批准）

- Windows 实测：Windows 11 Pro 10.0.22631、Node v25.9.0，`c2a1314` 独立工作区 `services/routefit` 下 `npm ci` 后 `npm test`：128/128 PASS。修复前同机 develop `e083202` 为 126/128（两项 404）。
- `root`、`sessionsFile` 改用 `fileURLToPath`，与 `main.mjs` 和集成测试一致；未改产品代码和 CI。
- 遗留（不在本卡范围）：`prototype/select-style-regression.mjs` 以 `file://${root}/${name}` 拼地址，在 Windows 上仍不是合法文件地址，以后改用 `pathToFileURL`。

合并：14:15 由大旺按 `MERGE-20261029-1400` 合并，合并 head 即批准的 `c2a1314`，合并内容与重新合并一致，develop CI 通过。
