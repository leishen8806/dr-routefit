# 仓库与用户订单接入 · v0.1 联调草案

2026-10-24。依据用户新增要求；不修改 PRD 正文、RULE/AT 编号、四份标准或既有只读中控接口。

## 浏览器原型

运营/调度的“外部订单接入”支持仓库来源与用户来源；独立 `#customer` 页面只列出演示用户自己的申请。运营／调度复制标签文本或扁平 JSON 后，逐项校对上门地址、取件联系人/电话、送货地址、收货人/电话、货物尺寸、期望时间、配送费与保险费。原始粘贴文本不持久保存。未知字段提示，含糊的“价格”不猜测。

用户提交配送需求只要求上门收货地址、双方联系人及电话、送货地址和期望时间；货物说明可选。货物尺寸、数量、重量、配送报价、保险费和付款方式由调度核验后补充。该需求自动登记为待调度处理的草稿，但关键参数缺失时不能建立服务承诺、匹配车辆、派单或收款。用户可按需展开复制其他平台订单，仅填入取送资料，不采信外部价格。

导入只建立草稿；申请派单只登记申请，不自动选择车辆或绕过服务承诺、保险证据、装载、司机接受和交接。外部订单以来源类型、来源系统、来源平台及外部订单号防重；相同数据重试返回原单，不同数据拒绝覆盖。用户入口的来源身份固定，不能用表单冒充其他来源。

客户应付 = 配送费 + 保险费。保险费独立记账，不参与平台/司机分成。配送费包含经确认的距离加价或闪送费用。保险报价不等于承保；当前只能登记 DEMO 保险凭证。地址和双联系人会带入调度与司机详情。上门取件字段已接入，但未实现独立的双段导航、到店等待与取件预约引擎。

## HTTP 接口

`integration-server.mjs` 是使用现有业务模型的隔离联调服务。以下路径都以前缀 `/api` 开始：

| 方法 / 路径 | 用途 |
| --- | --- |
| GET/POST `/{warehouse|customer}/v1/orders` | 列表 / 导入草稿 |
| GET `/{warehouse|customer|ops}/v1/orders/:id` | 查询与版本 ETag |
| GET `/ops/v1/orders` | 调度列表 |
| POST `/{warehouse|customer}/v1/orders/:id/actions/request-dispatch` | 申请派单；空 JSON，不接受车辆字段 |
| POST `/warehouse/v1/orders/:id/actions/warehouse-release` | 按现有模型装载放行，不能绕过司机接受 |
| POST `/warehouse/v1/orders/:id/actions/warehouse-return-receipt` | 退回入库确认 |
| POST `/ops/v1/orders/:id/actions/{promise|offer|revoke|cancel}` | 调度确认承诺、提出车辆指派、撤回、取消 |

Bearer 凭据绑定企业、接口组和来源系统。外部来源仅能读自己的订单，跨对象返回 404；其他接口组和动作拒绝访问。所有 POST 要求 `Content-Type: application/json` 与 `Idempotency-Key`；对象动作另要求 `If-Match: "版本号"`。缺失前置条件 428，版本变化 412，幂等键复用或来源内容冲突 409，业务校验失败 422。请求体最大 64 KiB。分页 limit 1–50，cursor 为本联调版偏移量。

导入示例（合成数据）：

```json
{"externalOrderId":"DEMO-EXT-001","sourcePlatform":"DEMO-Shop","pickupAddress":"DEMO Pickup Phnom Penh","pickupContact":"DEMO Sender","pickupPhone":"+855000000001","destination":"DEMO Delivery Phnom Penh","deliveryContact":"DEMO Recipient","deliveryPhone":"+855000000002","customer":"DEMO Customer","cargo":"DEMO Box","qty":1,"weight":5,"length":30,"width":20,"height":20,"expected":"2026-10-24T11:00:00Z","deliveryFeeMinor":2000,"insuranceFeeMinor":200,"currency":"USD","payment":"cash","reviewed":true}
```

金额必须为整数分，保险无费用也明确传 0；只支持 USD。expected 使用 RFC3339，秒为 00（当前模型精确到分钟）。返回 money.deliveryMinor / insuranceMinor / totalMinor、状态、版本、联系人、来源与保险证据状态。当前 ops promise 动作沿用模型的柬埔寨本地分钟时间字段 `promise`，如 `2026-10-24T18:00`；生产接口须统一为带时区时间后再发布。

调度 offer 仅是提案，不代表司机已经接单；仓库接口不提供司机接单和财务核销。当前服务没有 webhook，调用方可用 GET 查询。中控 `/api/integration/v1` 的只读边界不变。

## 本地运行与已知限制

设置三个不同且至少 16 字符的环境变量 `ROUTEFIT_WAREHOUSE_TOKEN`、`ROUTEFIT_CUSTOMER_TOKEN`、`ROUTEFIT_OPS_TOKEN`，再运行 `node prototype/integration-server.mjs`。不要把凭据提交仓库。服务仅绑定 `127.0.0.1:4174`，拒绝带 Origin 的浏览器请求；供服务端本地联调。

**4173 页面使用 sessionStorage，4174 HTTP 服务使用独立进程内数据，两者没有自动同步。** 重启 HTTP 服务会丢失联调数据；浏览器身份切换只是演示，不是真实登录认证。

正式接入还需要持久化事务、认证与密钥生命周期、审计和限流、TLS、第三方仓库/用户平台适配、通知回执以及前后端桥接。未连接真实平台、保险或银行；不能作为可上线接口或承保证明。测试只证明本地模型、隔离接口与原型交互。
