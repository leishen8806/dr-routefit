# RF-PM-038 · 受控试运营工具：身份续期、员工身份、主数据、备份与 VPS 登录辅助

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | chore / 高（涉及身份会话与真实业务数据） |
| 版本 | v0.3.0 |
| 执行人 | 大旺＋Codex |
| 基线 SHA | 最新 `develop` |
| 分支 | `chore/RF-PM-038-single-machine-trial-tooling`，PR 目标 `develop` |
| 依赖 | 无，可与 RF-PM-037 并行（本卡只改 `services/routefit/scripts/`、`services/routefit/db/` 和 `package.json` 的脚本项） |
| 需人类批准 | **是**：合并前须项目负责人本人批准；真实数据写入前须 RF-DEC-07 签批 |
| 状态 | TODO |

## 背景

受控试运营的运行方式（见 [P01 受控试运营方案](../../trial/p01-controlled-trial-plan.md) 第 2 节）：

- **2026-10-28 改为 VPS：** 一台 Linux VPS 上运行 PostgreSQL 和 RouteFit 服务，都只监听 `127.0.0.1`；
- 员工通过受限 SSH 隧道访问，在自己电脑的浏览器里打开 `http://127.0.0.1:4180`；
- 不对公网开放网页，也不改身份适配器。

服务器本身的准备与加固见 [RF-OPS-01](RF-OPS-01-vps-trial-server.md)。本卡只做仓库里的脚本，下面第 7–9 项是改为 VPS 后补充的要求。

服务端目前只接受本机请求，身份是开发会话（`adapters/development-auth.mjs`、`adapters/local-browser.mjs` 都注明“部署前须替换为经批准的 IdP/BFF”）。本卡不改这两个适配器，只补齐单机试运营缺的工具。

现状缺口（已在 `develop` `a8f3e63` 上核实）：

- `db/dev-bootstrap.mjs` 每次都新建一个合成数据库；`.local/` 已存在时拒绝运行。没有办法在保留数据的前提下续期身份。
- 会话 24 小时过期，过期后只能重新 bootstrap，也就是换一个新库。
- 身份名是 `DEMO Pricing review` 这类合成名，员工角色不能按试运营分工配置。
- 没有备份和恢复脚本。

## 要做

1. **续期身份，不换库。** 新增 `npm run trial:renew`：
   - 为 `.local/sessions.json` 中已有的身份重新生成 token 和 CSRF，`expiresAt` 设为当前时间加 18 小时，旧 token 立即失效；
   - 不连接管理员账号，不建库，不改数据库内容；
   - `NODE_ENV=production` 时拒绝运行；
   - 输出提示：续期后须重启服务，再逐人用 `npm run session:link <序号>` 取一次性链接。
2. **按试运营分工建员工身份。** 新增 `npm run trial:staff`：
   - 读取 `.local/trial-staff.json`（不进仓库，`.gitignore` 已覆盖 `.local/`），为每人建 `org.principal`（kind `STAFF`），写入 `sessions.json`；
   - 权限按角色给，至少四个角色：
     - 录单报价：`orders:*`、`areas:read`、`quotes:read`、`quotes:create`、`quotes:confirm`、`pricing:read`；
     - 策略编制：`pricing:read`、`pricing:write`；
     - 策略复核：`pricing:read`、`pricing:review`；
     - 策略发布：`pricing:read`、`pricing:publish`；
   - 同一人不能同时持有编制、复核、发布中的两项，脚本检查并拒绝；
   - 提交一份 `trial-staff.example.json`，只用合成姓名。
3. **主数据核实与导入。** 逐项核实录单所需主数据能否从现有页面或接口建立：企业、客户、取货点、服务区域、费率草稿。在 PR 描述中逐项写“页面可建／接口可建／都不能”。
   - 都不能建的，提供 `npm run trial:import`，从 `.local/` 下的 CSV 导入；
   - 导入前校验，校验失败整批不写；
   - 示例 CSV 只用合成数据。
4. **建试运营库。** 新增 `npm run trial:init`：
   - 建一个名为 `routefit_trial` 的库并执行全部迁移；
   - 不灌合成订单和合成客户；
   - 库已存在时拒绝运行，不覆盖；
   - 生成 `.local/dev.env`，之后的续期、员工身份都对这个库操作。
