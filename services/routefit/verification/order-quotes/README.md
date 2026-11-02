# 固定费订单报价验证

2026-10-25，Node24.22.1 / PostgreSQL16.15，本机合成数据。

- 服务端63项通过（含父测试）；新增真实HTTP/PG报价链、输入造价拒绝、并发重放、重新报价、区域失效、退回、RLS、授权撤销、重启后来源恢复；纯函数检验精确到期边界及策略窗口上限。见service-tests.txt。
- 原型177项通过；浏览器8项通过，使用三个不同主体完成策略审核，再录单受理、生成275美分报价，保险75美分不分成；已报价只读、键盘页签、390px窄屏、退回失效与Slogan原文验证，0JS错误。见browser-result.txt、quoted-mobile.png。
- 005升级前后18张旧表的旧列和完整JSON快照一致，重复迁移通过。比较不包含新增quote_id空列；见migration-upgrade.json。001–004及正式PRD/RULE/AT相关文件未改，见protected-files.json。
- UI静态严格审计0发现；合同校验结果见contract-validation.json。完整契约220操作，27本机实现、193仅设计。静态审计不替代全面无障碍、设备或业务验收。

当前只支持已审核的DR固定基础/独享/保险费用。GET实时派生有效性，保留原报价金额；客户端不能信任旧POST/幂等重放的issued状态。没有客户确认、收款、承保、地图认证或派单副作用。

交接包由export-fee-baseline.py生成；精确snapshotId与归档哈希、空目录恢复结果以handoff/latest.json和restore-result.json为准，不将旧包验证结论用于新包。没有代替RF-QA-01独立验收；没有部署或推送业务代码。GitHub只同步README。

## RF-PM-023 页面验收补充

`prototype/browser-order-quote-acceptance.mjs` 使用合成策略、区域、订单和本机身份覆盖：已受理订单 → 已发布策略 → 生成 issued 报价 → 展示服务端明细 → 记录客户确认并回读 confirmed。截图：`01-issued-quote.png`、`02-confirmed-quote.png`。本页不自行计算金额，未接付款或派单。
