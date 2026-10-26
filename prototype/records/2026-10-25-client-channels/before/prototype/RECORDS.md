# 文档与验证记录索引

- [2026-10-25 KESS 文档与页面同步](records/2026-10-25-kess-pages/README.md)：开户状态、用户说明、模拟动作、手机/键盘/异常路径及最新设计截图。

2026-10-24 · R1 / R1-M 本地原型。用户要求保存全部文档记录，本索引统一连接原始依据、契约、实现和证据。

| 类别 | 位置 |
| --- | --- |
| 当前 PRD 与四份标准 | [PRD/docs](../PRD/docs/)；保持原文和 v0.1 草案状态 |
| 首期页面与 UX 规划 | [phase1-pages-and-ux.md](../PRD/docs/phase1-pages-and-ux.md) |
| R1 原始交付文档和截图快照 | [records/r1-baseline](records/r1-baseline/) |
| R1 当前契约／覆盖 | [PROTOTYPE-CONTRACT.md](PROTOTYPE-CONTRACT.md) / [COVERAGE.md](COVERAGE.md) |
| R1-M 契约／覆盖 | [R1M-CONTRACT.md](R1M-CONTRACT.md) / [R1M-COVERAGE.md](R1M-COVERAGE.md) |
| 原型使用说明与视觉映射 | [README.md](README.md) / [DESIGN.md](DESIGN.md) |
| 本轮测试、截图和一致性结果 | [records/2026-10-24-r1m](records/2026-10-24-r1m/) |
| 本轮全部 PRD/docs 来源快照 | [source-docs](records/2026-10-24-r1m/source-docs/) |
| 本轮可重现源代码／文档快照 | [prototype-source](records/2026-10-24-r1m/prototype-source/) |

记录目录保存浏览器结果、原流程回归摘要、模型原始输出、控制台日志、静态审查 JSON、7 张 R1-M 截图、源文件哈希与 PRD／品牌不变核对。此前文档不删除；当前入口更新范围说明，原始 R1 版本保留在基线目录。

仅保存本地项目记录；没有写入跨项目长期记忆，没有 Git 提交、云端上传或生产发布。截图及测试用合成业务数据。浏览器会话进度属于演示数据，重置时可清除，不等于文档归档。

司机地图首页更新与验证：[2026-10-24-driver-map](records/2026-10-24-driver-map/README.md)。

调度数据与紧急事项：[2026-10-24-dispatch](records/2026-10-24-dispatch/README.md)。

最新调度地图与 TAB 分区：[2026-10-24-dispatch-map](records/2026-10-24-dispatch-map/README.md)，替代首页瀑布流布局。

事故应急多车转运：[2026-10-24-incident](records/2026-10-24-incident/README.md)，新增用户授权范围，PRD 与数据库/API 草案未同步改写。

## 2026-10-24 仓配一体、双工作区、分成与提现

- [扩展契约与决策](WAREHOUSE-PLATFORM-CONTRACT.md)：明确用户确认的人工审核提现与按订单比例分成，保留 V1.4 基线。
- [验证与交付记录](records/2026-10-24-warehouse-platform/README.md)：模型测试、浏览器结果、页面截图、保护文件哈希核对。
- records/2026-10-24-warehouse-platform/before/ 保存本轮修改前的原型根目录文件；source/ 保存交付时源码、文档和验证脚本。旧记录目录继续保留。

## 2026-10-24 配送地址与超距计费

[配送业务细节清单](DELIVERY-DETAILS.md) / [本轮记录](records/2026-10-24-distance-pricing/README.md)。新增超距规则、区域/报价有效期阻断、客户确认与费用全链路；仍为逐单人工测距的本地原型。

## 2026-10-24 司机订单列表与问题闭环

[司机优化契约](DRIVER-ORDERS-CONTRACT.md) / [验证记录](records/2026-10-24-driver-orders/README.md)：四类订单、取消历史、离线入口保留、司机上报及调度回复。

## 2026-10-24 外部接入与多语言

