# RF-UX-V1 R2 接口汇总索引

状态：2026-11-10 汇总。唯一索引来源是四份模块清单；`已定义` 表示已有接口契约，不表示路由已接线。所有写接口仍须服务端授权、企业隔离、幂等与版本校验。

| 路径 | 用途和页面 | 负责岗位 | 模块清单 | 状态 |
| --- | --- | --- | --- | --- |
| `POST /api/customer/v1/route-quotes` | 客户下单报价 | Backend1 | `rf-ux-v1-r2-backend1-api.md` | 已定义 |
| `GET /api/ops/v1/route-pricing/configurations` | 后台查看计价配置 | Backend1 | 同上 | 已定义 |
| `POST /api/ops/v1/route-pricing/configurations` | 后台新增计价配置 | Backend1 | 同上 | 已定义 |
| `GET /api/ops/v1/coupons` | 后台优惠券 | Backend1 | 同上 | 已定义 |
| `POST /api/ops/v1/coupons/batches` | 后台创建券批次 | Backend1 | 同上 | 已定义 |
| `POST /api/customer/v1/orders/{orderId}/actions/lock-coupon` | 客户下单锁券 | Backend1 | 同上 | 已定义 |
| `POST /api/customer/v1/orders/{orderId}/actions/redeem-coupon` | 付款后核销券 | Backend1 | 同上 | 已定义 |
| `POST /api/customer/v1/orders/{orderId}/actions/release-coupon` | 客户取消订单释放券 | Backend1 | 同上 | 已定义 |
| `GET /api/ops/v1/merchants/{merchantId}/contract` | 后台读取商户合同 | Backend1 | 同上 | 已定义 |
| `POST /api/ops/v1/merchants/{merchantId}/contract` | 后台创建商户合同 | Backend1 | 同上 | 已定义 |
| `POST /api/ops/v1/merchants/{merchantId}/contract/actions/activate` | 后台合同生效 | Backend1 | 同上 | 已定义 |
| `POST /api/ops/v1/merchants/{merchantId}/contract/actions/expire` | 后台合同到期 | Backend1 | 同上 | 已定义 |
| `GET /api/ops/v1/merchants/{merchantId}/sku-dimensions` | 后台读取货品尺寸 | Backend1 | 同上 | 已定义 |
| `POST /api/ops/v1/merchants/{merchantId}/sku-dimensions` | 后台登记货品尺寸 | Backend1 | 同上 | 已定义 |
| `POST /api/ops/v1/users/{userId}/actions/freeze` | 后台冻结用户 | Backend1 | 同上 | 已定义 |
| `POST /api/ops/v1/users/{userId}/actions/unfreeze` | 后台解冻用户 | Backend1 | 同上 | 已定义 |
| `POST /api/driver/v1/registration-applications` | 司机注册 | Backend2 | `rf-ux-v1-r2-backend2-api.md` | 已定义 |
| `GET /api/ops/v1/driver-applications` | 后台司机审批列表 | Backend2 | 同上 | 已定义 |
| `POST /api/ops/v1/driver-applications/{applicationId}/actions/review` | 后台审核司机 | Backend2 | 同上 | 已定义 |
| `GET /api/driver/v1/vehicles` | 司机车辆档案 | Backend2 | 同上 | 已定义 |
| `PUT /api/driver/v1/vehicles/{vehicleId}` | 编辑车辆 | Backend2 | 同上 | 已定义 |
| `POST /api/driver/v1/vehicles/{vehicleId}/documents` | 维护车辆证件 | Backend2 | 同上 | 已定义 |
| `GET /api/driver/v1/vehicles/{vehicleId}/alerts` | 车辆提醒 | Backend2 | 同上 | 已定义 |
| `POST /api/driver/v1/vehicles/{vehicleId}/fuel-mileage-logs` | 油费里程 | Backend2 | 同上 | 已定义 |
| `POST /api/driver/v1/assignments/{assignmentId}/load-scans` | 扫码装车 | Backend2 | 同上 | 已定义 |
| `POST /api/driver/v1/orders/{orderId}/delivery-attempts` | 扫码送达 | Backend2 | 同上 | 已定义 |
| `POST /api/driver/v1/delivery-attempts/{attemptId}/location-checks` | 送达位置核对 | Backend2 | 同上 | 已定义 |
| `POST /api/driver/v1/delivery-attempts/{attemptId}/undelivered-reasons` | 未送出原因 | Backend2 | 同上 | 已定义 |
| `POST /api/driver/v1/orders/{orderId}/collections` | 司机模拟收款 | Backend2 | 同上 | 已定义 |
| `GET /api/driver/v1/cash-limit-status` | 司机交现提醒 | Backend2 | 同上 | 已定义 |
| `POST /api/driver/v1/withdrawal-requests` | 司机提现申请 | Backend2 | 同上 | 已定义 |
| `GET /api/driver/v1/withdrawal-requests` | 司机提现进度 | Backend2 | 同上 | 已定义 |
| `POST /api/ops/v1/dispatch/optimization-runs` | 调度台发起自动排线 | BackendSenior | `rf-ux-v1-r2-backendsenior-api.md` | 已定义 |
| `GET /api/ops/v1/dispatch/optimization-runs` | 自动排线列表 | BackendSenior | 同上 | 已定义 |
| `GET /api/ops/v1/dispatch/optimization-runs/{runId}` | 自动排线详情 | BackendSenior | 同上 | 已定义 |
| `POST /api/ops/v1/dispatch/optimization-runs/{runId}/actions/adopt` | 调度台采纳方案 | BackendSenior | 同上 | 已定义 |
| `GET /api/ops/v1/finance/payout-approvals` | 财务出款审批列表 | BackendSenior | 同上 | 已定义 |
| `GET /api/ops/v1/finance/payout-approvals/{approvalId}` | 出款审批详情 | BackendSenior | 同上 | 已定义 |
| `POST /api/ops/v1/finance/payout-approvals/{approvalId}/actions/approve` | 运营审批出款 | BackendSenior | 同上 | 已定义 |
| `POST /api/ops/v1/finance/payout-approvals/{approvalId}/actions/reject` | 运营驳回出款 | BackendSenior | 同上 | 已定义 |
| `POST /api/ops/v1/finance/payout-approvals/{approvalId}/actions/confirm-paid` | 财务确认模拟出款 | BackendSenior | 同上 | 已定义 |
| `POST /api/ops/v1/finance/withdrawal-requests/{requestId}/payout-approvals` | 提现进入两步审批 | BackendSenior | 同上 | 已定义 |
| `POST /api/ops/v1/finance/merchant-settlement-requests/{requestId}/payout-approvals` | 商户结算进入两步审批 | BackendSenior | 同上 | 已定义 |
| `GET /api/ops/v1/payroll/schemes` | 财务工资规则列表 | BackendSenior | 同上 | 已定义 |
| `POST /api/ops/v1/payroll/schemes` | 财务新建工资规则 | BackendSenior | 同上 | 已定义 |
| `POST /api/ops/v1/payroll/schemes/{schemeId}/actions/submit` | 提交工资规则 | BackendSenior | 同上 | 已定义 |
| `POST /api/ops/v1/payroll/schemes/{schemeId}/actions/approve` | 批准工资规则 | BackendSenior | 同上 | 已定义 |
| `POST /api/ops/v1/payroll/runs` | 生成工资单 | BackendSenior | 同上 | 已定义 |
| `GET /api/ops/v1/payroll/runs` | 工资单列表 | BackendSenior | 同上 | 已定义 |
| `GET /api/ops/v1/payroll/runs/{runId}` | 工资单详情 | BackendSenior | 同上 | 已定义 |
| `GET /api/ops/v1/payroll/runs/{runId}/lines` | 工资单明细 | BackendSenior | 同上 | 已定义 |
| `POST /api/ops/v1/payroll/runs/{runId}/actions/submit` | 提交工资单出款 | BackendSenior | 同上 | 已定义 |
| `GET /api/ops/v1/kpi/rule-versions` | KPI 标准列表 | BackendSenior | 同上 | 已定义 |
| `POST /api/ops/v1/kpi/rule-versions` | KPI 新建标准 | BackendSenior | 同上 | 已定义 |
| `POST /api/ops/v1/kpi/rule-versions/{ruleVersionId}/actions/approve` | 批准 KPI 标准 | BackendSenior | 同上 | 已定义 |
| `GET /api/ops/v1/kpi/monthly-results` | KPI 月度结果 | BackendSenior | 同上 | 已定义 |
| `GET /api/ops/v1/kpi/monthly-results/{resultId}` | KPI 结果详情 | BackendSenior | 同上 | 已定义 |
| `POST /api/ops/v1/kpi/monthly-results/{resultId}/reward-penalties` | 新增 KPI 奖惩 | BackendSenior | 同上 | 已定义 |
| `GET /api/ops/v1/kpi/appeals` | KPI 申诉列表 | BackendSenior | 同上 | 已定义 |
| `POST /api/driver/v1/kpi/monthly-results/{resultId}/appeals` | 司机发起 KPI 申诉 | BackendSenior | 同上 | 已定义 |
| `POST /api/ops/v1/kpi/appeals/{appealId}/actions/decide` | 后台裁定 KPI 申诉 | BackendSenior | 同上 | 已定义 |

