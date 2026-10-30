# RF-PM-038-R5 · 试运营部署链路三个缺口

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | fix / 高（部署关键路径） |
| 基线 SHA | `origin/develop` at claim |
| 分支 / PR | `fix/RF-PM-038-R5-deploy-gaps` / draft |
| 依赖 | RF-PM-038-R4 |
| 状态 | IN_REVIEW |

## 范围

- systemd 显式设置 `ROUTEFIT_EVIDENCE_DIRECTORY=/var/lib/routefit/evidence`；启动时创建并收紧为 0700。
- `ROUTEFIT_TRIAL=1` 下证据目录不可写时以非零状态退出，并只报告变量名与路径。
- 运维手册与 RF-OPS-01 第 8 步补齐 Node 24、`--env-file`、脚本路径、环境变量及 root-only 文件说明，覆盖全部 `trial:*` 脚本。
- 不改 npm 脚本、本地开发用法或 pg_hba/授权逻辑。

## 验收证据

- 证据目录单元测试：PASS（目录 0700；不可写时含 `ROUTEFIT_EVIDENCE_DIRECTORY` 与路径）。
- CI 五项：待 PR 运行。
- Linux systemd 限制启动：NOT_RUN（当前环境无 VPS/systemd；负责人按 RF-OPS-01 复核）。

## 审查记录

待 Claude 审查最终 head；按要求保持 Draft，不合并。