- [外部接入记录](records/2026-10-24-external-integration/README.md)：接口契约、保险口径和 6 组浏览器流程。
- [三语设计记录](records/2026-10-24-multilingual/README.md)：三语设计预览、78 项测试、宽度与输入保留验证、高棉文截图。
- 原始 PRD、规则/验收编号、四份 v0.1 标准和 Logo 未修改。

## 配送区域 · 2026-10-24

[交互与规则记录](DELIVERY-AREAS-CONTRACT.md) · [测试、截图与浏览器证据](records/2026-10-24-delivery-areas/README.md)。PRD、四份标准、Logo未修改；当前仅本地原型。

## 后台账号与权限 · 2026-10-24

[账号权限规则](ACCESS-CONTROL-CONTRACT.md) · [验证与截图](records/2026-10-24-access-control/README.md)。文档为v0.1补充，不改PRD及规则/验收编号。未创建真实账号凭据或发送邀请。

## 二级页面返回 · 2026-10-24

[返回入口与6组浏览器验证](records/2026-10-24-back-navigation/README.md)：列表上下文恢复、分页/搜索保留、深链接父级回退、手机布局。

## 保险费分成核查 · 2026-10-24

[核查结果](records/2026-10-24-insurance-audit/README.md)：保险费不分成，修正确认框总额误标运费，23项定向测试通过。

## 司机任务右滑 · 2026-10-24

[交互约定](DRIVER-SLIDE-CONTRACT.md) · [验证和截图](records/2026-10-24-driver-slide/README.md)。101项测试及浏览器链路通过，未验证Android真机。
## 2026-10-24 Web / APP 规范与页面统一

- 规范：`PRD/docs/web-app-experience-standard.md`、`PRD/docs/order-state-catalog.md`。
- 记录：[`records/2026-10-24-experience/README.md`](records/2026-10-24-experience/README.md)。含页面矩阵、回归脚本、截图、自动测试与静态审计结果。

## 2026-10-24 登录、启动和强通知

三种登录页、APP 启动/首页公告、骨架加载、失败重试与强通知弹窗，详见 [`records/2026-10-24-entry/README.md`](records/2026-10-24-entry/README.md)。规范补充到 Web/APP 体验标准 §7。无真实认证、后台推送或原生构建。

## 2026-10-24 再次核对 V1.0 需求

对照用户新附件、V1.4 评审稿、后续明确需求与当前源码；完整报告见 [需求复核与差异清单](../PRD/docs/requirements-reconciliation-2026-10-24.md)，附件及装载反例见 [核查记录](records/2026-10-24-requirements-audit/README.md)。未修改业务规则或代码，未将原型测试视为正式验收。

## 2026-10-24 核心闭环展示页

录单至逐单交付、财务交款结清及只读中控，含拒绝分支和保险独立记账。记录：[闭环展示页证据](records/2026-10-24-showcase/README.md)。沿用 v0.1，未修改 PRD 正文和规则编号。

## 2026-10-24 需求增补与同单异常闭环

[需求与 Demo 更新记录](records/2026-10-24-closure-update/README.md)：112项测试，正常及异常链路浏览器验证，原报价和减免分离，返仓待检不冒充正常签收。

## 2026-10-24 财务结算与提醒增补

[实现与验证记录](records/2026-10-24-settlement/README.md)：按主体规则、自动内部待办、模拟账单/催收、部分核销、合作应付联动，含模型测试、浏览器脚本与截图。未接真实通知、银行或后台定时。


## 跨端财务闭环（2026-10-24）

入口 [finance.html](finance.html)，[设计图](finance-design.html)，[契约](FINANCE-CLOSURE-CONTRACT.md)，[验证记录](records/2026-10-24-finance-closure/README.md)。COD、独立资金事实与核销、三人审核、出款未知、差额及各端报表在新版合成切片实现。旧版提醒/付款逻辑保留供历史样例，已纳入订单禁止旧入口写入。非生产资金、认证、审计或SQL迁移证据。


## KESS 接入与再次复核（2026-10-24）

新增 [KESS、静态修正及需求复核记录](records/2026-10-24-kess-review/README.md)，包含测试、截图、历史快照修正前原件和需求差异。
