# 接口开发对照 v0.1

本说明与 [OpenAPI](openapi.json)、[字段字典](fields.md)、[流程验收](flows-and-acceptance.md)共同构成实现依据。字段／路径以机器契约为源，跨字段和事务约束以本文为源；若冲突必须修订契约，不能自行选择较宽松规则。费用设置8个操作及订单录入5个操作已实现为本地开发服务，其余198个操作为待实现设计；均未部署。费用联调以[费用接口说明](pricing-api.md)为准，以下通用生产要求不自动代表本地切片已全部实现。

## 1. 作用域、版本和上线范围

基线为 V1.4＋后续明确增补：合作运力、人工快递、事故应急分散转运、保险独立分账、收入提现、COD、KESS、跨端财务及客户门户分期。V1.2 的旧范围和“首期待确认COD”不再作为排除依据；R1、R1-M、R1-V 原规则编号不改。

每个 operation 的 `x-stage` 是能力开放门槛，`x-implementation-status` 区分 `LOCAL_IMPLEMENTED_NOT_DEPLOYED`（本地实现）与 `DESIGNED_NOT_DEPLOYED`（设计）。C0/C1/C1-ORDER/C2/C3 是客户入口阶段，不是替换原R阶段；KESS与渠道结算另设门槛。接口存在于文档不等于功能开关默认开，关闭返回 `422 CAPABILITY_DISABLED`；平台能力暂停返回423。

生产URL、IdP、消息渠道、真实KESS商户参数、银行日历和具体费率不能从合成样例中取得。D24不阻止按JSON契约设计领域层，但在选择持久化／认证组件前不能宣称可上线。

## 2. 通用 HTTP 规则

| 项目 | 实现约定 |
|---|---|
| 内容 | UTF-8 JSON；写操作Content-Type application/json。拒绝未知字段、重复JSON键、NaN/Infinity、超出大小/数量限制的数据。格式错误400，业务条件失败422或409 |
| 响应 | 成功直接返回定义的资源；列表游标以具体schema为准；多数为items/nextCursor，费用草稿为items/nextAfter，费用历史为items/nextAfterVersion。错误统一ApiError；无额外未定义的data/code外壳。204没有body |
| 资源ID | 服务端不透明ID；orderNo等人类编号另外保存。客户端只能引用授权可见ID，知道ID不等于有权限 |
| 时间 | 请求RFC3339带时区，响应UTC；业务日期按Asia/Phnom_Penh。时间窗start<end、左闭右开；observedAt不替代receivedAt和服务器生效时间 |
| 金额 | 全部最小单位整数，上限9×10¹²。USD是分，KHR是瑞尔整数。不用浮点求和；换汇不在本切片，币种不同拒绝核销 |
| 物理量 | 包装后cm/kg；用十进制定点存储。体积=L×W×H÷1,000,000。容积初筛不证明能装下；门洞、方向、重量、逐段剩余空间和必要装箱仍需验证 |
| 未知 | nullable字段才接受null，并返回unknownReason/quality。0只表示真实的零；UNKNOWN不能推断为失败或成功 |
| 分页 | limit默认50、最大100。游标绑定主体、查询、排序及快照边界；不能修改游标扩大范围。查询变化要清空游标 |
| 排序 | 订单列表createdAt倒序+id；调度队列按S1业务优先、最晚安全派发、承诺截止、需求时刻、id稳定排序；财务待办dueAt+createdAt+id；同页内字段排序不可改变安全过滤 |
| 语言 | Accept-Language km/en/zh-Hans；不支持时按用户偏好再zh-Hans回退。机器code/枚举不翻译；只翻译message与说明 |
| 缓存 | 资金、身份、私人数据、分享页面响应no-store；错误和下载结果不缓存到共享CDN |
| 请求追踪 | 每响应X-Request-Id；日志不记录Cookie、验证码、token、签名密钥、完整账户或未经脱敏的联系人 |

在响应中 `version` 与 ETag 相同。OrderDetail 的主版本在 `order.version`。通常创建子资源返回子资源版本；费用试算是明确例外：POST返回父价表tariffVersion对应ETag，GET试算不返回ETag。父资源如有变化，调用者重新GET父资源再发下个动作；不能拿报价ETag去更新订单。列表和汇总不提供可用于单资源写入的ETag。


