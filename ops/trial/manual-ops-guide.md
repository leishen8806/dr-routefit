# 受控试运营人工环节操作要点

适用范围：系统负责录单、报价、客户确认；收款、派单、司机配送由人工完成。不得把真实客户资料写入仓库、截图或聊天记录。

## 1. 收款台账

| 谁 | 什么时候 | 做什么 | 记在哪里 |
| --- | --- | --- | --- |
| 收款核对负责人 | 客户确认报价后、派单前 | 用系统订单号查报价；核对实收金额、币种与收款凭证；到账前不得派单 | `ledger-payments.csv`，凭证按负责人批准的位置保存 |
| 收款核对负责人 | 每笔到账后 | 填订单号、客户代号、报价金额、收款方式、到账时间、核对人；差额标为待处理 | 收款台账与受控凭证目录 |

“到账前不派单”判断：收款台账有到账时间、核对人和匹配凭证，且实收金额不低于应收金额；任一项缺失都视为未到账。

## 2. 派单与配送台账

| 谁 | 什么时候 | 做什么 | 记在哪里 |
| --- | --- | --- | --- |
| 调度负责人 | 收款核对完成后 | 以系统订单号派给指定司机，填写司机、出发时间和预计安排 | `ledger-dispatch.csv` |
| 司机/调度负责人 | 出发、签收、异常发生时 | 分别记录出发时间、签收时间和异常；异常立即通知调度 | 派单台账；签收凭证按批准位置留存 |
| 调度负责人 | 签收后 | 在台账写签收结果和凭证索引；系统外留痕只保存订单号、时间、结果，不复制客户地址 | 派单台账与受控签收记录 |

## 3. 每日对账

收工前由收款核对负责人发起，调度负责人复核：

1. 以系统订单号逐笔比对系统报价、收款台账、派单台账。
2. 标记三类结果：金额一致、已到账未派单、已派单未签收；缺少任一记录即列为差异。
3. 差异登记订单号、发现时间、差异类别、临时措施和处理人；禁止删除原记录。
4. 收款差异由收款负责人处理，配送差异由调度负责人处理；次日开工前仍未解决的差异升级给负责人。

## 4. 改址改时

登记由录单报价角色完成，决定由案件决定角色的人完成；两人必须是不同人员。候选报价由案件决定后生成。系统重新生成候选报价后，先暂停原派单安排并在台账标记“待重核”。收款负责人比较新旧金额：

- 新金额增加：确认客户同意后补收差额，到账并记录核对人后再派单。
- 新金额减少：按批准退款流程退还差额，在收款台账记录退款时间、方式和处理人，再更新派单安排。
- 客户未确认或差额未处理：不继续派单，保留原始订单号和两版报价的版本记录。

## 5. 系统故障

判断标准：连续无法建立本机 SSH 隧道、系统健康检查失败，或订单/报价接口无法可靠读写。调度负责人记录故障开始时间和订单号范围，负责人确认后当天切换为全线下：纸面/受控表格记录收款、派单、签收，不继续在系统录入。

恢复后不补录故障期间的历史订单；只保留线下台账和故障记录，待负责人决定后再处理后续新订单。

## 6. 超距离订单

超出系统服务范围的订单不进入系统报价或录单流程，按现有人工方式处理；在内部异常登记中只记录订单号（如已有）、处理时间、负责人和结果，不复制真实地址到仓库。

## 7. 开收工检查

- 开工：确认 VPS SSH 隧道、健康检查、收款/派单台账可写。
- 收工：完成当日对账，登记未决差异，锁定台账文件并交负责人复核。
- 任何停运、全线下切换、退款或异常派单都必须有负责人和时间记录。

备份由 `trial:init` 创建的专用备份角色执行。该角色保留 `BYPASSRLS`，但不授予集群级 `pg_read_all_data`：初始化会在 `routefit_trial` 库内为所有业务 schema 授予 USAGE、现有表/序列 SELECT，并为实际迁移执行角色设置可重复执行的 ALTER DEFAULT PRIVILEGES；每次迁移后由 root/管理员从受控 env 文件执行 `npm run trial:backup-grants` 重新授权。`ops/trial/pg_hba-routefit.example` 同时限制运行角色和备份角色只能从 127.0.0.1/::1 连接 `routefit_trial`，其他库在 reject 规则中拒绝。连接串只写入 root 可读的 `/root/.config/routefit/backup.env`，不放在命令行或员工端环境文件中。初始化会话文件后由 root 执行 `chown routefit:routefit /var/lib/routefit/sessions.json && chmod 600 /var/lib/routefit/sessions.json`，确保 systemd 服务用户拥有会话文件且其他用户不可读。

