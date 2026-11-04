# RF-PM-051 · `trial:init` 建角色改用 SCRAM 校验值，不向 PostgreSQL 发送明文口令

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | fix / 中（口令处理，试运营初始化脚本） |
| 版本 | v0.3.x（不阻塞 v0.3.1：已部署环境的角色已建好，只影响今后新建环境或重建） |
| 执行人 | 大旺＋Codex |
| 基线 SHA | 最新 `develop` |
| 分支 | `fix/RF-PM-051-init-scram-verifier`，PR 目标 `develop` |
| 依赖 | RF-PM-038-R4（已合并） |
| 需人类批准 | 是：涉及口令处理；合并前须负责人侧 Claude 审查通过，并由作者以外的人批准最终 head |
| 状态 | TODO |

## 背景

`trial:init` 用 `CREATE ROLE ... PASSWORD '<明文>'` 创建运行角色和备份角色。任何会记录语句文本的服务器日志设置（`log_statement`、`log_min_duration_statement`、语句审计扩展、`log_min_error_statement` 下的失败语句）都会把明文口令写进日志。RF-PM-038-R4 的审查和 RF-OPS-01 的"部署前准备清单"第 1 项为此要求部署前逐项核对日志设置，这只是防护，不是根治。

PostgreSQL 允许直接传入 SCRAM-SHA-256 校验值：服务器不会保存明文，日志里即使出现也不是可直接登录的口令。服务器的 `pg_hba` 示例本来就要求 `scram-sha-256`。

大旺在 RF-PM-044（#95）里顺手做了这项，负责人 2026-11-04 决定拆出来单独审查。

## 要做

1. **`trial:init`：** 创建运行角色、备份角色时，`PASSWORD` 传 `SCRAM-SHA-256$<迭代次数>:<盐>$<StoredKey>:<ServerKey>` 格式的校验值，不传明文。
   - 只用 `node:crypto`（PBKDF2-HMAC-SHA256、HMAC-SHA256、SHA-256），不新增依赖；
   - 迭代次数 4096（PostgreSQL 默认），盐 16 字节随机；
   - 写入 env 文件和备份 env 文件的连接串仍使用明文口令（客户端需要），文件权限不变（600）。
2. **不泄露：**
   - 校验值和明文口令都不写日志、不进错误信息、不进测试快照；
   - 模拟建角色失败，断言抛出的错误文本里既没有明文口令，也没有校验值。
3. **测试：**
   - 单元测试：用固定盐与固定口令得到固定校验值，格式正确；
   - 真实 PostgreSQL 集成测试：初始化后用生成的运行口令和备份口令真实登录（走 `scram-sha-256` 认证）成功；用错误口令失败；`pg_authid.rolpassword` 以 `SCRAM-SHA-256$` 开头且不等于明文（用超级用户只读查询，输出只写 PASS／FAIL，不打印值）；
   - 对 PostgreSQL 16 和 18 各验证一次（CI 用的版本与本机版本不同时，在 PR 里说明哪个没跑）。
4. **文档：** 更新 [RF-OPS-01](RF-OPS-01-vps-trial-server.md) "部署前准备清单"第 1 项和 [RF-PM-038-R4](RF-PM-038-R4-init-atomic.md) 的待验证说明：`trial:init` 不再向 PostgreSQL 发送明文口令，日志设置核对仍保留作为纵深防护（校验值在日志里仍属敏感信息）。

## 不做

- 不做口令轮换，不改口令长度和生成方式；
- 不改 `pg_hba` 规则，不改 `trial:renew`、`trial:restore` 的行为；
- 不改已部署环境里已建好的角色；
- `trial:init` 文件创建顺序（先写后登记）属于 RF-PM-044 的 R4 小建议，留在 #95，不在本卡。

## 验收

- 上述单元测试、真实 PostgreSQL 集成测试在 CI 通过；CI 五项全绿；
- PR 描述按 PASS／FAIL／NOT_RUN 逐项写，写明在哪个 PostgreSQL 版本上验证；
- 本卡合并前，#95 必须先把 SCRAM 相关改动移除（见 issue 派单），两个 PR 都改 `services/routefit/scripts/trial-init.mjs`，先合并 #95，本卡再同步 `develop`。

## 审查记录

（待填）
