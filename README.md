# DR RouteFit

> Current local API status (2026-10-26): **235 documented operations; runtime callability is unverified because migrations are blocked; none deployed**. The WMS/external service-import slice is documented in [contracts/service-intake-api.md](contracts/service-intake-api.md), customer membership semantics in [contracts/customer-members-api.md](contracts/customer-members-api.md), external-subject settlement boundaries in [contracts/external-subject-settlement-api.md](contracts/external-subject-settlement-api.md), recipient access in [contracts/recipient-api.md](contracts/recipient-api.md), and export controls in [contracts/finance-export-api.md](contracts/finance-export-api.md); the progress table below records verified test baselines.

![DR RouteFit](brand/logo/routefit-horizontal.svg)

**The right vehicle. The right route. On time**

**面向柬埔寨仓配业务的智能调度与配送平台。** 围绕订单、计价、调度、仓库交接、司机履约和财务核对，逐步建立可追溯的业务闭环。

DR RouteFit is a warehouse and delivery operations project. This repository contains product specifications, brand assets and an interactive Web prototype. Local backend development is in progress; this is not a production delivery or payment service.

## 当前进度

截至 **2026-10-26**，代码基线为 main `99299bc0451443162018a18030a685718fea5421`。历史环境检查以 main 基线 `2ac993ec20adb24feeb6b5035fb15a69990b608c` 的 [RF-PM-001 实测报告](https://github.com/leishen8806/dr-routefit/blob/test/RF-PM-001-baseline-report/ops/codex/reports/RF-PM-001-baseline.md)为准；代码入库、文档暴露与运行通过分别说明。

| 范围 | 当前状态（数字来源：RF-PM-001） |
| --- | --- |
| main 已包含 | PRD评审材料、品牌、Web原型、`contracts/`机器契约与`services/routefit/`后端源码；克隆可取得这些文件 |
| 契约与文档投影 | 235个操作标记为`LOCAL_IMPLEMENTED_NOT_DEPLOYED`；隔离HTTP文档适配器暴露235个，operationId差异0。正式服务启动被阻塞，实际可调用数尚未验证，不将契约状态当成端到端通过 |
| 数据库迁移 | 63份迁移文件，最高063；迁移存在3处已定位的SQL错误（051、057、061），修复卡RF-PM-007（Claude交接任务卡）；不能宣称迁移全部成功 |
| Node24重测 | main `99299bc`：依赖安装通过、服务单测101/101、原型187/187（21个测试文件），均fail0/skip0；日志见RF-PM-003-R1交接报告 |
| PostgreSQL16历史验证 | RF-PM-001、基线`2ac993e`：集成7个顶层测试初始化失败；bootstrap及7个smoke失败。不是最新main全量数据库验收 |
| 尚未验证或交付 | 正式服务全量API闭环、生产身份、真实银行/KESS、真实地图、外部承运商接入、司机移动安装包、Telegram交付与生产部署。财务、调度、仓库已有本地源码，不再笼统列为完全未开发 |

链接复核（RF-PM-003-R1，main `99299bc`）：RF-PM-004/006已分别随PR #4/#9合并；扫描3499处本地引用，当前文档和源码缺失0处，855处缺失均位于历史records/before/verification快照，逐项清单保存在本轮交接证据中，不改写历史原件。

产品入口方向：客户使用 **Telegram Mini App＋Bot**，司机使用 **iOS／Android App**；运营、调度、仓库及财务使用各自工作界面。当前这些方向仍由网页原型和接口规划承载，不表示已交付Bot或移动App。

## 体验已发布的Web原型

原型使用原生HTML、CSS、JavaScript和Node.js内置模块，无需安装npm依赖。

```sh
git clone https://github.com/leishen8806/dr-routefit.git
cd dr-routefit
node prototype/server.mjs
```

打开 **[http://127.0.0.1:4173/prototype/](http://127.0.0.1:4173/prototype/)**。仅监听本机；端口已占用时不要重复启动。请通过HTTP访问，不直接双击HTML。

| 工作区 | 可演示内容 |
| --- | --- |
| 运营 | 货品、仓库库存、车辆、司机、分成和提现审核 |
| 调度 | 队列、示意地图、异常、车辆提案与人工承诺核验 |
| 自营配送 | 录单 → 报价与承诺 → 派单 → 司机接受 → 仓库交接 → 取货 → 签收 |
| 合作运力 | 合作方准入、车辆指派、人工快递委托、交接凭证、退回和应付 |
| 事故应急 | 按件将车上货物安排至其他车辆，记录接驳及保管责任 |
| 财务 | 收款申报与核验、司机交款、合作应付和人工审核 |

建议按“调度录单 → 司机接受 → 仓库放行 → 司机点收与签收 → 财务核验”走查。顶部角色切换是演示工具，不是真实登录。旧原型中的现场收款场景用于历史流程演示；当前产品主线为先付款再派单，获批月结为例外，不能用旧演示替代新的准入规则。

详细步骤见[原型使用说明](prototype/README.md)。演示数据通过浏览器会话保存；请只填写合成资料。

## 从 main 启动本地开发

直接克隆 main 即包含服务、契约与原型。**迁移存在3处已定位的SQL错误（051、057、061），修复卡RF-PM-007**，以下为标准启动顺序；在RF-PM-007修复并重新验证前，不承诺能跑通，不绕过迁移校验。

```text
services/routefit/README.md                  服务启动、身份、数据库和测试
contracts/pricing-api.md                     8个费用接口
contracts/orders-api.md                      5个客户／订单接口
contracts/pricing-policy-api.md              4个固定费策略审核接口
contracts/prepayment-api.md                  11个客户确认／银行核验／核销／准入接口
contracts/service-cases-api.md                5个确认订单服务申请／独立受理接口
contracts/local-development-api.md           本机同源开发会话
contracts/warehouse-requests-api.md          客户仓储申请与仓库受理接口
prototype/ORDER-ENTRY-CONTRACT.md             数据库录单页面交互与失败恢复
PRD/docs/project-delivery-depth-v0.1.md        全项目实施顺序与证据标准
PRD/docs/development-responsibilities-v0.1.md  双人分工和公共文件边界
```

准备Node.js **24 LTS**、本机PostgreSQL **16+**（基线实测版本见RF-PM-001）；在 `services/routefit` 执行 `npm ci`。按服务README注入本机数据库管理连接后，执行 `npm run dev:bootstrap` 创建独立合成库，再执行 `npm run start:dev`。

另一个终端执行 `npm run session:link`，在60秒内打开一次性链接，再访问：

```text
http://127.0.0.1:4180/prototype/orders.html
http://127.0.0.1:4180/dev/openapi.json
```

按设计，服务成功初始化后，录单页用于查询授权客户、新建多行货物草稿、刷新读取和编辑；版本冲突保留输入，结果未知时使用原幂等请求重试。同源Cookie为HttpOnly，CSRF只放内存；不要把开发凭据放进前端或README。

草稿保存不生成正式报价、收款或派单。费用试算按整数金额计算，保险费独立且不参与配送分成。旧共享工作台的演示数据不自动迁移到数据库。

**GitHub Pages仅托管静态资源，不能运行此API、数据库或生产登录。** 4180服务明确限制为本机开发，不能直接作为公网服务发布。

## 全项目推进顺序与分工

1. **P01 订单与报价：** main已有录单、区域受理、固定费审核与报价源码；本轮干净库验证受迁移阻塞，距离计费仍需可靠依据。
2. **P02 付款准入：** main已有人工核验、独立复核审批、核销与撤销等本地源码；具体资金能力须分别验收，真实银行与支付接入未交付，不能据源码宣称放行派单。
3. **P03 调度：** 先满足安全、装载和时效，再优化顺路与成本；一单仅一个有效执行。
4. **P04 仓库与司机：** 逐件交接、取货、导航、签收和异常；离线补传不能重复推进状态。
5. **P05 财务：** 应收、应付、司机保管、COD分别核对，独立复核与审批，差额与更正保留来源。
6. **P06 受控试点：** 完成生产身份、监控、备份恢复、外部接入与独立验收后再发布。

大旺主责产品、UI/UX及各端页面开发；项目负责人主责后端、数据库、API与技术集成。双方共同联调和交叉验收。共享入口和全局CSS按文件边界顺序整合，避免两个Codex在同一目录覆盖改动。

## 文档导航

| 文档 | 用途 |
| --- | --- |
| [PRD V1.4评审稿](PRD/docs/PRD-V1.4-review.md) | 正式需求评审依据 |
| [设计标准](PRD/docs/design-standards.md) | 品牌、字体、颜色和界面约束 |
| [开发标准](PRD/docs/development-standards.md) | 契约、协作、测试与交付 |
| [系统边界](PRD/docs/system-boundaries.md) | 职责与数据权威 |
| [术语表](PRD/docs/glossary.md) | 业务定义 |
| [页面与UX规划](PRD/docs/phase1-pages-and-ux.md) | 首期各端流程 |
| [数据库设计](PRD/docs/database-architecture.md) / [API设计](PRD/docs/api-design.md) | 设计草案，不代表全部已实现 |
| [原型契约](prototype/PROTOTYPE-CONTRACT.md) | 原型交互边界 |
| [验证覆盖](prototype/COVERAGE.md) / [历史记录](prototype/RECORDS.md) | 对应版本的验证证据 |

规范、原型和新增接口分别按文件中标注的版本阅读；正式PRD／RULE／AT不随页面实现自动变更。

## 测试与证据

已发布原型的核心回归：

```sh
node --test prototype/model.test.mjs prototype/r1m-model.test.mjs prototype/dispatch-ui.test.mjs prototype/incident-model.test.mjs prototype/platform-model.test.mjs
```

从main克隆的目录可运行 `node --test prototype/*.test.mjs`；服务端运行 `npm test`。PostgreSQL集成测试须按服务README配置一次性本机测试环境，禁止使用生产连接。

浏览器走查脚本 `prototype/browser-*.js` 供Playwright MCP使用，不是直接用Node运行的测试。记录必须指明源码／快照、环境、成功和失败场景；作者自测不能代替大旺或业务人员的独立验收。

## 实现边界

- 地图、定位、导航和外部承运能力在原型中是示意，不用动画证明实时数据。
- 签收、客户收款、司机交款及对外结算是独立状态；订单完成不等于财务结清。
- KESS商户尚未开通；只做模拟与接入准备，不声称真实扣款、自动退款或资金划转。
- COD不是平台运费收入；保费不参与配送费分成；钱在账户中不等于平台可自由使用。
- 不提交会话、支付密钥、真实个人资料、本机数据库或 `node_modules`。
- 缺少真实来源的数据应标为未知；Demo、设计与本机测试均不等于生产能力。

问题可通过[GitHub Issues](https://github.com/leishen8806/dr-routefit/issues)记录，附合成复现资料、实际结果和期望结果。每次交付同步代码、接口、页面契约及验证证据。
