# RF-PM-000 · 推送 Claude 准备的两个分支并开 PR

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | chore / 低（只推送独立分支、开 PR，不合并 main） |
| 工作区 | `/Users/suchen/Documents/ChatGPT/Dr RouteFit/dr-routefit` |
| 优先级 | 最先做；RF-PM-002 依赖它 |
| 状态 | TODO |

## 背景

Claude 的会话暂时没有 GitHub 写权限（leishen8806 尚未安装 Claude GitHub App；Claude 在本机能用的命令行也连不上 GitHub），以下两个本地分支只能由 Codex 用本机 GitHub 登录推送：

| 分支 | 预期提交 | 基线 | 内容 |
| --- | --- | --- | --- |
| `docs/codex-task-board` | 以本地最新提交为准，至少含 `deed28d` | main `2ac993e` | 新增 `ops/codex/` 任务看板、任务卡与补丁 |
| `fix/customer-request-validation` | `e2c8c41` | main `2ac993e` | 客户下单表单字段级校验与反馈修复 |

## 要做

1. `git fetch origin`，确认 `origin/main` 仍是 `2ac993ec20adb24feeb6b5035fb15a69990b608c`；若已前进，先在报告中写明新 SHA，再 `git rebase origin/main` 两个分支（有冲突则停下，在报告里列出，不自行解决业务冲突）。
2. 核对每个分支只比 main 多出上表的提交：`git log --oneline origin/main..<分支>`。
3. `git push -u origin docs/codex-task-board fix/customer-request-validation`。
4. 各开一个 PR 到 `main`，**不合并**：
   - `docs/codex-task-board`：标题 `docs: Claude→Codex 任务看板与第一批任务卡`
   - `fix/customer-request-validation`：标题 `RF-PM-002: 客户下单表单字段级校验与反馈`；描述附上 `node --test prototype/*.test.mjs` 结果（应 65/65）。
5. 推送后核对远端 SHA：`git ls-remote origin docs/codex-task-board fix/customer-request-validation`，应与本地一致。

## 不做

不强推、不推 main、不合并 PR、不改两个分支的内容（rebase 除外）。

## 交付证据

`claude-bridge/outbox/RF-PM-000-report.md`：两个分支的本地 SHA、远端 SHA、PR 链接、测试输出、是否 rebase。

## 审查记录

（Claude 填写）
