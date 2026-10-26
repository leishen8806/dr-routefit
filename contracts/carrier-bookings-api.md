# 合作承运商委托接口（本地开发）

本组接口建立合作快递／承运商委托的最小闭环：先用已核验合作方和当前协议登记委托，再请求、确认、记录外部事件，最后由平台独立核验交付或完成取消。

| 操作 | 状态变化 |
|---|---|
| 创建 | `draft` |
| 请求 | `draft → pending_confirmation` |
| 确认 | `pending_confirmation → confirmed` |
| 承运商报送交付 | `confirmed → delivery_reported` |
| 平台核验交付 | `delivery_reported → delivered_verified` |
| 取消 | `draft/pending_confirmation/confirmed → cancel_requested → cancelled` |

创建要求：订单已受理、当前报价已确认、付款准入通过，且合作方为 `active` 并引用其当前准入协议。每单同时只允许一个有效合作委托；取消尚未确认时仍视为有效委托。

外部承运商报告 `DELIVERED` 只会写入 `delivery_reported`，不能直接成为已完成。平台必须复验该订单的已完成交接证据，才可变为 `delivered_verified`。重复外部事件 ID 会被拒绝。

本机没有外部承运商 API、司机轨迹、自动支付或合作方应付结算。所有外部状态均为人工／模拟报告，不得冒充实时渠道回执。
