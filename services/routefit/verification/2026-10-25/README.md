# 2026-10-25 本地接口实施与验证记录

工作区 `E:\Dr.RouteFit`，分支 main，起点 HEAD `ba9a77ec78cd20a6bf72476e9c3410d7faa9a06e`，remote为leishen8806/dr-routefit。工作区已有大量未提交文档／原型改动，本轮保留；`before/`保存本轮修改前的相关文档／契约／生成脚本。未提交、推送或部署。

## 交付范围

- services/routefit：Node24开发服务、参数化SQL、开发会话、8个费用操作、001迁移、bootstrap／smoke及测试。
- contracts：7条新路径／8个操作、12个schema／24个样例、目录与字段再生成。逐对象比较确认原有路径／schema内容未改。
- 两份新增规划、费用接口说明，及README／PRD索引／变更记录／数据库／API／计价差距同步。正式PRD、RULE、AT编号和原全量SQL草案未修改。
- 当前Web页面仍用sessionStorage，未改页面代码或把草稿试算接到正式报价、派单、付款。

## 实际运行环境

Windows PowerShell；Node **24.22.1**（通过npm缓存单独取得，未替换工作机默认Node25）；PostgreSQL **16.15**，从[官方EDB二进制下载](https://www.enterprisedb.com/download-postgresql-binaries)取得，隔离临时集群，仅监听127.0.0.1:55433，SCRAM认证。没有安装Windows服务或使用Docker。首切片没有空间字段，未安装／测试PostGIS。

Python默认3.15加载rpds扩展失败，因此契约校验改用bundled Python3.12.14，校验依赖安装在临时独立目录；未把原环境的DLL问题当作契约失败。服务依赖固定在package-lock.json。

## 结果

| 检查 | 实际结果 | 记录 |
|---|---|---|
| 服务领域／鉴权／契约 | 8项通过 | [unit-tests.txt](unit-tests.txt) |
| 真实PG与HTTP集成 | 13个子场景＋1个父测试通过；不是内存替身 | [postgres-tests.txt](postgres-tests.txt) |
| 既有原型回归 | 173项通过 | [prototype-regression.txt](prototype-regression.txt) |
| OpenAPI与样例 | 187条路径、210个操作、201个schema、413组样例通过 | [contract-validation.json](contract-validation.json) |
| CLI实际启动闭环 | bootstrap创建合成库；main启动；smoke建立草稿、保存200美分基础费、试算并读取持久化结果 | [cli-smoke.txt](cli-smoke.txt) |
| 就绪探针 | HTTP200，local-development | [health-ready.json](health-ready.json) |
| 新服务依赖审计 | 当前registry报告0项漏洞；不是全面安全审计 | [npm-audit.json](npm-audit.json) |

PG验证包括：同键并发只生成一次草稿；同版本并发一个成功、一个412；成功重放早于过期版本检查；改请求或If-Match后同键409；错误费目不留版本／幂等半成品；保险排除且总额425=可分成300+独立125；旧试算不随草稿编辑变化；HTTP跨企业404；运行账号RLS；跨企业复合FK；数据库分成CHECK；只追加历史；停用主体拒绝重放；分页；新服务与连接池仍读到原快照。

启动验证发现工作机已有其他项目的通用DATABASE_URL，Node的env-file不会覆盖继承值。已改用ROUTEFIT_DATABASE_URL／ROUTEFIT_MIGRATION_DATABASE_URL／ROUTEFIT_TEST_DATABASE_URL／ROUTEFIT_PG_ADMIN_URL／ROUTEFIT_PORT；新增实际CLI回归，用错误的通用DATABASE_URL验证不会影响RouteFit连接。初次误连只执行了角色／表存在性的只读就绪检查，没有写入其他项目数据库。

## 本机验证资源

测试随机库和随机运行角色由测试清理；人工smoke的合成开发库、凭据保留在本机`.local/`与临时PG目录，均不进入Git。验证完成后，已停止本任务创建的API进程和临时PG集群，未停止其他项目服务。

如需在**本次工作机**继续体验，可重新启动保留的临时集群，再用Node24运行服务：

```powershell
$pgRoot = Join-Path $env:TEMP 'routefit-api-pg-20261025'
& (Join-Path $pgRoot 'pgsql/bin/pg_ctl.exe') -D (Join-Path $pgRoot 'data') -l (Join-Path $pgRoot 'postgres.log') -o '-h 127.0.0.1 -p 55433' -w start
Set-Location E:/Dr.RouteFit/services/routefit
npm run start:dev
# 另一个终端：npm run smoke
```

临时目录可能被系统清理，不是持久部署。开发会话24小时后过期，续期方式见服务README；新工作机按README用自己的本机PG重新bootstrap，不能复制凭据。PG归档哈希只做本次下载留档，不等于独立签名认证。

## 未验收范围

没有生产身份提供方、完整对象范围、正式发布审批、真实报价／收付／派单、全WMS、真实KESS、Telegram、司机设备、数据库备份恢复、生产性能／灾备、独立审查或浏览器接线验证。历史原型／SQL验证不替代这些工作。D24、正式费率、税务／保险资料继续按既有流程确认。
