# RouteFit API · v0.1 本地开发切片

> 当前状态（2026-10-26）：**235/235** 个操作在本机实现，尚未部署；以下保留的121/235叙述是返仓、仓库待退回点收队列、财务待办、客户/运营收款与账项报表／资金总览、司机／客户证据、离线事件同步、公开追踪、客户仓储申请／仓库受理及库存预留、持久化通知、角色范围授权、银行流水、司机现金交接、账期账单／客户账单及客户退款申请／结算账户／司机提现申请补齐前的历史记录。

大旺接入先看：[订单录入API](../../contracts/orders-api.md)、[订单取消API](../../contracts/order-cancellation-api.md)、[本机会话注销API](../../contracts/session-api.md)、[费用API](../../contracts/pricing-api.md)、[策略审核API](../../contracts/pricing-policy-api.md)、[服务申请API](../../contracts/service-cases-api.md)、[收款投影API](../../contracts/finance-receipts-api.md)、[银行流水API](../../contracts/bank-transactions-api.md)、[司机现金交接API](../../contracts/cash-handovers-api.md)、[账期与对账单API](../../contracts/settlements-api.md)、[客户退款与结算账户API](../../contracts/customer-finance-requests-api.md)、[调度看板API](../../contracts/dispatch-board-api.md)、[候选读取API](../../contracts/dispatch-candidates-api.md)、[自营车辆指派API](../../contracts/assignments-api.md)、[司机提案、定位、离线同步与交付API](../../contracts/driver-api.md)、[持久化通知API](../../contracts/notifications-api.md)、[内部角色范围API](../../contracts/access-api.md)、[件级交接API](../../contracts/custody-transfers-api.md)、[客户仓储申请、库存与仓库受理API](../../contracts/warehouse-requests-api.md)、[候选报价价差审核单API](../../contracts/finance-documents-api.md)、[应收台账API](../../contracts/finance-ledger-api.md)、[客户门户只读／确认报价API](../../contracts/customer-read-api.md)、[受控客户下单API](../../contracts/customer-order-api.md)、[车辆检查与服务承诺API](../../contracts/promise-check-api.md)、[运营证据文件API](../../contracts/evidence-api.md)、[装载复核API](../../contracts/load-reviews-api.md)、[返仓任务API](../../contracts/returns-api.md)、[仓库待退回点收队列API](../../contracts/warehouse-api.md)、[调度异常API](../../contracts/exceptions-api.md)、[合作承运商准入API](../../contracts/partners-api.md)、[合作承运商委托API](../../contracts/carrier-bookings-api.md)。启动后 `http://127.0.0.1:4180/dev/openapi.json` 只展示可调用的188个接口，可直接导入接口工具；完整仓库契约仍含待开发设计。

财务待办、客户/运营收款申报与确认、账项报表、司机与客户订单证据、离线同步、仓储申请及库存预留接入见：[财务今日待办API](../../contracts/finance-tasks-api.md)、[收款接口](../../contracts/finance-receipts-api.md)、[银行流水接口](../../contracts/bank-transactions-api.md)、[司机现金交接接口](../../contracts/cash-handovers-api.md)、[账期与对账单接口](../../contracts/settlements-api.md)、[客户退款与结算账户接口](../../contracts/customer-finance-requests-api.md)、[司机接口](../../contracts/driver-api.md)、[通知接口](../../contracts/notifications-api.md)、[内部角色范围API](../../contracts/access-api.md)、[客户门户接口](../../contracts/customer-read-api.md)、[仓储申请接口](../../contracts/warehouse-requests-api.md)。当前可调用接口为188个。

当前接口数以顶部状态为准：**235/235 本机实现，尚未部署**。其余本段为历史切片说明，保留用于追溯。

2026-10-25 更新：客户门户可用订单证据确认本人报价，当前本地实现为121/235个操作。自营指派要求持久化路线计划、当前承诺、装载复核、付款和唯一有效履约；司机只可读取本人 `offered`／`accepted` 指派并在线接受／拒绝，接受后订单进入 `executing`。交接要求运营与司机不同自然人双签，确认前不改变保管人，差异创建阻断异常；司机出发还要复验全部件已由本人保管、装载复核仍为放行；司机位置仅在受控设备与当前当班均匹配时记录，未被采用为调度当前位置；交付仅允许当前收货授权与`DELIVERY`证据支持的全件结果，部分交付进入`return_open`；此后可由运营发起有证据、指定仓库的返仓任务，尚未实现授权、接回、点收、检验或关闭；收货授权由运营在当前交付窗口内登记，司机只能读取；异常只有解决且无阻断事项时才能关闭。没有结算、真实设备在线、真实合规核查或外部渠道时，`accepted`、`confirmed`、`in_transit`与本机`delivered`都不等于现实已执行或已交付。

