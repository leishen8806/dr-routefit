# RF-OPS-01 · 试运营 VPS 准备与加固：只允许 SSH 访问

试运营主数据导入时，负责人提供审核过的真实服务区域文件，只放在服务器；仓库中的 `service-areas.example.geojson` 仅为合成示例。导入由 `trial:init` 创建的专用系统主体执行，发布依据必须通过 `ROUTEFIT_TRIAL_AREA_REASON` 外部传入。

备份角色不授予集群级 `pg_read_all_data`；`trial:init` 在 `routefit_trial` 库内授予 schema/table/sequence 读取权限并设置迁移后的默认权限。部署 RF-OPS-01 时按 `ops/trial/pg_hba-routefit.example` 配置：运行角色和备份角色仅允许从 loopback 连接 `routefit_trial`，其他数据库在 reject 规则中拒绝。
每次迁移完成后，管理员从 root-only env 文件重复执行 `npm run trial:backup-grants`，再执行备份；该命令可幂等重跑。

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | ops / 高（服务器、访问控制、真实数据存放） |
| 版本 | v0.3.0 试运营 |
| 执行人 | 项目负责人（苏晨）＋苏晨的 Codex |
| 服务器 | 负责人提供的 Linux VPS。**真实地址不写进本仓库**，文中用 `<VPS>` 代替 |
| 依赖 | 第 1–6 步无依赖；第 7 步依赖 RF-PM-038 合并；第 8 步依赖 v0.3.0 打标签 |
| 需人类批准 | **是**：每一步改动服务器前，由项目负责人在场确认 |
| 状态 | 第 1–7 步通过（第 7 步 2026-10-30 R5 从干净状态验证 PASS）；第 8 步待 11-01 正式部署 |

## 背景

2026-10-28 项目负责人决定：受控试运营放在 VPS 上，只能通过 SSH 登录操作（见 [P01 受控试运营方案](../../trial/p01-controlled-trial-plan.md) 第 2 节）。

服务端只监听 `127.0.0.1`，数据库也必须在本机（`services/routefit/main.mjs`）。员工通过受限 SSH 隧道访问，网页端口和数据库都不对外开放。

## 现状与取舍（2026-10-28 盘点）

这台 VPS 不是空机器：

- 系统是 Ubuntu 24.04.5，2 核、3.8 GiB 内存；
- 上面已有 Docker 和与 RouteFit 无关的其他服务；
- ufw 放行了 80、443，以及一条限定来源的 8080 规则；但 8080 由 Docker 绑定在公网地址上，可能绕过了这条限制；
- root 可以用公钥登录；时区是 UTC。

“只允许 SSH”和这些既有服务有冲突，由项目负责人选择：

- **A 另开一台空 VPS 专给试运营**（建议）：真实客户资料不和其他服务共用一台机器，原有服务完全不受影响；
- **B 继续用这台**：保留既有服务的端口。这时“只开放 SSH”改为“RouteFit 相关只开放 SSH”，并逐个核实既有端口确实受控。

**2026-10-28 负责人决定选 B。** 据此，本卡以下要求随之调整：

- 既有服务的端口（80、443、8080）、Docker、ufw 原有规则保持现状，不删除、不停用；
- 时区保持 UTC，不修改。RouteFit 的业务时间由应用按 `Asia/Phnom_Penh` 处理；
- RouteFit 新增的部分只有 `<SSH端口>`。4180 和 PostgreSQL 都只监听 `127.0.0.1`，不新增任何对外端口；
- 外部核验时逐个测试既有端口，特别是 8080 是否真的只对指定来源开放。结果报给负责人，Codex 不自行修正；
- RouteFit 的文件（`/srv/routefit`、`/etc/routefit`、数据库、备份）只有 `routefit` 用户和管理员能读，其他服务的账户读不到；
- 这台机器上有其他服务，须在 RF-DEC-07 签批时写明，作为风险由负责人确认。