## OpsLead 模块（待定义细则）

| 路径 | 用途和页面 | 负责岗位 | 模块清单 | 状态 |
| --- | --- | --- | --- | --- |
| `GET /api/ops/v1/api-clients` | 后台开放接口客户端列表 | OpsLead | `open-platform-r2-api.md` | 待定义 |
| `POST /api/ops/v1/api-clients` | 后台创建开放接口客户端 | OpsLead | 同上 | 待定义 |
| `GET /api/ops/v1/api-clients/{id}` | 接入方详情 | OpsLead | 同上 | 待定义 |
| `POST /api/ops/v1/api-clients/{id}/api-keys` | 创建接口密钥 | OpsLead | 同上 | 待定义 |
| `POST /api/ops/v1/api-keys/{id}/actions/rotate` | 轮换接口密钥 | OpsLead | 同上 | 待定义 |
| `POST /api/ops/v1/api-keys/{id}/actions/revoke` | 停用接口密钥 | OpsLead | 同上 | 待定义 |
| `GET /api/ops/v1/webhook-endpoints` | 回调地址列表 | OpsLead | 同上 | 待定义 |
| `POST /api/ops/v1/webhook-endpoints` | 创建回调地址 | OpsLead | 同上 | 待定义 |
| `POST /api/ops/v1/webhook-endpoints/{id}/actions/test` | 测试回调 | OpsLead | 同上 | 待定义 |
| `GET /api/ops/v1/webhook-deliveries` | 回调投递记录 | OpsLead | 同上 | 待定义 |
| `POST /api/ops/v1/webhook-deliveries/{id}/actions/retry` | 重试回调 | OpsLead | 同上 | 待定义 |
| `GET /api/ops/v1/api-call-logs` | 开放接口调用日志 | OpsLead | 同上 | 待定义 |
| `GET /api/ops/v1/ad-campaigns` | 后台广告位列表 | OpsLead | 同上 | 待定义 |
| `POST /api/ops/v1/ad-campaigns` | 后台创建广告位 | OpsLead | 同上 | 待定义 |
| `PUT /api/ops/v1/ad-campaigns/{id}` | 编辑广告位 | OpsLead | 同上 | 待定义 |
| `POST /api/ops/v1/ad-campaigns/{id}/actions/submit` | 提交广告审核 | OpsLead | 同上 | 待定义 |
| `POST /api/ops/v1/ad-campaigns/{id}/actions/approve` | 批准广告 | OpsLead | 同上 | 待定义 |
| `POST /api/ops/v1/ad-campaigns/{id}/actions/reject` | 驳回广告 | OpsLead | 同上 | 待定义 |
| `POST /api/ops/v1/ad-campaigns/{id}/actions/offline` | 广告下线 | OpsLead | 同上 | 待定义 |
| `POST /api/ops/v1/ad-campaigns/{id}/actions/revoke-offline` | 撤销下线 | OpsLead | 同上 | 待定义 |
| `POST /api/ops/v1/ad-campaigns/{id}/actions/revoke` | 撤销广告 | OpsLead | 同上 | 待定义 |
| `GET /api/ops/v1/ad-campaigns/{id}/stats` | 广告统计 | OpsLead | 同上 | 待定义 |
| `GET /api/ops/v1/roles` | 后台角色列表 | OpsLead | 同上 | 待定义 |
| `POST /api/ops/v1/roles` | 后台创建角色 | OpsLead | 同上 | 待定义 |
| `PUT /api/ops/v1/roles/{id}` | 编辑角色 | OpsLead | 同上 | 待定义 |
| `GET /api/ops/v1/roles/permission-matrix` | 角色权限矩阵 | OpsLead | 同上 | 待定义 |
| `GET /api/ops/v1/staff` | 后台员工列表 | OpsLead | 同上 | 待定义 |
| `POST /api/ops/v1/staff` | 后台创建员工 | OpsLead | 同上 | 待定义 |
| `PUT /api/ops/v1/staff/{id}` | 编辑员工 | OpsLead | 同上 | 待定义 |
| `GET /api/ops/v1/audit-logs` | 操作日志 | OpsLead | 同上 | 待定义 |
| `GET /api/ops/v1/dashboard/summary` | 后台首页汇总 | OpsLead | 同上 | 待定义 |
| `GET /api/ops/v1/dashboard/trend30d` | 后台首页趋势 | OpsLead | 同上 | 待定义 |
| `POST /api/open/v1/quotes` | 开放报价 | OpsLead | 同上 | 待定义 |
| `POST /api/open/v1/orders` | 开放创建订单 | OpsLead | 同上 | 待定义 |
| `GET /api/open/v1/orders/{id}` | 开放查订单 | OpsLead | 同上 | 待定义 |
| `POST /api/open/v1/orders/{id}/actions/cancel` | 开放取消订单 | OpsLead | 同上 | 待定义 |
| `GET /api/open/v1/orders/{id}/tracking` | 开放订单轨迹 | OpsLead | 同上 | 待定义 |
| `GET /api/public/v1/ads` | 客户端与司机端广告 | OpsLead | 同上 | 待定义 |
| `POST /api/public/v1/ad-interactions` | 广告曝光/点击上报 | OpsLead | 同上 | 待定义 |

