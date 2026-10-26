# DR RouteFit 开发接口包 v0.1

2026-10-25 渠道更新：[客户 Telegram Mini App＋Bot、司机 iOS／Android](../PRD/docs/telegram-and-driver-app-scope-v0.1.md)。受控下单提前为 C1-ORDER；业务接口复用，但 Telegram 认证／webhook／会话和双平台设备契约尚缺，不能仅凭当前 OpenAPI 部署真实 Bot。

本包是**可据此实现、校验和联调的开发候选契约**，不是已部署服务，也不是正式冻结／验收证明。以 V1.4 及后续用户明确的范围增补为依据，保留正式 PRD、RULE 和 AT 编号。技术栈与身份提供方仍按 D24 另行选型。

## 开发阅读顺序

1. [开发对照与业务约束](implementation-guide.md)：身份、幂等、并发、状态、跨端权限、金额、事务和失败处理。
2. [接口目录](endpoint-catalog.md)：每条操作的路径、输入输出、权限、开放阶段和版本对象。
3. [字段字典](fields.md)：字段类型、必填、单位、范围和用途。
4. [OpenAPI 3.1 机器契约](openapi.json)：唯一字段与路由来源，可导入支持 OpenAPI 的接口工具。示例服务器使用保留域名 `.invalid`，不能调用。
5. [流程与验收对照](flows-and-acceptance.md)：正常链、并发与拒绝路径；测试标识 `API-CASE` 不替代 PRD AT。
6. [实现／数据映射及待确认项](implementation-mapping.md)：现有 Demo、数据库草案、旧端点与新契约的对应关系，哪些能开发、哪些需外部资料。

客户产品范围另见 [客户门户分期](../PRD/docs/customer-portal-scope-v0.1.md)。C0 是轻量只读；C1 是邀请制货主门户；收货人写操作另有验证开关；C2 仓储申请要先有可靠库存；C1-ORDER 受控下单；C3 完整自助扩展与客户系统接入受控开放。没有新增独立原生客户 App、公众注册或三维漫游前置条件。

## 怎么使用与维护

`openapi.json` 为字段、路径及操作 ID 的维护源。不是从 Demo 函数自动导出，也不能把 `actorId`、`paid`、`result=SUCCESS` 等原型开关暴露为生产 API。

修改机器契约后同步业务约束、正反样例，再运行：

```text
python scripts/render-api-reference.py
python scripts/validate-api-contract.py
```

校验依赖见 [requirements-dev.txt](requirements-dev.txt)，建议安装在独立 Python 环境。只用于文档校验，不是应用依赖；也支持通过 `ROUTEFIT_VALIDATOR_PATH` 指定单独的工具安装目录。

`examples/schema-cases.json` 为每个数据结构提供合法／非法样例，另含金额精度、跨主体字段注入、伪造支付成功和离线接单等拒绝样例。它验证请求形状，**不证明服务器已做到授权、锁、资金守恒或真实渠道处理**；这些需要按流程验收文档另写服务端测试。

本次 [校验记录](verification/2026-10-24/result.json) 对应实际文件哈希；生成的字段／目录可重建，手工业务文档不得被工具覆盖。新增枚举需同步客户端未知值处理；删字段或改语义须版本迁移，不允许静默更改正在使用的接口。

规范依据：[OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0.html)。KESS 外部协议以 [官方文档](https://devwebpayment.kesspay.io/docs) 及商户实际确认版本为准；本包不自行发明其回调签名或生产地址。
