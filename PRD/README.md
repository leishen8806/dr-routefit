# DR RouteFit

2026-10-26 产品需求会资料：[会议议程、决策表与 GitHub 状态](docs/meetings/2026-10-26-product-requirements-meeting.md)。该材料区分远端已发布内容、本地未提交工作包和待决事项；不冻结需求、不授权部署。

最新前置能力：[固定费策略审核发布](../contracts/pricing-policy-api.md)新增4个本地接口及003迁移，三主体分离并冻结来源版本，合计17个已实现操作。正式报价仍等待订单受理及来源校验，不把已发布策略当作订单已报价。

全项目推进（2026-10-25）：[实施深度与证据标准](docs/project-delivery-depth-v0.1.md)。独立[数据库录单页](../prototype/ORDER-ENTRY-CONTRACT.md)已跑通创建、刷新、编辑、冲突和原请求重试；共享工作台及其他端尚未接线。GitHub本轮只更新README，代码仍为本地开发增量。

服务端优先增量：[订单录入API](../contracts/orders-api.md)已实现客户查询、创建／列表／详情／编辑，共5个操作；与原8个费用API合计13个。大旺按机器契约和请求模板接线；正式报价／付款／派单后端继续依次实现，不把录单完成视为P01全部完成。

RF-COL-00／RF-API-01本地交付：[可复现基线与文件边界](docs/tasks/fee-baseline-handoff-v0.1.md)、[本机同源接入](../contracts/local-development-api.md)。大旺的页面接线仍待执行，未推送或部署。

RF-QA-01准备：[费用联调验收交接表](docs/tasks/fee-integration-qa-v0.1.md)，包含后端技术结果、页面待验收步骤和证据填写要求。

协作入口：[你与大旺的开发分工](docs/development-responsibilities-v0.1.md)及[首批费用页面接线任务](docs/tasks/first-sprint-fee-integration-v0.1.md)。你负责服务端、接口与技术集成；大旺用Codex参与产品、设计、客户端开发；任务卡已写好，尚未送达或确认接单。

2026-10-25 服务端启动：[代码与分阶段规划](docs/server-implementation-plan-v0.1.md)、[数据库迁移规划](docs/database-implementation-plan-v0.1.md)、[费用接口开发对照](../contracts/pricing-api.md)。已实现8个本地PostgreSQL费用操作，D24仍待确认；网页原型尚未接线，其余接口不因此视为已实现。

2026-10-25 计价专项：[完整规则体系](docs/delivery-pricing-system-v0.1.md)、[公开资料核查](docs/research/2026-10-25-delivery-pricing.md)、[开发与验收差距](docs/pricing-development-map-v0.1.md)。包裹／车型／拼单／合同与仓储分别计价，客户应收、司机应付和成本分开；[后台分项费用设置与试算](docs/fee-settings-v0.1.md)已接入本地Demo，具体费率待批准，订单正式报价引擎尚未接入。

2026-10-25 已确认：[用户端 Telegram Mini App＋Bot 下单、司机端 iOS／Android App](docs/telegram-and-driver-app-scope-v0.1.md)。这项增补替代旧入口形态；现有 Demo 仍为网页模拟，正式 PRD 编号保持不变。

待评审增量：[订单交付约定与收货授权差距](docs/delivery-agreement-review-v0.1.md)，附 [2U Delivery 公开核查](docs/research/2026-10-24-2u-delivery-review.md)。交付方式、费用确认与授权版本尚未合入机器契约或 Demo；不改变已有门户分期和正式 PRD 编号。

最新开发接口：[接口包 v0.1](../contracts/README.md)，含机器契约、字段、权限、状态、调用流程和待开发验收；[客户门户范围](docs/customer-portal-scope-v0.1.md)明确货主门户＋收货人入口，首期不要求独立原生 App。文档候选不等于服务已部署，正式 PRD/RULE/AT 未改。

**Smart Dispatch & Delivery**
**DR 智能调度与顺路配送平台**

> The right vehicle. The right route. On time.
>
> 配对车辆，规划路线，准时送达。

DR RouteFit 面向即时货运与仓配配送，围绕车辆与货物装载匹配、及时送优先和顺路拼单形成业务闭环。地址、坐标、路网时间和车辆位置由地图基座 **Daen GeoCore** 提供。

## 最新整合评审稿

最新跨端财务：[需求与报表 v0.1](docs/cross-end-finance-and-reports-v0.1.md)、[交互 Demo](../prototype/finance.html)、[设计图](../prototype/finance-design.html)。COD 纳入首期需求与本地原型；已实现独立资金确认、三人审核、核销／更正、交款差额、付款未知、司机提现及各端授权视图。旧订单不自动迁移，生产后端／银行仍未接通。


