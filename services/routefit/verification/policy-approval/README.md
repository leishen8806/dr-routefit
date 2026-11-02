# 固定费策略审核发布交付记录

2026-10-25 · v0.1 本地开发。基础HEAD仍为ba9a77ec78cd20a6bf72476e9c3410d7faa9a06e，本轮业务代码未提交或部署。原共享页面及正式PRD／RULE／AT不改。

## 已实现

4个HTTP操作：提交来源草稿版本、查询策略、独立复核、批准发布。17个本地已实现接口；完整契约215个操作、198个仍为设计。三个独立主体及历史编制人排除由服务和数据库双重检查。

003增量迁移新增3张只追加表，企业RLS与复合外键隔离，未修改001／002。保存整份费率快照和提交参数，复核／批准分别保存操作者、理由与时间；编辑来源草稿使未发布申请失效，已经发布的快照不会被后续编辑覆盖。

新增权限pricing:review、pricing:publish；新bootstrap身份0／1维持原经办权限，2为企业A复核、3为企业A批准。正式身份和岗位系统不在本轮实现；开发账号不同不自动证明现实中是不同自然人。

## 实测证据

- [service-tests.txt](service-tests.txt)：48项全部通过，包括16项单测、3个PG父测试及29个集成子场景。本次新增3个单测和7个真实HTTP／PG场景。
- 覆盖同键并发重放、不同键并发版本冲突、角色限制、同人审核拒绝、未复核不能发布、跨企业404与运行角色RLS、来源变更、历史贡献人、自审核数据库阻断、重启持久化和过期／不支持费目阻断。
- [migration-upgrade.json](migration-upgrade.json)：上轮非空合成库002→003升级；既有九张业务表的行数与内容SHA-256完全不变。
- [contract-validation.json](contract-validation.json)：192路径、215操作、206 schema、423正反样例、38操作样例通过；目录与字段字典重新生成。
- [protected-files.json](protected-files.json)：相对上轮快照检查公共页面、费用UI、正式PRD／验收映射、001／002未改。
- `npm run smoke:policy`在新bootstrap的三份开发会话中运行；最新交接包的安装／启动／smoke结果记录在`handoff/restore-result.json`，必须与`handoff/latest.json`的snapshotId一致。

首次测试发现共用PL/pgSQL触发器用CASE引用不同NEW记录字段会报字段不存在，已改为按表分支读取实际字段；真实数据库的正常审核与直接绕过场景均重新通过。原测试固定迁移数由2同步为3，接口导出数由13同步为17。

## 为什么没有直接开启订单报价

既有createQuote契约要求validating/quoted、地址、区域及尺寸来源。当前订单只有draft，相关受理与证据服务未实现；本轮保留该门槛，没有把它改成“录入即收费”。客户确认使用的凭证服务也不能拿虚构文件ID代替。

本次策略只接受DR固定base／flash／insurance，不接受启用的距离、阶梯、比例保险或采购规则；其他试算能力仍保留。发布不触发报价、应收、收付款、承保、派单；有效期仍须单独校验。未实现提前撤销／停用，故不能用于真实经营收费。

本轮新增 `prototype/fees.html` 的策略提交、查询、复核和发布面板，复用 `FeeClient` 的同源会话、CSRF、幂等和身份变更处理。`prototype/browser-policy-approval-acceptance.mjs` 使用三个独立本机开发身份覆盖提交 → 复核 → 发布、同人复核被拒；截图见 `01-submitted.png`、`02-reviewed.png`、`03-published.png`。仅用合成费率与本机数据库，未部署或开启真实收费。
