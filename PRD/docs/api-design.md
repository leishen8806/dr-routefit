# DR RouteFit · 接口设计

2026-10-25 实施增量：[费用设置API](../../contracts/pricing-api.md)的8个操作已在本地服务实现并接入PostgreSQL；以OpenAPI的LOCAL_IMPLEMENTED_NOT_DEPLOYED标记区分其他待实现接口。页面、真实身份与KESS仍未接入此服务。

2026-10-25：[后台费用配置与试算](fee-settings-v0.1.md)已做本地原型。feeSave／feeTrial为本地动作，不是HTTP接口；生产价表审核发布、自动选价与报价落单接口仍按计价开发对照待补。

2026-10-25 [完整计价体系](delivery-pricing-system-v0.1.md)与[开发差距](pricing-development-map-v0.1.md)新增价表版本、计费原量、费目归属、折扣承担及差额要求。当前 OpenAPI 已新增费用草稿、独立费目、试算及版本查询；完整批准价表、自动选价与订单报价扩展尚未合入；不能仅凭现有 pricingPolicyVersionId 宣称计价系统完整。

2026-10-25 [渠道增补](telegram-and-driver-app-scope-v0.1.md)：客户为 Telegram Mini App＋Bot，司机为 iOS／Android App。复用业务接口；Telegram 认证、webhook、会话及设备接口仍待补齐，不把本接口包视为可直接上线 Bot 的完整协议。

| 项目 | 内容 |
| --- | --- |
| 状态 | v0.1 开发候选；机器契约见 `contracts/openapi.json`，R0-B 仍需评审冻结 |
| 版本 | v0.1 · 2026-10-24 |
| 需求依据 | [PRD V1.4 评审稿](PRD-V1.4-review.md) 3、5、6、9、13、15、21；当前基线 [V1.3](PRD-V1.3-final.md) |
| 覆盖范围 | 首期 R1、R1-M、R1-V；[首期页面](phase1-pages-and-ux.md) W01–W20、D01–D09、C01–C02、V01–V05 |
| 相关文档 | [数据库架构](database-architecture.md) · [开发标准](development-standards.md) · [系统边界](system-boundaries.md) · [术语表](glossary.md) |

当前开发入口为[接口包](../../contracts/README.md)：包含 OpenAPI 3.1、字段字典、逐端点权限/阶段/版本对象、流程与拒绝案例、实现迁移映射和正反样例。其中费用8个操作已本地实现，其余待实现；整体仍是待冻结候选契约，不是已部署服务。下文早期端点清单保留设计沿革；重合路由和字段以接口包为开发对照，不同时启用两套财务写入口。正式 PRD、RULE、AT 不变；新增范围以明确的后续需求及[客户门户分期](customer-portal-scope-v0.1.md)补充，发现未解决冲突应停止相关功能放行。

---

## 1. 接口分组

| 分组 | 基础路径 | 使用者 | 认证 | 首期 |
| --- | --- | --- | --- | --- |
| 运营接口 | `/api/ops/v1` | 运营 Web：调度、仓库、装载复核、财务、管理员 | OIDC 登录 + 服务端会话 | R1／R1-M |
| 司机接口 | `/api/driver/v1` | 司机 iOS／Android App：自营司机、合作司机 | OIDC + 设备绑定的刷新令牌 | R1／R1-M |
| 公开查询 | `/api/public/v1` | 客户与收货人的跟踪链接 | 不透明短期引用 | R1（按 D08／D11 批准启用） |
| 集成接口 | `/api/integration/v1` | 智序工场中控台的服务端适配器 | 服务对服务凭据 | R1-V |
| 内部端口 | 进程内或内网 | RouteFit ↔ GeoCore G1、快递、通知 | 服务内部 | 见第 10 章 |

- 四组接口分开部署路由、分开限流、分开审计；一组接口的凭据不能访问另一组。
- 客户门户/外部订单和 WMS 接入已由后续用户需求纳入规划，新增契约见本文后续闭环增补；公开跟踪链接与中控凭据不得用于这些写操作。合作方仅提供本人应付与结算申请入口；不提供快递司机端与中控写操作。

---

## 2. 通用约定

### 2.1 资源与动作

- 资源用复数名词、短横线连接：`/orders`、`/carrier-bookings`、`/custody-transfers`。
- **状态变化一律用动作接口**：`POST /{资源}/{id}/actions/{动作}`。不提供直接修改 `status` 字段的接口（[开发标准](development-standards.md) 5.1）。每个动作对应 PRD 6.3 状态转换表或 21.3.1 委托生命周期中的一行。
- 草稿阶段的字段编辑用 `PATCH`；非草稿对象只能通过动作改变。
- 不提供 `DELETE`；作废、取消、撤回都是动作（[数据库架构](database-architecture.md) 5.5）。

### 2.2 请求头

| 请求头 | 要求 |
| --- | --- |
| `Authorization` 或会话 Cookie | 必需（公开查询除外） |
| `Idempotency-Key` | 所有业务 `POST`／`PATCH` 必需；收货人验证握手按机器契约的 secret exception 处理；缺少返回 `428 IDEMPOTENCY_KEY_REQUIRED` |
| `If-Match` | 对已有对象执行动作或 `PATCH` 时必需，值为对象当前 `ETag`（即版本号）；缺少返回 `428 PRECONDITION_REQUIRED` |
| `Accept-Language` | `km`、`en`、`zh-Hans`；只影响错误的 `message` 文本，不影响数据 |
| `X-Request-Id` | 可选；不传时服务端生成，响应中回传 |

### 2.3 幂等

- 幂等键由客户端生成（建议 UUIDv7），作用域为"企业 + 主体 + 键"。
- 同键同内容：返回首次结果，响应头带 `Idempotent-Replayed: true`。
- 同键不同内容：`409 IDEMPOTENCY_KEY_REUSED`。
- 幂等记录保留 7 天（候选值）。司机离线事件另以事件 ID 永久去重（第 6 章），不受此期限影响。
- 对外部系统的调用（快递 API 启用后）沿用同一业务请求的幂等键，超时先查询，不换新键重试（PRD 21.3.2）。

