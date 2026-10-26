# 数据库实施规划 v0.1

2026-10-25续轮：新增003_pricing_policy_versions.sql，增加pricing.policy_version、policy_review、policy_publication三张只追加表；企业RLS、来源版本复合FK、提交／复核／批准独立主体约束。001和002不改；非空旧合成库升级后九张既有业务表内容哈希及行数均不变，见[验证](../../services/routefit/verification/policy-approval/README.md)。

2026-10-25增量：新增 `002_order_drafts.sql`，保留001校验和。新增party.customer、party.customer_access、orders.draft、orders.draft_revision四表；订单及修订同时受企业与授权客户RLS限制，修订只追加。幂等表扩为POST／PATCH；这只覆盖录单，不替代完整订单、包裹交接或财务schema。运行角色只读客户授权，不具备授予自身权限的表写权。

2026-10-25 · 开发草案；承接 [数据库架构](database-architecture.md) 和 [服务端规划](server-implementation-plan-v0.1.md)。PostgreSQL 16+／PostGIS 仍是 D24 候选；本轮在独立本地 PG16.15 上实施首个迁移，未修改原全量 SQL 草案或正式 PRD／RULE／AT。

## 1. 从建表草案到可重复迁移

`PRD/docs/database/routefit-schema-draft.sql` 是完整业务建模参考，不能当成后续可反复执行的升级脚本。新的 [001_pricing_drafts.sql](../../services/routefit/db/migrations/001_pricing_drafts.sql) 是**空库起点**，只创建当前接口所需对象。

迁移工具用独立账号、事务级锁、文件名＋SHA-256 记录保证重复执行安全；已经应用的迁移不改内容。若已有旧草案库，先导出结构、比对并设计专门转换迁移，在副本验证后再迁移，禁止直接叠加 001 或删库重建。原型浏览器数据不作为正式账务迁移来源。

## 2. 已实现的 7 张表

| 表 | 当前职责 | 关键约束／索引 |
|---|---|---|
| org.company | 企业与启停 | UUID主键；运行账号只读 |
| org.principal | 企业内开发主体，预留idp_subject | company+id／company+idp_subject唯一，企业FK；运行账号只读 |
| pricing.tariff | 对客／采购费用草稿 | owner=DR/VET/ZTO/CE/JT、USD/KHR、仅DRAFT、版本；企业＋id列表索引；经办人复合FK |
| pricing.fee_rule | 每个草稿的独立费目 | company+tariff+code主键，owner复合FK；19费目／单位／比例限制，保险等分成禁用CHECK |
| pricing.tariff_revision | 每版完整配置和经办人 | company+tariff+version主键；只追加触发器、不可UPDATE／DELETE |
| pricing.trial | 指定配置版本的模拟结果 | FK精确引用历史版本；金额、规则与输入快照；只追加 |
| integration.http_request_result | API成功结果幂等重放 | company+principal+method+path+key主键、指纹／HTTP结果／ETag；只追加 |

另有 `public.routefit_migrations`，只归迁移管理，不是业务表。org 两张表沿用旧草案字段；pricing 是新领域，不能宣称旧 13 个 schema 已覆盖计价。首迁移只有 org／pricing／integration 三个业务 schema。

配置采用结构化列，快照采用 JSONB。快照由已校验的服务端生成，不能接收客户端提交的完整“已确认快照”。金额和数量为有界 bigint，应用用 BigInt，JSON 输出限制在安全整数范围；比例基点单独解释，不与最小货币单位混淆。

## 3. 全库分域目标与权威数据

保持旧 13 个领域分组，加 pricing 为第 14 个候选分组；如果建设自有 WMS，再增加 warehouse，不提前宣称第 15 个已实现。RouteFit 与 GeoCore G1 分库，不做跨库 FK 或查询。

