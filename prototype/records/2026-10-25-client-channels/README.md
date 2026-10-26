# 2026-10-25 · 客户 Telegram 与司机双平台入口同步

用户确认：用户端使用 Telegram Mini App 和 Bot 下单；司机端做成 iOS、Android App。

## 变更范围

- 新增[渠道需求 v0.1](../../../PRD/docs/telegram-and-driver-app-scope-v0.1.md)，同步门户、页面、接口、设计、开发、边界和项目索引；正式 PRD、RULE、AT 和 SQL 草案保留。
- 创建客户订单草稿和提交动作从 C3 调整为 C1-ORDER，补齐阶段说明、字段描述、权限说明和生成目录；路由、字段形状、金额和业务守卫不变。Telegram 认证／webhook／会话及司机设备接口仍列为缺口。
- entry-ui.mjs 与 app.mjs 只改入口名称／说明，复用原演示表单、导航、样式及状态模型，没有实际 Telegram SDK 或 App 工程。

## 验证

- `node --test *.test.mjs`：164/164 通过，见 tests.txt。
- `scripts/validate-api-contract.py`：180 路径、202 操作、189 schema、389 样例通过，见 contract-validation.json；不是服务端业务测试。
- Premium 严格静态检查：0 errors、0 warnings，见 premium-audit.json。
- 浏览器执行 browser-check.js：360／390／1440 宽度的三种入口无横向溢出，Logo 正常；客户／司机 DEMO 校验、键盘提交、失败保留输入、重试及进入原工作区通过；无脚本错误，无外部请求。
- 页面截图：customer-entry.png、driver-entry.png。客户窄屏截图已查看。
- `node scripts/build-demo.mjs dist/client-channels-20261025`：43 个运行文件及相对依赖检查通过。
- `git diff --check` 通过；未改动文件与链接检查见 consistency.json。

before/ 保存本轮修改前文件，changed-files.json 记录涉及路径，source.zip 与 source-sha256.json 保存本轮结果。

## 未验证／未执行

无 Telegram 实际账号／Bot 创建、消息发送或 webhook 配置；没有 iOS／Android 安装包或真机测试；没有 KESS 真实支付、GitHub 提交推送或部署。桌面浏览器手机尺寸验证不能代替 Telegram 内嵌浏览器、后台定位或设备推送验收。