### 2.4 数据格式

| 类别 | 规则 |
| --- | --- |
| 字段名 | `camelCase` |
| ID | 不透明字符串；面向人的编号另有 `orderNo` |
| 时间 | RFC 3339；服务端返回 UTC（`Z`）；设备上报带 `observedAt` |
| 时间窗 | `{ "start": "...", "end": "..." }`，左闭右开 |
| 金额 | `{ "amountMinor": 1250, "currency": "USD" }`；不返回浮点金额；USD 与 KHR 不合计 |
| 物理量 | 字段名带单位：`weightKg`、`lengthCm`、`volumeM3` |
| 未知 | 值为 `null`，并给出 `unknownReason`；**不返回 0 代替未知** |
| 枚举 | 契约中定义的稳定编码；客户端遇到未知枚举值时显示"未知"，不推断含义 |

**可信度包装：**可能过期或有来源差异的值（ETA、位置、货物尺寸、外部状态）使用统一结构：

```json
{
  "value": "2026-10-24T09:40:00Z",
  "estimateType": "UNCALIBRATED",
  "source": "MANUAL",
  "computedAt": "2026-10-24T08:55:12Z",
  "quality": "fresh",
  "dataVersion": "UNAVAILABLE"
}
```

### 2.5 列表

- 游标分页：`?limit=50&cursor=...`，`limit` 最大 100；响应 `{ "items": [...], "nextCursor": "..." }`。
- 过滤用查询参数：`?status=awaiting_dispatch&serviceLevel=S1&fulfillmentMode=PARCEL_CARRIER`。
- 排序用 `?sort=latestSafeDispatchAt`；默认排序在各端点说明。
- 列表只返回调用者有权看到的字段；仓库、财务角色看到的订单字段不同（首期页面 W02）。

### 2.6 版本

- 路径中的 `v1` 是主版本；新增字段、新增端点、新增可选参数不升主版本。
- 删除或改变字段含义须升主版本，旧版本保留到批准的退役日期，并在响应头 `Deprecation`／`Sunset` 中告知。
- 快照与事件在消息体内带 `schemaVersion`。

---

## 3. 错误

### 3.1 错误结构

与[开发标准](development-standards.md) 4.5 一致：

```json
{
  "error": {
    "code": "PLAN_VERSION_CONFLICT",
    "message": "路线已被他人更新，请刷新后重新确认。",
    "messageKey": "error.plan_version_conflict",
    "retryable": false,
    "details": { "expectedPlanVersion": 7, "currentPlanVersion": 8 },
    "requestId": "01J9Z3..."
  }
}
```

### 3.2 HTTP 状态与错误码

| HTTP | 错误码 | 含义 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 不符合契约（缺字段、非有限数值、无时区时间、未知枚举等） |
| 401 | `UNAUTHENTICATED` | 未登录或令牌失效 |
| 403 | `FORBIDDEN` | 已知对象但当前角色无此动作权限 |
| 404 | `NOT_FOUND` | 对象不存在**或不在调用者作用域内**；两种情况返回相同结果，不泄露对象是否存在（首期页面 G02） |
| 409 | `INVALID_TRANSITION` | 当前状态不允许此动作 |
| 409 | `PLAN_VERSION_CONFLICT` | 路线版本已变化（RULE-012） |
| 409 | `OFFER_EXPIRED` | 提案已过有效期（RULE-011） |
| 409 | `EXECUTION_ALREADY_ACTIVE` | 订单已有有效指派或快递委托（RULE-041） |
| 409 | `CAPACITY_CONFLICT` | 车辆时段或容量已被占用（AT-72） |
| 409 | `IDEMPOTENCY_KEY_REUSED` | 幂等键被用于不同内容 |
| 409 | `DUPLICATE_EXTERNAL_TRANSACTION` | 银行交易已核销（AT-38） |
| 412 | `VERSION_CONFLICT` | `If-Match` 与对象当前版本不一致 |
| 422 | `HARD_CONSTRAINT_VIOLATION` | 超载、门洞不适配、禁止堆叠等（RULE-007） |
| 422 | `LOAD_NOT_RELEASED` | 无有效装载放行，不能交接（RULE-031） |
| 422 | `OUT_OF_PILOT_SCOPE` | 区域、货类、时段等不在批准的试点范围（RULE-001） |
| 422 | `PILOT_NOT_APPROVED` | 试点参数或责任人未批准 |
| 422 | `CAPABILITY_DISABLED` | 功能开关关闭（如未启用的收款方式，RULE-039） |
| 422 | `ETA_UNCALIBRATED` | 不能据未校准 ETA 做自动承诺（RULE-003） |
| 422 | `PARTNER_NOT_AVAILABLE` | 合作方非可用状态或协议过期（RULE-042） |
| 423 | `CAPABILITY_PAUSED` | 该能力处于试点暂停中（PRD 15.1） |
| 428 | `IDEMPOTENCY_KEY_REQUIRED`／`PRECONDITION_REQUIRED` | 缺少必需请求头 |
| 429 | `RATE_LIMITED` | 超出限流 |
| 503 | `UNAVAILABLE` | 依赖服务（如 GeoPort）不可用；返回可执行的人工降级提示 |
| 504 | `TIMEOUT` | 依赖服务超时 |

GeoPort 透传的 `OUT_OF_COVERAGE`、`LOW_CONFIDENCE` 不作为 HTTP 错误，而是在结果的 `quality` 与 `unknownReason` 中返回，因为调用方仍可走人工确认。

---

## 4. 认证与授权