| 领域 | 后续对象与权威范围 | 依赖与边界 |
|---|---|---|
| org / party | 身份映射、自然人、角色范围、客户／货主、合作方、协议和账户版本 | 企业与货主双层隔离；账号与自然人不能等同；账户变更须复核 |
| fleet / cargo | 司机、车辆／规格版本、班次、可用量、货物包装尺寸／旋转堆叠限制 | 剩余容量由计划及实物事件重算；不能只除总体积认定装得下 |
| pricing | 已批准价表、适用区间、输入快照、费用行、调整、合作方应付价格快照 | 草稿与已发布不可混；客户收费与采购价独立；审批发布尚未实现 |
| orders | 订单、货件、取送地址、报价／承诺版本、交付约定、服务变更申请 | 报价确认、付款准入、履约、收款、交款与结算分别建状态 |
| dispatch / carrier | 唯一有效执行、assignment提案阶段、路线版本、站点、逐段容量预留、人工委托及外部报告 | assignment的offered阶段继续承接DispatchOffer；不新增第二份提案真值 |
| custody | 稳定货件、交接及逐件明细、POD、附件元数据、保管责任变化 | 部分交接／事故拆车不复制原订单；承运商delivered先报送再核验 |
| finance | 账项、收付事实、银行交易、核销分配、现金保管、结算单、审批版本、争议／冲正、结账期间 | 银行事实唯一而分配可多笔；不是可手改余额表，详见下节 |
| ops / reco | 异常、停用与恢复、通知待办、功能开关、方案与推荐证据、成本分析 | 恢复暂停保留PRD双人批准；未知成本不补零，推荐不直接落执行 |
| integration / audit | 服务身份、幂等、inbox／outbox、来源版本、只读中控快照、审计事件 | 外部回调先验真防重；审计独立权限／留存；中控只读 |
| warehouse（候选） | 自有库存批次／库位、预留、入出库和作业事件 | 若用外部WMS，外部系统是库存权威，RouteFit保存来源快照／请求／交接；两套系统不能独立改同一库存 |
| GeoCore G1（独立库） | 道路、地理编码、坐标可信度、道路时耗与服务能力 | RouteFit保存使用的版本／证据；远程时耗不在锁表事务内调用 |

服务区等空间字段以及车辆时段排他约束需要按相应阶段启用 PostGIS／btree_gist；S0 无空间查询，没有安装或验证这些扩展。原草案此前的扩展验证记录仍属原记录，不替代新迁移验收。

## 4. 财务表的下一轮细化

保留原 `collection_record / collection_verification / remittance / partner_payable` 的业务含义，逐表与以下候选结构映射后再出迁移，不并行维护两套余额真值。

| 候选对象 | 不可省略的字段与约束 |
|---|---|
| fee_line / ledger_item | source业务及版本、feeCode、币种、金额、承担方／受益方、保险／COD／运输用途、批准来源；稳定服务实例防重复计费 |
| bank_transaction / payment_fact | 渠道／商户账户＋外部交易ID唯一；金额、币种、资金方向、证据来源、确认时刻；银行事实与付款截图分开 |
| allocation | confirmed_fact_id＋ledger_item_id、分配额、币种、批准版本、冲正引用；事务锁住事实及账项，分别限制累计分配不能超额 |
| cash_custody_event / cash_handover | 收款事实、原／新保管人、应交／实交、币种、点收证据；司机交款只转保管，不再次生成客户收入 |
| cod_obligation / settlement_rule | 商户受益方、应代收／实收／核验／待返；各对象账期、结算周期、规则版本与生效日；不与运费默认抵扣 |
| settlement_statement / line | 对象、币种、账期、费用和调整／分配来源、争议项、部分已结余额、当前版本；一张单可多次收付 |
| approval / payment_execution | 单据快照指纹、经办／复核／审批自然人、职责分离、账户版本；执行中／未知／确认成功分别记录 |
| correction / accounting_period | 原记录引用、原因、证据、复核审批、新分录；锁账后用新期间调整，不覆盖原历史 |

