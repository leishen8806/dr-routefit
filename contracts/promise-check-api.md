# 车辆检查与服务承诺 API · v0.1

2026-10-25。本机已实现 R1 车辆规格、承诺检查、受控人工承诺与历史读取。自动 ETA 承诺、派单和司机任务仍由后续接口负责。

| 操作 | 路径 | 权限 | 当前行为 |
| --- | --- | --- | --- |
| `listVehicles` | `GET /api/ops/v1/vehicles` | `fleet:read` | 只读返回本企业车辆的规格与状态，使用签名游标分页。 |
| `checkPromise` | `POST /api/ops/v1/orders/{orderId}/promise-checks` | `promise:check` | 固化一次不可改的检查快照；须引用当前已确认报价并带订单版本。 |
| `createPromise` | `POST /api/ops/v1/orders/{orderId}/promises` | `promise:create` | 在人工授权条件满足时创建承诺并预留车辆时段。 |
| `promiseHistory` | `GET /api/ops/v1/orders/{orderId}/promises` | `orders:read` | 返回不可改承诺历史。 |

车辆检查已经拒绝暂停/事故/忙碌车辆、未知尺寸重量、超载、超容积、单件内尺寸或门洞不符、未支持货物限制。当前没有经验证的地图 ETA、路线版本或已批准承运商能力，所有结果同时带 `ETA_UNAVAILABLE`，`feasible=false`，且人工快递带 `CARRIER_CAPABILITY_UNAVAILABLE`。这不是缺陷回退：未知 ETA 不能被误标为可自动承诺。

`createPromise` 只接受当前已确认报价、已核销付款、未过期的同订单版本检查，并重新验证车辆硬约束和窗口。若检查唯一缺口是 `ETA_UNAVAILABLE`，拥有 `promise:create` 的人工调度人员可在记录客户同意依据后创建 `APPROVED_MANUAL` 承诺；这不是校准 ETA 或自动保证。服务端将订单推进为 `awaiting_dispatch`，写入不可改承诺及独占 `tstzrange` 预留；同车重叠预留由 PostgreSQL 排他约束拒绝。替换承诺必须明确引用当前承诺，历史不被覆盖。

写操作需 `Idempotency-Key`、`If-Match: "<订单版本>"`、同源开发会话和 CSRF。重试返回首次快照；跨企业订单/车辆一律按不存在处理。PostgreSQL 以企业作用域 RLS 隔离检查记录，并禁止改写或删除已记录检查。

本地测试覆盖车辆企业隔离、同键重放、无 ETA 时拒绝自动放行、跨企业隐藏、已付款人工承诺、状态推进、预留写入以及检查/承诺不可删除。没有地图、司机真机、承运商或生产数据验证。