## 8. 服务区域导入

### 服务器上的命令表

以下命令均在 `/srv/routefit/services/routefit` 执行；`<NODE24_PATH>` 是服务器上 Node 24 的完整路径。`<ADMIN_ENV>`、`<RUN_ENV>`、`<BACKUP_ENV>`、`<COMPANY_FILE>`、`<STAFF_FILE>`、`<IMPORT_DIR>`、`<AREA_FILE>`、`<BACKUP_DIR>`、`<SESSION_FILE>` 是服务器布局占位符，不在仓库或命令行中写入任何值。root-only 文件只允许 root 读取。`trial:init` 先读 `<ADMIN_ENV>`，并按其中的 `ROUTEFIT_TRIAL_ENV_FILE=<RUN_ENV>`、`ROUTEFIT_BACKUP_ENV_FILE=<BACKUP_ENV>` 等路径写出运行文件；后续命令再读生成的 `<RUN_ENV>`。

部署前准备（数据库日志设置、管理连接、父目录、`<ADMIN_ENV>` 须包含的全部 12 个变量、模板占位符替换清单、备份属主）见 [RF-OPS-01 第 8 步“部署前准备清单”](../codex/tasks/RF-OPS-01-vps-trial-server.md)。

`<ADMIN_ENV>` 在执行 `trial:init` 前还必须包含以下七个非秘密路径/参数变量：`ROUTEFIT_ADMIN_ENV_FILE`、`ROUTEFIT_TRIAL_STAFF_FILE`、`ROUTEFIT_TRIAL_IMPORT_DIRECTORY`、`ROUTEFIT_TRIAL_SERVICE_AREAS_FILE`、`ROUTEFIT_TRIAL_AREA_REASON`、`ROUTEFIT_BACKUP_DIRECTORY`、`ROUTEFIT_PG_BIN`。init 只复制这些非秘密路径/参数到新生成的 `<RUN_ENV>`，绝不复制或写入管理连接串、备份连接串或其他凭据。

| 操作 | 完整命令 | 显式环境变量名 | 身份/文件要求 |
| --- | --- | --- | --- |
| 初始化 | `sudo <NODE24_PATH> --env-file=<ADMIN_ENV> scripts/trial-init.mjs` | `ROUTEFIT_PG_ADMIN_URL`→`<ADMIN_ENV>`；`ROUTEFIT_TRIAL_DATABASE`, `ROUTEFIT_TRIAL_ENV_FILE=<RUN_ENV>`, `ROUTEFIT_TRIAL_COMPANY_FILE=<COMPANY_FILE>`, `ROUTEFIT_TRIAL_SESSION_FILE=<SESSION_FILE>`, `ROUTEFIT_BACKUP_ENV_FILE=<BACKUP_ENV>`→`<ADMIN_ENV>` | 必须 root；`<ADMIN_ENV>` root-only，预检要求 `<RUN_ENV>`/`<SESSION_FILE>`/`<BACKUP_ENV>` 尚不存在 |
| 员工 | `sudo <NODE24_PATH> --env-file=<RUN_ENV> scripts/trial-staff.mjs` | `ROUTEFIT_ADMIN_ENV_FILE=<ADMIN_ENV>`, `ROUTEFIT_TRIAL_STAFF_FILE=<STAFF_FILE>`, `ROUTEFIT_TRIAL_COMPANY_FILE=<COMPANY_FILE>`, `ROUTEFIT_TRIAL_SESSION_FILE=<SESSION_FILE>`→`<RUN_ENV>` | 必须 root；`<ADMIN_ENV>` root-only；员工名单仅服务器 |
| 导入 | `sudo <NODE24_PATH> --env-file=<RUN_ENV> scripts/trial-import.mjs` | `ROUTEFIT_ADMIN_ENV_FILE=<ADMIN_ENV>`, `ROUTEFIT_TRIAL_COMPANY_FILE=<COMPANY_FILE>`, `ROUTEFIT_TRIAL_SERVICE_AREAS_FILE=<AREA_FILE>`, `ROUTEFIT_TRIAL_AREA_REASON`, `ROUTEFIT_TRIAL_IMPORT_DIRECTORY=<IMPORT_DIR>`→`<RUN_ENV>` | 必须 root；`<ADMIN_ENV>` root-only；真实区域文件仅服务器 |
| 备份 | `sudo <NODE24_PATH> --env-file=<RUN_ENV> scripts/trial-backup.mjs` | `ROUTEFIT_BACKUP_ENV_FILE=<BACKUP_ENV>`, `ROUTEFIT_BACKUP_DIRECTORY=<BACKUP_DIR>`, `ROUTEFIT_PG_BIN`→`<RUN_ENV>` | 必须 root；`<BACKUP_ENV>` root-only；备份目录由 root 准备 |
| 备份授权 | `sudo <NODE24_PATH> --env-file=<RUN_ENV> scripts/trial-backup-grants.mjs` | `ROUTEFIT_ADMIN_ENV_FILE=<ADMIN_ENV>`, `ROUTEFIT_BACKUP_ENV_FILE=<BACKUP_ENV>`, `ROUTEFIT_TRIAL_DATABASE`→`<RUN_ENV>` | 必须 root；`<ADMIN_ENV>` 与 `<BACKUP_ENV>` root-only |
| 恢复 | `sudo <NODE24_PATH> --env-file=<ADMIN_ENV> scripts/trial-restore.mjs <BACKUP_FILE> <NEW_DATABASE>` | `ROUTEFIT_PG_ADMIN_URL`、`ROUTEFIT_PG_BIN`→`<ADMIN_ENV>` | 必须 root；恢复直接读 root-only `<ADMIN_ENV>`，不读尚未生成的 `<RUN_ENV>` |
| 续期 | `sudo <NODE24_PATH> --env-file=<RUN_ENV> scripts/trial-renew.mjs` | `ROUTEFIT_TRIAL_SESSION_FILE=<SESSION_FILE>`→`<RUN_ENV>` | 必须 root；续期后会话文件归 routefit 服务用户 |
| 启动检查 | `sudo <NODE24_PATH> --env-file=<RUN_ENV> scripts/trial-start.mjs` | `ROUTEFIT_DATABASE_URL`, `ROUTEFIT_SESSION_FILE=<SESSION_FILE>`, `ROUTEFIT_BACKUP_DIRECTORY=<BACKUP_DIR>`→`<RUN_ENV>` | 必须 root；实际服务由 systemd 运行 |

