# 费用设置接口开发对照 v0.1

2026-10-25 · `LOCAL_IMPLEMENTED_NOT_DEPLOYED`。实现位于 [services/routefit](../services/routefit/README.md)，使用真实本地 PostgreSQL，仍为开发切片；既有页面尚未接入。机器定义以 [openapi.json](openapi.json) 为准。

## 联调入口与完整示例

先按服务README启动本地数据库及API。默认地址是 `http://127.0.0.1:4180`，不代表当前已运行。本文仍维护原8个费用操作；加上5个录单与4个[策略审核](pricing-policy-api.md)，本地共17个。`/dev/openapi.json`只返回已实现操作；完整契约215个操作中的198个设计接口不能发送到本服务。

使用[HTTP请求模板](examples/pricing.http)，按顺序执行。请求工具中私密设置 `sessionToken` 和 `csrfToken`，来源是本机bootstrap生成的 `.local/client.json`；不写回模板或提交Git。创建后复制实际返回的ID，版本以响应为准；模板中的1／2／3仅适用于无并发修改的新流程。

| 顺序 | 请求与输入 | 响应及下一步 |
|---|---|---|
| 1 | GET catalog | 取得允许费目、单位与分成限制 |
| 2 | POST tariffs，DR／USD／名称／适用范围 | 201、version=1；保存id及ETag |
| 3 | save-fee，base固定200，share=true；If-Match="1" | 200、version=2 |
| 4 | save-fee，insurance比例125基点，share=false；If-Match="2" | 200、version=3 |
| 5 | GET tariff | 确认当前费目与最新ETag |
| 6 | POST trials，base无数量／基数，insurance货值10000；If-Match="3" | 201 SIMULATION，totalMinor=325、shareMinor=200、insuranceMinor=125、separateMinor=125；价表仍为3 |
| 7 | GET trial／revisions／tariffs | 分别核对持久快照、版本历史、本企业草稿 |

以上金额均为合成示例：配送2.00 USD、货值100.00 USD、保费1.25 USD，合计3.25 USD。不是VET、ZTO、CE、极兔或DR的正式费率。请求及完整响应示例已放入OpenAPI对应操作的 `examples`，导入接口工具后可查看。

每次新动作使用新幂等键；网络重试保留原键、原body和原If-Match。不要因为请求超时就换键再建一份草稿。另有可执行的 `npm run smoke`，见服务README；HTTP模板是人工联调清单，不会替你读取本机凭据或自动串联ID。

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

ETag只在创建／读取价表、保存费目及创建试算时返回；创建试算的ETag引用父价表版本 `tariffVersion`。GET试算、目录及两个列表不返回ETag。试算没有可编辑的独立版本，不能拿其响应头更新订单。

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

三个POST入口要求无BOM的有效UTF-8 JSON。同一对象内不得重复字段，包括 `amount` 与 `amou\u006et` 这类解码后相同的名称；嵌套对象同样检查，不同对象可使用相同字段。语法／编码／重复字段均返回400 INVALID_JSON，不创建价表、版本、试算或成功幂等记录。不回显原始输入；调用方修正请求，不按可重试故障处理。

| 失败条件 | HTTP／code | 调用方处理 |
|---|---|---|
| 重复JSON字段／非法UTF-8／JSON语法错误 | 400 INVALID_JSON | 修正编码与请求内容；不接受静默取最后一个值 |
| 旧价表版本 | 412 VERSION_CONFLICT | 重新GET并展示变化；确认新修改后使用新键与新版本提交 |
| 同键改内容或前置版本 | 409 IDEMPOTENCY_KEY_REUSED | 检查是否错误复用了操作键；不要当作临时网络失败自动重试 |
| 同键仍在处理／数据库短暂锁冲突 | 409 REQUEST_IN_PROGRESS | 按Retry-After等待，再以同键、同内容、同版本重试 |
| 无键或非法版本头 | 428 IDEMPOTENCY_REQUIRED／VERSION_REQUIRED | 修正请求；创建草稿不需要If-Match，传入会422 UNEXPECTED_VERSION |
| 保险／COD等勾选分成 | 422 INVALID_SHARE_BASIS | 修正归属配置，不生成司机收入 |
| 未配置、停用费目／重复费目 | 422 FEE_NOT_ENABLED／DUPLICATE_FEE | 查询最新草稿，修正试算输入 |
| 会话失效／主体停用 | 401 UNAUTHENTICATED／SESSION_REVOKED | 重新取得授权会话，不靠换角色绕过 |
| Origin／CSRF／权限错误 | 403 ORIGIN_REQUIRED／ORIGIN_FORBIDDEN／CSRF_INVALID／FORBIDDEN | 检查开发源、CSRF与服务端授权 |
| 对象不存在或属于其他企业 | 404 NOT_FOUND | 不显示其是否存在，不尝试其他企业ID |

```json
{"error":{"code":"VERSION_CONFLICT","message":"费用版本已变化，请重新查询","messageKey":"errors.version_conflict","retryable":false,"requestId":"demo-request-001","fields":[]}}
```

当前412响应不带 `currentVersion`；应重新GET，不从错误消息解析版本。短暂冲突与429／503的响应可能带 `Retry-After: 1`；它是最短等待建议，不保证下一秒限流窗口已结束。

HTTP 400 JSON 无效；401 会话／主体无效；403 权限或 CSRF；404 无权访问／不存在；405 方法；413 超过 64 KiB；415 类型或压缩；422 字段或业务约束；429 每主体每分钟 120 次；503 服务未就绪。请求超时及非法 HTTP 帧可能由 Node HTTP 层终止，不保证 JSON 错误包。限流是单进程开发实现，上线前使用共享策略；当前错误说明以中文返回，messageKey 预留给已有三语言规范，尚未接入服务端翻译。

公开健康端点仅返回本地服务模式和状态。未实现CORS跨域授权；RF-API-01已提供[本机同源与一次性开发会话](local-development-api.md)，可从4180下页面调用。生产BFF／IdP仍待实现，不在浏览器放置服务端凭据。实际配置示例和可重复闭环见服务 README 的 bootstrap／smoke。