### 当前费用切片的实际边界

- 仅开发会话和本地Origin／CSRF，不包含IdP、货主范围或完整能力开关。分页为UUID／版本游标，不是签名游标；每个GET仍经过企业RLS。
- 消息当前中文返回，未实现Accept-Language协商；messageKey可用于后续翻译。
- 费用切片已拒绝非法UTF-8、JSON语法错误及同一对象内的重复键（含转义后相同的键），返回400 INVALID_JSON，不进入业务事务。不同对象可使用相同键名；其他待实现接口仍须单独实现和验证这条约束。
- 事务已保存费用版本、试算快照和幂等结果，未实现通用audit／outbox。下述订单、资金与外部事件要求仍属于后续实现门槛。

## 3. 身份、货主隔离与字段裁剪

运营Web使用服务端会话＋CSRF/Origin校验。司机及门户使用不同audience的短期访问令牌；WMS、外部客户系统、中控分别使用独立服务身份。OIDC协议交给选定IdP和BFF，不自行增加密码收集接口。文档中的角色和personId都来自可信会话，不接受请求体自报。

每次请求依次检查：身份 → API audience／能力开关 → 运营企业 → 货主或受益主体关系 → 仓库／任务归属 → 动作权限 → 字段权限。对象不存在与越权访问统一404；对象已合法可见但没有某动作权限可403。返回数据在服务器裁剪，不能把全企业账本发给浏览器再隐藏列。

客户门户的会员权限按下表映射，实际动作仍检查对象范围：

| 门户成员权限 | 允许的API权限族 | 不包含 |
|---|---|---|
| ORDERS_READ | portal:orders:read、portal:session:read | 全企业订单、内部成本 |
| EVIDENCE_READ | customer:evidence:read | 他人文件、内部财务凭证 |
| INVENTORY_READ | portal:inventory:read | 库存改写和预留 |
| WAREHOUSE_REQUEST | portal:warehouse:request/read | 点收、出库确认、库存调整 |
| ORDER_REQUEST | portal:orders:create（C1-ORDER 开启后） | 发司机提案、承诺时效 |
| FINANCE_READ | portal:finance:read | 付款申请、确认账单、内部批准 |
| PAYMENT_REQUEST | portal:payments:request/read、portal:refunds:request | 资金确认、自动退款 |
| QUOTES_CONFIRM | portal:quotes:read/confirm | 承诺生成或放行派单 |
| STATEMENTS_ACKNOWLEDGE | portal:statements:acknowledge | 内部复核审批和核销 |
| CASE_CREATE | portal:cases:create/read | 自动赔款、改路线 |
| MEMBERS_MANAGE | portal:members:manage | 超过自身可委派上限的授权 |
| FINANCE_EXPORT | 仅获授权范围的财务导出能力；门户专用导出路由未列入本批，暂不启用 | 内部全企业export接口 |

上传能力随相关业务权限派生，只允许该业务对象及用途：付款申请可上传本人PAYMENT凭证，异常申请可上传本案件DISPUTE图片；不能因此获得其他类型文件的上传/下载权限。收货人token不得访问customer/driver/ops；合作司机凭据只看其任务。

## 4. 幂等与并发处理顺序

业务POST/PATCH必须Idempotency-Key。已有聚合动作/PATCH按operation的 `x-version-resource` 提供强If-Match，如 `"7"`；创建时关联旧对象版本在body单独提供。同步批次每个事件带任务版本，不使用一个ETag覆盖整批。认证挑战／验证码交换是明确例外：使用服务端单次challenge和限次，不把验证码或令牌放进通用幂等响应缓存。

业务写的固定处理顺序：

