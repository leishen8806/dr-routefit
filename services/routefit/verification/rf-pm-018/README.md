# RF-PM-018 浏览器验收证据

本目录仅包含本机合成数据库和真实 Chromium 会话生成的脱敏截图；不含 Cookie、CSRF、ticket 或 HAR。

本轮重拍基于 `origin/develop` `5d4aaa6100a6d7ce2cb0afe7dc089891d8fd5a72`（2026-10-28）；六项断言全部 PASS。

## 复跑

在 `services/routefit` 启动本机开发服务后，从仓库根目录运行：

```sh
ROUTEFIT_SESSION_FILE="$PWD/services/routefit/.local/sessions.json" \
ROUTEFIT_EVIDENCE_DIRECTORY="$PWD/services/routefit/verification/rf-pm-018" \
node prototype/browser-fee-acceptance.mjs
```

脚本使用 `playwright-core` 驱动本机 Google Chrome（可用 `CHROME_BIN` 覆盖路径），每次创建新的合成费用草稿，不触碰业务代码或真实数据。

## 结果

| 文件 | 验收项 | 结果 |
| --- | --- | --- |
| `01-mobile-navigation.png` | 390px 手机视口，费用设置入口可见且可打开 | PASS |
| `02-mobile-fees-page.png` | 390px 费用页无横向滚动，保存按钮在视口内 | PASS |
| `03-401-session-expired.png` | 无会话，API `UNAUTHENTICATED`，错误摘要获焦点且保存区域隐藏 | PASS |
| `04-403-readonly.png` | 只读界面禁用保存，直接写入返回 `FORBIDDEN`，保存区域隐藏 | PASS |
| `05-404-cross-company.png` | 跨企业对象返回 `NOT_FOUND`，错误摘要获焦点且保存区域隐藏 | PASS |
| `06-offline-result-unknown.png` | 服务端已提交后切断响应；重试显示已保存，版本只从 v1 增至 v2 | PASS |
