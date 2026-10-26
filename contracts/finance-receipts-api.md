# 收款来源查询 API · v0.1 本地开发

2026-10-25。通用收款事实支持客户申报、运营补录和独立确认；旧预付款收据及其核销链继续保留，二者统一投影为 Receipt 与 ReceiptPage。它不接通银行、KESS 或自动退款。

| 方法及路径 | 权限 | 结果 |
|---|---|---|
| GET /api/ops/v1/finance/receipts | finance:receipts:read | 获授权客户范围内的 ReceiptPage |
| POST /api/ops/v1/finance/receipts | finance:receipts:report | 运营登记银行转账或公司现金收款；可暂不关联订单，但必须提供主体、凭证与交易引用 |
| GET /api/ops/v1/finance/receipts/{resourceId} | finance:receipts:read | 单项 Receipt；无范围权限时返回404 |
| POST /api/ops/v1/finance/receipts/{receiptId}/actions/confirm | finance:receipts:confirm | 不同自然人确认交易、金额、币种、账户与证据；确认不等于核销 |
| GET /api/customer/v1/receipts | portal:finance:read | 当前客户范围内的同一安全投影 |
| POST /api/customer/v1/receipts | portal:payments:request | 当前唯一货主申报向公司转账；主体由会话推导，必须关联本人订单 |
| GET /api/ops/v1/finance/reports/ledger | finance:reports:read | 按币种、主体、方向及到期日筛选已有账项的可下钻报表 |
| GET /api/customer/v1/reports/ledger | portal:finance:read | 当前唯一货主已有账项的费用与未结报表；不接受主体或方向越权筛选 |

## 数据口径

- 新 `finance.receipt` 是只追加资金事实：运营可登记银行转账或已经由公司保管的现金；客户只能申报 BANK_TRANSFER，付款主体由会话推导且所有关联订单必须属于该主体。无订单的运营申报必须引用启用客户主体，作为待认领收款，不能凭空创建匿名资金。
- reported 是尚未独立核验的申报，allocatedMinor=0、unallocatedMinor=0；confirmed 才显示未分配余额。确认人必须与申报人是不同自然人，交易引用以公司、收款账户（现金为空）和引用号唯一；旧预付款收据仍按其原有核销与撤销规则投影。
- 客户与运营申报都要求已可用证据；有关联订单时证据必须属于其中一单。无订单运营申报只能使用企业内已可用证据。金额均是整数最小货币单位，退款字段固定为零，直到独立退款流程实现。
- 账项报表仅投影已经落库的 `ledger_item` 与已入账价差调整；不会把司机保管、COD、渠道待结算、合作应付或未知资金填为零。资金池概览仍待这些独立事实完成后实现。
- 运营和客户读取同一 PostgreSQL 事实。客户投影不含银行参考号、收款账户、人工依据、经办人或内部审核载荷。

## 查询与权限

只接受 limit=1..100 与签名 cursor；游标绑定公司、主体、排序、时效，不能跨会话复用。查询按收款 ID 稳定分页，企业与客户范围继续由 PostgreSQL RLS 限制。无权客户的列表为空，单据不因猜测 ID 暴露。

验证：本机单元／契约测试覆盖收款接口路由、输入输出和重复订单／同人确认阻断；原预付款的 PostgreSQL HTTP 集成测试覆盖申报、核验、三人核销、撤销排除、运营列表及详情、客户读取、无授权空页及无效分页。新通用收款表尚未在本环境执行真实 PostgreSQL 集成测试。真实银行、KESS、司机现金/COD、退款及生产身份尚未接入。
