# 受控客户下单 API · v0.1

2026-10-25。C1-ORDER 现有两项本地开发实现，复用运营录单与受理状态机，不创建 Telegram 专用订单、公共注册或自动派车。

| 操作 | 路径 | 权限 | 结果 |
| --- | --- | --- | --- |
| `customerCreateOrder` | `POST /api/customer/v1/orders` | `portal:orders:create` | 以当前会话唯一授权货主创建草稿；请求体不接受 `customerId`。 |
| `customerSubmitOrder` | `POST /api/customer/v1/orders/{orderId}/actions/submit` | `portal:orders:create` | 提交既有草稿进入受理；复用坐标、尺寸、包装、区域与证据检查。 |

客户会话只能对应一个启用货主；多个授权货主的选择/切换尚无契约，因此返回 `CUSTOMER_CONTEXT_REQUIRED`，不会猜测归属。跨企业或未授权订单以 404 隐藏。创建与提交均要求幂等键，提交额外要求当前订单 `If-Match` 版本。

提交不等于占车、出库、报价、承诺或派单。若后台尚未记录合格的地址/包装/尺寸受理依据或区域不可服务，提交返回 `INTAKE_BLOCKED`，订单保持草稿。客户不能借此跳过运营核验。

本地真实 PostgreSQL 测试覆盖：不接收伪造货主、同键并发重放、唯一货主作用域、跨企业隐藏、缺少核验依据拒绝，以及具备内部核验依据时推进到 `validating`。真实 Telegram 身份、Bot webhook、支付和生产开关仍未实现。