1. 认证和对象可见性检查。即使请求重放，权限被撤销后也不能取回旧敏感响应。
2. 按 `company + principal + HTTP method + canonical path + Idempotency-Key` 找记录。请求指纹包含规范化query、body及If-Match等业务前置头，摘要必须一致；路径包含所有资源ID。相同键不同请求409。并发同键只能一个执行者，其他返回同一进行中结果或 `409 REQUEST_IN_PROGRESS`＋Retry-After，不能再执行一次。
3. 已完成同内容请求返回首次结果和重放头：费用切片为 `Idempotency-Replayed: true`；其他待实现操作的候选契约仍为 `Idempotent-Replayed: true`（按operation读取，后续冻结前统一命名），然后才考虑新的版本检查。否则成功后重试会错误地被旧If-Match拒绝。
4. 新请求检查If-Match、状态、源数据版本、对象范围和业务约束；在同一事务中锁定涉及的订单/执行/预留/资金/核销账项，按稳定ID顺序获取多行锁。
5. 事务提交领域变化、幂等结果、审计和outbox；事务失败不得留下半笔资金或半条保管关系。

金融、外部订单及设备事件的**业务唯一键**与HTTP缓存是两道机制。即使缓存清理或客户端换新键，同一银行交易、KESS交易、外部来源单、设备事件也不能成为第二笔事实。HTTP响应缓存建议最低7天，具体配置与保留策略冻结；业务去重标识不因缓存到期消失，个人数据留存另按批准策略。

外部调用不可长期占数据库事务。先落支付意向/唯一商户单号和outbox，再由任务执行；超时记录unknown，查原单，不换号重试。创建结果未知返回202及当前意向，不把它写成可安全重发的失败。

## 5. 录单、报价、承诺、派单

OrderDraft中的clientItemId在一单内唯一。服务端生成稳定itemId及packageIds；OrderItem返回这些ID供交接、签收和退回引用。单次契约每包装行最多1000件、每请求最多200行，实际试点可再降低；总量/尺寸缺项保留UNKNOWN，禁止自动确认车辆适配。存在保管事实后不能改写件ID或数量。

| 动作 | 必须满足 | 原子结果 |
|---|---|---|
| submit | 草稿、联系人/地址/时间窗及货物字段满足校验 | draft→validating；失败不改变状态 |
| quotes | 有效计价策略、来源距离/区域、独享与保险分别计价 | 追加Quote，订单quoted；不形成承诺 |
| quote confirm | 本货主/授权经办、报价未过期、订单源版本未变 | Quote confirmed，保留客户同意证据 |
| promise-checks | 车辆模式查车辆/路线/装载；人工快递查合作方/协议与能力 | 返回可行性快照，不写资源占用 |
| promises | 检查未过期且源版本一致；客户同意；批准的人工/校准依据 | 追加ServicePromise，订单awaiting_dispatch；原承诺不覆盖 |
| assignments | 承诺有效、报价确认、预付完成核销或月结协议有效、装载/资格/资源无冲突 | offered＋软预留；订单仍awaiting_dispatch |
| driver accept | 指定司机、在线、服务器TTL、路线/容量/承诺重验 | accepted＋有效执行；订单executing/pickup_pending |
| reject/expire/revoke | 当前状态允许，取货前可撤回 | 释放相应预留，不删除原承诺 |
| reassign | 无实物保管转移；新方案通过全部检查 | 结束旧执行并创建新提案必须同事务；失败保留原状态 |

S1最高业务优先级不是可突破安全/载重/体积/门洞/原承诺。S4、自动推荐和动态插单默认关闭；人工候选列表不得标“算法保证”。付费独享与S1–S4为两个字段，不能把独享闪送直接等同S1。

月结不能靠 `paymentTerms=APPROVED_CREDIT` 自报放行；必须查询后台已批准、未撤销、当前有效、主体匹配且额度足够的协议。协议管理与资格撤销需要服务端事实；本批没有提供让客户自批授信的接口。

## 6. 实物交接、交付、退回和事故

CustodyTransfer先proposed，双方签认partially_signed，双方自然人不同、件数/封签/证据一致才confirmed。只有该次交接授权双方可签；角色切换不能替代另一自然人。差异保留原保管方，产生阻断异常。

交付必须使用任务返回的packageIds。delivered和remaining两集合不相交、无重复，合并必须覆盖本次持有待交全部件，不能混入他单。实收为0时必须拒收/异常依据；全部交付才delivered。部分实收记录保留，剩余件继续计容量并走退回；货物签收不改变资金核销。

ReturnTask：requested→authorized→assigned/picked_up→received→inspected→closed。司机到仓不转保管；实际点收有差额则不闭合；检验通过也需库存权威批准才可重上架。事故分散转运以exceptionId为依据，逐件最多一个活动救援指派，新车仍通过装载与承诺检查，旧车保管直到双签；不重复生成客户收费或将正常业务随意拆单。