财务闭环增补：[财务结算设计与 Demo 差距 v0.1](docs/financial-closure-design-v0.1.md)。分开收付款、银行核对和核销，补一款多单、四类业务账及保险独立用途；现有付款登记即已付、部分收款标差错等缺口已列入 P05。该段记录实现前审查；最新实现与COD首期范围以上方跨端专项为准，现有司机收入提现保留。

合作结算专项：[合作单位／个人结算与资金管理 v0.1](docs/partner-settlement-and-funds-v0.1.md)。已实现按主体账期、到期出账提醒、模拟账单/催收发送、部分到账及应付提醒 Demo，见[验证记录](../prototype/records/2026-10-24-settlement/README.md)。周结／月结仅为模板，具体账期以协议为准；后台定时、真实通知、银行和资金日历预测尚未接通。

银行托管讨论已记录于上述专项第 8 节：“银行托管＋DR 分账结算”为优先评估方向，具体场景、费用、资金权属与合规适用待确认；未联系银行或接入服务。

**下一轮实施任务：[基础配送闭环第一轮任务 v0.1](docs/core-delivery-implementation-plan-v0.1.md)。** P01统一订单报价 → P02预付/月结派单守卫 → P03合格车辆成本比较 → P04司机执行导航 → P05核账 → P06验证发布。任务卡均待执行。

地图成本专项：[地图路线与导航成本优化方案 v0.1](docs/map-cost-optimization-v0.1.md)，含官方计费核查、候选过滤、逐站外部导航、配额、许可边界及待执行技术样例。

路线专项：[配送路线规划与调度界面设计 v0.1](docs/route-planning-design-v0.1.md)。明确站点顺序、时窗、逐段载荷、成本对比及地图操作；遵循预付/月结准入和分阶段推荐，不代表真实引擎已接通。

**当前执行重点：[平台跑通与基础计价派单基线](docs/platform-first-execution-baseline.md)。** 优先统一报价、先付款/获批月结再派单、可行车辆成本比较和正常交付核账；复杂售后规划保留但不作为基础主线前置。客户退款不自动扣司机收入。

**后续实施规划：[后续闭环功能执行规划 v0.1](docs/future-closure-plan-v0.1.md)。** 按 F01–F09 细化部分签收/退款、收入提现、事故、多运力、接入仓储、只读投影与推荐拼单；同步页面、状态、API、数据库、边界、标准、术语和候选验证场景。工作包编号不是新 AT，新增能力尚未实现或验收。

**最新闭环增补：[闭环需求增补与交付规划 v0.1](docs/closed-loop-requirements-v0.1.md)。** 汇总已确认的用户端、仓配接入、费用保险、提现、多运力、事故转运和权限体验要求；明确现有原型、本轮同单异常退回和后续建设边界。与下方 V1.4 一起阅读，不改原规则和验收编号，也不代表 V1.4 已冻结。

[PRD V1.4 完整整合评审稿](docs/PRD-V1.4-review.md) 已整合用户确认的三项选择：自营与白名单合作车辆、人工快递委托；顺路合单及返程配货分阶段；智序工场中控台只读展示并跳转。含 52 条规则、104 项验收和 GitHub 选型核验。它是完整稿，不需要与 V1.3 拼接阅读。2026-10-27 按需求会 M01 冻结为当前基线，见[冻结说明](docs/decisions/2026-10-27-v1.4-freeze.md)。

V1.3 保留作历史追溯；其与 V1.4 的差异及迁移已写入 V1.4 第 21 章、附录 G.4。

## 当前基线

**当前基线：[PRD V1.4](docs/PRD-V1.4-review.md)（2026-10-27 冻结，见[冻结说明](docs/decisions/2026-10-27-v1.4-freeze.md)）；已确认增补：[及时送优先与车辆—货物装载适配](docs/confirmed-dispatch-loading-baseline.md)。下文保留 V1.3 时期的说明作历史记录。**

2026-10-24 用户明确将上述两项要求正式纳入核心业务规则。增补明确：安全、装载及所有既有承诺先作为硬约束，及时送在可行方案中优先，顺路和成本随后优化；3D 装箱独立评估。七项来源要求映射到既有规则，不重编 RULE/AT，不代表 V1.4 整体冻结、技术选型完成或功能已实现。增补不改变正在进行的三张设计图视觉开发任务。

