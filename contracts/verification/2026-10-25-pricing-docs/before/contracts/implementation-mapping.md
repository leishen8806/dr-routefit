# 开发迁移对照与依赖清单 v0.1

2026-10-25 后续实施增量：[费用设置API](pricing-api.md)已补入机器契约；services/routefit提供8个本地HTTP操作及001迁移。下方“本轮不改OpenAPI”等表述属于此前研究记录；新的费用草稿／试算以此增量为准，完整选价、发布审批和报价落单仍待实现。

2026-10-25 [计价开发差距](../PRD/docs/pricing-development-map-v0.1.md)：现有 Quote／FeeItem 不覆盖完整价表、费目取整／归属和发布审批。新增规则见[计价体系](../PRD/docs/delivery-pricing-system-v0.1.md)，本轮不改 OpenAPI 字段／路由；后续须同步契约、样例和业务测试后实现。

2026-10-25 渠道差距：[Telegram 与司机 App 增补](../PRD/docs/telegram-and-driver-app-scope-v0.1.md)。customerCreateOrder、customerSubmitOrder 阶段调整为 C1-ORDER；其余 C3 完整自助范围保留。Telegram 登录交换、绑定／解绑、webhook、会话续填、消息投递以及司机设备／推送登记仍需补充机器契约和实现。

2026-10-25 状态补充：用户确认 KESS 商户尚未开通，当前先完成模拟流程与接入准备。内部契约可继续实现；真实商户沙箱、回调、结算和生产验收保持未完成。具体清单见 [KESS 接入说明](../PRD/docs/kess-payment-integration-v0.1.md)，不是等待用户在聊天提供密钥。

本包定义目标开发契约；现有 Demo 的浏览器状态与本地函数不是生产 HTTP 服务。正式 PRD、规则、验收编号与 SQL 草案未被此包重写。

## 1. 新旧接口与实现边界

| 已有材料/实现 | 新开发对照 | 实施注意 |
|---|---|---|
| PRD/docs/api-design.md 的早期端点目录 | openapi.json / endpoint-catalog.md | 重合端点以本包候选契约联调；旧目录保留历史解释，不同时实现两套状态写入口 |
| prototype/model.mjs、r1m-model.mjs | orders、assignments、carrier-bookings、custody-transfers | 本地对象字段不是网络 DTO；必须服务端做状态、授权、锁和审计 |
| prototype/finance-ledger.mjs、finance-ui.mjs | receipts、ledger-items、documents、cash-handovers、statements | 原型角色切换不是身份认证；全局页面版本替换为各聚合版本 |
| 旧 collections/{id}/verifications 等核验目录 | reportReceipt/confirmReceipt + ALLOCATION 审核链 | 资金事实确认与业务核销拆开；不能核验一次就默认全额结清 |
| 旧 partner-payments 付款登记思路 | PAYMENT/REFUND 审核 → 执行 → 结果核对 → post | 申请、批准、执行未知、确认成功分开；首期无主动划款 |
| prototype/integration-server.mjs 的演示接入 | warehouse/external orders 与 dispatch request | 现有扁平演示 DTO 需显式映射到目标字段；不能无迁移替换消费者 |
| prototype/settlement-model.mjs | settlement-rules / statements / finance tasks / notifications | 浏览器模拟定时和账单不作为真实调度器；任务与正式账项共用来源 |
| integrations/kess-pay.mjs、kess-sandbox.mjs | 服务端 PaymentPort 适配 payment-intents | 当前测试环境客户端不是上线证明；密钥不进浏览器，前端结果不能入账 |
| 客户 APP 演示页面 | C0/C1/C2/C3 客户门户阶段 | 当前演示不删除；首期交付不要求原生客户端或公众注册 |

金额统一映射到 `amountMinor`：USD 为分，KHR 为整数瑞尔；不要用普通浮点乘 100 修补历史金额。迁移程序解析十进制字符串、验证精度及舍入政策；既有账目保留原值和转换证据，禁止静默回写。历史原型未受审计的数据只用于测试，不迁移成真实资金。

## 2. 数据库草案对照

