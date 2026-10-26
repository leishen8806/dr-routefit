# 收货人轻入口接口

2026-10-26。本组接口仅服务某一订单的预登记收货人：它不是客户门户、司机凭据或公开追踪链接的写权限升级。

## 本地流程

`trackingRef` → 预登记联系电话验证码 → 15 分钟订单限定 Bearer token → 查看本次配送、提交交付安排／异常、登记确认声明、上传本订单交付或争议证据。

验证码请求始终返回通用文案；不存在、失效或无预登记电话不会泄露订单或电话号码。验证失败统一为 `401 RECIPIENT_CHALLENGE_INVALID`；挑战最多五次，单次有效十分钟。令牌哈希化保存，令牌只在验证成功时返回一次。

| 操作 | 路径 | 关键约束 |
| --- | --- | --- |
| 请求验证码 | `POST /api/recipient/v1/access-challenges` | 仅 `trackingRef`；本机须显式配置验证码发送器。 |
| 验证并建会话 | `POST /api/recipient/v1/sessions` | `challengeId` + 六位验证码；不使用通用幂等缓存。 |
| 查看配送 | `GET /api/recipient/v1/delivery` | Bearer token 仅绑定创建会话时的订单。 |
| 提交服务申请 | `POST /api/recipient/v1/service-requests` | 改址／改期只是申请；不会直接修改费用、路线或承诺。 |
| 登记收货声明 | `POST /api/recipient/v1/delivery-acknowledgements` | 不改变订单为已签收；与司机交付记录的件数不一致时进入 `needs_review`。 |
| 上传／完成／下载证据 | `/api/recipient/v1/uploads…` | 仅本订单 `DELIVERY`／`DISPUTE` 证据，MIME、大小、SHA-256 与扫描状态复用统一证据模型。 |

写操作均要求 `Idempotency-Key`；完成上传还要求 `If-Match`。重复键若携带不同内容会返回 `409 IDEMPOTENCY_KEY_REUSED`。

## 本地验证码通道

本地开发可在忽略目录下配置 `ROUTEFIT_RECIPIENT_CODE_SINK=.local/recipient-codes.jsonl`。它只用于开发人员读取合成验证码，文件不应进入版本库，也不是短信服务、Telegram Bot 或生产通知渠道。未配置发送器时，所有挑战请求返回 `503 RECIPIENT_CHALLENGE_DELIVERY_UNAVAILABLE`，不会伪造发送成功。

真实短信／Telegram、号码归属、发送审计、频率策略和生产反滥用仍需在渠道选择后接入；当前没有接入任何外部消息服务。
