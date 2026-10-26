# 账号与权限验证 · 2026-10-24

规范：[ACCESS-CONTROL-CONTRACT.md](../../ACCESS-CONTROL-CONTRACT.md)。入口：运营中心 → 账号与权限。

- `tests.txt`：全部96项测试，其中10项覆盖账号、角色、操作范围、会话失效、幂等与最后管理员保护。
- `browser-results.json`：四组浏览器验证，新建自定义角色和账号、只读与受限账号实际业务预览、状态与审计、持久化与手机布局。
- `accounts-desktop.png`、`accounts-mobile.png`、`readonly-preview.png`、`access-audit.png`：合成数据截图。
- 源测试：`access-control.test.mjs`、`browser-access-control.js`。

只验证本地原型。未进行真实认证服务、数据库隔离、SSO/MFA、渗透测试或生产安全验收。浏览器仍持有全部演示数据；前端权限模拟不等于服务端授权。

静态审核 audit.json 保留既有三语预览页面的9项事件绑定检测局限；本次账号权限文件无新增报告。浏览器实际交互已验证，不声称全项目静态零告警。
