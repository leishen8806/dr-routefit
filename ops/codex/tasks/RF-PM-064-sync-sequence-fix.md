# RF-PM-064 · 修复司机补传接口：首条事件被拒后设备序号未落库，导致下一次补传 23505 → 25P02

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | fix / 高（同步事务、只追加表、数据修正迁移） |
| 版本 | v0.7（司机 App 与地图） |
| 执行人 | 苏晨＋Codex |
| 基线 SHA | 最新 `develop` |
| 分支 | `fix/RF-PM-064-sync-sequence`，PR 目标 `develop` |
| 依赖 | 无；完成后 RF-PM-059（PR #134）同步 develop 复测离线链路 |
| 需人类批准 | 是：合并前须负责人侧 Claude 审查，并由作者以外的人批准最终 head |
| 状态 | IN_PROGRESS |

## 背景（PR #134 的只读诊断，2026-11-09）

- 首条数据库错误是 `23505`，约束 `sync_event_company_id_device_id_sequence_key`，发生在写入 `mobile.sync_event`；之后事务处于失败状态，记录 HTTP 结果时报 `25P02`。
- App 发出的 `assignmentVersion`、`planVersion` 与服务端一致。

## 根因（审查方读代码确认，开工后先用测试复现）

`services/routefit/adapters/driver.mjs` 的 `writeDriverSync`：

1. 设备第一次补传时，`INSERT INTO mobile.sync_device_state ... last_sequence 0` 写在 `SAVEPOINT driver_sync_event` **里面**。
2. 如果这条事件在序号检查之后被业务拒收（例如版本过期、证据不符），会 `ROLLBACK TO SAVEPOINT`，**连同刚插入的设备状态行一起回滚**。
3. 随后 `storeSyncResult` 仍把这条“被拒但顺序正确”的事件写进 `mobile.sync_event`（序号 1），但 `UPDATE mobile.sync_device_state` 因为行不存在，更新了 0 行，`last_sequence` 实际仍是“无记录 = 0”。
4. 下一次补传序号 1 的新事件：序号检查认为它“正好是下一个”，处理后写 `sync_event` 时与已有的序号 1 冲突 → `23505`；`storeSyncResult` 不在保存点里，事务被污染 → 之后任何语句报 `25P02`。

## 要做

1. **先写失败测试**（真实 PostgreSQL 集成测试），复现上述顺序：新设备 → 第一条事件顺序正确但被业务拒收 → 断言 `sync_event` 有 1 行且 `sync_device_state.last_sequence = 1`（修复前应失败）→ 第二条事件序号 2 返回 `APPLIED` → 原样重发第一条返回 `DUPLICATE`。
2. **修复**：
   - 设备状态行在保存点**之外**确保存在（先 `INSERT ... ON CONFLICT DO NOTHING`，再 `SELECT ... FOR UPDATE`），不随单条事件回滚；
   - `storeSyncResult` 的 `UPDATE` 必须恰好更新 1 行，否则抛出明确错误；
   - `storeSyncResult` 放进自己的保存点；写入时若遇到唯一约束冲突，回滚到该保存点，按“同事件重复（返回 DUPLICATE）／不同事件占用同序号（返回 REJECTED，错误码 `SYNC_SEQUENCE_CONFLICT`）”处理，**事务保持可用**，后续事件和 HTTP 结果记录正常；
   - 不改变现有对外语义：顺序正确的拒收事件仍落库并推进序号；乱序和未授权事件仍不落库。
3. **数据修正迁移**（新编号，幂等，可重复执行）：对每台设备，`sync_device_state.last_sequence` 至少等于该设备 `sync_event` 的最大序号；缺行的补行。不删除、不改写 `sync_event`（只追加表）。迁移前后各输出受影响设备数（不输出设备 ID）。
4. **契约与文档**：`contracts/driver-api.md` 补 `SYNC_SEQUENCE_CONFLICT` 的含义；`openapi.json` 若有错误码枚举同步补上。
5. **回归**：现有补传相关集成测试全部保留并通过；新增测试覆盖第 1 条全部断言，外加“同一请求里第一条被拒、第二条成功”的批量情况。

## 不做

- 不改司机 App；不改其他接口；不改只追加触发器；
- 不在试运营服务器上执行迁移（发版时随版本走，由董事会批准）。

## 验收

- 修复前新测试失败、修复后通过（PR 描述写清这一点）；CI 八项全绿；
- 用 `npm run scenario:driver -- --stage custody-pending` 造数据，本机以接口方式（不必开模拟器）复现诊断场景：首条拒收 → 新事件补传返回 `APPLIED`，服务端日志无 23505／25P02；
- PR 描述逐项写 PASS／FAIL／NOT_RUN。

## 审查记录

（待填）
