# RF-PM-038-R3 · 试运营数据库访问边界收口

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | fix / 高（数据库访问边界） |
| 版本 | v0.3.0 |
| 执行人 | 大旺＋Codex |
| 基线 SHA | 最新 `develop`（含 #68） |
| 分支 | `fix/RF-PM-038-R3-db-access-scope`，PR 目标 `develop` |
| 依赖 | RF-PM-038-R2（#68，已合并） |
| 需人类批准 | **是**：合并前须 Claude 审查通过和项目负责人批准；**11-01 部署（RF-OPS-01 第 8 步）前合并** |
| 状态 | TODO |

## 背景

#68 合并时已经完成了这些事：
- 备份角色改为只在试运营库内授权，不再授予 `pg_read_all_data`；
- 新增 `trial:backup-grants`，可以重复执行；
- 新增备份角色的 `pg_hba` 示例。

这三项是在 Claude 复审批准（`c8272a9`）之后才推送的（`f823e68`、`e013ea2`），合并前没有重新审查。2026-10-29 已事后补审，结论是方向正确，但还有缺口，就是本卡下面列出的事项。

2026-10-29 对 VPS 做了只读核查：当前 PostgreSQL 实例里只有系统库。连接层的限制是为了保证：即使以后这个实例里放进了其他库，RouteFit 的角色也读不到。

## 要做

1. **运行角色也要在连接层限死。** `ops/trial/pg_hba-backup.example` 改名为 `pg_hba-routefit.example`，同时覆盖运行角色和备份角色，规则如下：
   - `local all <角色> reject`；
   - 只允许从 `127.0.0.1/32` 和 `::1/128` 以 `scram-sha-256` 连接 `routefit_trial`；
   - 连接其他库（包括 `postgres`）一律 `reject`。

   文件开头写明：这些行必须放在任何泛化的 `local` 或 `host` 允许规则之前，因为 `pg_hba` 按第一条匹配的规则生效。
2. **角色名要能拿到。** `trial:init` 结束时，同时输出运行角色名和备份角色名（不输出口令），用于替换模板里的 `<RUNTIME_ROLE>`、`<BACKUP_ROLE>`。角色名保留随机后缀，不改成固定名。
3. **授权范围的测试要能证明问题。** 现在的测试先对其他库执行了 `REVOKE CONNECT … FROM PUBLIC`，再断言连不上，这只证明了数据库本身的 CONNECT 机制，证明不了备份角色的授权只在试运营库内。请改为：
   - 不撤销 CONNECT，让备份角色连上其他库，断言 `SELECT` 其中的表报权限不足；
   - 运行角色做同样的断言；
   - 模板测试改为同时检查两个角色的规则，以及每个角色“允许”在前、“拒绝”在后的顺序。
4. **`trial:import` 收口：**
   - 不再要求 `service-areas.csv`；
   - 试运营模式（`ROUTEFIT_TRIAL=1`）下必须显式提供 `ROUTEFIT_TRIAL_SERVICE_AREAS_FILE`，不能默认去读导入目录里的示例文件。
5. **`trial:staff` 的企业来源和 `trial:import` 保持一致**：使用 `ROUTEFIT_TRIAL_COMPANY_ID` 或企业配置文件里的 `id`，不再取“第一个有效企业”。
6. **RF-OPS-01 第 8 步补充部署和核验步骤：**
   - 插入 `pg_hba` 规则后重新加载配置；
   - 运行角色、备份角色连接 `postgres` 都被拒绝；
   - 两者连接 `routefit_trial` 正常；
   - 每次迁移后执行 `trial:backup-grants`，再执行备份。

## 不做

- 管理角色改用 `peer` 加 `pg_ident` 映射。管理连接串只放在 root 可读的文件里，这个边界已经够用。
- 把角色改成固定名。
- 改动现有的 `pg_hba` 规则或其他业务的配置。模板只新增 RouteFit 角色的规则。

## 验收

- CI 五项全部通过；
- 第 3 项的测试在 CI 的真实 PostgreSQL 上通过；
- PR 描述按 PASS/FAIL/NOT_RUN 逐项写明第 1–6 项；
- 部署后的连接核验由项目负责人的 Codex 在 RF-OPS-01 第 8 步执行，结果写进该卡的审查记录。

## 审查记录
