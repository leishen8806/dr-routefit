# KESS 用户文档与页面同步记录

2026-10-25 · 依据用户“尚未开通，先完成模拟流程和接入准备”及“同步文档和页面”。保留 v0.1，不改正式 PRD、RULE/AT、SQL 或 OpenAPI。本地 main 基础 HEAD 为 ba9a77ec78cd20a6bf72476e9c3410d7faa9a06e，工作区此前已有未提交差异；本轮未提交、推送或部署。

## 变化

- 客户/内部收款页、创建/查询弹窗和内部报表展示开户状态，模拟动作与模拟结果明确命名。
- 复用现有信息框、表单与原生 details，增加键盘可用的付款说明；无当前币种订单时禁用创建并指引加载样例。
- 客户显示等待财务核销；司机/仓库无 KESS 操作。资金模型、保险不分成、渠道未结算款不可付等约束未更改。
- [用户说明](../../KESS-USER-GUIDE.md)、设计契约、README、PRD 接入说明和记录索引同步；设计图内两张 KESS 图片为本轮浏览器截图。改前页面源在 before/，历史截图仍保存在 2026-10-24-kess-review/。

## 验证

| 项目 | 结果与证据 |
|---|---|
| 语法 | node --check prototype/finance-ui.mjs 通过 |
| 原型测试 | prototype 目录 node --test *.test.mjs，164/164通过；tests.txt |
| 严格静态审查 | 0 errors / 0 warnings；premium-audit.json |
| 浏览器 | browser-kess-status.js：空态、键盘、未知、重复拦截、错金额、离线/恢复、成功、刷新、角色隔离、390px与1440px、减少动效；browser-results.json |
| 外部请求 | 本轮浏览器外部请求 0；测试上下文只使用合成数据，没有改用户现有会话 |
| 设计图 | kess-customer-mobile.png、kess-finance-help.png、kess-report.png；设计索引全部图片加载通过 |
| 静态打包 | dist/kess-pages-20261025；相对运行依赖检查通过，无服务端适配器或凭据进入发布包 |

本轮没有真实 KESS、银行、身份登录或物理手机验证；页面仍是中文评审版，高棉文/英文全界面与母语审校待后续完成。真实支付门槛见 PRD/docs/kess-payment-integration-v0.1.md。用户手册不随静态包复制，但其操作要点已嵌入付款页，可在发布副本直接展开。
