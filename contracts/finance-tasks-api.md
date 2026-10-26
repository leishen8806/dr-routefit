# 财务今日待办 API

> 本机开发切片。待办只来自已经持久化的收款申报与审核单；它不等同于银行到账、付款执行、账务结清或完整财务工作台。

## 读取待办

`GET /api/ops/v1/finance/tasks`

需要 `finance:tasks:read`。支持 `limit`（1–100）、签名 `cursor`，以及可选的 `type`、`currency`、`subjectId`。游标绑定主体、企业和所有筛选条件，不能改条件或跨会话复用。

当前可返回的待办包括：

- `RECEIPT_REVIEW`：尚未独立核验的预付收款申报。金额与币种取自已保存的申报事实，下一步是核对银行交易、账户与金额。
- `DOCUMENT_REVIEW`：已提交的候选报价价差调整单，等待独立复核。
- `APPROVAL`：已复核的候选报价价差调整单，等待独立审批。
- `COLLECT`：已确认报价产生且仍有未结余额的应收账项。金额按有效核销实时重算；已结清或撤销来源会自然从列表消失。

结果按待办最近业务记录时间倒序。读取不关闭、认领或改变任何财务事实。响应使用 [`FinanceTaskPage`](fields.md#financetaskpage)。

## 标记个人已读

`POST /api/ops/v1/finance/tasks/{taskId}/actions/mark-read`

同样需要 `finance:tasks:read`，并须携带 `If-Match`、`Idempotency-Key`、CSRF 及空命令体 `{}`。系统仅为当前人员追加其 `readAt` 事实；同一待办仍对其他人员保持未读，且不改变其当前业务 `state`。来源收款或审核单被处理后，待办会自然从列表消失；此动作不能关闭、认领或绕过任何复核审批。

## 暂缓催收

`POST /api/ops/v1/finance/tasks/{taskId}/actions/hold`

需要 `finance:tasks:hold`，仅允许暂缓仍为 `open` 的 `COLLECT` 待办。请求需携带 `If-Match`、`Idempotency-Key`、CSRF、未来的 `until`、理由及属于同一订单的已完成证据文件。系统追加不可改写的暂缓事实，不修改原账项、已核销额或客户债务；在 `until` 之前该待办显示 `held`，到期后若仍未结会自动恢复为 `open`。没有“手动结清”或借暂缓减免费用的路径。

## 未纳入的事项

司机交款、COD 保管／返还、合作方应付、付款执行、银行结果核对、月结、渠道结算与差额处理尚没有完整可核验的底层事实，因此不会出现在本机待办中。它们后续必须各自接入来源、审批与证据链，不能以空任务或“已完成”占位。