| 接口组 | 方式 | 说明 |
| --- | --- | --- |
| 运营 | OIDC 授权码 + PKCE；服务端会话（`HttpOnly`、`Secure`、`SameSite` Cookie）+ CSRF 令牌 | 身份提供方待定；不做公开企业注册 |
| 司机 | OIDC + PKCE；短期访问令牌 + 绑定设备的刷新令牌 | 刷新令牌可远程撤销；合作方退出或司机停用时立即撤销 |
| 公开查询 | 路径中的不透明引用（至少 128 位随机数） | 服务端只存哈希；到期或撤销后返回与"不存在"相同的结果 |
| 集成 | OAuth2 客户端凭据或双向 TLS，范围 `ops-snapshot:read` | 只在中控服务端使用；前端不持有业务密钥（PRD 21.6） |

授权规则：

- 企业作用域只从认证主体推导；请求体中的 `companyId` 只做一致性校验（AT-14）。
- 每个端点同时校验角色和对象：例如合作司机只能读写被指派给自己的任务（PRD 11.1.1）；装载放行只能由持有 `LOAD_REVIEWER` 角色的主体执行。
- 暂停与恢复：报告、暂停对应能力、全局停单、恢复分属不同角色（PRD 15.1）；外部人员没有任何暂停接口。

---

## 5. 运营接口 `/api/ops/v1`

表中"页面"列对应[首期页面](phase1-pages-and-ux.md)的 ID。

### 5.1 调度工作台与订单

| 方法与路径 | 用途 | 页面 | 关联 |
| --- | --- | --- | --- |
| `GET /dispatch/board` | 待派、待司机确认、待揽收、在途风险、待指派已承诺队列；默认按最晚安全派发时刻排序，S1 置顶 | W01 | PRD 3.8、11.1 |
| `GET /orders` | 订单列表，按角色返回不同字段 | W02 | |
| `POST /orders` | 新建草稿 | W03 | |
| `GET /orders/{orderId}` | 订单详情：三种时间、履约实例、件级去向、事件、证据、财务分栏 | W05 | |
| `PATCH /orders/{orderId}` | 编辑草稿 | W03 | |
| `POST /orders/{orderId}/actions/submit` | 提交核验（`draft → validating`） | W03 | PRD 6.3 |
| `POST /orders/{orderId}/locations` | 新增位置快照（选点、地标、入口、确认状态） | W03 | RULE-009 |
| `POST /orders/{orderId}/locations/{locationId}/actions/confirm` | 电话确认位置 | W03 | RULE-009 |
| `GET /geo/address-candidates?q=...` | 经 GeoPort 查询候选坐标；只返回候选，不自动选定 | W03 | PRD 5.2 |
| `POST /orders/{orderId}/items` | 新增逐件货物（含尺寸重量来源） | W03 | RULE-006 |
| `GET /orders/{orderId}/timeline` | 事件时间线 | W05 | |
| `POST /orders/{orderId}/actions/cancel` | 取货前取消；已取货时返回 `409 INVALID_TRANSITION` 并提示走退回 | W05 | AT-70 |

### 5.2 报价与承诺

| 方法与路径 | 用途 | 页面 | 关联 |
| --- | --- | --- | --- |
| `POST /orders/{orderId}/quotes` | 生成报价版本 | W04 | PRD 3.7 |
| `POST /quotes/{quoteId}/actions/record-customer-confirmation` | 记录客户确认报价的凭证；**不形成承诺** | W04 | RULE-037 |
| `POST /orders/{orderId}/promise-checks` | 承诺前可行性检查：资源、装载、ETA 类型、既有承诺、服务范围；只返回结果，不写业务 | W04 | PRD 3.6、RULE-037 |
| `POST /orders/{orderId}/promises` | 确认服务承诺（附客户同意凭证与承诺依据运力）；变更承诺时带 `supersedesPromiseId` | W04 | PRD 3.6、3.8 |
| `GET /orders/{orderId}/promises` | 承诺历史版本 | W05 | |

### 5.3 运力与合作方

| 方法与路径 | 用途 | 页面 | 关联 |
| --- | --- | --- | --- |
| `GET /vehicles`、`GET /vehicles/{id}` | 车辆、实测规格版本、占用 | W07 | |
| `POST /vehicles/{id}/spec-versions` | 登记新的车厢实测规格（只追加） | W07 | PRD 4.6 |
| `GET /vehicles/{id}/reservations` | 车辆预留与占用时间线 | W06、W07 | PRD 3.8 |
| `GET /drivers`、`POST /drivers/{id}/qualifications` | 司机与资格 | W07 | |
| `GET /shifts`、`POST /shifts` | 班次（定位采集授权依据） | W07 | PRD 8 |
| `GET /carrier-partners`、`POST /carrier-partners` | 合作方列表与登记 | W08 | RULE-042 |
| `POST /carrier-partners/{id}/agreements` | 新协议版本 | W08 | |
| `POST /carrier-partners/{id}/actions/{verify|suspend|reinstate|exit}` | 合作方状态变化；退出阻断新任务，不删除在途、欠款与争议 | W08 | PRD 21.3 |
| `POST /capacity-availabilities` | 登记合作车辆已确认的可用窗口 | W08 | PRD 21.3 |

### 5.4 人工派单

| 方法与路径 | 用途 | 页面 | 关联 |
| --- | --- | --- | --- |
| `GET /orders/{orderId}/dispatch-candidates` | 自营与合作候选及不可用原因（窗口、装载、资格、费用、已有任务）；首期是规则校验结果，**不是算法推荐** | W06 | RULE-041 |
| `POST /orders/{orderId}/assignments` | 发提案：创建执行、指派（`offered`）、提案软预留；返回 `expiresAt` | W06 | RULE-011 |
| `POST /assignments/{id}/actions/revoke` | 撤回未接受的提案或取货前的指派 | W06 | PRD 6.3 |
| `POST /assignments/{id}/actions/reassign` | 取货前改派：原子结束旧执行并发出新提案 | W06 | PRD 3.8 |
| `POST /assignments/{id}/actions/vehicle-swap` | 故障换车：须新车装载复核与实物交接 | W14 | AT-70 |

