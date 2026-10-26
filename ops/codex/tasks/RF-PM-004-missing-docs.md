# RF-PM-004 · 补齐 10 份被引用但缺失的 PRD 文档

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | docs / 低 |
| 基线 SHA | `2ac993ec20adb24feeb6b5035fb15a69990b608c` |
| 分支 | `docs/RF-PM-004-missing-prd-docs` |
| 状态 | TODO |

## 背景

`contracts/`、`services/`、`README.md` 引用了以下文档，但 main 里不存在，链接全部失效，评审无法核对需求依据：

- `PRD/docs/cross-end-finance-and-reports-v0.1.md`
- `PRD/docs/customer-portal-scope-v0.1.md`
- `PRD/docs/database-implementation-plan-v0.1.md`
- `PRD/docs/delivery-pricing-system-v0.1.md`
- `PRD/docs/development-responsibilities-v0.1.md`
- `PRD/docs/kess-payment-integration-v0.1.md`
- `PRD/docs/pricing-development-map-v0.1.md`
- `PRD/docs/project-delivery-depth-v0.1.md`
- `PRD/docs/server-implementation-plan-v0.1.md`
- `PRD/docs/telegram-and-driver-app-scope-v0.1.md`

## 要做

1. 从本地交接目录找到这 10 份原件，原样加入 `PRD/docs/`，不改内容。
2. 提交前扫描：不得含密钥、KESS 商户凭据、真实电话、身份证、银行账号；发现则停下，在 PR 里列出并请人类负责人处理。
3. 找不到原件的，在 PR 里列出，不要凭记忆重写。
4. 加完后再跑一次链接检查，确认 `contracts/` 与 README 中 `PRD/docs/*.md` 引用全部可达。

## 验收

10 个链接可达或在 PR 中逐个说明缺失原因；敏感信息扫描结果写进 PR 描述。

## 审查记录

（Claude 填写）
