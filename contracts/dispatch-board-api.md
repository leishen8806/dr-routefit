# 调度看板 API · v0.1 本地开发

2026-10-25。此读取接口基于已保存的待派订单和车辆档案，供运营工作台显示真实可用数据；它不创建指派、不计算路线、不生成定位或异常。

| 方法及路径 | 权限 | 结果 |
|---|---|---|
| GET /api/ops/v1/dispatch/board | dispatch:read | DispatchBoard |

## 当前投影边界

- queue 未填或 awaiting_dispatch 时，返回状态为 awaiting_dispatch 的订单；offered、in_transit、urgent 返回空队列，因为当前本地切片没有指派执行或异常事实表。
- 车辆来自 fleet.vehicle。没有位置采集时，point 与 observedAt 为 null，quality=unavailable；activeAssignmentIds 和 exceptionIds 为空。
- urgentExceptionIds 为空，不代表没有真实风险，只代表本地服务尚未存储异常聚合。
- warehouseId 在本地明确拒绝，不用无效仓库参数静默返回全企业数据。订单超过1000或车辆超过500时拒绝读取，避免截断后误判完整性。

验证：真实 PostgreSQL HTTP 测试覆盖待派读取、无定位质量、未知队列与未接仓库范围拒绝、跨企业空投影。真实位置、路线 ETA、执行指派、事故与仓库队列仍待独立接口和事实表。