收货授权必须由服务器核实并绑定订单/交付对象，司机不能填写任意字符串就通过。人工替代验证只在批准的例外策略下留证；验证渠道未准备好时，收货人写入口关闭，不能降级成持分享链接就可签收。

## 7. 客户／收货人的申请与确认

ServiceRequest只创建案件。地址或时间变化由内部 decide 队列重新评估区域、费用、原路线全部时窗、装载与成本。需要新价格或承诺时返回needs_customer_consent；客户接受新Quote／Promise后再由领域动作生效。在此之前原承诺、路线、费用不变。

PublicTracking不返回姓名、电话、完整地址、整车路线、内部账务。分享引用至少128位随机熵，只存哈希，按批准TTL到期或撤销；统一404，日志脱敏。关联令牌治理、签发/撤销仍由内部权限和原tracking-link设计约束，不能无期限公开链接。

RecipientChallenge只向预登记收货人发验证，响应不能泄露号码或订单存在性。限时、限次、单次使用，跨订单使用失败；验证后token只授权该订单。收货人确认返回recorded/needs_review/matched，后台匹配司机交付记录、件数和授权后才影响交付事实。禁止收货人提交货主费用异议或查看其他货主的库存、财务。

Statement.customerState是客户认可/异议，internalState是内部审核，paymentState来自净核销。三者互不替代。

## 8. 收款、核销、资金保管与金额守恒

收款申报→独立确认资金事实→经办分配→复核→审批→post核销。银行/现金事实可先存在为到账待归属，不能因尚未审批而否认实际已收。现金交回公司是保管转移，不增加第二笔客户收款。

同一已确认收款可以分配多个应收；同一应收可分多次核销。因此“银行交易只处理一次”指只产生一次资金事实，不是禁止一对多分配。建议唯一键：`company + channel + receivingAccount + externalTransactionId`；核销记录另有独立ID和来源引用。

| 检查 | 必须成立 |
|---|---|
| 核销来源 | receipt confirmed；同企业、币种、付款主体；目标版本当前 |
| 来源可用 | 本次分配≤已确认额−有效净分配−已确认退款−退款占用 |
| 目标未结 | 本次分配≤原额＋已批准调整−净核销；每个目标只出现一次 |
| 应付占用 | 同一来源的付款、提现、结算批次共用锁与预留；不能各算一套余额 |
| 钱的归属 | 运费、保险、COD分开；COD属于受益商户往来，不是收入；保险不计配送分成 |
| 保管维度 | DRIVER、COMPANY、CHANNEL独立；司机持款与商户负债可能为同一笔，不能相加 |
| 更正 | 已确认记录追加冲正／撤销核销／补差，不直接改余额或删除原记录 |

经办/复核/审批必须三个不同personId，付款执行与核对也必须不同personId。审批绑定金额、币种、受益人、账户版本与脱敏快照、全部明细及证据摘要。任何关键变更清空当前审核并生成新版本；处理中的付款禁止修订。批准后账户变化必须重新制单或复核，不能直接执行旧批准。

Payment/Refund：draft→submitted→reviewed→approved→processing→unknown/failed/confirmed→posted。unknown保持预留并查询原指令；确认失败才按规则释放。已确认成功和未结清部分分开。当前首期人工在银行执行，本系统只记录；不得在record-execution偷偷调用KESS提现、转账或退款。

## 9. KESS 请求、支付和渠道结算

创建支付意向只接收orderId/version、quoteId和应收账项版本，不接收金额或成功状态。交易费用快照取自合法未结配送／保险账项；COD不在本收款入口。服务端计算整数总额，唯一商户支付号持久化后才请求渠道；新键也不能为同一未决支付再扣一次。

客户端打开已校验域名的收银台；回来只能GET当前意向或发起query任务。返回页、截图、客户端“成功”参数无入账权限。渠道未知保持unknown，不以本地超时推定failed。可信查单必须匹配商户、订单号、币种、金额、交易标识和状态；金额不符保存待查异常，不能截取一个success字段入账。