**2026-10-28 补充决定（root 与 22 端口）：** 盘点发现，root 在 30 天内有约 277 次公钥登录，既有服务的自动化部署依赖 root 经 22 端口登录。所以：

- 暂不禁止 root 登录，改为 `PermitRootLogin prohibit-password`；
- 22 端口保留，并用 `Match LocalPort` 限定为只允许 root；
- RouteFit 的人员只走 `<SSH端口>`。

**后续事项（不在本次试运营范围内）：** 既有自动化迁到 `<SSH端口>` 或改用非 root 账户之后，关闭 22、设 `PermitRootLogin no`；清理 root `authorized_keys` 中无备注的密钥。

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
  - `PermitRootLogin prohibit-password`：只允许 root 用密钥登录，暂不禁止。原因见下方“2026-10-28 补充决定”；
  - `PubkeyAuthentication yes`。
- 按端口隔离（`Match LocalPort`）：
  - 22 端口只允许 root：`AllowUsers root`，供既有服务的自动化使用；
  - `<SSH端口>` 只允许 `AllowGroups rf-admin rf-tunnel`，RouteFit 的管理员和员工只走这个端口；
  - 先确认 OpenSSH 支持在 Match 块中使用 AllowUsers/AllowGroups，再用 `sshd -t` 检查语法。
- 限制连接：`MaxAuthTries 3`、`LoginGraceTime 30`。
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

- **SSH 改用自定义端口。** 2026-10-28 负责人决定，在 40000–48999 之间选一个端口，下文记作 `<SSH端口>`，端口号不写进仓库。先用 `ss -tlnp` 确认这个端口没被占用。按以下顺序操作，避免把自己锁在外面：
  1. ufw 和云防火墙先放行 `<SSH端口>/tcp`，22 暂时保留；
  2. Ubuntu 24.04 的 SSH 默认由 `ssh.socket` 监听：只改 `sshd_config` 的 `Port` 不会生效，要用 `systemctl edit ssh.socket` 覆盖 `ListenStream`，同时监听 22 和 `<SSH端口>`，然后 `systemctl daemon-reload` 并重启 `ssh.socket`；
  3. **在新会话中**验证四件事：
     - rfadmin 能经 `<SSH端口>` 登录；
     - rfadmin 经 22 登录被拒；
     - root 经 22 能登录；
     - root 经 `<SSH端口>` 登录被拒；
  4. **22 暂不移除**（2026-10-28 补充决定）：保留给既有自动化的 root 密钥登录。关闭 22 列为后续事项，见下方“后续事项”；
  5. fail2ban 的 sshd 规则同时覆盖 22 和 `<SSH端口>`。
- 服务器防火墙 `ufw`：新增 `ufw allow <SSH端口>/tcp`，22 与既有规则保持不变。**不用 `ufw limit`**：员工可能共用办公室的出口 IP，limit 会把短时间内的多次正常连接拒掉。防暴力破解由 fail2ban 负责。
- 服务商控制台的云防火墙同样新增 `<SSH端口>`，22 与既有规则保持不变，两层都要配。
- **Docker 会绕过 ufw。** Docker 发布的端口直接写 iptables，ufw 的来源限制管不住。外部核验时要单独测试这些端口；服务器上已有的其他服务怎么处理，由负责人决定（见下方“现状与取舍”）。
- 安装 `fail2ban`（sshd 规则）和 `unattended-upgrades`（自动安装安全更新）。
- 时区：按负责人决定（选 B）保持 UTC；确认 NTP 时间同步已开启。

### 第 5 步：运行环境

- 安装 PostgreSQL 16：用官方 PGDG 源。`listen_addresses = 'localhost'`；`pg_hba.conf` 只允许本机连接。
- 安装 Node 24 LTS 和 git。
- 新建无登录 shell 的用户 `routefit`，代码放在 `/srv/routefit`，配置放在 `/etc/routefit/`（权限 700，归 `routefit`）。

### 第 6 步：外部核验（用负责人自己的电脑，从外网做）

