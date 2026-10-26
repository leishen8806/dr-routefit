# C2 仓储申请 API（本机开发切片）

状态：2026-10-25，**14 个操作本机实现**；适用于受邀货主与已授权仓库人员。唯一机器契约是 [openapi.json](openapi.json)。本说明不修改正式 PRD、RULE 或 AT。

## 已接通的最小链路

```text
货主入库预报／出库申请
  → 仓库查看 submitted 队列
  → 受理（独立受理理由＋该申请的 available 证据）
  → accepted，等待后续库存或实物交接事实
```

| 对象 | 操作 | 权限 |
| --- | --- | --- |
| 客户 | `customerInboundNotices` / `createInboundNotices` / `getInboundNotices` | `portal:warehouse:read` / `portal:warehouse:request` |
| 客户 | `customerOutboundRequests` / `createOutboundRequests` / `getOutboundRequests` | `portal:warehouse:read` / `portal:warehouse:request` |
| 仓库 | `listInbound` / `acceptInbound` | `warehouse:read` / `warehouse:accept` |
| 仓库 | `listOutbound` / `acceptOutbound` | `warehouse:read` / `warehouse:accept` |

客户读取按当前唯一授权货主过滤；仓库读取按运营企业过滤。跨货主、跨企业和错误类型均返回资源不存在，避免泄露申请存在与否。

## 状态、并发与证据

- 创建时状态固定为 `submitted`，版本为 `1`；重复提交必须重用同一 `Idempotency-Key`。
- 仓库只可将同类型、当前版本的 `submitted` 申请推进为 `accepted`，并使用 `If-Match`、受理理由和至少一个已完成、归属该申请的 `WAREHOUSE_REQUEST` 证据文件。
- 数据库触发器拒绝删除、身份字段改写、跳跃版本及非 `submitted → accepted` 的转换；请求事件与证据关联只追加。
- 同一 SKU 不允许在一张申请中重复；如请求行携带 `inventoryId`，必须同时提供对应 `inventoryVersion`。

客户在申请创建前可引用本人已有且已完成的包装证据；创建后需上传该申请专属的 `WAREHOUSE_REQUEST` 证据，仓库才能受理。开发环境中的 `available` 仅表示本地结构检查完成，不等于生产恶意文件扫描结论。

## 明确未做的事

入库预报不增加实物库存；出库申请和受理不创建订单、不派车，也不改变财务状态。库存写入来源仍必须是 RouteFit WMS 或后续 WMS 权威事件；当前没有库存来源时返回空集，不把未知写成零。

## 已接通的库存预留

`customerInventory` 只返回当前货主的可靠库存快照，并显示 `bookQty - reservedQty - quarantineQty` 计算出的 `requestableQty`。``reserveStock`` 只接受已受理出库申请、相同申请版本、精确匹配的申请行及每个库存行的当前版本；服务端在同一事务中锁库存行并增加 `reservedQty`。

`stockRelease` 只释放已确认预留；`stockConsume` 在具备该仓储申请的有效证据时同时减少账面和预留数。两者都要求当前预留版本、幂等键及独立证据，不会重复扣减。外部 WMS 权威回执和 `wmsStockEvent` 仍未接通，不能用此本机内部库存切片冒充外部仓库实物事实。

迁移为 `services/routefit/db/migrations/040_warehouse_requests.sql`。在干净的本机合成数据库执行迁移后才能启动；不允许使用生产数据库或生产账号做本机验证。