### 5.5 仓库、装载与交接

| 方法与路径 | 用途 | 页面 | 关联 |
| --- | --- | --- | --- |
| `GET /warehouse/queue` | 待复核、待取货、待快递揽收、待退回点收 | W11 | |
| `POST /orders/{orderId}/load-reviews` | 提交装载复核结果；`REJECTED` 没有覆盖入口 | W12 | RULE-031、AT-67 |
| `POST /custody-transfers` | 发起交接（逐件、包装与封签、地点时间） | W13 | PRD 21.3.1 |
| `POST /custody-transfers/{id}/actions/confirm` | 一方签认；双方都签认后交接生效 | W13 | |
| `POST /custody-transfers/{id}/actions/report-discrepancy` | 报差异：保持原保管方，创建阻断异常 | W13 | AT-23 |

### 5.6 快递委托（R1-M）

| 方法与路径 | 用途 | 页面 | 关联 |
| --- | --- | --- | --- |
| `POST /orders/{orderId}/carrier-bookings` | 新建委托草稿 | W09 | RULE-043 |
| `POST /carrier-bookings/{id}/actions/request` | 离开草稿（`pending_confirmation`），同时创建执行；与有效指派互斥 | W09 | RULE-041 |
| `POST /carrier-bookings/{id}/contact-logs` | 记录人工联系；结果"未知"时必须指定跟进人 | W09 | PRD 21.3.1 |
| `POST /carrier-bookings/{id}/actions/confirm` | 登记承运商确认与外部单号 | W09 | |
| `POST /carrier-bookings/{id}/events` | 人工录入承运商事件（原始状态、发生时间、证据）；按去重键防重复 | W10 | RULE-045 |
| `POST /carrier-bookings/{id}/actions/verify-delivery` | 按凭证策略核验承运商报告的送达 | W10 | PRD 21.3.1 |
| `POST /carrier-bookings/{id}/actions/request-cancel` | 申请取消（`cancel_requested`） | W09 | RULE-044 |
| `POST /carrier-bookings/{id}/actions/confirm-cancel` | 承运商确认取消且货物在可控保管方后才生效 | W09 | RULE-044 |

### 5.7 异常与退回

| 方法与路径 | 用途 | 页面 | 关联 |
| --- | --- | --- | --- |
| `GET /exceptions`、`GET /exceptions/{id}` | 异常队列与详情 | W14 | |
| `POST /exceptions` | 运营侧登记异常 | W14 | |
| `POST /exceptions/{id}/actions/{assign|resolve|close}` | 指派负责人、处置、结案；结案须每件货去向闭合 | W14 | RULE-032 |
| `POST /orders/{orderId}/return-tasks` | 申请退回 | W15 | RULE-018 |
| `POST /return-tasks/{id}/actions/{authorize|assign|receive|inspect|close}` | 退回生命周期；点收差异不能结案 | W15 | AT-59 |

### 5.8 财务

| 方法与路径 | 用途 | 页面 | 关联 |
| --- | --- | --- | --- |
| `GET /finance/collections` | 按币种与受益方分账的收款列表 | W16 | RULE-020 |
| `POST /collections/{id}/verifications` | 历史核验入口；同一银行交易只形成一次资金事实，可分配多笔核销且不得超额 | W16 | RULE-021、AT-38 |
| `POST /collections/{id}/corrections` | 审批冲正，原记录保留 | W16 | PRD 9.3 |
| `GET /finance/remittances`、`POST /remittances/{id}/actions/{verify|reconcile}` | 司机交款核对；差额保持开放 | W17 | RULE-022 |
| `GET /finance/partner-payables` | 合作方应付 | W18 | RULE-046 |
| `POST /partner-payables/{id}/actions/{verify|dispute}` | 核对、争议 | W18 | |
| `POST /partner-payables/{id}/payments` | 登记付款（附凭证）；不代付、不自动划转 | W18 | PRD 9.4 |

### 5.9 基础资料、设置与通知

| 方法与路径 | 用途 | 页面 | 关联 |
| --- | --- | --- | --- |
| `GET/POST /cargo-templates`、`POST /cargo-templates/{id}/versions` | 货物模板与版本 | W19 | RULE-006 |
| `GET/POST /load-patterns` | 组合装载模式与兼容表 | W19 | PRD 4.3 |
| `POST /address-corrections` | 提交地址纠错候选（经 GeoPort），不修改公共地点真值 | W19 | AT-65 |
| `GET /pilot-policies`、`POST /pilot-policies/{id}/actions/approve` | 试点参数版本与批准 | W20 | PRD 附录 C |
| `GET /feature-flags`、`PUT /feature-flags/{capability}` | 功能开关；改动需授权并写审计 | W20 | RULE-052 |
| `POST /degradations`、`POST /degradations/{id}/actions/end` | 进入与结束人工降级 | W20 | PRD 6.5 |
| `POST /pauses` | 暂停对应能力或全局停单（按角色） | W20 | PRD 15.1 |
| `POST /pauses/{id}/approvals` | 恢复批准；运营负责人与人类集成负责人各一条 | W20 | PRD 15.1 |
| `POST /pauses/{id}/actions/resume` | 两条批准齐全后恢复 | W20 | PRD 15.1 |
| `GET /audit-events` | 审计查询（受限角色） | W20 | |
| `GET/POST /scene-bindings` | 真实仓库与场景分区映射 | W20 | PRD 21.6 |
| `POST /orders/{orderId}/notifications` | 按批准模板发送通知；记录结果 | C01 | PRD 7.4 |
| `POST /orders/{orderId}/tracking-links`、`POST /tracking-links/{id}/actions/revoke` | 签发与撤销跟踪链接 | C02 | PRD 21.6 |

### 5.10 文件