| 业务对象 | 现有草案的对应区域 | 开发需补的约束/数据 |
|---|---|---|
| 公司、主体、角色 | org.company / principal / role_grant | 自然人标识、会话授权快照、货主成员作用域，不能只有 companyId |
| 客户、合作方 | party.customer / carrier_partner / partner_agreement | 货主归属、账户版本、邀请成员及合同授权 |
| 车辆、司机、可用时段 | fleet.vehicle / vehicle_spec_version / driver / capacity_availability | 每段容量及并发预留校验；位置来源/时间/质量 |
| 货物、报价、承诺 | orders.delivery_order / order_item / quote / service_promise | 稳定货件标识、费用用途、保险独立、地址与报价版本 |
| 执行、路线 | dispatch.fulfillment_execution / route_plan_version / route_stop | 订单有效执行唯一；事故在执行内建分段保管，不复制收费 |
| 财务 | 原 finance 域草案及后续财务需求 | 收款事实、分配明细、应收应付、保管转移、三人审核快照、未知付款占用、渠道结算、冲正链需要独立迁移设计 |
| 接口可靠性 | integration.idempotency_record / outbox_event / inbox_event | 幂等请求指纹、业务来源唯一键、可恢复状态和事务发件箱 |
| 客户跟踪与通知 | ops.tracking_link / notification_message | 撤销、过期、验证范围、真实投递结果与防重 |

本包没有声称原 SQL 已包含全部新增财务和门户字段，也没有修改建表草案。开发需先列字段迁移、索引、外键及不可变事实表，再做数据层验收。**一笔银行交易只形成一次资金事实，但可有多条合法核销分配**；唯一索引不得误写为“bankTransactionId 在分配表只能出现一次”。总分配不能超过已确认余额，需锁和事务保证，不只靠前端。

GeoCore G1 与 RouteFit 仍为两个库；不新增跨库外键和跨库写查询。库存只设一个实物权威；接入 WMS 前明确 RouteFit 管预留还是完整库存，不能双方各扣一次。

## 3. 可开始与尚需确认的内容

| 项目 | 当前可做 | 上线/联调前必须补齐 |
|---|---|---|
| DTO、权限守卫、状态、金额、幂等 | 按本包实现及写负例测试 | D24 技术栈 ADR、存储事务、部署和独立审查 |
| 身份 | 定义运营会话、司机/门户令牌及范围 | 实际 IdP、登录/刷新/撤销协议、同人多账号识别；不能自造固定 token |
| KESS 收款 | 内部支付意图、查单、单次收款与核销模型 | 商户测试账号、已确认渠道协议、币种/精度/金额限制、生产入口、签名/回调与查单映射、错误及超时实测 |
| KESS 回调 | 预留内部适配边界，不发布猜测的回调 schema | 官方商户版回调认证、原文验签、重放和乱序测试。资料不齐时仅可信服务端主动查单 |
| 渠道结算 | 对账批次、手续费/退款分量、银行来源关联 | 实际结算周期、报表字段、到账证据与账务政策 |
| 客户门户 | C0/C1 查询、费用申报、申请和成员隔离 | 邀请制开关、数据权限；FINANCE_EXPORT 预留权限未开放客户导出接口，不可借用内部导出 |
| 仓储 | 预报/申请、版本化事件和预留契约 | 仓库权威、SKU/库位/批次口径、盘点和 WMS 事件映射；未知库存不能开放自动出库 |
| 接收人 | 单订单验证与请求；签收授权查询和内部核验 | 验证渠道、失败限制、有效期与撤销；没有合格证据则不得签收 |
| 信用月结 | 派单读取已批准合同/额度及期限 | 信用审批和合同管理模块尚无完整 CRUD；未接通时关闭该例外，不能上传截图即视为获批 |
| 通知与地图 | 任务、数据质量和依赖失败处理 | 真实服务提供方、模板和授权；地图/时间估计校准与费用政策 |

## 4. 本包没有扩大为完整 ERP 或全量后台配置

本包覆盖配送、合作/快递、事故/退回、财务、跨端查询/申请、外部接入的关键调用链。全量商品与车辆主数据编辑、完整合同/信用管理、客户批量自助审批、WMS 扫码盘点全流程、工资总账税务，以及门户财务导出仍需对应子契约；不能把“目录中没有”解释为可直接写库。

原生客户 App、开放注册、自动退款、自动划款、钱包和跨公司资金池没有因为本接口包而获准建设。客户可以通过网页直接使用，不依赖三维漫游。

## 5. 开发交付顺序与完成条件

1. 先建身份/作用域、金额类型、幂等记录、审计和 outbox；用两个企业和同企业两个货主验证隔离。
2. 订单—报价—承诺—收款分配—派单—交接—交付，按 [流程验收](flows-and-acceptance.md) 逐链落库。
3. 合作/人工快递与退回、事故分段，再接财务应付、三人控制、现金/COD、渠道结算与报表。
4. 门户按阶段开启；WMS 与 KESS 各自独立沙箱联调，不能由本地 Demo 测试替代。
5. 提供迁移回滚方案、契约校验、服务端安全/并发/守恒测试、跨端演练与真实外部接口证据。开发完成状态必须与本包的 DESIGNED_NOT_DEPLOYED 分开记录。

若实现发现字段或前置接口缺失，先修改本包并更新正反样例和业务流程，不在客户端猜字段，也不把生产需求藏在 Demo 的临时属性中。
