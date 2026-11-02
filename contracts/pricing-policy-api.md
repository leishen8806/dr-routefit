# 费率策略审核发布接口 v0.1

2026-10-25 · LOCAL_IMPLEMENTED_NOT_DEPLOYED。本地开发增量，非生产定价授权。现有8个费用＋5个录单＋本次4个策略操作，共17个；完整契约215个操作中198个仍待实现。

## 五个操作与身份

| 操作 | 权限 | If-Match含义 | 结果 |
|---|---|---|---|
| POST `/api/ops/v1/pricing/tariffs/{tariffId}/policy-versions` | pricing:write | 来源tariff.version | 201 PricingPolicyVersion，version=1、SUBMITTED |
| GET `/api/ops/v1/pricing/policy-versions` | pricing:read | `state=PUBLISHED`（默认）、`effectiveAt`、`serviceLevel`、`tariffId`、`after`、`limit` | 200 PricingPolicyVersionPage；仅返回本企业已发布且有效的摘要 |
| GET `/api/ops/v1/pricing/policy-versions/{policyId}` | pricing:read | 不需要 | 当前策略投影、ETag |
| POST `…/policy-versions/{policyId}/actions/review` | pricing:review | 策略version，初始1 | 200、version=2、REVIEWED |
| POST `…/policy-versions/{policyId}/actions/publish` | pricing:publish | 策略version，复核后2 | 200、version=3、PUBLISHED |

所有写请求带同源Cookie、Origin、内存CSRF、Idempotency-Key及带双引号If-Match。重放头为`Idempotency-Replayed`；权限和企业身份仍会重新检查。成功重放返回首次响应，不保证是当前投影，随后GET查看最新版本。错误格式、64KiB上限和限流复用[费用接口](pricing-api.md)。

身份来自会话，不接受preparedBy、reviewedBy或approvedBy请求字段。提交人及来源草稿各历史编制人都不能复核或批准；复核人不能批准同一策略。数据库复合外键、CHECK和触发器再检查三主体分离，不能靠切换角色绕过。开发主体不同不等于生产已验证为三个自然人；正式身份和岗位授权仍待建设。

## 冻结快照与适用范围

提交体：`validFrom`、`validUntil`、`quoteValiditySeconds`、`serviceLevels`、`reason`。均必填；有效期须有序且尚未结束，TTL为1–86400秒的本地开发技术上限，不预设正式报价有效期。S1/S2/S3集合不重复；范围文字保留在来源tariff.scope中，尚不等于已经完成服务区域匹配。

当前仅发布DR客户收费，启用规则只允许固定base／flash／insurance，必须明确配置base，零元也须显式保存。任何启用的距离、重量、比例保险、仓储、COD等规则都会返回CAPABILITY_DISABLED，不能忽略后发布。旧试算仍支持其既有规则，本次不削减试算能力。保险不可分成继续由原计算器和数据库约束保证。

提交冻结整份来源草稿、费目、版本、适用期、TTL、服务等级、提交依据及贡献人。复核与发布各追加一条审核事实；业务账号没有历史记录UPDATE／DELETE权限。

复核前或复核后修改来源草稿，会导致旧申请不能继续审核／发布：必须重新提交。已发布后修改草稿不覆盖已发布快照；新收费版本需新申请和新审核。发布不等于已经开始生效，使用方仍须检查validFrom／validUntil。当前尚无提前撤销／停用接口，因此此切片不得承担真实收费，生产启用前必须补齐撤销及影响处理。

## 策略发布与后续报价的边界

受理增量已支持draft→validating；005报价切片新增固定基础费/独享费/可选保险报价，必须重查当前受理与已发布策略。详见[订单报价](order-quotes-api.md)。距离依据与附件服务尚未接通，不能据此报价距离费或宣称承保。

报价生成、客户确认、承保、收款及派单均不由策略发布动作触发。人工审核reason只是审核说明，不伪造evidenceFileIds或宣称扫描过凭证。

## 启动、样例和恢复

先按[服务说明](../services/routefit/README.md)在新交接目录bootstrap。新开发身份0为企业A经办、1为企业B经办、2为企业A复核、3为企业A批准。后两者分别只获pricing:read＋review或publish权限。`npm run session:link -- 2`或`-- 3`在浏览器激活对应开发身份；不是原型前端角色切换。

运行`npm run smoke:policy`实际使用三份短时开发会话完成提交／复核／发布／读取，结束后退出会话，不打印票据、Cookie或CSRF。脚本会创建合成费率和审核记录，勿用于真实数据。

旧库先以迁移账号执行003；001／002校验和不变。旧.local不会自动授予新权限或创建审核主体，请保留旧环境，建议在新的空目录重新bootstrap。不能复制他人的会话文件给大旺。

调用模板：[pricing-policy.http](examples/pricing-policy.http)。机器结构与正反样例由openapi.json、schema-cases.json维护，生成目录和字段字典已同步。

| 错误 | 页面或调用者处理 |
|---|---|
| 403 INDEPENDENT_REVIEW_REQUIRED／FORBIDDEN | 使用独立且获授权的主体，不更改前端角色冒充 |
| 404 NOT_FOUND | 统一处理不可见或不存在的资源 |
| 409 INVALID_STATE | 先完成所需前序动作，再GET查看当前版本 |
| 409 SOURCE_VERSION_CHANGED | 新建审核申请；不能把旧批准套到新草稿 |
| 412 VERSION_CONFLICT | 查询当前策略或草稿，保留输入，不强制覆盖 |
| 422 CAPABILITY_DISABLED／BASE_FEE_REQUIRED／INVALID_POLICY_WINDOW | 修正规则或有效期，不默认补零或发明业务参数 |
| 网络超时／REQUEST_IN_PROGRESS | 以相同方法、路径、body、版本和幂等键重试，不重复创建申请 |

验证：[policy-approval](../services/routefit/verification/policy-approval/README.md)。大旺的审核页面与正式报价页面尚未接线。
