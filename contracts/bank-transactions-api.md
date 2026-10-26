# 银行流水接口 · 本机开发切片

本组只登记已经取得证据、人工核验过的银行资金事实。登记流水不等于确认客户收款、不等于给供应商付款、不等于核销账项，也不会调用银行或 KESS。

| 操作 | 路径 | 权限 | 结果 |
| --- | --- | --- | --- |
| 流水列表 | `GET /api/ops/v1/finance/bank-transactions` | `finance:bank:read` | 返回本企业已登记流水及当前未匹配金额 |
| 登记流水 | `POST /api/ops/v1/finance/bank-transactions` | `finance:bank:record` | 写入不可改资金事实和证据关联 |

## 约束

- 收款账户必须已启用，且与流水币种相同；金额为正整数，入账时间不得在未来。
- `(企业、账户、externalTransactionId)` 唯一；同一流水不能重复形成第二笔资金事实。重试使用相同 `Idempotency-Key`，不同业务请求遇到相同流水返回冲突。
- 至少附一项企业内可用证据，证据不被当作“已收款”或“已付款”的自动证明。
- 初始 `matchedMinor=0`、`unmatchedMinor=全额`。多对多匹配、收付款确认、渠道结算和核销仍由后续财务动作实现，不能在登记流水时偷做。

本机仅使用合成数据，不访问银行、KESS 或任何外部支付渠道。完整字段和错误码以 [OpenAPI](openapi.json) 的 `BankTransactionDraft`、`BankTransaction`、`BankTransactionPage` 为准。
