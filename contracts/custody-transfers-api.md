# 件级交接接口 · R1 本地开发切片

这四个接口将单件保管责任从运营人员交给已接受指派的司机。当前仅在本机合成 PostgreSQL 环境实现，不代表仓库 WMS、移动端离线同步或真实签收已上线。

| 操作 | 路径 | 约束 |
|---|---|---|
| 发起交接 | `POST /api/ops/v1/custody-transfers` | 发起人必须是交出保管人；订单必须 `executing`；指派已接受、装载复核为 `RELEASED`。 |
| 运营签认 | `POST /api/ops/v1/custody-transfers/{id}/actions/confirm` | 仅交出方签认；必须提供本订单可用证据。 |
| 报告差异 | `POST /api/ops/v1/custody-transfers/{id}/actions/report-discrepancy` | 保留原保管方，创建 `MISSING` 阻断异常，解除本次锁，不会凑平件数。 |
| 司机签认 | `POST /api/driver/v1/custody-transfers/{id}/actions/confirm` | 仅被指派司机可签；必须与交出方是不同自然人；双方签认后才原子更新件的保管人。 |

`items` 必须给出订单中的具体 `itemId` 与 `packageIds`，不能只给数量。每个件在 `proposed` 或 `partially_signed` 期间被数据库锁定，不能同时进入另一笔交接。已确认或差异记录不可删除；所有写操作要求幂等键，签认和差异还要求当前 `If-Match` 版本。

首笔交接允许没有历史保管位置，但只允许由当前运营发起人作为交出方建立该受控起点。完整仓库库存、货位、司机之间转交、返仓和最终签收仍是后续接口，不能据此把本接口当作完整仓储系统。
