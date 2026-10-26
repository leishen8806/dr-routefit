# 账期规则与对账单 API（本机实现，未部署）

本组接口对应 `R1-FIN` 的账期规则与对账单内部审核链。它只整理已存在的 `finance.ledger_item` 与已批准的差额账项；不会创建收款、付款、退款或银行流水，也不会把账单签发误写为资金结清。

## 路由与权限

| 操作 | 路径 | 权限 |
| --- | --- | --- |
| 读取规则 | `GET /api/ops/v1/finance/settlement-rules` | `finance:rules:read` |
| 创建草稿规则 | `POST /api/ops/v1/finance/settlement-rules` | `finance:rules:create` |
| 预览三个账期 | `POST /api/ops/v1/finance/settlement-rules/preview` | `finance:rules:read` |
| 独立批准生效 | `POST /api/ops/v1/finance/settlement-rules/{ruleId}/actions/activate` | `finance:rules:activate` |
| 读取账单 | `GET /api/ops/v1/finance/statements`、`GET /.../{statementId}` | `finance:statements:read` |
| 生成账单 | `POST /api/ops/v1/finance/statements` | `finance:statements:create` |
| 复核／审批／签发 | `POST /.../{statementId}/actions/{review|approve|issue}` | 对应 `finance:statements:*` 权限 |

所有写入仍须精确本机 Origin、CSRF、幂等键；状态动作另须 `If-Match`。分页游标绑定企业、主体、资源和 limit，不支持 offset。

## 业务不变量

- 规则先以 `draft` 创建；不同自然人凭证批准后才成为 `active`。同一主体、方向、用途、币种只保留一个 active 规则；旧规则标记 `superseded`，已建账单仍引用原规则版本。
- 生成账单仅接收规则边界一致的期间，并以未进入其他账单的账项建立不可变明细快照。重复生成相同聚合键返回同一账单，不二次取项。
- 对账单内部状态只能 `draft → reviewed → approved → issued`。经办、复核、审批必须为三个不同自然人；签发只能由本单审批人完成。
- 签发仅表示内部账单已签发，**不表示客户已付款、资金已到账或款项已核销**。`paymentState` 只能由账项的实际剩余额反映。
- 保险、配送、COD、承运商、司机收入与仓储用途是独立规则维度，不允许把保险费默认为平台／司机分成。

## 当前范围

本机服务端当前只有可追溯的账项来源，因此账期规则和对账单只能覆盖这些账项。COD、合作方应付、客户门户确认和正式催收通知仍需各自的权威账项、主体授权及接口完成后再接入；不能以空账单或演示数据补齐。
