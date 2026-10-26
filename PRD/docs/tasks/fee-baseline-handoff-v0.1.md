# RF-COL-00 费用开发基线交接 v0.1

2026-10-25 · 本地工作快照，非Git提交或已推送版本。基础HEAD为 `ba9a77ec78cd20a6bf72476e9c3410d7faa9a06e`，交接内容还包含已梳理的未提交变更；不能仅拉取该SHA复现。

## 1. 获取和核验

从项目根目录执行 `python scripts/export-fee-baseline.py`，得到 `handoff/routefit-fee-baseline-<snapshotId>.zip` 和同名manifest。manifest记录每个文件的SHA-256与大小，包内同时有 `HANDOFF-MANIFEST.json`。输出JSON记录归档自身哈希；最新实交包及恢复验证见[执行记录](../../../services/routefit/verification/rf-api-01/README.md)。

校验命令：

```powershell
python scripts/export-fee-baseline.py --verify <交接zip的本机路径>
```

在一个**新的空目录**解压，不覆盖大旺现有工作目录。先校验交接清单，再运行测试。快照不包含.git历史；可作为新工作目录或与双方约定的Git基线比对后提交，不能把包名当成commit SHA。本轮没有提交、推送或向大旺发送文件。

## 2. 打包范围及排除

包含：当前原型顶层运行文件及测试（费用页依赖现有共享应用）、品牌资源、费用服务与锁文件、契约及样例、当前PRD文档、校验与导出脚本。manifest逐项列出真实范围。

排除：`.git`、node_modules、`.local`、真实.env文件、历史before备份／history目录及prototype/records截图档案。`.env.example`仅保留占位示例。部分历史文档链接因此只在完整仓库可打开；运行代码、费用契约及启动资料在包内齐备。旧演示模块的合成数据是原型依赖，不作为正式数据导入。

原始工作区及未提交改动不清理、不回退。导出脚本使用固定文件时间生成可验证快照，检测链接文件并拒绝打包；没有把工作机数据库、登录Cookie或开发票据交给大旺。

## 3. 大旺本机启动

1. 安装Node24及本机PostgreSQL16+；进入解压目录的 `services/routefit`，运行 `npm ci`、`npm test`。
2. 按[服务说明](../../../services/routefit/README.md)通过本机环境注入 `ROUTEFIT_PG_ADMIN_URL`，执行 `npm run dev:bootstrap`，生成他自己的合成库及开发身份，不复制你的凭据。
3. 执行 `npm run start:dev`；另一个终端执行 `npm run session:link`，在60秒内打开链接，进入4180下的同源原型。
4. 对照[本机接入协议](../../../contracts/local-development-api.md)，查询 `/dev/session` 后调用费用API；从健康探针、CLI smoke开始，再做页面接线。

原4173服务可继续运行，费用API联调使用4180页面。当前费用按钮尚未接线，不能拿旧页面“保存成功”作为数据库验收证据。

## 4. 本轮文件边界

| 负责人 | 本轮文件 | 约定 |
|---|---|---|
| 你／RF-API-01 | services/routefit/main.mjs、application/http.mjs、adapters/development-auth.mjs、adapters/local-browser.mjs、db/dev-bootstrap.mjs、scripts/browser-session.mjs及服务测试 | 接入与会话、后端守卫；不改原型公共入口 |
| 你／RF-COL-00 | scripts/export-fee-baseline.py、交接说明、.gitignore的handoff排除项 | 快照与核验，避免打包本机凭据 |
| 大旺／RF-WEB-01 | prototype/fee-settings-ui.mjs及其页面调用层、前端测试、必要样式 | 真实接口接线；修改app.mjs／app.css前在卡上登记，避免双方同时编辑 |
| 共享契约 | contracts/openapi.json、pricing-api.md、local-development-api.md | 当前8个业务接口字段不变；新缺口先记录并同步契约 |

本轮未修改 `prototype/app.mjs`、`app.css`、`server.mjs`、`fee-settings-ui.mjs`、`fee-settings.mjs`；起止哈希核对见执行记录。没有更改正式PRD／RULE／AT或数据库迁移。

## 5. 交接状态

续轮更新后应重新导出快照，旧包保留为历史记录；以 `handoff/latest.json` 的snapshotId为准，恢复测试必须注明对应snapshotId，不能沿用旧包通过记录。[RF-QA-01交接表](fee-integration-qa-v0.1.md)列出当前技术证据和待页面接线验证项。

RF-COL-00：本地快照和恢复验证交付后标“待交接”，不表示大旺已收到。RF-API-01：技术实现和本地证据交付后标“待验收”；大旺确认收到、能启动并完成RF-QA-01对应验证后，才填写接收人与完成状态。RF-UX-01、RF-WEB-01与完整RF-QA-01不在本轮代做。