5. **备份与恢复。** 新增 `npm run trial:backup` 和 `npm run trial:restore`：
   - backup：用 `pg_dump -Fc` 写入 `ROUTEFIT_BACKUP_DIRECTORY`，文件名带时间戳；目录在仓库内时拒绝运行；保留最近 14 份；
   - restore：只能恢复到一个**新**库名，不覆盖 `routefit_trial`；
   - PR 中附一次实际演练（合成库）：备份 → 恢复到新库 → 行数一致。
6. **一键启动检查。** 新增 `npm run trial:start`，依次：
   1. 检查 PostgreSQL 可连接；
   2. 检查会话剩余时间，不足 2 小时时提示先续期；
   3. 检查当天是否已备份，没有就先备份；
   4. 启动服务。

   Linux（VPS，以 Ubuntu 24.04 为准）、Windows、macOS 都要能跑：路径不写死，`pg_dump` 的位置用 `ROUTEFIT_PG_BIN` 指定。

### 补充：改为 VPS 后（2026-10-28）

7. **systemd 服务。** 提交一份 `routefit.service` 模板：
   - 以专用的无登录用户 `routefit` 运行，`Restart=on-failure`；
   - 环境变量从 `/etc/routefit/routefit.env`（权限 600）读取，这个文件不进仓库；
   - 服务仍只监听 `127.0.0.1`。

   改为 systemd 后，`trial:start` 第 4 步改为“检查 `systemctl is-active routefit`”，不再在前台启动服务。
8. **员工 SSH 登录辅助。** 新增一个供 SSH `ForceCommand` 调用的脚本（例如 `scripts/trial-ssh-link.mjs`）：
   - 用 SSH 登录名查 `.local/trial-staff.json`，找到对应的身份序号，打印该员工的一次性登录链接；然后保持连接，直到员工关闭窗口，这样隧道一直可用；
   - 不读取 `SSH_ORIGINAL_COMMAND`，员工不能指定别人的序号；登录名查不到时拒绝并退出；
   - 通过 sudoers 只允许以 `routefit` 身份运行这一个脚本。PR 中附 sudoers 片段和 `sshd_config` 的 `Match Group` 片段，只作为模板，由 RF-OPS-01 部署。
   - 补单元测试：已知登录名、未知登录名、企图传入序号三种情况。
9. **员工端快捷方式。** 提交一份 Windows 快捷方式示例（`.bat` 或 `.ps1`），内容是 `ssh -L 4180:127.0.0.1:4180 <员工账号>@<VPS 地址>`，VPS 地址用占位符；再附一页给员工看的中文使用说明，放在 `ops/trial/` 下：
   - 怎么双击启动；
   - 链接 60 秒内打开；
   - 不要关窗口；
   - 本机 4180 端口被占用时怎么办。

## 不做

- 不改 `development-auth.mjs`、`local-browser.mjs` 的本机限制、Origin 校验和权限模型；不开放 `127.0.0.1` 以外的访问。
- 不接生产身份；不配置域名和 HTTPS。
- 不登录、不操作 VPS：服务器上的一切操作属 RF-OPS-01，由项目负责人执行。
- 仓库中不出现 VPS 的真实地址。
- 不提交任何真实姓名、电话、地址或 `.local/` 文件。

## 验收

- 第 1–9 项各有脚本或模板；第 1–6 项和第 8 项有单元测试，CI 三项通过；测试用合成数据。
- PR 附一次完整演练记录（合成数据）：
  - `trial:init` → `trial:staff`（4 人）→ 各角色取链接登录 → 录单 → `trial:renew` 后旧 token 失效、新 token 可用 → `trial:backup` → `trial:restore` 到新库。
- 第 2 项：同一人兼任编制与复核时，脚本拒绝。
- PR 描述按第 1–6 项逐项写 PASS／FAIL／NOT_RUN，并写“发现但未处理”。

## 交付证据

提交信息以 `RF-PM-038` 开头。本卡标注“需人类批准”：Codex 只做到 PR，不自行合并；看板 APPROVED 后由项目负责人批准合并。

## 审查记录

（Claude 填写）
