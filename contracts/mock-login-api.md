# 模拟登录接口（司机端、客户端）v0.1 · 示例

仅开发环境。固定验证码，不调用真实短信或 Telegram，不读写真实凭据。生产环境必须关闭（见下）。

| 端 | 路径 |
|---|---|
| 司机端 | `POST /api/driver/v1/auth/mock-login` |
| 客户端 | `POST /api/customer/v1/auth/mock-login` |

请求体只接受 `phone`（6–15 位数字，可带 +）与 `code`。验证码固定为示例值 `123456`（模拟，非凭据）。

成功 200：`{mode:"mock-development", audience, tokenType:"Bearer", accessToken, expiresAt, companyId, principalId, permissions}`。令牌 8 小时内有效，只能用于本端路径前缀（司机令牌访问 `/api/ops/v1`、`/api/customer/v1` 返回 403），不能与 Cookie 同时使用，不能再换取别的令牌。

错误：手机号不存在、验证码错误、手机号属于另一端，一律 `401 INVALID_CREDENTIALS`（不泄露手机号是否存在）；身份权限与该端不符 403；方法 405；非 JSON 415；多余字段 422；非本机 403；同一来源每分钟最多 10 次 429。

## 开关（缺一不可，默认关闭）
- `NODE_ENV` 必须是 `development` 或 `test`（未设置、`production`、其他值一律关闭）。
- `ROUTEFIT_AUTH_MODE=development` 且 `ROUTEFIT_MOCK_LOGIN=1`。
- 关闭时两个路径返回 `404 NOT_FOUND`，与不存在的接口一致；`main.mjs` 在 `NODE_ENV=production` 时本来就拒绝启动。
- 模拟身份来自被忽略的本地会话文件：在已有的显式开发会话条目上加 `mockLogin:{audience,phone}`。

测试：`services/routefit/tests/mock-login.test.mjs`。OpenAPI 路径由 BackendSenior 合并时按各端前缀写入（本任务不改 `contracts/openapi.json`）。
