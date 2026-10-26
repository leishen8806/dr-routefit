# 订单录入接口开发对照 v0.1

2026-10-25 · **已实现本地服务，尚未部署。** 这是P01订单报价主线的录单部分；当前可接客户选择、录单、订单列表、详情与草稿编辑。不会生成有效报价、应收、收款或派单。

与8个[费用API](pricing-api.md)和4个[策略审核API](pricing-policy-api.md)运行在同一服务下，共17个本地实现操作。大旺可从 `http://127.0.0.1:4180/dev/openapi.json` 导入**仅包含已实现接口**的OpenAPI；完整[机器契约](openapi.json)还包含198个未实现操作，不能把它们当作可调用服务。

## 1. 五个可接接口

| 方法／路径 | 权限 | 请求与结果 |
|---|---|---|
| GET `/api/ops/v1/customers` | orders:read | 当前企业、当前主体获授权的启用客户；items={id,name}，nextCursor |
| POST `/api/ops/v1/orders` | orders:create | 完整OrderDraft；201 OrderDetail、ETag="1" |
| GET `/api/ops/v1/orders` | orders:read | items为OrderSummary，nextCursor；按创建时间倒序、ID倒序 |
| GET `/api/ops/v1/orders/{orderId}` | orders:read | OrderDetail、ETag=order.version |
| PATCH `/api/ops/v1/orders/{orderId}` | orders:edit | 完整OrderDraft替换；If-Match；成功200、递增order.version |

PATCH成功码从未实现设计中的201修正为200；不是JSON Patch或任意状态修改。订单版本位于 `response.order.version`，不能读取 `response.version`。写操作携带精确Origin、X-CSRF-Token及16–128位Idempotency-Key；创建不带If-Match，编辑必须带双引号版本。订单重放头沿用 `Idempotent-Replayed`，费用接口为 `Idempotency-Replayed`，两者不要混淆。

相同动作重试复用method、path、body、If-Match和幂等键；同键改内容409。成功重放返回第一次快照，可能早于当前版本，应再GET当前资源。重新请求也检查主体及客户授权，授权撤销后不能通过重放继续读旧数据。两个独立编辑同版本只有一个成功，另一个412。

## 2. 页面字段与服务端事实

完整输入样例见 [order-draft.json](examples/order-draft.json)，其中customerId是占位，必须先查询本机会话实际授权客户并替换。地址、电话、货物都是合成示例，不使用真实联系人做联调。

OrderDetail新增可选 `draft` 字段以兼容尚未实现的其他投影；这四个本地订单操作的详情响应始终包含完整draft，供表单回填：客户、取送地址／联系人、逐件信息、服务等级、独享要求、取送时间窗、付款方式及备注。items另含服务端生成的货物ID及逐件packageIds。

- 相同clientItemId编辑时保留货物ID；数量增加追加包裹ID，减少保留前N个，历史快照不删除。每单最多1000个包裹，clientItemId不能重复。
- 地图坐标未知用null；尺寸／重量未知须提供unknownReason，仍只能保存draft，不代表已通过装载或时效校验。
- 时间窗必须start<end；送货窗口不得完全早于取货窗口。允许保留历史日期草稿，不据此建立配送承诺。
- 客户ID由查询选择；不能提交companyId、操作者、status、paid、quoteId、价格或批准信息。不存在、跨企业、同企业但未授权的客户／订单统一404。
- 当前state固定draft，collectionState=unpaid，fulfillmentStage=none，promiseId、quoteId、activeExecutionId为null；PREPAID只是计划付款方式，不是已付款。

| 能力 | 当前处理 |
|---|---|
| PREPAID、S1/S2/S3、独享要求 | 可录入草稿，尚不校验真实运力、报价或时效 |
| APPROVED_CREDIT、S4 | 422 CAPABILITY_DISABLED；授信及经济拼单尚未接通 |
| COD、merchantBeneficiaryId、creditAgreementId | 422 CAPABILITY_DISABLED，不静默忽略 |
| skuId或非空measurementEvidenceIds | 422 CAPABILITY_DISABLED；商品／凭证授权服务尚未接通 |
| 正式报价、提交受理、确认、收款、派单 | 未实现，不进入“已报价／待派单”；不得拿费用草稿试算代替 |

这些是当前切片能力边界，不删除已确认的月结、COD或商品需求。

## 3. 列表与错误