对照：[接口说明](../../contracts/pricing-api.md) · [服务端规划](../../PRD/docs/server-implementation-plan-v0.1.md) · [数据库实施规划](../../PRD/docs/database-implementation-plan-v0.1.md) · [验证记录](verification/2026-10-25/README.md)。D24 技术选型仍待确认。

## 浏览器同源接入（RF-API-01）

本服务现在同时提供原型静态页面与费用API，原4173服务未改。启动后另开终端运行 `npm run session:link`，在60秒内于浏览器打开一次性链接，进入4180下的页面。会话Cookie为HttpOnly；页面通过 `/dev/session` 获取当前开发身份及内存CSRF，再以相对路径调用费用接口。

新bootstrap还生成企业B身份，可执行 `npm run session:link -- 1`；旧 `.local` 可能只有身份0。详情见[本机接入协议](../../contracts/local-development-api.md)、[代码交接说明](../../PRD/docs/tasks/fee-baseline-handoff-v0.1.md)和[本轮验证](verification/rf-api-01/README.md)。页面按钮接线仍由RF-WEB-01负责，不能用原型角色切换改变后端身份。

## 启动一次本地闭环

前置：Node.js **24 LTS**、npm、本机 PostgreSQL **16+**。此切片不需要 PostGIS；本轮实测 Node 24.22.1、PostgreSQL 16.15。不要把旧的全量 SQL 建表草案与本迁移执行在同一个库。

在 `services/routefit` 目录：

```powershell
npm ci
# 由本机环境注入本地 PostgreSQL 管理连接，例格式：
# postgresql://<admin>:<password>@127.0.0.1:<port>/postgres
# 不把真实凭据写进脚本、聊天或 Git。
$env:ROUTEFIT_PG_ADMIN_URL = $env:YOUR_LOCAL_POSTGRES_ADMIN_URL
npm run dev:bootstrap
npm run start:dev
```

本地浏览器验收若需要在同一进程连续跑大量请求，可显式设置 `ROUTEFIT_DEV_RATE_LIMIT`（默认 120 次/主体/分钟；仅本地开发服务读取）降低测试环境的假性限流，例如 `ROUTEFIT_DEV_RATE_LIMIT=1000 npm run start:dev`。生产部署不使用该本地开发入口。

`dev:bootstrap` 只接受本机数据库，创建一个随机命名的 `routefit_local_*` 库、独立受限登录角色和两家合成企业，应用迁移，并把开发会话和运行连接写到被 Git 忽略的 `.local/`。不会覆盖已有 `.local`，不会迁移真实业务数据。管理员需要创建库、角色及迁移权限；**运行服务不使用管理员连接**。

另开终端，在相同目录运行：

```powershell
npm run smoke
```

该命令读取本机凭据、不打印密钥，实际完成“建草稿 → 保存基础费 → 试算 200 美分 → 读取快照”。每次运行产生一份新的合成草稿；不生成订单、应收或付款。

`npm run smoke:orders` 另验证“查询授权客户 → 创建订单草稿 → 读取 → 修改 → 列表”，生成合成订单但不产生报价／付款／派单。新bootstrap生成客户授权和orders:read/create/edit权限。旧环境需管理员先执行002迁移并配置客户授权及开发权限，不能只升级代码就假称可用；无需订单联调时也须应用002才能满足当前启动检查。大旺建议在新交接目录自行bootstrap，保留旧库与旧.local。

健康探针：`http://127.0.0.1:4180/health/live`、`/health/ready`。`Ctrl+C` 停止 API。数据库进程由本机 PostgreSQL 安装方式管理，不由 API 启停。

策略审核增量需要003迁移；现有001／002不改。新bootstrap除原身份0／1外，另建企业A复核身份2及批准身份3，权限分别为pricing:read＋review／publish；原身份0／1无这两项权限。`npm run smoke:policy`以三份开发会话验证提交、复核、发布、读取并退出；不会创建订单报价或收付款。旧.local不会自动扩权；建议在新空目录bootstrap后对接，保留旧库和旧会话文件。

来源开发身份有效期为24小时；通过一次性链接创建的浏览器会话最长8小时且不超过来源身份期限，可通过POST /dev/session/logout撤销，重启服务后失效。正式登录和账号权限管理待下一阶段接入。手工续期只能在本机修改 `.local/sessions.json` 的 `expiresAt` 并重启；不能在前端切换角色代替登录。`.local/client.json` 含测试凭据，Windows 文件 ACL 应限制到本机开发者；文件 mode 不是 Windows ACL 的替代。

