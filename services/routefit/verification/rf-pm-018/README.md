# RF-PM-018 浏览器验收证据

本目录仅包含本机合成数据库和真实 Chromium 会话生成的脱敏截图；不含 Cookie、CSRF、ticket 或 HAR。

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
| `02-401-session-expired.png` | 会话失效，错误摘要获焦点且保存区域隐藏 | PASS |
| `03-403-readonly.png` | 只读角色写入被拒绝，错误摘要获焦点 | PASS |
| `04-404-cross-company.png` | 跨企业对象返回 NOT_FOUND，错误摘要获焦点 | PASS |
| `05-offline-result-unknown.png` | 保存响应中断，输入保留并显示原请求重试 | PASS |