两个列表使用limit（默认50、1–100）和cursor。订单列表另支持state、serviceLevel、customerId。拒绝未知／重复查询参数；客户列表按UUID升序。nextCursor原样传回，末页为null。

游标签名绑定资源类型、主体、企业、limit及筛选条件，一小时有效；改筛选／每页数量、换身份或服务重启后应重新从第一页查询。分页是稳定排序的keyset查询，不是跨请求冻结的数据库快照；期间编辑会影响筛选结果。不要缓存到其他账号或拼装游标内容。

| HTTP／code | 页面处理 |
|---|---|
| 400 INVALID_JSON | 修正重复字段、非法UTF-8／BOM或JSON语法 |
| 401 UNAUTHENTICATED／SESSION_REVOKED | 重新建立本机开发会话，保留未保存输入 |
| 403 FORBIDDEN／CSRF_INVALID | 核对服务端权限及CSRF，不切换页面角色绕过 |
| 404 NOT_FOUND | 对象不可用；不透露是否属于其他客户 |
| 409 IDEMPOTENCY_KEY_REUSED | 不把旧操作键用于新的修改 |
| 412 VERSION_CONFLICT | 保留输入，GET最新订单并展示差异；用户确认新修改后换键 |
| 422 CAPABILITY_DISABLED | 展示本期暂不支持，不静默移除用户选择后继续保存 |
| 422 INVALID_TIME_WINDOW／INVALID_CARGO／MEASUREMENT_REASON_REQUIRED／PACKAGE_LIMIT | 定位时间窗／货物问题，保留原值 |
| 422 INVALID_CURSOR／INVALID_QUERY | 重置失效游标或修正查询 |
| 428 VERSION_REQUIRED／IDEMPOTENCY_REQUIRED | 修正调用头；不得自动覆盖新版本 |

其他64KiB限制、限流、事务重试与JSON错误格式沿用[费用HTTP约定](pricing-api.md)。权限和客户关联每次检查；数据库额外设置企业及主体上下文，订单／修订同时受客户RLS限制，事务结束上下文清除。

## 4. 启动与接线顺序

在新的交接目录，按[服务README](../services/routefit/README.md)使用自己的本机数据库：

```powershell
cd services/routefit
npm ci
$env:ROUTEFIT_PG_ADMIN_URL = $env:YOUR_LOCAL_POSTGRES_ADMIN_URL
npm run dev:bootstrap
npm run start:dev
# 另一个终端
npm run session:link
npm run smoke:orders
```

新bootstrap包含两家合成企业、各一名合成客户和授权关系，身份具备费用及orders:read/create/edit开发权限。老环境不会自动扩权或生成客户：需要先由迁移账号执行002，再由本机管理员配置合成客户／授权和开发权限；建议大旺使用新空目录bootstrap，不删除旧.local重建或清空旧库。

浏览器按[同源协议](local-development-api.md)获取session与CSRF，使用相对URL。接线顺序：查询客户 → 创建草稿 → 列表／详情 → 用detail.draft回填 → PATCH保存 → 刷新GET核对。请求模板见[orders.http](examples/orders.http)，CLI smoke实际经过全部5个操作。原型公共入口仍由大旺修改，本轮没有替换旧页面的数据源。

## 5. 下一条后端交付

固定费策略审核发布子集已实现，见[策略接口](pricing-policy-api.md)。下一步补订单受理时的地址／区域／尺寸来源校验和距离依据，再实现绑定订单版本的正式报价生成／查询／确认；其后做付款或有效月结准入、派单与司机履约。QuoteRequest所引用的pricingPolicyVersionId不能伪造为tariff草稿ID，保险继续独立，不将当前试算直接用于收费。

后续页面进度（2026-10-25）：独立的`/prototype/orders.html`已接入这5个接口，支持列表、新建、回读、编辑、冲突和原请求重试。见[页面契约](../prototype/ORDER-ENTRY-CONTRACT.md)与[浏览器证据](../services/routefit/verification/order-entry-ui/README.md)。共享工作台、Telegram及移动原生端尚未接线。

服务端[技术证据](../services/routefit/verification/order-drafts/README.md)覆盖持久化、隔离、并发、重放及输入校验。P01整体与生产身份仍未完成；无公开部署和真实支付。

## 受理输入增量

草稿接口可返回 validating 订单，只读查看；PATCH 仅允许 draft。后续提交、依据登记、区域与退回接口见 [order-intake-api.md](order-intake-api.md)。不要把 validating 显示为草稿或允许直接覆盖。
