# RF-COL-00／RF-API-01 技术交付记录

本页保留首次交付记录；后续JSON输入防护与QA准备见[续轮复核](../rf-api-01-followup/README.md)，新包ID及测试结果以续轮记录为准。

2026-10-25，本地main，起始HEAD `ba9a77ec78cd20a6bf72476e9c3410d7faa9a06e`，原有156项未提交状态保留。代码图工具本次不可用，按实际源码定位调用链；未将旧main当成完整基线。任务状态：RF-COL-00待交接，RF-API-01待独立验收；未通知大旺、未提交／推送／部署。

## 已实现

4180上的原型静态资源与费用API同源；本机终端产生60秒一次性激活链接，原子领取并检查源、来源身份与数据库启停状态后发放HttpOnly／SameSite=Strict会话。最长8小时、来源期限截断、重启失效；GET会话返回身份与CSRF，POST退出撤销会话。所有请求校验本机地址、Host／Origin及Fetch Metadata；静态文件限制路径及类型，不开放服务源码、凭据、测试和历史记录目录，无通配CORS。

8个费用业务接口的DTO和数据库迁移未变，整数金额、保险排除、RLS、版本、幂等与持久快照继续测试。新增开发端点契约见[本机接入说明](../../../../contracts/local-development-api.md)，不冒充生产IdP。

## 已完成验证

| 项目 | 结果 | 证据 |
|---|---|---|
| 服务单测与真实PG集成 | 24项计数通过（8个单测＋15个集成子场景＋父测试） | [service-tests.txt](service-tests.txt) |
| 真实Chromium同源调用 | 12项检查通过，未捕获页面异常；保险325=配送200＋保险125美分 | [browser-result.json](browser-result.json) |
| 原型回归 | 本轮结果见文件 | [prototype-regression.txt](prototype-regression.txt) |
| 契约／样例 | 本轮结果见文件 | [contract-validation.json](contract-validation.json) |
| 原工作区／文件边界 | 起始状态及受保护文件哈希；交付时复核未改 | [starting-state.json](starting-state.json)、[protected-files-check.json](protected-files-check.json) |

集成测试覆盖重复激活并发只一次、过期票据、停用身份、企业B不能读A、Host及跨源拒绝、CSRF、静态路径限制、退出和重启失效。初次测试暴露“读文件再删除”可能重复领取，已改为原子rename领取后再读取；修复后重跑通过。Host伪造测试使用原生HTTP请求，避免fetch忽略Host覆盖导致误判。

浏览器在独立context中打开未修改的原型，通过页面同源fetch完成草稿创建、保存、试算、412、幂等重放、刷新读取、退出；不是点击已接线的费用按钮。页面按钮接线与完整RF-QA-01依然未完成。浏览器脚本 [browser-local-access.js](../../tests/browser-local-access.js)由Playwright运行；一次性链接仅运行时注入占位符，不写入源码／证据。

## 交接快照

通过 `python scripts/export-fee-baseline.py` 导出带逐文件SHA-256的工作快照，包含真实运行依赖、费用服务、契约、文档与测试，排除本机凭据、依赖缓存和历史截图。快照文件与清单位于根目录 `handoff/`；具体文件名、包哈希和恢复验证结果记于该目录的 `latest.json`／`restore-result.json`，避免把归档自身哈希循环打进归档。

恢复验证在新临时目录完成，不覆盖原工作区；按锁文件安装依赖，运行服务单测／真实PG测试及原型回归，新建的测试库由测试清理。实际输出以handoff记录为准。交接步骤与文件归属见[RF-COL-00说明](../../../../PRD/docs/tasks/fee-baseline-handoff-v0.1.md)。

## 运行范围与限制

使用Node24.22.1、本机独立PostgreSQL16.15集群、合成数据。未使用Docker、真实银行或外部客户资料。验证使用的API与临时PG由本任务启动，结束后停止；旧4173服务不受影响，合成开发库保留在本机，凭据不打包。

仍有开发会话而非生产身份、未接线按钮、前端全业务验收、生产安全和运维等限制。Cookie仅本机HTTP使用、其他本机进程与同源代码属于开发信任边界；不能将服务映射到公网。JSON重复键解析等既有上线缺口继续保留在接口说明中。交付证据不是独立审查或生产批准。