- 端口扫描：RouteFit 相关只有 `<SSH端口>` 开放；4180、5432 都不可达。22 仍开放，但只允许 root 用密钥登录。既有服务的端口逐个记录实际可达情况，8080 要从非指定来源测试一次。
- 经 `<SSH端口>` 用 root 登录被拒；经 22 用 rfadmin 登录被拒；任何端口用密码登录都被拒。
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
- 用 root 将 `ops/trial/pg_hba-routefit.example` 中的 `<RUNTIME_ROLE>`、`<BACKUP_ROLE>` 替换为 `trial:init` 输出的随机角色名，插入 `pg_hba.conf` 中泛化允许规则之前；执行 `SELECT pg_reload_conf()`（或等价的 PostgreSQL reload），再核验运行角色和备份角色连接 `postgres` 均被拒绝、连接 `routefit_trial` 均正常。
- 每次迁移完成后，按下方命令表先执行 `trial-backup-grants.mjs`，再执行 `trial-backup.mjs`（服务器上不用 `npm run`）；最后做一次备份和恢复演练。

**部署前准备清单（2026-10-30 演练后补充）：**

1. **数据库日志：** `SHOW log_statement` 不能是 `ddl` 或 `all`。`trial:init` 建角色的语句里带明文口令，记录 DDL 会把口令写进服务器日志。
2. **管理连接：** 专用管理角色为 `LOGIN SUPERUSER`（创建带 `BYPASSRLS` 的备份角色需要超级用户），`pg_hba` 只允许它从 `127.0.0.1/32`、`::1/128` 以 `scram-sha-256` 连接 `postgres` 和 `routefit_trial`；`<ADMIN_ENV>` 为 `root:root 600`。部署完成后可改为 `NOLOGIN`，维护时再临时打开。
3. **父目录：** R4 起 `trial:init` 不再自动建目录。`/etc/routefit`、`/var/lib/routefit`、`/root/.config/routefit` 须事先存在且可写；备份目录为 `root:rf-admin 2750`。
4. **`<ADMIN_ENV>` 在 `trial:init` 前须包含的全部变量（共 12 个，另加连接串）：**
   - 连接串（秘密）：`ROUTEFIT_PG_ADMIN_URL`；
   - 初始化输出位置：`ROUTEFIT_TRIAL_DATABASE`、`ROUTEFIT_TRIAL_ENV_FILE`、`ROUTEFIT_TRIAL_SESSION_FILE`、`ROUTEFIT_BACKUP_ENV_FILE`、`ROUTEFIT_TRIAL_COMPANY_FILE`；
   - 复制进 `<RUN_ENV>` 的非秘密路径和参数：`ROUTEFIT_ADMIN_ENV_FILE`、`ROUTEFIT_TRIAL_STAFF_FILE`、`ROUTEFIT_TRIAL_IMPORT_DIRECTORY`、`ROUTEFIT_TRIAL_SERVICE_AREAS_FILE`、`ROUTEFIT_TRIAL_AREA_REASON`、`ROUTEFIT_BACKUP_DIRECTORY`、`ROUTEFIT_PG_BIN`。
5. **模板占位符替换：** 安装下列模板时，只替换占位符，其余内容逐字不变；安装后检查已安装文件里不再含 `<…>` 占位符。
   - `ops/trial/routefit.service`：`<NODE24_PATH>`。安装后 `daemon-reload`，用 `systemctl cat routefit` 核对生效的 `ExecStart`，并确认没有遗留的 drop-in；
   - `ops/trial/routefit-tunnel-link.example`、`ops/trial/routefit-sudoers.conf.example`、`ops/trial/sshd_config-match.example`：`<NODE24_PATH>` 及文件内其他占位符；
   - `ops/trial/pg_hba-routefit.example`：`<RUNTIME_ROLE>`、`<BACKUP_ROLE>`（`trial:init` 输出后替换，见上文）。
