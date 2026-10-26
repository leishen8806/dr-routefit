# 客户门户查询与报价确认接口 · v0.1 本地开发

2026-10-25。此切片把现有订单、报价和应收事实安全投影给已获授权的货主成员；客户可以凭完成的订单证据确认本人未过期报价。它不新增独立账，不开放客户修改订单、直接改价、发起付款或绕过内部复核。

| 方法及路径 | 权限 | 返回 |
|---|---|---|
| `GET /api/customer/v1/session` | `portal:session:read` | 当前主体、客户范围与可用权限；不返回令牌或CSRF原文 |
| `POST /api/customer/v1/uploads` | `customer:evidence:create` | 仅当前唯一货主所属订单的定向上传凭证；返回5分钟上传链接 |
| `POST /api/customer/v1/uploads/{uploadId}/actions/complete` | `customer:evidence:create` | 完成上传，复核实际MIME、大小与SHA-256后进入本机结构检查 |
| `GET /api/customer/v1/evidence-files/{fileId}/download-url` | `customer:evidence:read` | 仅本人订单已可用凭证的5分钟下载链接 |
| `GET /api/customer/v1/orders` | `portal:orders:read` | 本客户订单摘要分页 |
| `GET /api/customer/v1/orders/{orderId}` | `portal:orders:read` | `CustomerOrderDetail`，不含内部执行、阻断与录单草稿字段 |
| `GET /api/customer/v1/orders/{orderId}/timeline` | `portal:orders:read` | 订单、报价、确认和变更申请的安全时间线；不伪造实时位置或履约完成 |
| `GET /api/customer/v1/quotes/{quoteId}` | `portal:quotes:read` | 本客户当前报价与费用项 |
| `POST /api/customer/v1/quotes/{quoteId}/actions/confirm` | `portal:quotes:confirm` | 仅用本订单已完成证据确认本客户未过期报价；幂等回放同一结果，确认不等于付款、派单或服务承诺 |
| `GET /api/customer/v1/receipts` | `portal:finance:read` | 本客户付款申报、核验状态及有效核销余额；不返回银行参考号、内部依据或账户信息 |
| `GET /api/customer/v1/ledger-items` | `portal:finance:read` | 本客户费用项、有效核销额和未结额分页 |

所有读取都沿用企业、客户授权与 PostgreSQL RLS。跨企业、没有该客户授权，或直接猜测资源 ID 时，单项读取返回404；列表返回空页。`orderId` 过滤不会扩大授权范围。门户订单详情刻意不返回内部执行 ID、异常阻断、运营草稿或采购成本；门户台账不返回合作方应付、平台利润、其他客户账项或银行敏感信息。

客户证据上传只接受当前会话唯一货主所属的 `ORDER`，不开放合作方、财务、仓库申请或任意案例文件；跨客户订单、未知文件ID与不受支持资源均不泄露存在性。完成上传前核对MIME、大小、SHA-256和文件魔数，本机 `available` 只代表结构检查，不代表生产恶意文件扫描通过。客户确认报价只接受当前客户所属订单、当前报价版本和已完成的订单证据；证据 ID、确认人、时间与理由写入不可直接改写的确认快照。确认会创建原报价应收，不表示已付款、已获配送承诺或已经派单。收款清单中 `reported` 不产生可用余额，`confirmed` 才显示可分配余额，`disputed` 表示核验未通过；有效核销遇到已入账撤销后会回退。它不提供客户发起付款或退款能力。时间线只展示已落库的订单、报价、确认与服务申请事实；它不等于实时车辆位置、调度执行或签收。台账的已核销／未结额只反映原确认报价费用项；候选重报价的价差仍须经过独立财务单据、审批和映射，不能由门户页面自行抵扣。

验证：真实 PostgreSQL HTTP 集成测试覆盖客户读取本订单、报价、收款、账项，跨企业404或空页，门户订单投影不泄露运营草稿、银行参考号或内部依据，以及客户证据确认报价的授权、版本与幂等。生产 IdP、Telegram 登录、公开跟踪令牌、客户付款申报、KESS 与真实支付尚未接入。
