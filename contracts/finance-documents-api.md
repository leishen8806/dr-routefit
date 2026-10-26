# 财务审核单接口 · v0.1 本地开发

2026-10-25。当前本机只启用候选重报价的 `ADJUSTMENT` 价差单；`ALLOCATION`、`PAYMENT`、`REFUND`、`PAYABLE` 等其他财务单据仍保留为契约设计，提交会返回422，不能被误认为已具备真实付款能力。

| 方法及路径 | 权限 | 本机行为 |
|---|---|---|
| `GET /api/ops/v1/finance/documents` | `finance:documents:read` | 已授权调整单分页 |
| `POST /api/ops/v1/finance/documents` | `finance:documents:create` | 建立候选报价价差调整草稿 |
| `GET /api/ops/v1/finance/documents/{documentId}` | `finance:documents:read` | 审核记录、来源与状态 |
| `POST .../actions/submit` | `finance:documents:submit` | 仅经办人提交 |
| `POST .../actions/review` | `finance:documents:review` | 非经办人独立复核 |
| `POST .../actions/approve` | `finance:documents:approve` | 非经办、非复核人审批 |
| `POST .../actions/reject` | `finance:documents:reject` | 在提交或复核阶段驳回 |
| `POST .../actions/post` | `finance:documents:post` | 经批准后创建独立候选应收或客户贷项账项 |

创建调整必须明确提供 `candidateQuoteId`；服务端逐项核验原账项、候选报价、候选费用项、币种和绝对价差。涨价生成新的客户应收，降价生成客户贷项，二者都不覆盖原账项、原收款或原有效核销。候选报价必须已获客户确认；入账不等于退款，也不切换订单当前报价、路线或承诺。

调整单与事件由 PostgreSQL RLS、复合外键和只追加触发器保护。幂等、版本、跨企业404与三人分离均在真实HTTP集成测试覆盖。真实银行/KESS、原收款跨报价重新分配、退款、订单切换和其余通用财务单据尚未接入。
