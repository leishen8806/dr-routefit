# 调度候选 API（本机开发）

2026-10-25。dispatchCandidates 是只读的候选读取边界。目前服务没有持久化路线计划和 ETA，因此会验证订单授权后返回空候选页，绝不编造 Candidate.required 的 planVersion、eligible 或预计成本。

在路线计划、司机时段、实时车辆状态和候选成本事实实现后，此接口才可返回按稳定顺序分页的规则候选。空候选不表示没有车辆，而表示当前没有可验证的路线计划，不可据此自动创建 assignment。