`--env-file` 是 Node 24 的参数；上述命令是服务器直接调用脚本的写法，不改本地 npm 脚本。`trial:import` 的 `ROUTEFIT_TRIAL_AREA_REASON` 必须由值班人员在 root-only env 中提供，未提供会拒绝运行。

#### 临时目录演练记录（合成值）

按上表逐字执行 `trial:init` → `trial:staff` → `trial:import` → `trial:backup-grants` → `trial:backup` → `trial:restore` → `trial:renew` → `trial:start`；每步使用临时 `<ADMIN_ENV>`、`<RUN_ENV>`、`<BACKUP_ENV>`、`<SESSION_FILE>`、`<COMPANY_FILE>`、`<STAFF_FILE>`、`<IMPORT_DIR>`、`<AREA_FILE>`、`<BACKUP_DIR>`，不记录连接串。2026-10-30 本机合成演练结果：init 0（创建临时库/角色，无口令输出）；staff 0（创建 1 个合成员工）；import 0（导入 1 个合成客户、发布 1 个区域）；backup-grants 0（刷新 19 个 schema 授权）；backup 0（写出 dump）；restore 0（恢复到新库，原库未修改）；renew 0（续期 18 小时）；start 1（本机非 Linux，明确提示需要 Linux systemd）。负责人须在 VPS 复核同一命令表。

负责人提供审核过的真实服务区域文件，只放在服务器的 `/root/.config/routefit/service-areas.geojson`（GeoJSON `FeatureCollection`，单外环 Polygon，坐标顺序为 `[经度,纬度]`）；仓库里的 `service-areas.example.geojson` 仅为合成示例，真实地址或未审核坐标不得放入仓库。由 root/管理员在试运营库执行 `trial:import` 并通过 `ROUTEFIT_TRIAL_AREA_REASON` 传入发布依据，命令会在同一事务中创建并直接发布 ALLOW/DENY 区域，发布主体是 `trial:init` 创建的专用系统 principal；任一区域校验失败会回滚客户与区域全部导入。导入后再用受理页验证区域内、区域外和 DENY 点的结果。

`trial:init` 开始前会预检运行 env、会话文件和备份 env：三个文件都必须不存在，且各自父目录必须事先存在并可写；任一不满足就直接拒绝，不创建数据库或角色。若初始化中途失败，程序先断开试运营库残留连接，再删库、备份角色、运行角色，最后只删除本次新写出的文件；企业配置写入企业 id 后显式收紧为 600，失败时恢复原内容和原权限。清理失败不会被吞掉，错误会列出“仍有残留：角色/库/文件”，值班人员必须按清单处理。可用下列 SQL 检查残留角色：

```sql
SELECT rolname FROM pg_roles
WHERE rolname LIKE 'rf_trial_%' OR rolname LIKE 'rf_backup_%';
```