| 方法与路径 | 用途 |
| --- | --- |
| `POST /uploads` | 申请上传：声明类型、大小、`sha256`；返回短期预签名地址与 `uploadId` |
| `POST /uploads/{uploadId}/actions/complete` | 服务端校验对象存在、大小与哈希一致后生成 `evidenceFileId` |
| `GET /evidence-files/{id}/download-url` | 签发短期下载地址（按对象授权） |

允许的类型：`image/jpeg`、`image/png`、`application/pdf`；单文件上限 10 MB（候选值）。对外分享的照片去除 EXIF 位置信息。

---

## 6. 司机接口 `/api/driver/v1`

### 6.1 端点

| 方法与路径 | 用途 | 页面 | 关联 |
| --- | --- | --- | --- |
| `GET /me` | 身份、所属合作方、角色、语言、定位授权说明 | D09 | |
| `POST /me/shift/actions/{start|end}` | 开始、结束班次；同时开启、关闭定位采集窗口 | D01 | PRD 8 |
| `GET /sync?cursor=...` | 拉取变化：任务、提案、撤回、策略参数（提案 TTL 等）、服务器时间 | D01、D08 | |
| `POST /assignments/{id}/actions/accept` | 接受提案。**必须在线同步完成**，服务器成功才算接单 | D02 | RULE-011、RULE-012 |
| `POST /assignments/{id}/actions/reject` | 拒绝提案（附原因） | D02 | AT-17 |
| `POST /sync/events` | 批量上报离线可记录的事件（见 6.2） | D04–D08 | PRD 6.2 |
| `POST /locations` | 批量上报定位点；服务端转交 GeoPort，授权窗口外的点拒收 | D01 | RULE-010 |
| `POST /uploads`、`POST /uploads/{id}/actions/complete` | 同运营接口 5.10 | D04、D05 | |
| `GET /me/remittances` | 本人交款单与差额（只读） | D06 | |

接受提案的请求：

```http
POST /api/driver/v1/assignments/01J9Z4.../actions/accept
Idempotency-Key: 01J9Z4K2V8...
If-Match: "3"
Content-Type: application/json

{ "planVersion": 7, "acceptedAt": "2026-10-24T08:42:10+07:00" }
```

可能的结果：`200`（返回指派与任务详情）、`409 OFFER_EXPIRED`、`409 PLAN_VERSION_CONFLICT`、`409 CAPACITY_CONFLICT`。响应丢失后重试，返回首次结果（AT-71）。

### 6.2 离线事件同步

司机端在离线时可记录的事件：到达、取货交接签认、出发、交付（含部分收货）、收款申报、异常上报、退回执行。**不能离线接受提案**，也不能把转账标为已到账（PRD 6.2）。

```json
POST /api/driver/v1/sync/events
{
  "deviceId": "dev-7c1e",
  "events": [
    {
      "eventId": "01J9Z5A1...",
      "type": "DELIVERY_RECORDED",
      "observedAt": "2026-10-24T10:05:31+07:00",
      "taskRef": { "assignmentId": "01J9Z4...", "planVersion": 7 },
      "payload": {
        "deliveredItems": ["ITEM-1", "ITEM-2"],
        "remainingItems": ["ITEM-3"],
        "proofEvidenceFileIds": ["01J9Z5B7..."]
      }
    }
  ]
}
```

- `eventId` 由设备生成，作为永久去重键；同一事件重传返回原结果。
- 服务端按每台设备的事件顺序处理，并以服务端状态为准。
- 每个事件单独返回结果：

| 结果 | 含义 | 客户端处理 |
| --- | --- | --- |
| `APPLIED` | 已生效 | 从待上传队列移除 |
| `DUPLICATE` | 之前已生效，附首次结果 | 移除 |
| `REJECTED` | 违反规则，附错误码 | 显示原因，按提示处理 |
| `NEEDS_REVIEW` | 与调度代录或其他事件冲突（PRD 6.5） | 保留记录，等待调度员裁定 |

- 每批最多 100 个事件；一批中某个事件失败不影响其他事件。

### 6.3 定位上报

```json
POST /api/driver/v1/locations
{
  "points": [
    { "clientPointId": "p-000123", "observedAt": "2026-10-24T10:01:15+07:00",
      "lat": 11.5564, "lng": 104.9282, "accuracyM": 12.0,
      "deviceState": { "permission": "ALWAYS", "battery": 0.64, "foreground": false } }
  ]
}
```

延迟补传的点保留原 `observedAt`，不会成为当前位置（AT-12）。

---

## 7. 公开查询 `/api/public/v1`

| 方法与路径 | 用途 | 页面 |
| --- | --- | --- |
| `GET /tracking/{ref}` | 授权订单状态、平台承诺时间、当前预计时间（带类型与更新时间）、联系方式 | C02 |

- 不返回电话、地址、姓名、其他客户信息、车队轨迹或财务明细。
- 引用过期、撤销或不存在都返回相同的 `404`，页面显示获批准的联系入口。
- 严格限流；响应 `Cache-Control: no-store`。

---

## 8. 集成接口 `/api/integration/v1`（R1-V）

| 方法与路径 | 用途 | 页面 |
| --- | --- | --- |
| `GET /ops-snapshot` | 当前权威只读快照；支持 `If-None-Match` | V01–V05 |
| `GET /ops-snapshot?afterSequence=...` | 断线重连时取最新快照（不提供增量补丁，PRD 21.6） | V05 |

快照 `RouteFitOpsSnapshot v1` 结构概要（字段以 R0-B 契约为准）：

