# RF-PM-008 · 诊断交付（修复与既有PR#11重叠，尚未重复实现）

基线main `48a7f61a456da2840cfb5e90fae39498f1c23e41`，2026-10-26 Asia/Phnom_Penh，Node24.22.1、PG16.15一次性本机合成库。

## 三个子案例根因

1. orders.integration.mjs:59/:69，客户提交返回422 `INTAKE_BLOCKED`，fields仅剩`DELIVERY_WINDOW_EXPIRED`。静态样例contracts/examples/order-draft.json:33–40的送达结束是2026-10-26T05:00Z；测试直接使用静态时间，当执行时已过去。domain/intake.mjs:38按真实当前时间拒绝过期，符合需求，不应放松校验；应把测试fixture时间相对当前时间生成。依据：PRD-V1.4-review §3/§7/§11.1的时效、时间窗、最晚安全派发；domain订单时间窗约束不等于允许过期受理。属于测试过时，不是业务校验错误。
2. quotes.integration.mjs:246（名为manual promise，实际失败在随后司机读取订单），GET /api/driver/v1/orders/{id} 返回404 `NOT_FOUND`。adapters/driver.mjs先确认本人offered/accepted指派，再经adapters/orders.mjs:36–38 getOrder读取orders.draft；051:98–107重建RESTRICTIVE customer_scope时去掉025/027中司机USING/WITH CHECK分支，司机无customer_access/service_binding，RLS把真实存在的本人订单隐藏，getOrder返回404。属于实现/RLS回归，不应把200断言改成404。
3. quotes.integration.mjs:253/:267，两个并发accept均返回404 `NOT_FOUND`；其前一条PLAN_VERSION_STALE=409是预期反例，不能当根因。accept调用getOrder同样被051的RLS读取范围阻断。必须保留offered/accepted本人任务可读、accepted才可写的边界，不允许offered写订单。依据：PRD-V1.4-review §6.2/§7/§11.1.1，development-standards §6.1（:228合作司机只访问本人任务）、025/027历史策略意图；AT-14跨企业和对象范围不应放宽。

## 复现与范围

诊断时仅在本地临时向测试请求helper添加响应体日志，随后全部恢复；没有保留测试/业务/迁移修改。PASS 单测101/101、原型187/187；FAIL 集成66 tests、61pass、5fail、0skip（3子案例+2父测试）。日志在本机claude-bridge/outbox/RF-PM-008-evidence/；未使用Mock代替数据库。

已有在审PR https://github.com/leishen8806/dr-routefit/pull/11 ，head `18e6dae5983529e6d1a4f96dd14657fe998ea2ae`，覆盖同一fixture时间、051司机RLS及delivery读写问题，并声称66/66；该声明本轮尚未独立复验。为避免与正在进行的后端工作重复，不复制/cherry-pick其业务修复，不另造相同修复。**本PR仅交付诊断；第2步修复尚未完成，需要负责人协调采用PR#11或按本卡继续实现。**

重要差异：本卡禁止改001–063，若由本卡继续修复RLS，须新增前向迁移并由人类负责人批准合并；PR#11直接改051等既有迁移，不符合本卡边界，不能自动当本卡已验收。不要把只读诊断PR合并视为业务修复通过。

## 发现但未处理

- 修复RLS后可能露出delivery的只读事务FOR UPDATE、完成指派后丢失司机RLS可见性等后续问题，PR#11已有相应改动，需要独立复验，不提前声称已解决。
- 最新main CI run40275720748 attempt2中另有并发建全局role的`pg_authid_rolname_index`重复键错误，两文件初始化失败；该次55tests/50pass/5fail，与本机66/61/5不同，不混用。属于并发初始化，另卡处理，禁止静默串行掩盖。
- NOT_RUN：共享/生产库迁移、真实身份/地图/银行/KESS、后端修复和修复后CI（等待重叠工作协调）。没有合并或部署。
