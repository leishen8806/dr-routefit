# 订单取消 API（本机开发）

2026-10-25。orderCancel 只允许已确认、尚未取货的 quoted 或 awaiting_dispatch 订单。请求必须带当前订单 If-Match、取消理由和已经 available 的本订单证据。

取消会新增不可改写的取消事实，把订单改为 cancelled，并将存在的承诺预留标为 CANCELLED 后释放。它不会删除报价、收款、核销或承诺历史；退款、费用调整和资金退回仍是独立财务流程，不能因取消被自动执行。

017 迁移在 PostgreSQL 中保护取消人身份、订单版本和证据关联，并把预留释放区分为 SUPERSEDED 与 CANCELLED。集成测试覆盖已核验证据、预留释放、重复取消拒绝和历史删除拒绝。
