# RF-UX-V1 R2 BackendSenior 接口清单

状态：契约先行；下列均为 `LOCAL_PLANNED`，不接入银行、KHQR、KESS 或地图服务。所有金额均为整数 `amountMinor` + `currency`，所有示例配置含 `example: true`。写操作要求同源会话、CSRF、`Idempotency-Key`；动作接口另要求 `If-Match`。

| 路径 | 用途 / 页面 | 负责人 | 权限与边界 | 请求 / 返回 / 错误 |
| --- | --- | --- | --- | --- |
| `POST /api/ops/v1/dispatch/optimization-runs` | 调度台「自动排线」发起 | BackendSenior | `dispatch:optimize`；只读企业范围订单与车辆 | `OptimizationRunCreate` → `OptimizationRun`；`NO_ELIGIBLE_VEHICLE`、`VERSION_CONFLICT` |
| `GET /api/ops/v1/dispatch/optimization-runs` | 自动排线列表 | BackendSenior | `dispatch:read`；分页、企业隔离 | query → `OptimizationRunPage`；`INVALID_QUERY` |
| `GET /api/ops/v1/dispatch/optimization-runs/{runId}` | 自动排线结果详情 | BackendSenior | `dispatch:read`；越权统一 404 | 无 body → `OptimizationRun`；`NOT_FOUND` |
| `POST /api/ops/v1/dispatch/optimization-runs/{runId}/actions/adopt` | 调度台「采纳方案」 | BackendSenior | `dispatch:adopt`；仅成功、未过期运行；事务写既有 route plan | `AdoptOptimization` → `OptimizationRun`；`RUN_NOT_ADOPTABLE`、`VERSION_CONFLICT` |
| `GET /api/ops/v1/finance/payout-approvals` | 财务「出款审批」列表 | BackendSenior | `payouts:read`；分页、状态筛选 | query → `PayoutApprovalPage`；`INVALID_QUERY` |
| `GET /api/ops/v1/finance/payout-approvals/{approvalId}` | 出款审批详情 | BackendSenior | `payouts:read`；金额与目标账户脱敏 | 无 body → `PayoutApproval`；`NOT_FOUND` |
| `POST /api/ops/v1/finance/payout-approvals/{approvalId}/actions/approve` | 运营审批出款 | BackendSenior | `payouts:approve`；批准人与确认人数据库约束不得相同 | `PayoutDecision` → `PayoutApproval`；`SELF_CONFIRM_FORBIDDEN`、`INVALID_STATE` |
| `POST /api/ops/v1/finance/payout-approvals/{approvalId}/actions/reject` | 运营驳回出款 | BackendSenior | `payouts:approve`；追加不可变事件 | `PayoutDecision` → `PayoutApproval`；`INVALID_STATE` |
| `POST /api/ops/v1/finance/payout-approvals/{approvalId}/actions/confirm-paid` | 财务确认模拟出款 | BackendSenior | `payouts:confirm-paid`；不得与 approve 同一人；仅记录模拟结果 | `PayoutConfirmation` → `PayoutApproval`；`SELF_CONFIRM_FORBIDDEN`、`INVALID_STATE` |
| `POST /api/ops/v1/finance/withdrawal-requests/{requestId}/payout-approvals` | 提现进入两步审批 | BackendSenior | `payouts:create`；来源版本、可提现额重验 | `PayoutApprovalCreate` → `PayoutApproval`；`AMOUNT_EXCEEDS_AVAILABLE`、`DUPLICATE_SOURCE` |
| `POST /api/ops/v1/finance/merchant-settlement-requests/{requestId}/payout-approvals` | 商户结算进入两步审批 | BackendSenior | `payouts:create`；来源企业与账户版本重验 | `PayoutApprovalCreate` → `PayoutApproval`；`DUPLICATE_SOURCE` |
| `GET /api/ops/v1/payroll/schemes` | 财务「工资规则」列表 | BackendSenior | `payroll:schemes:read`；仅已批准版本可用于计算 | query → `PaySchemePage`；`INVALID_QUERY` |
| `POST /api/ops/v1/payroll/schemes` | 新建工资规则示例版本 | BackendSenior | `payroll:schemes:write`；所有金额示例、版本化 | `PaySchemeDraft` → `PayScheme`；`INVALID_PAY_SCHEME` |
| `POST /api/ops/v1/payroll/schemes/{schemeId}/actions/submit` | 提交工资规则审批 | BackendSenior | `payroll:schemes:submit`；不改历史版本 | `VersionedDecision` → `PayScheme`；`INVALID_STATE` |
| `POST /api/ops/v1/payroll/schemes/{schemeId}/actions/approve` | 批准工资规则 | BackendSenior | `payroll:schemes:approve`；提交人与审批人不同 | `VersionedDecision` → `PayScheme`；`SELF_APPROVAL_FORBIDDEN` |
| `POST /api/ops/v1/payroll/runs` | 财务「生成工资单」 | BackendSenior | `payroll:runs:create`；事务生成、同人员月份幂等 | `PayrollRunCreate` → `PayrollRun`；`SCHEME_NOT_APPROVED`、`DUPLICATE_PERIOD` |
| `GET /api/ops/v1/payroll/runs` | 工资单列表 | BackendSenior | `payroll:runs:read`；分页、企业隔离 | query → `PayrollRunPage`；`INVALID_QUERY` |
| `GET /api/ops/v1/payroll/runs/{runId}` | 工资单详情 | BackendSenior | `payroll:runs:read` | 无 body → `PayrollRun`；`NOT_FOUND` |
| `GET /api/ops/v1/payroll/runs/{runId}/lines` | 工资单人员明细 | BackendSenior | `payroll:runs:read`；仅脱敏账户 | query → `PayrollLinePage`；`NOT_FOUND` |
| `POST /api/ops/v1/payroll/runs/{runId}/actions/submit` | 提交工资单出款 | BackendSenior | `payroll:runs:submit`；创建 payout approval，不调用真实通道 | `EmptyCommand` → `PayrollRun`；`INVALID_STATE` |
| `GET /api/ops/v1/kpi/rule-versions` | KPI 标准查看 | BackendSenior | `kpi:rules:read`；仅生效版本默认返回 | query → `KpiRuleVersionPage`；`INVALID_QUERY` |
| `POST /api/ops/v1/kpi/rule-versions` | 提交 KPI 示例标准 | BackendSenior | `kpi:rules:write`；金额标示 `example: true`，版本化 | `KpiRuleDraft` → `KpiRuleVersion`；`INVALID_KPI_RULE` |
| `POST /api/ops/v1/kpi/rule-versions/{ruleVersionId}/actions/approve` | 批准 KPI 标准 | BackendSenior | `kpi:rules:approve`；创建人与审批人不同 | `VersionedDecision` → `KpiRuleVersion`；`SELF_APPROVAL_FORBIDDEN` |
| `GET /api/ops/v1/kpi/monthly-results` | KPI 月度结果列表 | BackendSenior | `kpi:results:read`；分页、企业隔离 | query → `KpiMonthlyResultPage`；`INVALID_QUERY` |
| `GET /api/ops/v1/kpi/monthly-results/{resultId}` | KPI 月度结果详情 | BackendSenior | `kpi:results:read` | 无 body → `KpiMonthlyResult`；`NOT_FOUND` |
| `POST /api/ops/v1/kpi/monthly-results/{resultId}/reward-penalties` | 新增奖惩条目 | BackendSenior | `kpi:reward-penalties:write`；写入不可变条目 | `RewardPenaltyDraft` → `RewardPenalty`；`RULE_VERSION_REQUIRED` |
| `GET /api/ops/v1/kpi/appeals` | KPI 申诉列表 | BackendSenior | `kpi:appeals:read`；申请人只见本人 | query → `KpiAppealPage`；`INVALID_QUERY` |
| `POST /api/driver/v1/kpi/monthly-results/{resultId}/appeals` | 司机端「发起申诉」 | BackendSenior | `driver:kpi:appeal`；结果必须属于本人 | `KpiAppealCreate` → `KpiAppeal`；`NOT_FOUND`、`APPEAL_WINDOW_CLOSED` |
| `POST /api/ops/v1/kpi/appeals/{appealId}/actions/decide` | 后台「裁定申诉」 | BackendSenior | `kpi:appeals:decide`；裁定人不能是原奖惩经办人 | `KpiAppealDecision` → `KpiAppeal`；`CONFLICT_OF_INTEREST`、`INVALID_STATE` |

## 已明确差异与取舍

- 规划的「自动排线」未确定是否使用地图服务。此契约指定本地确定性启发式（容量、时间段、超长件与车型约束），不调用地图、导航或距离 API；因此不需要密钥。
- 规划列出 5 个出款审批接口；为将已存在的提现与商户结算纳入同一两步链，额外定义两个受控「创建审批」动作。它们只建立本地审批记录，不触发实际支付。
- 工资扣款配置默认为 `enabled: false`；所有工资、KPI、车辆和计酬数字均为后台可改的示例配置，历史工资单与结果记录所用版本。