可信SUCCESS只创建唯一KESS收款来源，保管在CHANNEL；业务核销仍三人处理，核销满足预付门槛后才允许派单。银行可支付余额不因CHANNEL成功增加。终态之后收到新的可信成功资金事实不能丢弃，应入待核实/超付处理，禁止因此重复履约或重新扣款。

渠道结算独立聚合：同币种 `grossMinor - feeMinor - refundMinor = netMinor`，来源收款和银行流水版本锁定，每笔金额只匹配一次。审核post才移转净额保管并追加手续费/退款事实；不再新增客户收款。首个实现只允许明确匹配的整笔渠道收款组成批次；复杂拆分结算、手续费税务口径、差额自动抹平均不启用。不符合批次公式进入disputed。

公开KESS文档存在createorder/createOrder大小写差异。生产地址、真实商户认证、回调完整签名/重放及应答协议必须由KESS确认。本包**不发布猜测的Webhook端点**，现有适配器仅沙箱主动创建/查询。正式后台先实现outbox查单闭环；回调只是经验证的查询触发或资金证据，不允许前端直接注入渠道结果。

## 10. 账期、账单、催收与后台任务

账期按 `company + subject + direction + purpose + currency` 隔离。日/周/月/每N日/逐单均以Asia/Phnom_Penh自然日定义；区间左闭右开。WEEKLY必须weekDay，MONTHLY必须monthDay与短月策略，EVERY_N_DAYS必须intervalDays。没有银行日历时禁止把自然日说明为银行工作日。

规则新版本只绑定新账项，不能静默改历史到期日。出账任务唯一键包含规则版本/周期/修订，重复调度、宕机补跑和人工重试不得重复出账；账项不可重复收进两张有效同方向账单。出账后迟到的记录形成补充单，引用原账单。

期末未结=`期初未结＋本期新增＋批准净调整−本期净核销`；无自动跨币种、运费/COD互抵。客户认可不减少未结。部分款只催剩余；未核验的付款申报进入复核待办，可暂缓催收但不得当到账。撤销核销恢复原到期日和待办。已读不结案；只有来源已处理/余额结清才完成。

后台调度不能依赖浏览器打开。任务应持久化到期时间、去重键、领取/重试状态；重启补跑。通知发送前重新确认权限、版本、未结和暂缓；错误为failed，结果未知为unknown并查原渠道消息。不将HTTP202或本地模拟发送称为客户已收到。

## 11. WMS、外部订单、证据与只读中控

每仓只允许一个实物库存权威。外部WMS观察按sourceVersion和事件ID去重，旧版本不能覆盖新快照；RouteFit仅保存预留或镜像时，不能再双扣外部实物库存。申请可用量只供展示，实际受理锁最新库存；出库申请不是预留/出库/派车，入库预报不是实收。

外部订单唯一键包含凭据绑定来源系统、货主和externalOrderId，revision单调。完全重复返回原受理；同版本异内容409；更高版本必须按订单可修改阶段处理，已有承诺/保管不自动覆盖。原平台deliveryPrice与insurancePrice分别保留，重新核价同意后进入正常派单门槛。用户复制文本先生成待校对字段，不默认完成地址/电话/价格核验。

上传先授权关联对象，限制类型、大小、内容魔数、哈希和恶意内容；扫描未通过不能当正式证据。下载重新鉴权、短期URL、私有存储、访问记录；文件ID不能跨客户关联。付款图片只能证明上传，不能证明资金到账。

R1-V只有GET，只允许批准的汇总字段。各模块mode/quality/observedAt独立；未知值null；不公开客户地址、银行明细或个人轨迹。GeoCore查询与路由继续走内部GeoPort，不杜撰跨库HTTP直写接口。

## 12. 错误码与客户端动作