```json
{
  "schemaVersion": "1.0.0",
  "snapshotId": "01J9Z6...",
  "sequence": 1842,
  "sourceSystem": "routefit",
  "operatingCompanyId": "01J8...",
  "mode": "live",
  "generatedAt": "2026-10-24T03:10:00Z",
  "dataAsOf": "2026-10-24T03:09:45Z",
  "quality": "fresh",
  "window": { "start": "2026-10-23T17:00:00Z", "end": "2026-10-24T17:00:00Z", "timeZone": "Asia/Phnom_Penh" },
  "metricDefinitionsVersion": "2026.10-a",
  "sceneBindings": [{ "warehouseRef": "WH-01", "sceneZone": "W1", "bindingVersion": 1 }],
  "modules": {
    "fulfillmentOverview": {
      "mode": "live", "quality": "fresh",
      "orders": { "byMode": { "OWN_FLEET": 12, "PARTNER_VEHICLE": 3, "PARCEL_CARRIER": null },
                  "unknownReason": { "PARCEL_CARRIER": "NOT_ENABLED" } },
      "carrierBookings": { "count": null, "unknownReason": "NOT_ENABLED" },
      "onTimeRate": { "value": null, "denominator": 0, "unknownReason": "NO_SAMPLES" }
    },
    "vehiclePositions": { "mode": "live", "quality": "stale", "lastObservedAt": "2026-10-24T03:01:02Z", "items": [] },
    "exceptions": { "mode": "live", "quality": "fresh", "items": [
      { "exceptionId": "01J9...", "dueAt": "2026-10-24T04:00:00Z", "ownerRole": "DISPATCHER",
        "status": "OPEN", "openPath": "/exceptions/01J9..." } ] },
    "finance": { "mode": "unavailable", "unknownReason": "AUDIENCE_NOT_AUTHORIZED" },
    "routeOpportunities": { "mode": "unavailable", "unknownReason": "NOT_ENABLED" },
    "inventory": { "mode": "unavailable", "unknownReason": "NOT_INTEGRATED" }
  }
}
```

- 每个模块独立标模式与质量；没有来源时值为 `null` 加原因，**不返回 0**（PRD 21.6）。
- 订单数与快递委托数分开，不相加。
- 跳转只给出非敏感的 `openPath`；用户点击后进入 RouteFit 并重新认证（V03）。
- 访客大屏使用单独的客户端凭据，快照只含批准的汇总模块。
- 中控台不能通过本组接口写入任何数据。

---

## 9. 领域事件

首期事件只在 RouteFit 内部使用，通过发件箱表可靠投递给通知、快照生成和审计等消费者，不引入消息中间件（PRD 21.6）。

### 9.1 信封

```json
{
  "eventId": "01J9Z7...",
  "eventType": "assignment.accepted",
  "schemaVersion": "1.0.0",
  "occurredAt": "2026-10-24T01:42:10Z",
  "companyId": "01J8...",
  "aggregate": { "type": "Assignment", "id": "01J9Z4...", "version": 4 },
  "correlationId": "01J9Z3...",
  "causationId": "01J9Z4K2V8...",
  "payload": { }
}
```

消费者按 `eventId` 去重，至少一次投递。

### 9.2 首期事件

| 事件 | 触发 | 主要消费者 |
| --- | --- | --- |
| `order.submitted`、`order.validated`、`order.cancelled` | 订单状态变化 | 快照、审计 |
| `quote.customer_confirmed`、`promise.accepted`、`promise.superseded` | 报价与承诺 | 通知、快照 |
| `assignment.offered`、`assignment.accepted`、`assignment.rejected`、`assignment.expired`、`assignment.revoked`、`assignment.superseded` | 指派生命周期 | 司机推送、快照 |
| `reservation.expired` | 承诺级预留过期 | 升级提醒（PRD 3.8） |
| `load_review.recorded`、`load_review.invalidated` | 装载复核 | 仓库队列 |
| `custody.transferred`、`custody.discrepancy_reported` | 交接 | 订单状态、异常 |
| `delivery.recorded`、`delivery.partial_recorded` | 交付 | 通知、财务、快照 |
| `carrier_booking.*`、`carrier_event.received` | 快递委托与事件 | 跟进队列、快照 |
| `exception.opened`、`exception.closed` | 异常 | 快照、通知 |
| `return_task.*` | 退回 | 仓库队列 |
| `collection.reported`、`collection.verified`、`collection.mismatch` | 收款 | 财务、快照 |
| `remittance.discrepancy` | 交款差额 | 财务 |
| `degradation.started`、`degradation.ended`、`pause.started`、`pause.resumed` | 降级与暂停 | 全端横幅、快照 |

---

## 10. 内部端口

### 10.1 GeoPort（RouteFit → GeoCore G1）

| 操作 | 输入 | 输出 | 阶段 |
| --- | --- | --- | --- |
| `resolveAddress` | 地址原文、地标、参考点、企业作用域 | 候选坐标列表（来源、精度、留存依据） | R0-B 合成；真实调用按批准契约 |
| `reverseGeocode` | 坐标 | 地址候选 | 同上 |
| `confirmAddress` | 订单位置快照 | 地址库记录或纠错候选；不改公共地点真值 | R1 |
| `ingestLocations` | 定位点批次、授权窗口 ID | 每点的接收结果 | R1 |
| `getLatestLocation` | 司机或车辆 | 位置、观测时间、精度、来源；**不判断是否过期** | R1 |
| `getTravelTimeMatrix`、`getRoute` | 起终点、出发时间 | 道路行驶时间与路线，带供应商与适配器版本 | R2 按需 |
| `getCapabilities` | — | 支持的操作、覆盖范围、当前可用性 | R0-B |

失败统一返回 `UNAVAILABLE`、`TIMEOUT`、`OUT_OF_COVERAGE`、`LOW_CONFIDENCE`、`FORBIDDEN`、`UNSUPPORTED`；RouteFit 据此进入人工降级（PRD 6.5），不伪造路线或 ETA。整趟履约 P90、承诺与派车由 RouteFit 负责（PRD 5.1）。

### 10.2 CarrierPort（RouteFit → 快递企业）

