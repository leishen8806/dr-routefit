# 2026-10-25 接口文档同步记录

请求：接口文档同步已实现的服务端。工作区main，HEAD `ba9a77ec78cd20a6bf72476e9c3410d7faa9a06e`。保留已有修改；本轮仅修改接口文档／机器契约描述与样例／校验工具，不修改服务运行代码、数据库、页面或正式PRD／RULE／AT，不提交或部署。

## 更新

- README、implementation-guide、flows-and-acceptance、implementation-mapping与PRD接口说明区分8个本地费用操作和202个待实现操作。
- 费用OpenAPI补本机server、Origin必需头、实际CSRF／幂等键约束、16个操作级请求／响应示例，修正ETag实际返回位置；其余业务路径与schema结构保持原义。
- pricing-api补端到端顺序、325美分合成例、父价表版本、分页、重试及错误处理；examples/pricing.http提供9次请求，覆盖8个操作。
- 指南显式记录开发会话、中文消息、分页、重放头命名差异及重复JSON键尚未拒绝的实现边界；未将这些描述为已完成的生产保证。
- 重新生成endpoint-catalog与fields；校验脚本增加操作级示例验证。before保存本次修改前文件，历史服务验证记录保持原样。

## 本轮验证

| 检查 | 结果 | 证据 |
|---|---|---|
| OpenAPI／schema样例／操作示例 | 187路径、210操作、201schema；413组结构样例＋16个操作示例通过 | [result.json](result.json) |
| 实际服务契约与领域测试 | 8项通过，Node24.22.1 | [service-contract-tests.txt](service-contract-tests.txt) |
| HTTP模板静态对照 | 9次请求覆盖8个操作，4个请求体匹配已验证示例 | [template-check.json](template-check.json) |
| 服务代码未改 | 与此前source-sha256记录逐文件比较 | 同上 |

使用独立临时工具目录，Python3.12.14，依赖按contracts/requirements-dev.txt安装。没有启动数据库或重跑真实HTTP流程；模板验证是路径、请求头及JSON对照，不是人工接口工具执行。此前真实数据库测试见[服务验证记录](../../../services/routefit/verification/2026-10-25/README.md)。

金额均为合成示例，接口仍仅本地开发状态；真实身份、已批准价表、付款、派单、Telegram和移动客户端不因此完成。
