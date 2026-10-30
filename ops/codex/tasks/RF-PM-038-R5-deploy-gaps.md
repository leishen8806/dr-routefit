# RF-PM-038-R5 · 试运营部署链路三个缺口

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | fix / 高（部署关键路径） |
| 基线 SHA | `origin/develop` at claim |
| 分支 / PR | `fix/RF-PM-038-R5-deploy-gaps` / #76 |
| 依赖 | RF-PM-038-R4（#74） |
| 状态 | 已合并（PR #76 → `fc7121e`，2026-10-30 13:34）；10-30 VPS 从干净状态验证 PASS |

## 范围

- systemd 显式设置 `ROUTEFIT_EVIDENCE_DIRECTORY=/var/lib/routefit/evidence`；启动时创建并收紧为 0700。
- `ROUTEFIT_TRIAL=1` 下证据目录不可写时以非零状态退出，并只报告变量名与路径。
- 运维手册与 RF-OPS-01 第 8 步补齐 Node 24、`--env-file`、脚本路径、环境变量及 root-only 文件说明，覆盖全部 `trial:*` 脚本。
- 不改 npm 脚本、本地开发用法或 pg_hba/授权逻辑。

## 验收证据

- 证据目录单元测试：PASS（目录 0700；不可写时含 `ROUTEFIT_EVIDENCE_DIRECTORY` 与路径）。
- CI 五项：SUCCESS。
- Linux systemd 限制启动：PR 时 NOT_RUN；2026-10-30 负责人在 VPS 上按命令表从干净状态验证 PASS（见 RF-OPS-01 审查记录）。

## 审查记录

### 2026-10-30 · claude-bridge 审查

`c457df2`、`be3b0f0`、`500610c` 三轮 CHANGES_REQUESTED（命令表与 R4 预检矛盾、变量来源、`<RUN_ENV>` 缺后续脚本所需变量、`<ADMIN_ENV>` 须含 7 个变量的说明），12:55 在 `6c0527f` APPROVED（13:00 发到 PR 评论区）。

### 2026-10-30 13:25 · 负责人侧 Claude 审查：APPROVED（`6c0527f`）

- 证据目录：service 显式设置并在启动时收紧为 700，写探针确认可写；试运营模式不可写时报出变量名与路径并非 0 退出，有测试。
- 服务器命令表：Node 24 完整路径加 `--env-file` 直接调用 `scripts/*.mjs`，不改 npm 脚本本地用法。
- `trial:init` 把非秘密路径和参数写进新生成的 `<RUN_ENV>`，不复制连接串，有单元测试。
- 待验证：命令表需在 VPS 上从干净状态逐字执行 `init → start`，确认无需手工补配置。
- 建议（不阻断，并入 RF-PM-044）：`buildTrialEnv` 拒绝含换行的值；`ROUTEFIT_TRIAL_AREA_REASON` 避免引号和 `#`。

合并：13:34 由 leishen8806 合并，合并 head 即批准的 `6c0527f`，合并内容与重新合并一致，develop CI 通过。
