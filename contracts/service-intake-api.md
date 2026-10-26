# WMS／外部订单导入接口 · 本机实现

这 7 个接口只接受 `ServiceToken`，不能使用运营浏览器 Cookie；本机开发时以 `authType: "service"` 的会话记录提供 Bearer token。令牌、货主、来源系统和（WMS 场景的）仓库由 `integration.service_binding` 固定绑定，请求体中的货主或仓库与绑定不一致时统一返回 404。

| 场景 | 路径 | 行为 |
|---|---|---|
| WMS订单导入 | `POST /api/warehouse/v1/orders` | 创建或修订待受理订单 |
| WMS状态／申请派单 | `GET /api/warehouse/v1/orders/{importId}`；`POST .../actions/request-dispatch` | 返回受理投影；派单只创建待办 |
| 外部订单导入 | `POST /api/external/v1/orders` | 创建或修订待受理订单 |
| 外部状态／申请派单 | `GET /api/external/v1/orders/{importId}`；`POST .../actions/request-dispatch` | 返回受理投影；派单只创建待办 |
| WMS库存观测 | `POST /api/warehouse/v1/stock-events` | 写入外部WMS物理库存镜像 |

所有写请求均需要 `Idempotency-Key`；派单申请还需要当前 `If-Match`。外部订单以“来源类型 + 绑定来源系统 + 绑定货主 + externalOrderId”唯一：同版本同内容返回原记录并标记 `duplicate:true`；同版本异内容、旧版本、订单已离开草稿状态的更高版本均拒绝。来源 `deliveryPrice` 与 `insurancePrice` 只以快照保存，不自动创建报价、收款、承诺、指派或履约事实。

库存观测以 `externalEventId` 去重，并要求 `requestableQty = bookQty - reservedQty - quarantineQty`。同一库存行只能由 RouteFit WMS 或外部 WMS 之一作为物理库存权威；来源版本未前进会拒绝，不能覆盖较新快照。

本机服务令牌仅用于开发联调，不得写入前端或提交到仓库；生产环境仍需经 IdP／凭据管理服务签发、轮换和撤销。