## DashboardSummary 指标来源与口径

以下口径按公司隔离统计；日期边界使用后台可配置的运营日历。未就绪的数据源不得被 demo 值伪装为实时值。

| 指标字段 | 来源表或视图 | 计算口径（含时间窗口、去重与排除规则） | 来源表属于哪个号段/哪张卡 | 当前是否已在 develop |
| --- | --- | --- | --- | --- |
| `pendingDispatchOrderCount` | `orders.draft` | 当前快照中 `snapshot#>>'{order,state}'='awaiting_dispatch'` 的 `id` 去重计数；天然排除已执行、已送达、取消及其他状态。 | 002 订单草稿基础；R2 由 OpsLead 消费 | 是 |
| `pendingDispatchOrderDeltaVsYesterday` | `orders.draft` + `orders.draft_revision` | 当前待调度去重计数，减去上一运营日结束时每个订单在 `draft_revision` 的最后一版快照为 `awaiting_dispatch` 的去重计数；同一订单只取该截止点前最新版本，排除截止点后修订。 | 002 订单草稿及追加修订；R2 由 OpsLead 消费 | 是 |
| `availableDriverCount` | 后台可配置 demo 示例值；后续 Backend2 070 司机表 | 当前分支未含 070 表定义，故只返回标注“示例”的后台配置值；070 合入后按其发布的可调度状态对司机主键去重，排除停用、审核未通过和不可调度状态。 | Backend2 070 司机注册/运力；CMP-1324 | 否（070 未合入） |
| `driversPendingConfirmationCount` | 后台可配置 demo 示例值；后续 Backend2 070 司机表 | 当前分支未含 070 表定义，故只返回标注“示例”的后台配置值；070 合入后在可调度司机集合内，按其发布的待确认标记去重计数，不把不可调度司机计入分母。 | Backend2 070 司机注册/运力；CMP-1324 | 否（070 未合入） |
| `onTimeDeliveryRatePercent` | `delivery.record` + `dispatch.service_promise` | 最近 `onTimeDeliveryRateWindowDays` 个运营日内，按订单去重；仅 `delivery_state='DELIVERED'` 纳入，交付时间取 `record.observed_at`。现有 `service_promise.snapshot` 尚未固化可比较的承诺截止字段，因此实时比例未就绪，先返回后台可配置“示例”值；截止字段发布后以不晚于承诺截止的订单数除以纳入订单数，分母为零时返回配置示例。 | 014 服务承诺、034 送达记录；R2 由 OpsLead 消费 | 表已在；实时口径未就绪 |
| `onTimeDeliveryRateWindowDays` | 后台配置（示例） | 统计窗口天数仅接受 1–366；不从订单数据反推，变更后同时作用于准时率时间窗口。 | DashboardSummary 契约 `3f589fe`；OpsLead 看板配置 | 是（契约）；配置存储待 OpsLead 接线 |
| `actionRequiredExceptionCount` | `casework.dispatch_exception` | 当前状态为 `open`、`assigned` 或 `resolving` 的异常 `id` 去重计数；排除 `resolved`、`closed`，不按事件表重复累计。 | 019 调度异常；R2 由 OpsLead 消费 | 是 |

