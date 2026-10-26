# 返仓任务 API · v0.1

状态：`createReturn`、`returnAuthorize`、`returnReceive`、`returnInspect` 与 `returnClose` 在本机实现；不表示外部物流、库存或财务闭环已交付。

## 已实现操作

`POST /api/ops/v1/orders/{orderId}/return-tasks`

运营人员在订单当前版本为 `return_open` 时，针对最终交付记录中仍为 `RETURN_PENDING` 的全部包裹发起返仓任务。请求必须带 `If-Match`、幂等键、返仓理由、有效仓库和已完成的订单证据文件：

```json
{
  "packageIds": ["package-id"],
  "reason": "收货人拒收剩余件",
  "warehouseId": "warehouse-id",
  "evidenceFileIds": ["evidence-file-id"]
}
```

成功返回 `201` 和 `ReturnTask`，初始状态固定为 `requested`。同一订单只能有一个未关闭返仓任务；重复提交由幂等记录重放，第二个不同请求按冲突拒绝。

`POST /api/ops/v1/return-tasks/{returnId}/actions/authorize` 使用同一订单的已完成证据、理由、`If-Match` 与幂等键，将任务推进到 `authorized`。授权人必须是有效运营人员，且与任务发起人为不同自然人；应用层和数据库事件触发器都会拒绝同一人绕过该控制。

`POST /api/ops/v1/return-tasks/{returnId}/actions/receive` 要求 `receivedPackageIds` 与 `missingPackageIds` 不重复且恰好覆盖任务全部包裹；缺失件会留下 `discrepancyOpen=true`，不以计划件补齐实收。

`POST /api/ops/v1/return-tasks/{returnId}/actions/inspect` 只能覆盖已实收件，记录 `QUARANTINE`、`RESTOCK_APPROVED` 或 `DAMAGED_HOLD` 处置，但不会自动增加可售库存。`POST /api/ops/v1/return-tasks/{returnId}/actions/close` 只能关闭已检验且无未决差异的任务；两者均须证据、理由、版本与幂等键。

## 未实现边界

`assigned` 与 `picked_up` 仍是为后续外部接回／承运执行预留的状态，没有单独动作接口。现有点收与检验记录不自动生成库存变更、赔付、退款、对外通知或外部物流事实。

完整字段、错误响应和权限以 [OpenAPI](openapi.json) 的 `createReturn` 操作为准。
