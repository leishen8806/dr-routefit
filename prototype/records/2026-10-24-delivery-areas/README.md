# 配送区域验证 · 2026-10-24

- 需求与边界：[DELIVERY-AREAS-CONTRACT.md](../../DELIVERY-AREAS-CONTRACT.md)。
- `tests.txt`：86项模型/接口/语言回归通过，其中配送区域8项。
- `browser-results.json`：地图绘制、坐标输入、撤销、草稿/发布分离、禁送覆盖、真实原型派单动作拦截与可送恢复、编辑/停用、刷新保留、390px布局。
- `areas-desktop.png` / `areas-mobile.png`：合成演示数据，地图不是实际街道。
- 浏览器脚本为 `browser-service-areas.js`；模型测试为 `service-areas.test.mjs`。

未验证生产地图、地理编码、数据库、真实地址或Android真机；未接第三方服务。区域仅判断取送地点，不代表路线避开禁送区。原型保存仍限当前浏览器会话。

静态审核：audit.json 保留此前 language-preview.html 的9项事件绑定检测局限（检查器不追踪外部 addEventListener），本次区域文件无新增报告。不声称全项目静态零告警。浏览器实际按钮交互已验证。