6. **备份属主：** 备份由 root 执行，文件和校验文件为 `root:rf-admin 640`。

服务器直接运行脚本时统一使用 Node 24 完整路径和 `--env-file`（不使用本地 npm 脚本的 `.local/dev.env` 默认值）。`<ADMIN_ENV>`、`<RUN_ENV>`、`<BACKUP_ENV>`、`<COMPANY_FILE>`、`<STAFF_FILE>`、`<IMPORT_DIR>`、`<AREA_FILE>`、`<BACKUP_DIR>`、`<SESSION_FILE>` 均为服务器布局占位符；`trial:init` 只读 root-only `<ADMIN_ENV>` 并按其中的 `ROUTEFIT_TRIAL_ENV_FILE=<RUN_ENV>`、`ROUTEFIT_BACKUP_ENV_FILE=<BACKUP_ENV>` 路径写出新文件，不能把尚不存在的 `<RUN_ENV>` 作为 `--env-file`。

执行 `trial:init` 前，root-only `<ADMIN_ENV>` 还必须声明 `ROUTEFIT_ADMIN_ENV_FILE`、`ROUTEFIT_TRIAL_STAFF_FILE`、`ROUTEFIT_TRIAL_IMPORT_DIRECTORY`、`ROUTEFIT_TRIAL_SERVICE_AREAS_FILE`、`ROUTEFIT_TRIAL_AREA_REASON`、`ROUTEFIT_BACKUP_DIRECTORY`、`ROUTEFIT_PG_BIN` 七个非秘密路径/参数变量。init 只把这些非秘密变量复制到新 `<RUN_ENV>`，不复制管理或备份连接串及任何凭据。

| 操作 | 完整命令 | 显式环境变量名 | root 要求 |
| --- | --- | --- | --- |
| 初始化 | `sudo <NODE24_PATH> --env-file=<ADMIN_ENV> scripts/trial-init.mjs` | `ROUTEFIT_PG_ADMIN_URL`→`<ADMIN_ENV>`；`ROUTEFIT_TRIAL_DATABASE`, `ROUTEFIT_TRIAL_ENV_FILE=<RUN_ENV>`, `ROUTEFIT_TRIAL_COMPANY_FILE=<COMPANY_FILE>`, `ROUTEFIT_TRIAL_SESSION_FILE=<SESSION_FILE>`, `ROUTEFIT_BACKUP_ENV_FILE=<BACKUP_ENV>`→`<ADMIN_ENV>` | 必须 root；`<ADMIN_ENV>` 仅 root |
| 员工 | `sudo <NODE24_PATH> --env-file=<RUN_ENV> scripts/trial-staff.mjs` | `ROUTEFIT_ADMIN_ENV_FILE=<ADMIN_ENV>`, `ROUTEFIT_TRIAL_STAFF_FILE=<STAFF_FILE>`, `ROUTEFIT_TRIAL_COMPANY_FILE=<COMPANY_FILE>`, `ROUTEFIT_TRIAL_SESSION_FILE=<SESSION_FILE>`→`<RUN_ENV>` | 必须 root；`<ADMIN_ENV>` 仅 root |
| 导入 | `sudo <NODE24_PATH> --env-file=<RUN_ENV> scripts/trial-import.mjs` | `ROUTEFIT_ADMIN_ENV_FILE=<ADMIN_ENV>`, `ROUTEFIT_TRIAL_COMPANY_FILE=<COMPANY_FILE>`, `ROUTEFIT_TRIAL_SERVICE_AREAS_FILE=<AREA_FILE>`, `ROUTEFIT_TRIAL_AREA_REASON`, `ROUTEFIT_TRIAL_IMPORT_DIRECTORY=<IMPORT_DIR>`→`<RUN_ENV>` | 必须 root；`<ADMIN_ENV>` 仅 root；真实区域文件仅服务器 |
| 备份 | `sudo <NODE24_PATH> --env-file=<RUN_ENV> scripts/trial-backup.mjs` | `ROUTEFIT_BACKUP_ENV_FILE=<BACKUP_ENV>`, `ROUTEFIT_BACKUP_DIRECTORY=<BACKUP_DIR>`, `ROUTEFIT_PG_BIN`→`<RUN_ENV>` | 必须 root；`<BACKUP_ENV>` 仅 root |
| 备份授权 | `sudo <NODE24_PATH> --env-file=<RUN_ENV> scripts/trial-backup-grants.mjs` | `ROUTEFIT_ADMIN_ENV_FILE=<ADMIN_ENV>`, `ROUTEFIT_BACKUP_ENV_FILE=<BACKUP_ENV>`, `ROUTEFIT_TRIAL_DATABASE`→`<RUN_ENV>` | 必须 root；`<ADMIN_ENV>`、`<BACKUP_ENV>` 仅 root |
| 恢复 | `sudo <NODE24_PATH> --env-file=<ADMIN_ENV> scripts/trial-restore.mjs <BACKUP_FILE> <NEW_DATABASE>` | `ROUTEFIT_PG_ADMIN_URL`、`ROUTEFIT_PG_BIN`→`<ADMIN_ENV>` | 必须 root；恢复读 root-only `<ADMIN_ENV>` |
| 续期 | `sudo <NODE24_PATH> --env-file=<RUN_ENV> scripts/trial-renew.mjs` | `ROUTEFIT_TRIAL_SESSION_FILE=<SESSION_FILE>`→`<RUN_ENV>` | 必须 root；会话文件随后归 routefit 服务用户 |
| 启动检查 | `sudo <NODE24_PATH> --env-file=<RUN_ENV> scripts/trial-start.mjs` | `ROUTEFIT_DATABASE_URL`, `ROUTEFIT_SESSION_FILE=<SESSION_FILE>`, `ROUTEFIT_BACKUP_DIRECTORY=<BACKUP_DIR>`→`<RUN_ENV>` | root；systemd 实际启动服务 |

