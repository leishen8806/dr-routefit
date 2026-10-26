# RF-API-01 续轮技术复核

2026-10-25 · HEAD仍为 `ba9a77ec78cd20a6bf72476e9c3410d7faa9a06e`，本地main及既有未提交工作保留。续轮仅处理HTTP输入缺口、契约与QA交接；不领取大旺的RF-WEB-01。

## 复现与修复

新增集成反例先在原实现运行，重复name请求得到201而非400，见[修复前失败](before-tests.txt)。原JSON.parse会覆盖重复字段；Buffer.toString会把非法UTF-8替换为U+FFFD。

现用标准TextDecoder严格解码、标准JSON.parse检查语法，再扫描已通过语法校验的字符串／容器，拒绝同一对象内解码后重复的键；不同对象可复用键名。复用现有400 INVALID_JSON响应，不回显原始请求。三个费用POST共用该入口，在业务事务前拒绝不合格输入。未新增依赖、DTO、业务操作或迁移。

## 本轮验证

- [service-tests.txt](service-tests.txt)：11个单测＋16个真实PG集成子场景＋父测试，共28项通过，无跳过。新增测试覆盖嵌套／转义重复键、合法中文与高棉文、非法UTF-8、BOM和三个POST无数据库副作用。
- [contract-validation.json](contract-validation.json)：OpenAPI及正反例校验；契约变更仅三个POST的请求说明，路径／DTO／操作数不变。
- [protected-files-check.json](protected-files-check.json)：与上轮289文件清单对比，原型公共入口、费用页面、正式PRD／验收映射及数据库迁移哈希不变。
- 最新交接包与恢复测试结果在根目录 `handoff/latest.json`、`handoff/restore-result.json`，以其中snapshotId核对；旧包与旧测试不冒充新包验证。

测试环境为Node24.22.1、本机独立PostgreSQL16.15、合成数据。测试连接及密码不写入证据。测试创建的随机库由测试清理；任务启动的数据库验证结束后停止。

## 待独立验收

已整理[RF-QA-01步骤](../../../../PRD/docs/tasks/fee-integration-qa-v0.1.md)。本轮未重跑浏览器；上轮page.fetch结果只证明同源调用，页面按钮接线仍待大旺执行。没有生产登录、真实资金操作、公开发布、提交／推送或独立审查结论。
