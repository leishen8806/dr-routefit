# 费用设置接口开发对照 v0.1

2026-10-25 · `LOCAL_IMPLEMENTED_NOT_DEPLOYED`。实现位于 [services/routefit](../services/routefit/README.md)，使用真实本地 PostgreSQL，仍为开发切片；既有页面尚未接入。机器定义以 [openapi.json](openapi.json) 为准。

## 8 个已实现操作

公共前缀 `/api/ops/v1/pricing`。

| 操作 | 方法与后缀 | 权限／版本 | 结果 |
|---|---|---|---|
| pricingCatalog | GET `/catalog` | pricing:read | 19 个费目及单位／分成限制 |
| listPricingTariffs | GET `/tariffs?limit=50&after=<UUID>` | pricing:read | 本企业草稿列表，UUID 升序游标 |
| createPricingTariff | POST `/tariffs` | pricing:write；新建无 If-Match | 201 DRAFT，版本 1 |
| getPricingTariff | GET `/tariffs/{tariffId}` | pricing:read | 草稿、全部费目、ETag |
| savePricingFee | POST `/tariffs/{tariffId}/actions/save-fee` | pricing:write；If-Match | 覆盖当前草稿中一个费目，追加完整版本快照 |
| createPricingTrial | POST `/tariffs/{tariffId}/trials` | pricing:read；If-Match | 201 SIMULATION，绑定精确费表版本；不增加价表版本 |
| pricingRevisions | GET `/tariffs/{tariffId}/revisions?limit=50&afterVersion=7` | pricing:read | 版本降序历史，含经办主体 |
| getPricingTrial | GET `/trials/{trialId}` | pricing:read | 不可覆盖的试算快照 |

列表限制 1–100。游标为空时从第一页开始；当前是 UUID／版本游标，不是其他业务列表的签名 cursor。拒绝未知或重复查询参数。试算快照存储是审计性模拟写入，不赋予读者修改费用配置的权限。

## 身份和事务

本机开发会话通过 `rf_session` Cookie 识别，配置只保存 token／CSRF 的 SHA-256、企业、主体、权限和过期时间。写操作需要精确 `Origin` 与 `X-CSRF-Token`。企业和主体由服务端会话确定，JSON 不接收 companyId、审批状态或操作者。每次事务重新检查企业与主体未停用。上线前须替换为可信 IdP／BFF 会话，并完成自然人身份、授权范围、撤销与审计验收。

POST 必带 16–128 位可见 ASCII `Idempotency-Key`。同企业、主体、方法、规范路径、键共用一条结果；规范路径将 UUID 大小写归一，规范 JSON 对象键排序，数组顺序保留。请求指纹包含 body 和 If-Match。成功后同键同内容重放原响应，`Idempotency-Replayed: true`；同键不同内容或版本返回 409。验证失败不占用成功幂等记录。当前幂等结果长期保留，尚未实现清理策略。

修改与试算要求 `If-Match: "3"`。相同价表的写操作锁住父行，检查版本后原子完成费目、版本、历史与幂等结果；两次独立修改同版本只有一次成功。版本过期返回 **412**；缺少合法键／版本返回 **428**。旧材料中泛指版本冲突 409 的地方，以本 HTTP 契约的 412 为准，409 用于幂等冲突或暂时并发占用。

GET 事务使用 REPEATABLE READ，价表和费目来自同一数据库快照；写事务使用 READ COMMITTED，加行锁及事务级幂等锁。运行账号无超级用户／BYPASSRLS 权限，`SET LOCAL app.company_id` 随事务结束清除；跨企业对象一律 404。

## 金额与单位

`currency` 是 USD 或 KHR。金额单位：USD 为美分、KHR 为整数瑞尔；不隐式换汇。所有金额／数量均为整数，最大 9,000,000,000,000。内部用 BigInt 运算，检查范围后输出 JSON 整数。

| method | amount | 其他字段 | 算法 |
|---|---|---|---|
| fixed | 币种最小单位 | unit=null、includedMilli=0、stepMilli=1000 | 每单固定金额 |
| unit | 每步金额 | unit 必须属于费目目录；数量、包含量及步长以 1/1000 单位表示 | max(数量−包含量,0) ÷ 步长向上取整，再乘单价 |
| percent | 基点，100=1%，0–10000 | 仅 insurance／cod；unit=null、includedMilli=0、stepMilli=1000 | 基数×基点÷10000，逐行 HALF_UP 到币种最小单位 |

例如 1.001 kg 是 `quantityMilli:1001`，免费 1 kg、每超 1 kg 100 美分，则费用 100 美分。金额不是金额字符串，也不是美元小数。前端适配时从输入十进制字符串精确转换，不能用普通浮点乘 100 修补金额。

试算固定费用 input 的 quantityMilli／basisMinor 均为 null；unit 只传 quantityMilli，percent 只传 basisMinor。insurance 的基数是申报货值，cod 是代收本金；**本金不进入费用合计**。未知基数用 null 并拒绝试算，不补零。

仅 DR 对客费用中获允许的配送费行可设 `share:true`。保险、COD 服务费、仓储／入出库／包装和外部承运采购费强制排除。`shareMinor` 仅为候选分成基数，**不是已批准司机收入**；本切片没有分成比例或实际结算。`totalMinor = shareMinor + separateMinor`，保险是 separateMinor 的子集，不能再次相加。

试算请求明确选择要计算的已启用费目；不会自动套用全部已启用项，也不判断业务上是否应收。完整报价必须在后续阶段由订单输入与已批准规则选费，不能把这个计算接口直接用于收费或派单。

## 错误与联调限制

错误统一为 ApiError，包含 requestId、稳定 code、messageKey、retryable 和字段列表。常见错误：VALIDATION_FAILED、INVALID_SHARE_BASIS、INVALID_FEE_UNIT、INVALID_PERCENT_FEE、FEE_NOT_ENABLED、DUPLICATE_FEE、AMOUNT_OUT_OF_RANGE、VERSION_CONFLICT、IDEMPOTENCY_KEY_REUSED。

HTTP 400 JSON 无效；401 会话／主体无效；403 权限或 CSRF；404 无权访问／不存在；405 方法；413 超过 64 KiB；415 类型或压缩；422 字段或业务约束；429 每主体每分钟 120 次；503 服务未就绪。请求超时及非法 HTTP 帧可能由 Node HTTP 层终止，不保证 JSON 错误包。限流是单进程开发实现，上线前使用共享策略；当前错误说明以中文返回，messageKey 预留给已有三语言规范，尚未接入服务端翻译。

公开健康端点仅返回本地服务模式和状态。未实现 CORS 跨域授权，联调可用 CLI；未来页面通过同源 BFF 接入，不在浏览器放置服务端凭据。实际配置示例和可重复闭环见服务 README 的 bootstrap／smoke。
