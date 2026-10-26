# 司机任务接口 v0.1

2026-10-25。本机 PostgreSQL 开发切片：本人提案列表、详情、必要订单资料、在线接单／拒单、完成件级交接后的出发、受控设备在有效当班内的位置批量上报、离线事件逐项补传，以及最终交付记录。字段和示例以 [openapi.json](openapi.json) 为准。

| 操作 | 路径 | 安全边界 |
| --- | --- | --- |
| 本人任务 | `GET /api/driver/v1/assignments` | 只返回当前 `DRIVER`／`PARTNER_DRIVER` 主体自己的任务；支持 `overdue`、`in_transit`、`completed`、`cancelled` 分组。 |
| 指派详情 | `GET /api/driver/v1/assignments/{assignmentId}` | 非本人或不存在统一返回 404。 |
| 必要订单资料 | `GET /api/driver/v1/orders/{orderId}` | 必须存在本人的 `offered` 或 `accepted` 指派；不返回运营草稿、内部成本或其他订单。 |
| 接受 | `POST /api/driver/v1/assignments/{assignmentId}/actions/accept` | 只接受未过期的本人提案；重验路线版本及当前承诺，原子转为 `accepted`，订单转为 `executing`。 |
| 拒绝 | `POST /api/driver/v1/assignments/{assignmentId}/actions/reject` | 只拒绝未过期的本人提案；结束该有效履约，不改写订单承诺或财务事实。 |
| 出发 | `POST /api/driver/v1/assignments/{assignmentId}/actions/depart` | 仅本人已接受指派；复验装载复核仍放行且全部订单件已由本人保管，才把履约阶段推进为 `in_transit`。 |
| 位置上报 | `POST /api/driver/v1/locations` | 仅有效司机、活跃设备和当前当班可写入；点位以设备内 `clientPointId` 去重，未来超过五分钟的点被拒绝。接收不等于采用为调度地图当前位置，也不推进订单状态。 |
| 离线事件补传 | `POST /api/driver/v1/sync/events` | 同一设备按连续 `sequence` 处理，`eventId` 永久去重且同 ID 不同内容拒绝。到达、完整交接签认、交付和异常只在当前指派／路线版本、设备当班、订单归属和既有证据规则都满足时生效；离线接单不在事件类型内。离线出发缺少必填出发证据、现金申报需要独立财务事实时，事件保留为 `NEEDS_REVIEW`，不推进履约或入账。 |
| 证据上传 | `POST /api/driver/v1/uploads` → `POST /api/driver/v1/uploads/{uploadId}/actions/complete` | 仅允许当前司机自身 `offered`／`accepted` 任务订单的 `ORDER` 证据；复用 MIME、大小、SHA256、魔数与短期上传令牌校验。完成只代表本机结构检查通过，不代表生产恶意文件扫描。 |
| 证据下载 | `GET /api/driver/v1/evidence-files/{fileId}/download-url` | 再次核对文件所属订单仍是司机当前任务；非本人或非订单资源统一不暴露。 |
| 交付记录 | `POST /api/driver/v1/orders/{orderId}/delivery-records` | 仅当前持有全部件的已接受司机可写入；必须使用当前收货授权、`DELIVERY`用途证据，并完整划分每件为已交付或待退回。全数交付进入 `delivered`；有剩余件进入 `return_open`，不伪称整单送达或财务结清。 |
| 本人收入 | `GET /api/driver/v1/income-items` | 仅当前有效司机本人名下的 `DRIVER_INCOME`／`PAYABLE` 账项；客户现金和 COD 不会被当作司机收入。 |
| 申请提现／查看进度 | `POST`／`GET /api/driver/v1/withdrawal-requests` | 只能从本人 `DRIVER_INCOME`／`PAYABLE` 账项申请，并锁定当时已核验的脱敏结算账户版本；同一账项的未处理申请会占用可提现额度。仅创建待复核与审批申请，不会调用 KESS、银行或自动出款。 |

写入仍需要开发会话、精确同源 Origin、CSRF、`Idempotency-Key` 与 `If-Match`。重试同一键返回同一接受结果；不同路线版本、已过期、非本人或已变更状态均不得继续接受。

位置和离线事件表强制设备、当班和事件使用同一司机；离线同步保存事件 ID、指纹、顺序、观测时间和逐项结果，既不接受提案，也不替代银行核验。它不生成地图投影、路线 ETA、推送、导航或后台定位结论。交付记录、件明细和订单状态均为只追加事实；数据库只有在交付记录完整覆盖订单全部件时才允许订单变为 `delivered` 或 `return_open`。本地单元测试覆盖离线到达的永久去重、同 ID 改内容拒绝以及现金事件不入账；件级交接／出发／定位／交付／同步的完整路径仍需一次性 PostgreSQL 集成测试。它不证明设备在线、推送、后台定位、地图导航或 iOS／Android App 已完成。
