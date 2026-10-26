# 订单受理输入验证

2026-10-25，本机合成环境；Node24.22.1、PostgreSQL16.15。未部署，未使用真实客户、地图认证或支付渠道。

- 服务端56项通过（`node --test tests/*.test.mjs tests/*.integration.mjs`，含父测试），覆盖新增7组真实PG受理场景以及原计价、保险排除、RLS、策略独立审核、幂等与会话回归。原型177项通过。见 service-tests.txt、prototype-tests.txt。
- OpenAPI：196路径、219操作、210 schemas、431样例和38操作示例通过；25操作本机实现、194仅设计。新增4份schema均有正反例；真实HTTP响应亦通过运行时AJV校验。见 contract-validation.json。
- 003非空旧合成库升级004并重复迁移，14表所有旧列（含完整JSON快照）哈希与行数一致。新增nullable列不参与旧列比较；001–003文件未改。见 migration-upgrade.json、protected-files.json。
- 浏览器11项通过，实际API创建/提交核验/退回，核验中只读、持久原因提示、键盘页签、返回、390px窄屏及恢复编辑，0JS错误。见 browser-result.txt、readonly-mobile.png、prototype/browser-order-intake.js。初次测试发现异步等待和fieldset断言不正确，修正测试；同时补齐只读提示。
- UI严格静态审计0发现；沿用prototype/DESIGN.md、ORDER-ENTRY-CONTRACT.md和既有ui-primitives，未改共享app.mjs/app.css。静态审计不等于全面无障碍认证。

交接包由 `scripts/export-fee-baseline.py` 生成；最终包身份及空目录恢复结果见被忽略的 `handoff/latest.json`、`handoff/restore-result.json`。两者必须匹配snapshotId，不能把测试预览包视为最终包。恢复验证执行npm ci、bootstrap及费用/订单/策略/受理四套smoke；不包含本机凭据。

未覆盖：生产身份、PostGIS/GeoCore、装载认证、正式报价/付款/派单、真实移动端。完整受理操作UI尚待大旺接线；RF-QA-01独立验收未代签。GitHub仅同步README，不提交本地业务增量。
