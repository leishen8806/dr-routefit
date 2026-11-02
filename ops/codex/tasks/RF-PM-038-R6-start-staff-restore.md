# RF-PM-038-R6 · 试运营启动、员工校验与恢复失败清理

状态：IN_PROGRESS（Codex，2026-10-31）

基于 RF-PM-038-R5 合并后的 `develop`。仅处理三处安全边界：试运营模式启动前必须有合格备份、员工角色输入必须严格校验、恢复失败只清理由本次创建的数据库。不得改动权限模型、命令表或 R4/R5 逻辑。

交付要求：

- `trial:start` 在 `ROUTEFIT_TRIAL=1` 时要求备份目录，合格备份须为匹配文件名的非空 dump、存在同名 `.sha256` 且校验通过；无合格备份时补做失败必须非零退出并包含“今日没有可用备份”。非试运营模式保留原行为。
- `validateStaffAssignments` 拒绝未知角色及空/非数组 `roles`，且在任何写库前整批失败。
- `trial:restore` 的 `pg_restore` 失败（含 ENOENT）时终止连接并删除本次新建库；预先存在的库不删除，清理失败保留“仍有残留”证据。
- 补充单元测试；真实 PostgreSQL 集成测试若未提供 `ROUTEFIT_TEST_DATABASE_URL` 标记 NOT_RUN，不伪造 PASS。

分支：`fix/RF-PM-038-R6-start-staff-restore`；PR 目标 `develop`，保持 Draft。