- 首期只有**人工实现**：上述 5.6 的运营接口就是 CarrierPort 的人工适配，记录操作人、渠道和证据。
- 后续 API 能力（PRD 21.3.2）：`getCapabilities`、`quote`、`createBooking`、`lookupBooking`、`cancelBooking`、`track`、`getProof`。按承运商分别声明支持情况；启用前核对官方权限、沙箱、签名、回调认证、幂等与超时查询能力。
- 回调接口（启用 API 后）：`POST /api/integration/v1/carriers/{partnerCode}/events`，校验签名，按 `providerEventId` 或去重键入收件箱。

### 10.3 NotificationPort

`send(templateCode, templateVersion, locale, recipientRef, variables)` → `{ messageId, status }`。渠道待 D08 确定；发送失败转人工跟进，"已发送"不代表客户已读或已同意（首期页面 3.6）。

---

## 11. 限流（候选值）

| 接口组 | 限制 |
| --- | --- |
| 运营 | 每用户每分钟 300 次 |
| 司机 | 每设备每分钟 120 次；定位每设备每分钟 10 批 |
| 公开查询 | 每个引用每分钟 30 次；每个来源地址每分钟 60 次 |
| 集成 | 每客户端每分钟 60 次 |

具体数值在 R0-B 压测后确定（PRD 17.1）。

---

## 12. 页面与接口对照

| 页面 | 主要接口 |
| --- | --- |
| G01／G02 | OIDC 登录；`404 NOT_FOUND`／`403 FORBIDDEN`／`422 CAPABILITY_DISABLED` 的统一页面 |
| W01 | `GET /dispatch/board` |
| W02、W05 | `GET /orders`、`GET /orders/{id}`、`GET /orders/{id}/timeline` |
| W03 | `POST /orders`、`PATCH /orders/{id}`、`/locations`、`/items`、`/geo/address-candidates`、`actions/submit` |
| W04 | `/quotes`、`/promise-checks`、`/promises` |
| W06 | `/dispatch-candidates`、`POST /orders/{id}/assignments`、`/assignments/{id}/actions/*` |
| W07 | `/vehicles`、`/drivers`、`/shifts` |
| W08 | `/carrier-partners`、`/capacity-availabilities` |
| W09、W10 | `/carrier-bookings/*` |
| W11–W13 | `/warehouse/queue`、`/load-reviews`、`/custody-transfers` |
| W14、W15 | `/exceptions`、`/return-tasks` |
| W16–W18 | `/finance/*`、`/collections/*`、`/remittances/*`、`/partner-payables/*` |
| W19 | `/cargo-templates`、`/load-patterns`、`/address-corrections` |
| W20 | `/pilot-policies`、`/feature-flags`、`/degradations`、`/pauses`、`/audit-events`、`/scene-bindings` |
| D01–D09 | 司机接口第 6 章 |
| C01、C02 | `/notifications`、`/tracking-links`、`GET /api/public/v1/tracking/{ref}` |
| V01–V05 | `GET /api/integration/v1/ops-snapshot` |

---

## 13. 待定事项

| 事项 | 关联 |
| --- | --- |
| 身份提供方与登录方式 | 本文第 4 章 |
| 通知渠道 | D08 |
| 客户查询入口是否启用、可见字段 | D08、D11 |
| 中控台身份映射、可见字段、刷新与过期门槛 | D22 |
| 快递企业 API 是否启用 | D20 |
| 幂等记录保留期、限流、上传大小 | 第 2.3、5.10、11 章候选值 |
| 机器契约（`contracts/openapi.json`、内嵌 JSON Schema、正反样例） | 已有开发候选包，正式冻结仍属 R0-B |

## 后续闭环接口增补

依据 [F01–F09 规划](future-closure-plan-v0.1.md)。本节是待冻结契约清单，不表示路由已经存在；既有请求头、权限、版本、幂等与错误约定继续适用。客户门户（首期不要求原生 APP）新增候选 `/api/customer/v1`，WMS 新增候选 `/api/warehouse/v1`，分别认证与限流；既有 `/api/integration/v1` 继续只读中控，不兼作外部派单写入口。

| 候选资源与动作 | 责任组 | 核心约束 |
|---|---|---|
| `POST /orders/{id}/delivery-records` | driver | 件级实收、剩余、凭证、任务版本；服务端验证收款放货条件，离线仅暂存证据 |
| 既有 return-tasks 增补到达、差异和检验记录 | driver / ops 各自授权 | 复用退回资源；到达与仓库 receive 分离；inspect 才形成库存处置依据 |
| `/fee-decisions` 的 submit/approve/reject/apply | ops | 引用订单、原因、费用版本、配送/保费独立裁定；审批人不能凭客户端声明取得财务权限 |
| `/refunds` 的 request/approve/reject/record-result/reconcile | customer 请求；ops 审核核对 | 源收款引用、同币种分项金额、原业务幂等键；结果未知先查询，成功/预留可退额共同防超额 |
| `/withdrawals` 的 request/cancel/approve/reject/record-payment/reconcile | driver / ops | 原子预留、脱敏收款账户版本、付款凭证；创建申请时服务端按企业＋币种的 7／14／30 天周期、可提现余额门槛及 `AND`／`OR` 生效规则复验；申请主体不能自行核验到账 |
| `/incident-transfers` 及逐件分配/交接动作 | ops / driver | 父单关联，件级唯一分配，实际交接才转保管；费用另记 |
| `/external-orders` 导入/修订/dispatch-request 与结果回传 | customer / warehouse | 企业+来源+外部编号去重，冲突进入修订；客户确认有效报价后仍需调度校验 |
| 库存预留/释放/点收/检验动作 | ops / warehouse | 明确权威仓库和对象版本，外部回传失败不双重扣减 |

新增事件候选：DeliveryPartiallyRecorded、ReturnReceived、ReturnInspected、FeeDecisionApplied、RefundStatusChanged、WithdrawalStatusChanged、InventoryDispositionRecorded；复用现有事件信封，包含企业、聚合 ID/版本、业务请求 ID、事件 ID、发生时间和模式。事务提交后可靠投递；消费方幂等、乱序校验和重放不能再次退款或交接。

