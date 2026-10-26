# 持久化通知接口 · 本机开发切片

本切片将经过授权的业务通知写入同企业的持久化出站队列；它不是短信、邮件、Telegram 或推送通道。创建成功只表示通知已排队，绝不表示收件人已收到、已读或业务已完成。

| 操作 | 路径 | 权限 | 本机行为 |
| --- | --- | --- | --- |
| 按模板排队 | `POST /api/ops/v1/notifications` | `notifications:send` | 校验来源、版本和已批准模板；相同业务投递合并为同一记录 |
| 查状态 | `GET /api/ops/v1/notifications/{notificationId}` | `notifications:read` | 读取本企业的队列状态 |
| 失败后重试 | `POST /api/ops/v1/notifications/{notificationId}/actions/retry` | `notifications:send` | 仅明确 `failed` 的记录可重回 `queued` |

## 创建前置与边界

请求为 `NotificationRequest`：`templateId`、`subjectId`、`resourceType`、`resourceId`、`resourceVersion`、`channel`、`reason`。写入请求仍须携带 `Idempotency-Key`、同源会话 CSRF 和当前开发会话；重试另须 `If-Match`。

- 模板必须由受控配置预先写入 `notification.template`，且同企业、`approved`、对象类型和渠道均匹配。当前没有模板管理 API，也不能把前端文案当作批准模板。
- 本机仅复验 `ORDER` 和 `CASE` 的主体与版本。`STATEMENT` 因账单来源尚未接通而显式拒绝，不能伪造账单通知。
- 相同主体、来源版本、模板与渠道只保留一条待投递记录；重复 HTTP 请求同时受幂等键保护。
- 通道工作者、供应商回执、收件人已读、短信／邮件／Telegram 实发和失败回写均尚未实现。未来只有已验证的渠道回执才能把 `queued` 改为 `sent`；超时或结果不明应为 `unknown`，不能重试或宣称已送达。
- 当前 API 只读写本机合成数据，服务仅监听 `127.0.0.1`。不包含生产身份、外部渠道凭据或公网发送能力。

## 状态与重试

`queued` 是本地待投递；`sent` 需要未来渠道回执；`failed` 是明确可重试失败；`unknown` 表示结果未知。状态记录只允许前进：`queued → sent|failed|unknown`，或 `failed → queued`。重试时版本递增并保留原始快照和重试理由；`unknown` 必须先查询原渠道，避免重复发送。

完整字段和错误码以 [OpenAPI](openapi.json) 的 `NotificationRequest`、`Notification` 及三个操作为准。执行前运行 `npm test`；真实 PostgreSQL 测试仍需要本机 PostgreSQL 16+ 与独立测试管理员连接。
