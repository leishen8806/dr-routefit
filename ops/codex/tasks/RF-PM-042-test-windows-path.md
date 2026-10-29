# RF-PM-042 · local-browser 测试 Windows 根目录路径修复

状态：IN_REVIEW

## 背景

`services/routefit/tests/local-browser.test.mjs` 使用 URL `.pathname` 取文件系统路径，在 Windows 上会产生 `/C:/...`，导致路径拼接错误和本地浏览器测试 404。

## 改动

- 使用 `fileURLToPath` 转换 `import.meta.url` 路径。
- 同步修复 `sessionsFile` 及 `prototype/select-style-regression.mjs` 中同类 URL 路径用法。
- 不修改产品代码和 CI 工作流。

## 验证

- `services/routefit` 与 `prototype` 搜查无其他 `import.meta.url).pathname` 用法（保留历史 verification 快照不改）。
- macOS 本机 `npm test`：PASS，128/128。
- Windows 本机 `npm test`：NOT_RUN（无 Windows 本机环境）。
- CI 五项：待 PR 触发。
