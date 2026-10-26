# DR RouteFit

![DR RouteFit](brand/logo/routefit-horizontal.svg)

**面向仓配一体业务的智能调度与配送平台。**

DR RouteFit is a warehouse and delivery operations platform prototype, covering dispatch, driver workflows, handover, delivery confirmation, and financial reconciliation.

本仓库包含产品需求、设计与开发标准、架构草案、品牌资产及可交互的 Web 原型。产品面向柬埔寨配送场景，围绕“货物装得下车、路线赶得上时间”组织业务流程。

> **当前状态：v0.1 本地功能原型。** 使用合成数据验证业务流程，不是已上线的配送服务。地图、定位、银行付款和外部承运服务尚未接入真实系统；原型实现不代表最终技术选型。

## 可以体验什么

| 工作区 / 能力 | 已提交原型中的内容 |
| --- | --- |
| 运营中心 | 商品与货品、仓库库存、自营车辆、司机资料、订单分成及提现审核 |
| 调度中心 | 地图示意、订单队列、异常待办、运营概览、车辆提案与人工承诺核验 |
| 自营配送 | 录单 → 确认报价与承诺 → 派单 → 司机接受 → 仓库放行 → 取货 → 配送签收 |
| 合作车辆 | 合作方准入、派单与接受、交接、签收、异常退回及合作应付 |
| 人工快递委托 | 联系承运方、确认委托、实物交接、承运事件登记、签收凭证核验 |
| 事故应急 | 按件将事故车辆货物分配给其他车辆，记录接驳与货物保管责任 |
| 财务核验 | 现金或人工转账核验、司机交款、合作应付、订单比例分成、人工审核提现 |
| 付费闪送 | 单独计费的独享配送流程，仍需核对车辆容量、客户确认与人工时限 |

运营中心与调度中心共用订单和主数据，按职责组织页面。**签收完成、客户收款核验、司机交款结清是不同状态**，不会因订单“已送达”就自动结清账务。

## 本地运行

需要 Git 和支持 ES Modules、`node:test` 的 Node.js。原型使用原生 HTML、CSS、JavaScript 与 Node.js 内置模块，无需安装 npm 依赖。

```sh
git clone https://github.com/leishen8806/dr-routefit.git
cd dr-routefit
node prototype/server.mjs
```

打开 **[http://127.0.0.1:4173/prototype/](http://127.0.0.1:4173/prototype/)**。

静态服务仅监听本机。若端口已被原型服务占用，直接打开上述地址；不要重复启动。页面需要通过 HTTP 访问，不要直接双击 `index.html`。

### 推荐走查流程

1. **调度**：新建订单，填写合成客户、货物、尺寸重量、期望时间和 USD 报价。
2. **调度**：确认客户报价与人工服务承诺，选择车辆发出提案。
3. **司机**：接受提案。
4. **仓库**：核对装载、件数和包装，登记放行依据。
5. **司机**：点收取货、出发、申报收款、记录签收。
6. **财务**：核验收款；现金配送再由司机提交交款、财务核对结清。

顶部角色切换用于原型走查，不是真实登录。通过“原型检查”可切换演示状态或重置合成数据。合作车辆、快递委托和仓配扩展的详细走查步骤见 [原型使用说明](prototype/README.md)。

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [PRD V1.4 评审稿](PRD/docs/PRD-V1.4-review.md) | 当前需求评审依据 |
| [PRD V1.3](PRD/docs/PRD-V1.3-final.md) | 前一版需求基线 |
| [首期页面与 UX](PRD/docs/phase1-pages-and-ux.md) | 各端页面、流程及交互规划 |
| [设计标准](PRD/docs/design-standards.md) | 品牌、色彩、字体与界面规范 |
| [开发标准](PRD/docs/development-standards.md) | 开发协作、契约、测试与完成定义 |
| [系统边界](PRD/docs/system-boundaries.md) | 系统职责、数据权威与写入边界 |
| [术语表](PRD/docs/glossary.md) | 业务术语及代码命名 |
| [数据库架构](PRD/docs/database-architecture.md) | 数据库设计与建表草案说明 |
| [API 设计](PRD/docs/api-design.md) | 接口分组、状态动作及集成约定 |
| [原型契约](prototype/PROTOTYPE-CONTRACT.md) | 自营配送原型范围与交互约束 |
| [R1-M 契约](prototype/R1M-CONTRACT.md) | 合作车辆与人工快递委托 |
| [仓配扩展契约](prototype/WAREHOUSE-PLATFORM-CONTRACT.md) | 库存、运力、分成与提现流程 |
| [事故应急契约](prototype/INCIDENT-CONTRACT.md) | 多车接驳与件级责任记录 |
| [验证覆盖](prototype/COVERAGE.md) / [记录索引](prototype/RECORDS.md) | 测试、浏览器验证及历史证据 |

需求、标准和架构文件应按各自标注的版本与状态阅读。设计建议、原型演示、PRD 验收和生产验证不互相替代。

## 仓库结构

```text
brand/logo/          Logo、图标与品牌预览
PRD/docs/            产品需求、标准、页面规划与架构草案
PRD/docs/database/   数据库建表草案
prototype/           可交互原型、业务模型与测试
prototype/records/   分阶段文档、截图和验证记录
```

原型入口为 `prototype/app.mjs`；核心业务模型在 `prototype/model.mjs`，合作履约、仓配与事故处理分别放在对应模块。视觉样式统一由 `prototype/app.css` 管理。

## 运行测试

在仓库根目录运行已提交的核心模型测试：

```sh
node --test prototype/model.test.mjs prototype/r1m-model.test.mjs prototype/dispatch-ui.test.mjs prototype/incident-model.test.mjs prototype/platform-model.test.mjs
```

`prototype/browser-*.js` 是供 Playwright MCP 执行的浏览器走查函数，不是可直接用 `node` 运行的测试文件。执行前需启动本地服务；部分脚本会重置演示数据。具体结果与局限以对应验证记录为准。

## 数据与实现边界

- 浏览器通过 `sessionStorage` 保存当前演示会话，刷新可保留；关闭会话后不保证持久化，重置会清除演示进度。
- 仅输入合成客户、地址和凭证，不要录入真实身份、银行账号或客户资料。
- 地图与车辆位置为示意，没有真实导航、道路里程或预测 ETA。
- 收付款操作只记录原型账务，不向银行发起转账；凭证编号不代表真实到账。
- 浏览器持有演示数据，前端角色与业务校验不构成生产认证或数据隔离。正式服务仍需服务端授权、持久化事务和审计。
- 本 README 描述仓库已提交的能力。后续功能以对应代码、契约和验证记录为准，不把规划当作已完成的生产能力。

## 反馈与协作

欢迎通过 [GitHub Issues](https://github.com/leishen8806/dr-routefit/issues) 提交问题或建议。报告原型问题时，请附上使用的工作区、角色、复现步骤、预期行为和实际结果，并使用脱敏或合成示例。

修改前先阅读相应需求与原型契约；业务状态、财务口径或系统边界发生变化时，同步更新文档与验证记录。