临时目录演练须按此表逐字执行 init→staff→import→backup-grants→backup→restore→renew→start，逐条记录退出码和脱敏输出摘要。2026-10-30 本机合成演练：init 0（临时库/角色）；staff 0（1 个合成员工）；import 0（1 个客户、1 个区域）；backup-grants 0（19 个 schema）；backup 0；restore 0（新库）；renew 0；start 1（macOS 无 Linux systemd，错误明确要求 VPS systemd）。最终以 VPS 复核为准。

## 不做

- 除 `<SSH端口>` 外不开放任何端口（负责人另有决定的既有服务除外），不配置域名、HTTPS、反向代理。
- 不改服务端代码，包括本机限制与开发身份。
- 不把 VPS 地址、密钥、口令、员工名单写进仓库、截图或聊天记录。
- RF-DEC-07 签批前，VPS 上只放合成数据。

## 验收

- 第 1–6 步：核验记录列出每项检查的命令和结果（PASS／FAIL）。只写主机代号，不写地址。
- 第 7 步：合成数据试跑记录，每个环节写 PASS／FAIL。
- 第 8 步：正式部署记录，包括标签 SHA、恢复演练的行数对比，以及每位员工的首次连通情况（只写角色，不写姓名）。

记录存放在负责人的私有位置，不进仓库。在本卡“审查记录”里只写结论和日期。Claude 根据负责人贴回的记录做技术复核。

## 审查记录

### 2026-10-28 · 第 1–6 步 · PASS（附两项例外）

依据：负责人贴回的核验记录（存放于负责人的私有位置）。负责人的 Codex 执行，负责人逐步确认，改动前已做快照，网页控制台可作应急入口。

**已通过：**

