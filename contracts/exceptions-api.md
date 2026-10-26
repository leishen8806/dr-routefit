# 调度异常接口（本地开发）

本文件覆盖事故、缺货、货损、拒收、价格争议等调度异常的最小闭环：登记、查看、指派、解决与关闭。当前只在本机合成 PostgreSQL 环境实现；不代表事故处置、车辆救援、货物转运、保险理赔或通知渠道已经接通。

## 可调用操作

| 操作 | 路径 | 约束 |
|---|---|---|
| 异常列表 | `GET /api/ops/v1/exceptions` | 按当前主体及订单访问范围分页；游标绑定主体和查询。 |
| 异常登记 | `POST /api/ops/v1/exceptions` | `ExceptionRequest`；幂等键必填；订单、包裹与证据均须在当前授权范围。 |
| 指派负责人 | `POST /api/ops/v1/exceptions/{exceptionId}/actions/assign` | `AssignOwner`；幂等键和 `If-Match` 版本必填；负责人必须为同企业有效身份。 |
| 解决异常 | `POST /api/ops/v1/exceptions/{exceptionId}/actions/resolve` | `EvidenceAction`；幂等键和 `If-Match` 版本必填；仅已指派异常可解决。 |
| 关闭异常 | `POST /api/ops/v1/exceptions/{exceptionId}/actions/close` | `EvidenceAction`；仅已解决且无阻断动作可关闭，关闭保留原事件与证据。 |

异常记录含类别、订单、负责人、期限、状态和阻断动作。服务端把创建、指派、解决分别写入不可改事件历史；状态转换、版本递增、负责人身份和跨企业访问均由 PostgreSQL 与服务端共同约束。

## 刻意未实现

件级交接差异会保留 `CUSTODY_TRANSFER` 阻断动作；即使异常标记为已解决，只要该阻断动作仍在，关闭接口将拒绝。后续退回与货物去向闭合不会由本接口伪造。

证据文件必须已经是本订单下的 `available` 文件；本机 `available` 仅表示上传结构与哈希／文件签名检查完成，不是生产恶意文件扫描或保险认定。异常创建也不会自动改变订单、派单、路线、收款、COD、应付或承诺状态。

## 联调顺序

1. 先以 `POST /orders` 建立当前身份可访问的合成订单。
2. 用 `POST /exceptions` 登记异常；重试必须复用同一幂等键。
3. 以返回的 ETag 作为 `If-Match` 执行指派，再以最新版本解决。
4. 发生版本冲突时重新读取，不得用旧版本覆盖；证据不属于订单、未完成或重复时服务端拒绝。

契约字段、枚举和样例以 [OpenAPI](openapi.json) 为准。开发会话、同源限制与启动方式见 [本机开发协议](local-development-api.md)。
