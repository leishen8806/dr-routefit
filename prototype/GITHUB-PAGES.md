# GitHub Pages Demo 发布记录

2026-10-24。已推送独立静态快照分支 `codex/demo-pages`，提交 `9245589c3f9ca0f71a377c217c69c066843ff9f2`，共 50 个文件。远端分支已核验。main 未改变，当前本地未提交的需求/原型工作保留。

当前仓库公开。当前 CLI 账号具备 push，不具备 admin/maintain；Pages 原先未开启。创建 Pages 请求返回 HTTP 404，因此不能声称已上线或线上验证通过。

## 管理员最后一步

1. 打开 https://github.com/leishen8806/dr-routefit/settings/pages 。
2. Build and deployment → Source：Deploy from a branch。
3. Branch：`codex/demo-pages`，Folder：`/ (root)`，保存。
4. 等待 GitHub 显示部署成功，再打开预期地址 https://leishen8806.github.io/dr-routefit/ 。此地址当前不是已验证的线上成果。

入口跳转至 `prototype/showcase.html`；工作台保留在 `prototype/index.html`。发布包仅含运行时 HTML/CSS/MJS、Logo SVG、入口、说明及 .nojekyll；不含 PRD、记录、测试或本地 HTTP 服务。数据为浏览器会话内合成数据，各访客不共享订单，没有真实认证/定位/银行/保险。真实 WMS HTTP 联调不由 Pages 托管。

## 更新方法

`node scripts/build-demo.mjs <一个尚不存在的输出目录>` 生成快照并验证相对模块/HTML 链接。只发布输出目录，禁止将整个仓库作为站点根目录推送。后续在现有发布分支上正常追加提交，不强制覆盖历史；源代码改变不会自动更新这个手工发布快照。

本次验证：运行依赖与相对链接检查、发布包常见密钥模式扫描、远端提交核验；业务浏览器验证沿用同一源文件的 `records/2026-10-24-closure-update/` 记录。Pages 开启后仍须验证在线资源路径和完整流程。

官方设置说明：https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