- `rfadmin` 用密钥登录，有独立的 sudoers 规则；
- SSH 双端口按端口隔离账户：22 只允许 root，`<SSH端口>` 只允许 rf-admin、rf-tunnel 组；任何端口都不能用密码登录；
- ufw 用 `allow` 放行 `<SSH端口>`；云防火墙新增 `<SSH端口>`，既有规则未动；fail2ban 覆盖两个端口；自动安全更新已开启；NTP 已同步；
- PostgreSQL 16.15 只监听本机，pg_hba 只允许本机连接；Node 24 单独安装，原有 Node 不受影响；
- `routefit` 用户不能登录，相关目录权限 700；用其他账户读取 RouteFit 的目录和数据库文件，被拒；
- 外网只能到达 `<SSH端口>`，4180、5432 不可达；
- 临时 rf-tunnel 账号核验：
  - 不加 `-N` 时登录后立即断开，拿不到命令行；
  - `-N` 隧道到 4180 可用；
  - 转发到 5432 被拒（administratively prohibited）；
  - 临时账号、服务、密钥均已清理。

**例外与现状（已知并接受）：**

1. 22 端口仍对外开放，root 可以用密钥登录。这是为兼容既有服务的自动化，按补充决定保留；关闭计划见“后续事项”。
2. 既有服务的端口：
   - 云防火墙对 80、443 放行全部来源，对 8080 只放行指定的一台机器，所以 8080 由云防火墙这一层受控；
   - 80、443 当前没有服务在监听，盘点时也没有。外网不可达属既有现状，与本次改动无关。将来要启用，由既有服务的负责人另行确认。

第 7 步等 RF-PM-038 合并，第 8 步等 v0.3.0 打标签，均未执行。

### 2026-10-28 · 第 7 步 · 部分通过（基础设施 PASS，初始化链路 FAIL）

依据：负责人的 Codex 执行，负责人逐条确认命令；基线 `f3dbfa0`（含 #67）；只用合成数据。核验记录存放在负责人的私有位置。

**已通过：**

- 两名登记员工经隧道各自只拿到本人的一次性链接，按对应角色进入页面；
- 未登记账号被拒；连接时带命令也只会触发登录辅助，不执行命令；关闭隧道后，登录辅助进程随之退出；
- 在 `orders.html` 实际录入的合成订单写入了数据库；
- 会话续期后旧会话失效，新链接可用；会话目录和文件的权限分别是 700 和 600；
- 备份文件和校验文件的属主是 `routefit:rf-admin`，权限 640；备份目录权限 2750（2026-10-30 更正：R2/R3 之后备份连接放在 root 私有的 `backup.env` 中，备份改由 root 执行，备份文件、校验文件为 `root:rf-admin 640`，备份目录为 `root:rf-admin 2750`。服务账号不能改写或删除备份。这是负责人 10-30 的决定，以此为准）；`pg_dump`、`pg_restore` 运行时，命令行里没有口令；
- 拉取到本机加密卷后，校验和一致；
- 正常恢复成功，前后行数一致；篡改过的备份被 `trial:restore` 拒绝（`backup checksum mismatch`），也没有建出目标库；
- 合成库、临时角色、临时账号和临时密钥都已清理。

**未通过（转 RF-PM-038-R2）：**

1. `trial:init` 不建会话文件；
2. `trial:init` 不建企业；
3. `trial:staff` 不设置企业作用域；
4. `trial:staff` 用的是运行连接，没有权限写员工主体；
5. `trial:import` 不建客户访问授权；
6. `trial:import` 的服务区域实际导入 0 行；
7. `trial:backup` 用的是运行角色，没有全库读取权限；
8. 一次性链接激活后进入的是 `/prototype/` 演示页，演示页的订单只存在浏览器本地，员工可能误把真实订单录进去而丢失。

上述各项在本次演练中都是手工补上的，补的做法不能作为正式方案。R2（#68）已经修复，待 R2 合并后在 VPS 上从干净的库重新演练，不手工补任何数据，才算第 7 步通过。

### 2026-10-29 · PostgreSQL 实例只读核查

