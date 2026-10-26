# 会话接口（本机开发）v0.1

`POST /api/ops/v1/session/actions/logout` 需要同源浏览器会话、`X-CSRF-Token`、16至128位幂等键及空JSON对象 `{}`，成功返回 `204 No Content` 并清除本机 `rf_session` Cookie。

该操作会在本地数据库保留幂等结果后撤销当前浏览器开发会话；同一会话被撤销后不能再用它重试，因此客户端应把204视为终态。它不撤销来源开发身份，也不代表生产IdP、Telegram或移动设备令牌已撤销。

本机已有的 `POST /dev/session/logout` 继续仅供开发页面辅助使用；前端对接业务契约时应使用上述 `/api/ops/v1` 路径。
