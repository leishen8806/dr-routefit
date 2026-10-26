# 司机现金交接 API（本机开发）

本组接口把客户现金收取、司机保管、司机交公司和财务点收分开记录。司机交款不会创建第二笔客户收款，也不会自动扣薪、核销、付款或改变收入。

## 流程

1. 司机以 `POST /api/driver/v1/cash-receipts` 申报本人已授权任务的配送费／保险费现金；结果仅为 `reported` 且保管人为 `DRIVER`。
2. 不同自然人的财务人员按既有 `confirmReceipt` 流程独立确认该现金事实。
3. 司机以 `POST /api/driver/v1/cash-handovers` 提交已确认、尚未交回的现金凭证；一张凭证可分次交回，但累计不可超过原金额。
4. 财务以 `POST /api/ops/v1/finance/cash-handovers/{handoverId}/actions/count` 据实点收。足额为 `counted`；多／少款为 `disputed`，差额保持原样。

所有写请求均须带 `Idempotency-Key`；点收另须带当前 `If-Match`。分页游标签名并绑定调用身份，接口不支持 offset。

## 已实现端点

| 操作 | 端点 | 权限 |
| --- | --- | --- |
| 司机申报现金 | `POST /api/driver/v1/cash-receipts` | `driver:cash:report` |
| 司机提交交款 | `POST /api/driver/v1/cash-handovers` | `driver:cash:handover` |
| 司机查看本人交款 | `GET /api/driver/v1/cash-handovers` | `driver:cash:read` |
| 财务交款队列 | `GET /api/ops/v1/finance/cash-handovers` | `finance:cash:read` |
| 财务查看交款 | `GET /api/ops/v1/finance/cash-handovers/{resourceId}` | `finance:cash:read` |
| 财务点收 | `POST /api/ops/v1/finance/cash-handovers/{handoverId}/actions/count` | `finance:cash:count` |

## 当前边界

当前订单受理明确关闭 COD 受益方与代收账；`codAmountMinor` 必须为 `0`，否则以 `COD_NOT_CONFIGURED` 拒绝。配送费和保险费分别按已确认报价账项及既有预付核销余额校验，不能重复收取已预付金额。启用 COD 前，必须先加入独立的 COD 应收、受益商户、返还和核销来源；不得以司机上报金额虚构 COD 余额。

本机服务仍只接受开发会话，未接 KESS、银行或生产身份系统；交款点收不代表银行入账或最终结算。