银行交易只入账一次不等于只能核销一个订单。核销分配不能简单给 bank_transaction_id 加全局唯一。USD/KHR 分开，需换汇时明确两种币种、汇率、来源、时刻和差额。保险、COD 本金和代保管资金不计入配送分成，资金所在账户也不证明平台拥有其全部余额。

## 5. 并发、权限与历史

- 当前7张业务表均强制RLS，企业来自事务内 `app.company_id`，缺失时读不到数据；复合FK阻止跨企业关联。后续还须加货主、仓库、车辆与个人作用域，不能只靠companyId开放客户数据。
- 本次GET使用一致性快照；费用变更锁父价表行后检查If-Match，版本、费目、历史和幂等结果同事务写。幂等锁先于价表锁，后续多订单／核销锁须按稳定ID顺序获得。
- 后续唯一有效执行用部分唯一索引；不同订单的独占预留用排他约束；同时检查承诺、逐段容量和订单状态。只约束总容积不足以证明几何可装。
- 运行账号不为owner／超级用户／BYPASSRLS，只给所需表权限。DDL账号与应用分离；只追加触发器不能抵御数据库超级用户，正式审计需要独立访问控制、留存、篡改检测与备份。
- 试算和版本快照当前长期保留；正式留存与归档策略应记录在后续ADR，不能用清理任务删除仍被报价／账务引用的版本。

## 6. 编号迁移顺序（后续均未实现）

| 批次 | 范围 | 进入条件 |
|---|---|---|
| 001 已实现 | 合成主体、费用草稿／规则／版本／试算、HTTP幂等 | 空库＋独立运行账号，实际PG测试 |
| 002 候选 | 身份、自然人、角色作用域、party、审计／outbox | D24及认证契约明确；跨客户授权测试 |
| 003 候选 | 批准价表、订单、货件、报价／承诺／变更 | 全计价算例、服务区域与来源、发布审批契约 |
| 004 候选 | 车辆、执行、容量预留、合作委托、逐件交接 | 排他约束与事故救援并发、离线事件验证 |
| 005 候选 | 收付款、核销、保管、COD、审批、结算任务 | 独立复核审批、一款多单、防重复与冲正验证 |
| 006 候选 | WMS接入／库存真值方案、报表读模型、归档 | 库存责任确认、来源对账及恢复演练 |

编号是规划顺序，实施时允许按一笔订单所需依赖拆分小迁移；不得写空迁移占位或跳过依赖。大表后续用并发索引等非事务操作时另设迁移策略，当前runner只支持事务内迁移。

## 7. 数据运维与验收

开发／测试／生产物理环境隔离；本轮只创建随机本地测试库。发布前必须验证备份恢复、迁移前后行数／余额对账、连接数／锁等待监控、时区与账期、证据存储权限、加密与保留期限。RPO／RTO和数据驻留要求待正式运维评审，不虚填已达标数值。

验证依据见 [2026-10-25记录](../../services/routefit/verification/2026-10-25/README.md)：金额边界、同键并发、旧版修改、跨企业HTTP和RLS、复合FK、只追加、服务重启持久化。本轮不验证生产备份恢复、不执行正式资金、不声称完整仓配数据库已建好。

## 004订单受理迁移

新增 coverage.area/publication、orders.intake_evidence/intake_return；订单投影绑定来源订单修订、依据和区域发布外键。只追加历史、公司/客户RLS继续适用。原001–003不改；003非空合成库升级前后14表的所有旧列一致，证据见 [升级记录](../../services/routefit/verification/order-intake/migration-upgrade.json)。

## 005报价快照

pricing.order_quote只追加，复合外键绑定源订单修订与已发布策略，公司与客户RLS；orders.draft增加quote_id关联及quoted状态约束。GET实时派生过期/被替代状态，不覆盖金额或历史；退回清除当前引用。001–004不可改写。