V1.3 正文、40 条业务规则（附录 A）、80 项验收案例（附录 B）、试运行候选参数（附录 C）和工程流程（附录 D）保留在原文件；本次明确确认的增补同时生效，后续完整冻结版本再统一收录。

首个可交付版本是单仓试点：一个运营企业、一个发货仓、受控车队、仓库发货到客户、调度员派车、司机执行（PRD 1.1）。智能推荐、合单与插单、复杂装箱和三维接入按证据逐步推进。

文档状态：需求整合完成，待产品与技术冻结。不是实现验收、生产试点、合并或部署批准。

## 目录

| 路径 | 内容 |
| --- | --- |
| `docs/PRD-V1.4-review.md` | 当前基线（2026-10-27 冻结；文件名保留 review 以免断链） |
| `docs/confirmed-dispatch-loading-baseline.md` | 用户已确认的及时送与装载适配基线增补；既有规则映射及技术尽调边界 |
| `docs/research/2026-10-24-open-source/verified-research.md` | 开源候选复核、固定 SHA/许可证据和 R0 技术验证计划；非选型批准 |
| `docs/PRD-V1.3-final.md` | 已被 V1.4 替代的原需求基线，保留追溯 |
| `docs/design-standards.md` | 设计标准：品牌与 Logo 使用、色彩、字体、数据可信度的视觉表达、各端界面规范 |
| `docs/development-standards.md` | 开发标准：仓库结构、分支与评审、契约、领域实现、安全、测试、完成定义 |
| `docs/system-boundaries.md` | 系统边界：系统职责、数据权威、接口、写权限、信任区、分阶段范围 |
| `docs/glossary.md` | 术语表：需求、界面、代码和培训统一使用的名称与编码 |
| `docs/database-architecture.md` | 数据库架构：选型建议、分库分域、全局约定、由约束兜底的规则、表结构、权限、迁移与备份 |
| `docs/database/` | `routefit` 与 `geocore_g1` 两个库的建表草案及验证脚本（已在 PostgreSQL 16.15 + PostGIS 3.6.2 上执行，32 项检查通过） |
| `docs/api-design.md` | 接口设计：四组接口、通用约定、错误码、认证授权、端点清单、离线同步、中控快照、领域事件、内部端口 |
| `docs/history/` | 已被 V1.3 取代的 V1.2 文件，仅作历史追溯（见该目录 README） |
| `../brand/logo/` | Logo 源文件、导出的图标套件与预览页 |
| `CHANGELOG.md` | 文档变更记录 |

标准、数据库与接口文档以 V1.4 评审稿为依据编写，状态均为草案；与 PRD 冲突时以 PRD 为准，V1.4 冻结后按冻结版本复核。数据库选型与正式接口契约分别在 D24 选型和 R0-B 冻结。

## 项目身份

| 项目 | 值 |
| --- | --- |
| 正式名称 | DR RouteFit |
| 英文全称 | DR RouteFit — Smart Dispatch & Delivery |
| 项目代号 | `ROUTEFIT` |
| 地图基座 | Daen GeoCore（简称 GeoCore） |
| 目标仓库 | https://github.com/leishen8806/dr-routefit |
| SSH | `git@github.com:leishen8806/dr-routefit.git` |

写法规范：DR 大写、不加点号；不使用 `Dr. RouteFit`、`Dr.RouteFit` 或 `RouterFit`；DR RouteFit 与 Daen GeoCore 各自保留前缀（PRD 0.2）。

## 下一步

R0-A 需要先确定 PRD 第 19 章的待定决策，其中最关键的是：
- D02：人类集成负责人；
- D01：试点范围，在 PRD 1.4 的范围表中填写；
- D03：是否启用 S1；
- D06：收款方式。

本轮 V1.4 的新增准备是 D19～D24：合作车辆名单与窗口、快递企业及交接协议、返程约束、中控台身份/字段/时效、对客责任和应付、开源选型验证。三项范围选择已经确认，不再重复询问；具体数据仍待填写。

这些未确定前，只能做合成实验。

## 协作约定

开始任务前同步并核对 GitHub 基线；完成后提交独立分支、推送并提供完整 SHA。开发者自测不等于独立验收；未经批准不合并 `main` 或部署。

不提交真实客户资料、司机证件、生产凭据、运行配置或真实位置轨迹。


## KESS 接入与再次复核（2026-10-24）

最新增补：[KESS 支付接入 v0.1](docs/kess-payment-integration-v0.1.md)；[本轮需求复核及缺口](docs/requirements-review-kess-2026-10-24.md)。渠道已选定，当前仅沙箱适配代码及本地演示，真实商户未联调。
