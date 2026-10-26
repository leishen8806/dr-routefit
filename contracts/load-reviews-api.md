# 装载复核 API（本机开发）

2026-10-25。createLoadReview 是订单承诺后的装载证据复核事实；它不创建车辆指派、不启动司机任务，也不声明路线、ETA 或装载算法已经完成。

| 操作 | 路径 | 当前结果 |
| --- | --- | --- |
| createLoadReview | POST /api/ops/v1/orders/{orderId}/load-reviews | 只追加 RELEASED、REJECTED 或 NEEDS_REVIEW 的复核事实 |

## 放行条件

- 订单必须仍为 awaiting_dispatch，并带有当前有效人工承诺；If-Match 必须等于当前订单版本。
- 复核车辆和规格版本必须与承诺中的车辆及当前车辆档案一致。
- 每个 evidenceFileId 必须唯一、同企业、关联该订单，并已到 available；未上传、仍在扫描或其他订单的文件一律拒绝。
- 每次 RELEASED 都重新计算重量、容积、尺寸、车门净空、车辆状态与货物限制。硬约束不满足时不能人工放行。
- 复核人使用当前 principal 的持久 personId；记录、证据列表、理由和计算出的拒绝原因都只追加保存。

REJECTED 与 NEEDS_REVIEW 不会绕过上述证据归属校验，也不会解除既有预留。RELEASED 只是后续真实派单的必要前置条件之一；路线计划版本、实时 ETA、唯一执行记录和司机接单仍未实现。

## 数据与验证

016 迁移以订单版本、车辆、复核人及快照建立复合约束，并启用 PostgreSQL RLS 和不可改写触发器。本机 PostgreSQL 集成测试覆盖证据未完成、规格不一致、跨企业读取、幂等重放和删除拒绝。

此接口仅监听本机开发服务；生产仍需受控对象存储、隔离文件扫描、正式身份系统及独立的装载／派单验收。