## 缺口与认领

- 表格数据行精确计数：Backend1 16、Backend2 16、BackendSenior 29、OpsLead 39，合计 100。BackendSenior 模块清单逐行计数为 29 条。
- OpsLead 的 39 条均为 `待定义`：当前模块清单尚未逐接口给出请求、返回与错误码；待 OpsLead 补齐细则后再更新状态，不改变其归属。

| 页面 | 按钮或动作 | 期望接口语义 | 建议归属岗位 | 状态 |
| --- | --- | --- | --- | --- |
| 管理后台订单 | 查看订单详情 | 按订单读取状态、当前环节与时效风险 | Backend1 | 待认领 |
| 管理后台运力 | 打开司机详情 | 读取指定司机运营档案与当前运力状态 | Backend2 | 待认领 |
| 管理后台运力 | 打开车辆详情 | 读取指定车辆运营档案与可调度状态 | Backend2 | 待认领 |
| 管理后台运力 | 打开注册审批详情 | 读取指定司机注册申请详情 | Backend2 | 待认领 |
| 管理后台客服与异常 | 查看工单详情 | 读取客服工单或配送异常详情（关联订单、负责人、SLA） | Lead2 先裁定后端归属 | 待认领 |
| 管理后台商户 | 查看商户详情 | 读取商户基础资料与服务订单概览 | Backend1 | 待认领 |
| 管理后台用户 | 查看用户详情 | 读取用户状态、订单概览与客服关联记录 | Backend1 | 待认领 |
| 司机端派单列表 | 连接任务／刷新任务 | 读取司机可处理派单列表 | 待后端认领 | 待认领 |
| 司机端派单详情 | 查看详情 | 读取派单、订单、交接记录、出发就绪状态与收货授权 | 待后端认领 | 待认领 |
| 司机端履约证据 | 上传照片 | 创建上传凭证并登记证据文件 | 待后端认领 | 待认领 |
| 司机端交接 | 确认交接 | 提交司机货物交接确认、原因与证据 | 待后端认领 | 待认领 |
| 司机端出发 | 确认出发 | 提交派单出发确认、原因与证据 | 待后端认领 | 待认领 |
| 司机端派单处置 | 接单／拒单 | 提交派单接受或拒绝及拒绝原因 | 待后端认领 | 待认领 |
| 司机端离线事件 | 补传事件 | 批量接收并幂等处理司机离线到达事件 | 待后端认领 | 待认领 |
| 客户端寄件 | 选择单件／批量并提交示例草稿（含 COD 声明） | 创建／保存客户订单草稿并记录寄件模式与代收货款声明 | 待后端认领 | 待认领 |
| 客户端寄件 | 纯前端付款确认 | 获取付款确认状态／提交模拟确认结果（不接入真实支付） | 待后端认领 | 待认领 |
| 客户端订单 | 订单列表、订单详情 | 查询当前客户订单列表与详情 | 待后端认领 | 待认领 |
| 客户端收件人查件 | 打开查件页、查看物流状态 | 按受限查询条件取得脱敏订单轨迹 | 待后端认领 | 待认领 |
| 客户端消息 | 查看消息列表 | 查询客户配送通知／消息列表 | 待后端认领 | 待认领 |
| 客户端我的 | 修改语言 | 保存客户语言偏好 | 待后端认领 | 待认领 |

未列入：关闭详情、拍照、系统设置和地图跳转为端侧动作；装车扫码、送达、位置核对、未送出原因、示例收款以及 KPI 详情读取已在接口索引中存在对应语义。
