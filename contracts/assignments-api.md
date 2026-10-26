# 自营车辆指派接口 v0.1

2026-10-25。本机 PostgreSQL 开发切片：`createAssignment`、`revokeAssignment`、`reassignAssignment`。字段和示例以 [openapi.json](openapi.json) 为准。

## 可调用接口

| 操作 | 路径 | 前置条件 | 结果 |
| --- | --- | --- | --- |
| 发出提案 | `POST /api/ops/v1/orders/{orderId}/assignments` | 当前承诺、已放行装载复核、已核销付款、未过期的匹配路线版本 | 创建 `offered` 指派及唯一有效车辆履约 |
| 撤回 | `POST /api/ops/v1/assignments/{assignmentId}/actions/revoke` | 未过期且尚未接收；订单证据可用 | 指派变为 `revoked`，结束履约记录 |
| 原子改派 | `POST /api/ops/v1/assignments/{assignmentId}/actions/reassign` | 旧指派未过期且尚未接收；新方案全部复验通过 | 旧指派 `superseded`，旧履约结束后创建新提案；失败时事务回滚 |

所有写入均需精确本机 Origin、开发会话、CSRF、`Idempotency-Key` 与 `If-Match`。`AssignmentRequest` 中的 `vehicleVersion`、`planVersion`、`loadReviewId`、`promiseId` 都是强制校验的事实引用；`availabilityId` 尚无独立班次事实表时会明确拒绝，绝不忽略。

## 安全边界

- 路线计划必须是内部规划器已持久化的 `ready` 版本，且含本订单取／送两个站点、未过期的 `MANUAL` 或 `CALIBRATED` ETA 依据。缺失时返回 `ROUTE_PLAN_UNAVAILABLE` 或 `ROUTE_CONSTRAINT_FAILED`。
- `dispatch.fulfillment_execution` 的部分唯一索引保证一张订单同时最多一个有效自营或合作履约；合作委托创建同样使用该记录。
- 提案不是司机已接单，也不是取货或签收。司机接受、定位、保管交接、执行状态和生产地图 ETA 仍是待实现接口。
- 本机路由计划目前只能由受控内部规划接入写入；没有对外“伪造路线计划”接口。真实地图／优化器、司机班次和生产身份尚未接入。

## 本机验证

真实本地 PostgreSQL 集成测试覆盖：付款与受理依据复验、装载复核、计划版本与车辆版本、同键重放、创建、原子改派、撤回、执行记录释放及只追加事件。验证文件为 `services/routefit/tests/quotes.integration.mjs`；它使用合成数据，不是生产派单、司机或地图验证。
