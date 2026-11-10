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

## 缺口与认领

- BackendSenior 模块清单当前逐行计数为 29，和协调评论所称 30 条不一致；本索引按实际文件的 29 条汇总，待 Lead 核对后再改。
- 无法从四份已交付模块清单识别出「demo 有按钮但无接口认领」的具体按钮；此项需由三端页面负责人逐项对照后补入。暂不臆造路径或归属。
- OpsLead 的 34 条仍为 `待定义`：当前清单未逐接口给出请求、返回与错误码；由 OpsLead 补齐细则后更新状态，不改变其归属。