## 独立配置与迁移

已有独立空库时，用迁移账号设置 `ROUTEFIT_MIGRATION_DATABASE_URL` 后运行 `npm run migrate`。迁移记录保存 SHA-256，重复执行跳过已应用版本，已应用 SQL 发生修改则报错。已经应用的迁移不再编辑，后续变更新建编号文件。

运行账号应为 `NOSUPERUSER NOBYPASSRLS`，仅继承 `routefit_api` 的表权限；与迁移／数据库 owner 分离。配置见 [.env.example](.env.example)。服务需要显式 `ROUTEFIT_AUTH_MODE=development`，拒绝 `NODE_ENV=production` 和远程开发数据库。不要把服务暴露到局域网或反向代理公网。

## 代码位置

```text
main.mjs                  配置、依赖装配、仅本机监听、退出
application/http.mjs      路由、鉴权、契约校验、事务、动作编排
application/orders.mjs    五个客户／订单录入操作映射
domain/pricing.mjs        整数计费、跨字段约束、费用归属
domain/orders.mjs         录单约束、完整快照与逐件标识
adapters/contract.mjs     直接校验仓库 OpenAPI，拒绝未知字段
adapters/development-auth.mjs  本机开发会话，不是生产认证
adapters/postgres.mjs     参数化 SQL、租户上下文、版本与幂等
adapters/orders.mjs       客户授权、订单持久化、签名分页
adapters/local-browser.mjs  本机同源静态资源、一次性激活及会话
scripts/browser-session.mjs  从本机终端生成短时激活链接
db/migrate.mjs            编号迁移与校验和
db/migrations/            可执行增量迁移
db/dev-bootstrap.mjs     合成开发库与开发会话
tests/                    算术／契约／鉴权及真实 PostgreSQL HTTP 测试
```

## 验证

```powershell
npm test
# 使用一次性本机测试集群的管理员连接；测试创建随机库和角色，结束后仅删除自己创建的资源。
$env:ROUTEFIT_TEST_DATABASE_URL = $env:YOUR_LOCAL_POSTGRES_TEST_ADMIN_URL
npm run test:integration
```

集成测试不接受远程主机；不能用生产库管理员凭据。测试运行账号经过 RLS，不以超级用户模拟业务请求。迁移、种子和约束破坏测试才使用测试管理员。

RF-QA-01交接见[验收步骤与待办](../../PRD/docs/tasks/fee-integration-qa-v0.1.md)。费用三个POST入口已拒绝重复JSON字段和非法UTF-8；续轮测试与修复前失败证据见[技术复核](verification/rf-api-01-followup/README.md)。

## 尚未实现

独立订单页面已接通：完成开发会话激活后访问`http://127.0.0.1:4180/prototype/orders.html`，可创建、回读、编辑数据库草稿，见[页面契约](../../prototype/ORDER-ENTRY-CONTRACT.md)与[验证](verification/order-entry-ui/README.md)。共享工作台与费用页面仍使用原有浏览器演示状态，不能把两种数据混为一套。

没有生产身份提供方、发布审批、合同／区域自动选价、完整阶梯／体积重计算、真实支付、路线自动规划／匹配、仓库或完整财务后端。现有自营提案及司机接受仅是本机闭环切片。VET／ZTO／CE／JT 只是采购配置分类，不表示对方费率已经核实或已接通承运商 API。GitHub Pages 只托管静态页面，不能运行本服务。

## 订单受理增量（004）

对照 [8个受理／区域接口](../../contracts/order-intake-api.md)。新空目录 bootstrap 会应用001–004并给身份0／1增加 orders:verify/submit 和 areas:read/create/publish；旧会话不会自动扩权。旧库须由迁移身份升级，已有001–003不可改写。`npm run smoke:intake` 使用当前开发身份验证人工依据、区域发布、提交核验、退回重核并停用本次合成区域；应在干净合成库运行，既有禁送区可能使其按预期阻断。

[本轮证据](verification/order-intake/README.md)包含旧非空库升级、接口测试和页面只读状态核查。受理界面接线仍待大旺完成；本段记录004阶段；现已补固定费报价，正式身份和生产地图未实现。

## 固定费订单报价（005）

[报价接口](../../contracts/order-quotes-api.md)：新增quotes:read/create，bootstrap身份0／1具备，旧.local不自动扩权。应用005迁移；001–004保持原样。`npm run smoke:quotes`复用三人策略审核，跑通录单、受理、报价275美分、保险75美分独立、读取及退回失效。仅本机合成数据，真实支付及派单仍不可用，客户确认与人工银行核验见006。

