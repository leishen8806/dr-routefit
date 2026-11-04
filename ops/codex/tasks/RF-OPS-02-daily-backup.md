# RF-OPS-02 · 每日自动备份、备份状态检查与站外拷贝规程

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | chore / 中（部署资产与运维规程；真实客户资料已在备份里） |
| 版本 | v0.3.x（不依赖 v0.3.1 的代码，模板可先于 v0.3.1 合并和安装） |
| 执行人 | 大旺＋Codex（仓库内模板、脚本、文档）；服务器安装由项目负责人的 Codex 在负责人逐条确认下执行 |
| 基线 SHA | 最新 `develop` |
| 分支 | `chore/RF-OPS-02-daily-backup`，PR 目标 `develop` |
| 依赖 | RF-OPS-01、RF-PM-038-R6 |
| 需人类批准 | 是：服务器部署资产；合并前须负责人侧 Claude 审查通过，并由作者以外的人批准最终 head；**安装到服务器是另一次独立授权** |
| 状态 | TODO |

## 背景

2026-11-04 负责人的 Codex 只读核查：试运营服务器上没有任何固定的每日备份。systemd 定时器、root cron、系统 cron 都是 0 个，本机也没有计划任务；备份与站外拷贝都靠人工想起。11-03 17:29 之后员工已开始录单，当天补做了一次手动备份（11-04 13:39，三方哈希一致，服务器保留 13 份，站外 1 份）。

R6 要求 `trial:start` 前有 24 小时内的有效备份，`trial:start` 找不到时会自己跑一次备份，这是兜底，不是备份制度。备份已含真实客户资料，所以只能拉到加密卷，不能出现在仓库、截图或报告里。

负责人 2026-11-04 的决定：

- 服务器每天 **02:00（UTC+7）**自动备份；
- 站外副本每天上午由负责人指定的人拉取前一晚的备份，站外至少保留最近 7 份，没拉取的天数要在日报里写明；
- 恢复演练每周一次，用新库验证，不碰生产库。

## 要做

1. **systemd 模板（`ops/trial/`）：**
   - `routefit-backup.service`：`Type=oneshot`，以 root 运行现有备份脚本，调用方式与 RF-OPS-01 命令表一致：`<NODE24_PATH> --env-file=<RUN_ENV> scripts/trial-backup.mjs`，环境变量 `ROUTEFIT_BACKUP_ENV_FILE=<BACKUP_ENV>`、`ROUTEFIT_BACKUP_DIRECTORY=<BACKUP_DIR>`、`ROUTEFIT_PG_BIN`；
   - 加固：`NoNewPrivileges=true`、`PrivateTmp=true`、`ProtectSystem=strict`，`ReadWritePaths` 只放备份目录；不给网络以外的额外权限；不在 unit 或命令行里出现任何口令；
   - `routefit-backup.timer`：每天 02:00（UTC+7），写成 `OnCalendar=*-*-* 19:00:00 UTC`（不依赖服务器时区），`Persistent=true`（服务器停机错过时开机补跑），`RandomizedDelaySec` 不超过 5 分钟；
   - 失败可见：备份失败时 `systemctl status` 与日志能直接看出，退出码非零。
2. **备份状态检查（只读脚本）：** 新增 `services/routefit/scripts/trial-backup-status.mjs`，输出最新备份时间（UTC+7）、距今小时数、校验文件是否存在且 SHA-256 通过、目录里的备份份数；最新备份超过 26 小时、校验失败或没有备份时退出码非零。不读取备份内容，不输出客户信息。
3. **文档：** 在 [RF-OPS-01](RF-OPS-01-vps-trial-server.md) 和 `ops/trial/manual-ops-guide.md` 增加"每日备份与站外拷贝"一节：
   - 定时器的安装步骤（占位符、`daemon-reload`、`enable --now`、`list-timers` 核对），每条服务器命令由负责人确认；
   - 站外拷贝的固定规程：谁拉、何时拉、拉到哪里（加密卷）、拉完做三方哈希、卸载加密卷、站外保留 7 份、记录模板（日期、哈希前 8 位、份数，不写路径和口令）；
   - 每周恢复演练的步骤（新库、行数对比、演练后删除）；
   - 备份失败、站外未拉取时的处理与上报。
4. **测试：**
   - 把新模板加入现有"模板占位符渲染"测试的文件清单；占位符必须都在替换表里；
   - `trial-backup-status` 的单元测试：新鲜、过期、校验失败、无备份四种；
   - 在 Linux CI 上有 `systemd-analyze` 时用它检查 `OnCalendar` 表达式和 unit 语法；没有则记 NOT_RUN 并说明。

## 不做

- 不在仓库里安装任何东西到服务器，不连接服务器；
- 不改 `trial:backup`、`trial:backup-grants`、`trial:restore` 的行为；
- 不自动化站外拷贝（加密卷由负责人侧手工挂载）；
- 不新增口令、不改备份角色权限。

## 验收

- 单元测试通过，CI 五项全绿；PR 描述按 PASS／FAIL／NOT_RUN 逐项写，写明哪些检查靠 `systemd-analyze`、哪些没跑；
- 合并后，项目负责人的 Codex 按文档在服务器上安装（每条命令负责人确认），并报告：`systemctl list-timers` 显示下一次触发时间；次日 02:00 之后 `trial-backup-status` 退出码为 0，备份时间在 02:00–02:05（UTC+7）。

## 审查记录

（待填）