并发/错误语义：版本过期、余额或可退额不足、重复件分配、权限不足、外部结果未知分别返回可识别原因；错误码最终在 OpenAPI 冻结，不用通用成功码隐藏 unknown。审批/执行/核验均由服务端授权，公开跟踪令牌不得提交写动作。正式实现须补异常响应、回调验签和对账恢复，不仅列出成功端点。

## 地图与导航成本控制增补

依据[地图成本专项](map-cost-optimization-v0.1.md)，保持v0.1草案。GeoPort对每次调用记录用途、供应商、SKU、计费单位或矩阵元素数、请求版本、耗时与结果质量；估算费用和供应商实际账单分开。位置上报不触发逐点逆地理编码或全路线重算。

候选道路计算前使用自有业务数据过滤资格、容量、区域和任务冲突；必要时逐步扩大候选。相同进行中请求可合并，持久缓存须遵守数据来源授权。调用预算不足、服务故障、数据未知与确实无可行解分别返回语义；限流/重试有上限，不换幂等键反复请求或伪造成功。

司机导航入口生成当前授权站点的外部导航链接，不输出其他客户地址；打开或返回导航不产生履约写动作。收费服务端凭据不进入静态Demo；浏览器地图凭据按供应商要求限制域名及API。具体供应商、配额和导航能力未冻结。

## 合作方周期结算候选契约

2026-10-24 实现增补：Demo 的 `settlement-model.mjs` 已提供上述交互的本地命令、版本和幂等校验，前端通过统一 `model.apply` 调用；这不是 HTTP API。模拟发送带源账项版本快照，余额变化时拒绝旧确认；部分核验更新原订单，原核验入口不能覆盖已登记的分笔收款。生产接口、调度器与发送渠道仍待实现，见[验证记录](../../prototype/records/2026-10-24-settlement/README.md)。

客户应收与承运应付共同使用按主体配置的结算策略，分方向授权。候选动作包括规则预览／批准生效、账单草稿生成／确认、催收草稿生成／确认发送、任务领取／跟进；外部发送必须在发送时复核权限、版本及未结余额。预付客户配置账期不自动取得月结准入。

后台调度按已生效规则生成内部任务，任务和通知分别记录，已读不代表业务完成。重试／补建按企业、主体、方向、逻辑期间或账单及提醒阶段幂等；已确认账单不得因策略版本变更重复生成。返回出账日、合同到期日、预计收付日、下一提醒时间、未结／争议／待核销金额及责任人。催收引用原账，不重复产生应收；结果失败或未知不能标成已发送或已收款。具体接口仍待实现。

依据[合作结算与资金规划](partner-settlement-and-funds-v0.1.md)，复用既有合作应付、付款核验和提现动作；补充结算策略版本、账单生成/核对/差异、批次批准、付款结果登记/核验以及只读资金日历。具体路径待契约冻结，不宣称已提供这些接口。

写动作沿用幂等键、对象版本、企业及财务权限校验。服务端按同一底层应付校验跨提现/批次的可付额，禁止重复预留或付款；失败、未知、处理中与成功分别返回。调度无付款权限，合作方仅见授权主体账项，中控只读；付款人与结果核验人分离。响应区分合同到期日、预计和实际付款日，客户月结未到账不自动修改合作应付期限。余额与预测按币种、来源、核验时间返回，不输出无依据的“可投资资金池”。


## 财务资金事实与核销动作增补（候选）

详见[财务闭环设计 §4–6](financial-closure-design-v0.1.md)。目标动作分开收款申报／核验、银行流水导入／匹配、核销分配／撤销核销、司机交款／点收、付款申请／批准／执行登记／结果查询／独立核验、差异批准、锁期及会计导出。当前不是已发布 HTTP 接口。

一笔资金可关联多个账项，多笔资金可结一项；响应分别返回已确认、已分配、待分配、未结、争议和预留金额。分配批次同事务验证来源与目标，拒绝超配及跨公司／币种／无授权主体；重复请求不重复占用。付款登记不能返回已核销，未知结果先查询同一指令；回调验签、事件去重与资金交易去重分别实施。审批人自批及执行人自核验均由服务端身份约束，不仅按角色隐藏按钮。

原 settlementCollect 本地动作合并核验与分配，部分金额仍标 mismatch；payablePay/withdrawPaid 合并登记与已付。这些当前行为需迁移，不能作为新 API 成功语义。COD 首期启用待确认，未启用拒绝代收／返款动作。


## 跨端财务同步更新（2026-10-24）

新增本地 applyFinance 命令、financeProjection 权限裁剪与幂等／版本检查；这不是HTTP服务。生产需从可信会话映射 personId，不能接受客户端自报身份。待办、各端订单账、复核、审批、点收、核销、付款结果、报表／导出契约见专项；网银、回调与后台通知未接。

以[跨端需求与报表 v0.1](cross-end-finance-and-reports-v0.1.md)为最新增补，保持本文草案状态；此前未实现／待确认描述为历史阶段记录，本次实现边界和证据以新专项为准。


## KESS 接入与再次复核（2026-10-24）

KESS 为收款渠道。服务端支付意向须从授权订单应收取金额；创建／主动查询走 KESS WebPay V2。客户端不能提交成功状态；回调未接入，不能把返回页当收款确认。服务端适配与未实现接口边界见 [KESS 接入](kess-payment-integration-v0.1.md)。

## 2026-10-25 本地受理实现记录

新增 [订单受理输入切片](order-intake-implementation-v0.1.md)：219契约操作中25个本机实现、194个仅设计；字段与实调示例见 [受理接口](../../contracts/order-intake-api.md)。不修改正式PRD/RULE/AT。

## 005固定费报价实现

[订单报价接口](../../contracts/order-quotes-api.md)新增创建与读取，完整契约220操作、27本机实现、193仅设计。用户确认Slogan见[品牌记录](../../brand/SLOGAN.md)。正式PRD/RULE/AT不变。