- 宿主机 PostgreSQL 实例中只有 `postgres`、`template1` 两个系统库，没有任何业务库。
- 两个既有容器都没有在环境变量里声明连接这个实例。按授权范围，未读取它们的挂载配置文件，所以不能完全排除它们在使用这个实例。
- 结论：RouteFit 的运行角色和备份角色按 [RF-PM-038-R3](RF-PM-038-R3-db-access-scope.md) 在 `pg_hba` 层限定为只能连 `routefit_trial`。这样即使以后有其他库放进这个实例，这两个角色也读不到，项目负责人不需要另外接受“备份账号可读其他业务数据”的风险。

### 2026-10-29 · 第 7 步重新演练 · FAIL（在 `trial:init` 处终止）

- 管理连接文件缺失，原指定的管理角色不存在，原因未能查明；新建本机专用管理角色 `routefit_admin`，`pg_hba` 只新增规则，不改原有规则。
- 预检漏掉了 10-28 演练手工建的 `/etc/routefit/routefit.env` 和 `sessions.json`，`trial:init` 拒绝覆盖（这一行为正确）。
- 但失败回滚先删角色、后删库，备份角色删除失败且错误被吞掉，遗留一个能登录、带 `BYPASSRLS` 的备份角色。转 [RF-PM-038-R4](RF-PM-038-R4-init-atomic.md)（#74）修复。遗留资源已清理。

### 2026-10-30 · 第 7 步重新演练（基线含 R4）· 第 0–8 步 PASS，第 9 步部分完成

- 第 0–8 步通过：初始化、临时 `pg_hba` 规则（两个角色连 `postgres` 被拒、连 `routefit_trial` 正常）、合成员工、区域导入、服务启动、隧道登录（一次性链接复用返回 401、演示页 404、只能转发 4180、5432 被拒、不能进入命令行）、区域内订单提交受理、区域外订单被拦截、会话续期。
- 发现三处部署链路缺口，转 [RF-PM-038-R5](RF-PM-038-R5-deploy-gaps.md)（#76）修复：证据目录默认在只读代码目录下，服务无法启动；服务器上 `npm` 回落到系统 Node 18；`trial:*` npm 脚本把 env 写死为 `.local/dev.env`。
- 第 7 步首次返回 422，原因是操作时未填写必填的受理依据字段，服务端校验正确拦截，不属于缺陷。
- 第 9 步：负责人决定备份由 root 执行（见本卡上方 10-28 记录中的更正），服务器端备份与站外拉取完成，三方哈希一致；恢复和篡改拒绝转到下面的 R5 验证中执行。

### 2026-10-30 · R5 从干净状态验证 · PASS（第 7 步完整通过）

- 基线 develop `fc7121e`（含 R4、R5）；PostgreSQL 16.15；全部按运维说明里的服务器命令表，用 Node 24 完整路径加 `--env-file` 直接调用脚本。
- `init`、`staff`、`import`、`backup-grants`、`backup`、`restore`、`renew` 退出码均为 0；恢复库与原库核心表行数一致，备份 SHA-256 通过，备份文件为 `root:rf-admin 640`。
- 服务首次启动失败（203），原因是安装服务单元时没有替换 `<NODE24_PATH>`，属于部署步骤遗漏，不是实现缺陷；已补进第 8 步“部署前准备清单”第 5 条。替换后服务正常启动，证据目录自动建为 700，运行 env 里没有手工追加的项，`trial:start` 通过。
- 合成员工经隧道登录，录入区域内订单并提交受理，进入“核验中”。
- 补充检查：篡改过的备份被校验和拒绝，未创建目标库；R4 失败回滚在连接数据库前退出，没有遗留库或角色。
- 收尾：合成库、角色、输出文件、合成输入、合成备份、临时隧道账号和本机临时密钥均已删除；服务为 inactive、disabled；备份目录为空，仍为 `root:rf-admin 2750`。保留管理角色、其 `pg_hba` 规则、`<ADMIN_ENV>` 和已渲染的服务模板。
- 全程没有手工改库、补业务数据或放宽校验。