| HTTP/code | 使用条件 | 客户端处理 |
|---|---|---|
| 400 VALIDATION_FAILED | 字段、格式、未知字段、时间无时区 | 定位field.path，不重发原无效请求 |
| 401 UNAUTHENTICATED | 凭据失效、收货验证失败 | 按对应身份重新验证，不退回公开权限做写操作 |
| 403 FORBIDDEN | 合法可见对象但无动作权限/职责冲突 | 不允许换角色或让前端跳过 |
| 404 NOT_FOUND | 不存在或不在授权范围 | 同样文案，不泄露存在性 |
| 409 INVALID_TRANSITION / SOURCE_CONFLICT | 状态不合法、重复件分配、已存在有效执行 | 获取现状，走合法异常/修订流程 |
| 409 IDEMPOTENCY_KEY_REUSED | 同键异请求 | 不能为了绕过失败随意换键支付 |
| 409 REQUEST_IN_PROGRESS | 同操作正在执行 | 按Retry-After查询/同键重试 |
| 409 CAPACITY_CONFLICT | 数据库排他约束：同一车辆该时段已被其他承诺占用 | 重新选择车辆或时间，不要原样重试 |
| 409 REQUEST_CONFLICT | 数据库唯一约束：并发创建了同一资源 | 刷新现状后再决定是否继续 |
| 409 CARRIER_BOOKING_ACTIVE / ASSIGNMENT_ACCEPTED | 取消订单时仍有有效快递委托或司机已接受的指派 | 先确认取消委托，或按已接受指派的异常流程处理 |
| 422 PROMISE_WINDOW_INVALID | 承诺的取件、送达窗口开始须早于结束，且取件开始须早于送达结束 | 修正窗口后重新提交 |
| 412 VERSION_CONFLICT | 主If-Match或被严格版本化的关联对象已变 | 刷新并让用户重新确认关键内容 |
| 422 HARD_CONSTRAINT_VIOLATION | 时效/装载/资格/区域不符合 | 展示具体拒绝原因，不提供强制突破按钮 |
| 422 INSUFFICIENT_BALANCE / SOURCE_NOT_CONFIRMED | 核销超额、未核验来源、渠道资金未结算 | 回到差异或核对队列 |
| 422 PAYMENT_REQUIRED / CREDIT_NOT_ACTIVE | 预付未完成核销或月结无效 | 支付/核销或申请合法例外，不直接派单 |
| 422 CAPABILITY_DISABLED / 423 CAPABILITY_PAUSED | 尚未开启或被暂停 | 保留已有事实，提示授权人员处理 |
| 428 IDEMPOTENCY_KEY_REQUIRED / PRECONDITION_REQUIRED | 缺少必需头 | 补全协议，不自动伪造版本 |
| 429 RATE_LIMITED / 503 UNAVAILABLE | 限流/依赖不可用 | 按Retry-After重试；已产生外部指令的仍查原单 |

现有PRD的OFFER_EXPIRED、PLAN_VERSION_CONFLICT、CAPACITY_CONFLICT、PARTNER_NOT_AVAILABLE、LOAD_NOT_RELEASED、ETA_UNCALIBRATED等稳定码继续使用对应409/422，不重编号。字段错误位于error.fields；不向调用者返回内部堆栈、渠道密钥或未授权对象明细。

## 13. 收货授权和结算账户取值

付款前以各端 settlement-accounts 查询已核验的脱敏账户及版本。外部端不接受任意 subjectId；新增账户以 ACCOUNT_CHANGE.currentAccountVersion=0 申报，服务端必须确认不存在既有账户；已有账户修改使用当前版本，重新复核审批。账户变更经批准后由 `post` 原子创建下一版本，旧版本不再可选作新退款、提现或外部结算申请。账户列表不向客户暴露平台完整银行流水。手工转账的公司收款账户只能引用已批准合同/支付指引中的公司账户，不能从客户自己的结算账户误选；相关收款指引及完整账户展示属于受控配置，未配置时关闭该收款方式。

司机通过 driverRecipientAuthorization 获取服务器已核验的收货授权。内部 recordRecipientAuthorization 根据本单登记收货人或明确委托证据签发；禁止司机自我授权。地址/收货人/执行计划变化即撤销，拒收或无法核验身份时走异常。授权记录不等于完成签收；driverDelivery 仍校验任务保管、货件集合和交付证据。

业务字段条件：ReceiptReport.method=BANK_TRANSFER 时 receivingAccountId 必填且属于公司批准收款账户；不满足返回422。WarehouseLine 用于出库时若指定库存行，inventoryId 与 inventoryVersion 必须同时提供，并校验归属；按SKU申请可不指定批次，但受理时由库存权威选择并锁定足量库存。结算规则的周/月/间隔字段须与周期模式一致，不满足返回422。