## 预付与核销（006）

[11个接口及前端接线](../../contracts/prepayment-api.md)。新空目录bootstrap应用001–006；原001–005不变。新增财务核验/复核身份4、财务审批/入账身份5，经办0，三名独立人员参与核销；人员ID由服务端取值。旧.local不自动加权限。仅保留旧库升级验证，不在旧会话中注入新身份；推荐新空目录bootstrap。

运行 `npm run smoke:prepayment` 使用0/2/3/4/5五个开发身份，确认报价、申报300、核销275，剩余25未分配；保险75独立。脚本停用合成区域后准入会阻断，账务仍保留。查看[本轮验证](verification/prepayment/README.md)。没有真实KESS/银行调用，没有退款、冲正或月结例外；生产身份和受控纠错完成前不可试点。

## 整笔核销撤销（007）

[5个接口](../../contracts/allocation-reversals-api.md)，新空目录bootstrap应用001–007、身份0/1增加prepayment:correct；4复核、5审批/入账，旧.local不自动扩权。运行 `npm run smoke:reversals` 完成预付、撤销、余额恢复与重新核销。原银行收款不撤销，确认订单仍锁定；不代表退款或完整会计冲正。验证见 [记录](verification/allocation-reversal/README.md)。

## 确认订单服务申请（008）

[5个接口](../../contracts/service-cases-api.md)，新空目录bootstrap应用001–008；身份0/1获得客户申请及运营读取权限，运营决定必须由与申请人不同的自然人完成。现阶段仅提供申请、授权读取和决定留痕；不产生新报价、价差、退款或原收款迁移，也不解除确认订单锁。旧 `.local` 不自动扩权，推荐重新bootstrap后联调。

## 候选变更报价（009）

009迁移为候选报价与已受理案件增加不可改的引用关系；010迁移在候选报价确认时冻结原收款、有效原核销、未分配余额及待补款/待处理贷项位置。已有 `createQuote` 接口在当前报价已确认时必须附 `serviceCaseId`，会重新检查候选地址/时间的受理条件并冻结新报价和价差；原订单、原报价、原收款、原核销和付款准入均不变。客户确认候选报价只保留同意证据和资金位置快照，仍需下一批价差应收/贷项与资金映射才可实际切换订单。旧 `.local` 不自动迁移或扩权。

## 原报价应收台账（011）

[应收台账接口](../../contracts/finance-ledger-api.md)新增 `finance:ledger:read` 列表与 `finance:ledger-items:read` 单项读取，读取确认报价按费用项形成的不可改应收。`allocatedMinor` 与 `outstandingMinor` 从仍有效的POSTED核销重算；整笔核销撤销后自动恢复未结额。当前只读展示原报价的配送费／保险费，不产生候选价差账项、不映射原收款到新报价、不自动退款，也不切换确认订单。新空目录bootstrap应用001–011；旧 `.local` 不自动迁移或扩权。

## 候选报价价差调整基础（012）

012迁移为候选报价价差建立独立的调整单、审核事件和候选账项三个只追加对象。它以企业＋订单＋报价复合外键防止跨订单引用，RLS限制企业与客户可见性，数据库触发器强制经办提交、不同自然人复核、再由第三人审批后才允许入账；候选报价未确认时不能入账。`FinanceDocument` 的调整单路由已接通：入账只新增候选应收／客户贷项，不改变原收款、原核销或订单当前报价，也不切换订单。

## 车辆检查（013）与服务承诺（014）

[车辆检查与服务承诺接口](../../contracts/promise-check-api.md)新增企业隔离的车辆规格、不可改承诺检查、承诺创建与历史读取。检查需当前已确认报价和订单版本；它校验车辆状态、重量、容积、内尺寸、门洞和货物限制。当前没有经过验证的路线 ETA/版本或承运商能力，所以服务明确返回 `ETA_UNAVAILABLE`、不自动放行。014在付款已核销、客户同意、有效检查和车辆硬约束满足时，允许获授权人员记录人工承诺，并以数据库排他约束写入同车独占时段预留；不会伪装为校准 ETA 或创建司机派单。

## 客户门户只读投影

[客户门户接口](../../contracts/customer-read-api.md)新增已授权客户的订单列表／详情、报价和账项读取。它们复用同一RLS事实，订单详情不回显运营草稿或内部执行字段；跨企业或撤销客户授权时，单项返回404、列表为空。当前只读，不开放客户录单、在线支付、地址改写或报价确认。
