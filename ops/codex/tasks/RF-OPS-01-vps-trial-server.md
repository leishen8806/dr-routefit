# RF-OPS-01 · 试运营 VPS 准备与加固：只允许 SSH 访问

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | ops / 高（服务器、访问控制、真实数据存放） |
| 版本 | v0.3.0 试运营 |
| 执行人 | 项目负责人（苏晨）＋苏晨的 Codex |
| 服务器 | 负责人提供的 Linux VPS。**真实地址不写进本仓库**，文中用 `<VPS>` 代替 |
| 依赖 | 第 1–6 步无依赖；第 7 步依赖 RF-PM-038 合并；第 8 步依赖 v0.3.0 打标签 |
| 需人类批准 | **是**：每一步改动服务器前，由项目负责人在场确认 |
| 状态 | TODO |

## 背景

2026-10-28 项目负责人决定：受控试运营放在 VPS 上，只能通过 SSH 登录操作（见 [P01 受控试运营方案](../../trial/p01-controlled-trial-plan.md) 第 2 节）。

服务端只监听 `127.0.0.1`，数据库也必须在本机（`services/routefit/main.mjs`）。员工通过受限 SSH 隧道访问，网页端口和数据库都不对外开放。

## 要做

### 第 1 步：盘点现状，先做快照（只读）

- 记录系统版本、内核、磁盘、内存、已有用户、`sshd -T` 的关键项、`ss -tlnp` 的监听端口、防火墙状态。
- **改动之前**，先在服务商控制台做一次快照。
- 确认服务商的网页控制台（不经 SSH 的应急登录）可用。如果第 3 步把自己锁在门外，就靠它恢复。

### 第 2 步：管理员账户

- 新建管理员用户（例如 `rfadmin`），加入 sudo 组，配置负责人的公钥。
- **另开一个新的 SSH 会话**，确认 `rfadmin` 能用密钥登录并执行 `sudo`。确认之前，不关闭原来的会话。

### 第 3 步：SSH 加固

在 `/etc/ssh/sshd_config.d/` 下新建一个配置文件，内容包括：

- 关闭登录方式：
  - `PasswordAuthentication no`、`KbdInteractiveAuthentication no`；
  - `PermitRootLogin no`；
  - `PubkeyAuthentication yes`。
- 限制连接：
  - `AllowGroups rf-admin rf-tunnel`；
  - `MaxAuthTries 3`、`LoginGraceTime 30`。
- 关闭转发：
  - `X11Forwarding no`、`AllowAgentForwarding no`；
  - 全局 `AllowTcpForwarding no`。
- `Match Group rf-tunnel` 段落：
  - `AllowTcpForwarding local`、`PermitOpen 127.0.0.1:4180`；
  - `PermitTTY no`；
  - `ForceCommand`：指向 RF-PM-038 第 8 项的登录辅助脚本。RF-PM-038 合并前，先指向 `/usr/bin/false` 占位。
- 管理员 `rfadmin` 加入 `rf-admin` 组。

改完先 `sshd -t` 检查语法，再重载 sshd。**仍在新会话中**确认管理员能登录，然后才关闭旧会话。

### 第 4 步：防火墙与基础安全

- 服务器防火墙 `ufw`：默认拒绝入站，只放行 `22/tcp`（用 `ufw limit` 限速）。
- 服务商控制台的云防火墙同样只放行 22 端口，两层都要配。
- 安装 `fail2ban`（sshd 规则）和 `unattended-upgrades`（自动安装安全更新）。
- 时区设为 `Asia/Phnom_Penh`，开启 NTP 时间同步。

### 第 5 步：运行环境

- 安装 PostgreSQL 16：用官方 PGDG 源。`listen_addresses = 'localhost'`；`pg_hba.conf` 只允许本机连接。
- 安装 Node 24 LTS 和 git。
- 新建无登录 shell 的用户 `routefit`，代码放在 `/srv/routefit`，配置放在 `/etc/routefit/`（权限 700，归 `routefit`）。

### 第 6 步：外部核验（用负责人自己的电脑，从外网做）

- 端口扫描：只有 22 开放；4180、5432 都不可达。
- `ssh root@<VPS>` 被拒；用密码登录被拒。
- 用一个临时的 `rf-tunnel` 测试账号检验受限效果：
  - 不能进入命令行；
  - 转发到 `127.0.0.1:5432` 被拒；
  - 只能转发 `127.0.0.1:4180`。
- 结果写进核验记录，测试账号用完删除。

### 第 7 步：试运营工具与合成数据试跑（RF-PM-038 合并后）

- 部署 RF-PM-038 的 systemd 服务模板、sudoers 片段、`Match Group` 中的 `ForceCommand`。
- 用 `develop` 当前版本加合成数据，完整走一遍：
  - `trial:init`、`trial:staff`（合成姓名）；
  - 员工账号连隧道，拿到链接，登录页面；
  - 录一张单；
  - `trial:renew` 后旧会话失效；
  - `trial:backup`；
  - 把备份拉到站外；
  - `trial:restore` 到新库，核对行数。
- 试跑完删除合成库和测试账号。

### 第 8 步：正式部署（v0.3.0 打标签后，11-01）

- `/srv/routefit` 检出 `v0.3.0` 标签。
- `trial:init` 建 `routefit_trial` 库，用真实员工名单执行 `trial:staff`。员工名单只存在服务器上，不进仓库。
- 为每位员工建 `rf-tunnel` 组账号，配置其公钥。员工的私钥由员工自己生成，不经过任何人转交。
- 做一次备份和恢复演练。

## 不做

- 不开放 22 以外的任何端口，不配置域名、HTTPS、反向代理。
- 不改服务端代码，包括本机限制与开发身份。
- 不把 VPS 地址、密钥、口令、员工名单写进仓库、截图或聊天记录。
- RF-DEC-07 签批前，VPS 上只放合成数据。

## 验收

- 第 1–6 步：核验记录列出每项检查的命令和结果（PASS／FAIL）。只写主机代号，不写地址。
- 第 7 步：合成数据试跑记录，每个环节写 PASS／FAIL。
- 第 8 步：正式部署记录，包括标签 SHA、恢复演练的行数对比，以及每位员工的首次连通情况（只写角色，不写姓名）。

记录存放在负责人的私有位置，不进仓库。在本卡“审查记录”里只写结论和日期。Claude 根据负责人贴回的记录做技术复核。

## 审查记录

（Claude 填写）
