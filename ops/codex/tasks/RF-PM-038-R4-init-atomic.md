# RF-PM-038-R4-init-atomic · trial:init 原子化输出与回滚

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | fix / 高（数据库角色与试运营初始化） |
| 基线 SHA | `develop`（RF-PM-038-R4 分支） |
| 分支 / PR | `fix/RF-PM-038-R4-trial-init-rollback` / #74 |
| 依赖 | RF-PM-038-R4 |
| 状态 | IN_REVIEW |

## 范围

- `trial:init` 在数据库操作前预检三个输出文件均不存在，且父目录已存在并可写。
- 初始化失败时先断开并删除试运营库，再删除运行/备份角色；清理失败必须以“仍有残留：...”报告。
- 只删除本次运行写出的文件；企业配置回写 id 后设为 600，失败恢复原内容和权限。
- 在 CI 真实 PostgreSQL 覆盖预检失败、末步写文件失败、文件与角色/数据库清理、企业配置权限与恢复。

## 验收证据

- PR #74 CI 五项全部 SUCCESS。
- 本机 PostgreSQL 新增回滚/预检测试通过；Windows/macOS 本机 `npm test` 按环境可用性在 PR 描述标注 PASS 或 NOT_RUN。
