# 结算账户与客户退款申请 API

2026-10-25。本机实现客户退款申请，以及客户／司机本人、运营获授权主体的脱敏结算账户读取。完整字段、状态和错误码以 [OpenAPI](openapi.json) 为准。

| 操作 | 路径 | 权限 | 结果 |
| --- | --- | --- | --- |
| `customerSettlementAccounts` | `GET /api/customer/v1/settlement-accounts` | `customer:accounts:read` | 仅返回当前唯一客户主体名下、`verified` 的脱敏账户 |
| `driverSettlementAccounts` | `GET /api/driver/v1/settlement-accounts` | `driver:accounts:read` | 仅返回当前有效司机主体本人名下、`verified` 的脱敏账户 |
| `opsSettlementAccounts` | `GET /api/ops/v1/settlement-accounts?subjectId=…` | `finance:accounts:read` | 仅在当前运营人员持有未过期、包含该主体的 `role_grant.subjectIds` 时返回其 `verified` 脱敏账户 |
| `requestCustomerRefund` | `POST /api/customer/v1/refund-requests` | `portal:refunds:request` | 创建 `submitted` 的退款审核申请 |
| `customerFinanceRequests` | `GET /api/customer/v1/finance-requests` | `portal:finance:read` | 仅返回当前客户自己的申请 |

## 约束

- 退款源必须是当前客户的已确认收款；请求同时校验收款版本、结算账户版本、币种和账户归属。
- 可申请额是原收款减去已入账核销和已有退款预留。收款行与退款汇总在同一事务中锁定，避免不同幂等键并发超额申请。
- 结算账户只返回银行标识、尾号和展示名称；不在 API、日志或快照中返回完整账号。司机账户读取会先核验当前会话是有效 `DRIVER`／`PARTNER_DRIVER`，主体固定为当前司机，不能带入其他 `subjectId`。
- 运营账户读取同时要求接口权限和一条未过期的主体范围授权；没有匹配范围时按资源不存在处理，且不会执行账户查询。分页游标绑定查询主体，不能拿一个主体的游标翻阅另一个主体。
- 申请只产生不可改写的内部 `submitted` 记录。它不执行 KESS、银行转账、自动退款或账务冲正；后续独立复核、审批、执行、结果核对必须通过财务单据流程实现。
- 无授权或猜测其他客户的收款、账户、申请一律不暴露，返回的资源语义等同不存在。

验证：本机单元／契约测试覆盖分页参数拒绝、客户范围隔离、司机主体绑定、已确认且未超额的预留、超额阻断和收款投影的预留金额。真实 PostgreSQL 并发、KESS／银行退款、账户创建／变更审核及支付结果仍未在当前环境验证。
