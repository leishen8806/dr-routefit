# 自营配送功能原型契约

v0.1 草案 · 2026-10-24。依据 PRD V1.4 评审稿、四份标准及 phase1-pages-and-ux.md；冲突以 PRD 为准，冻结后复核。本文件定义自营 R1 切片；后续 R1-M 扩展由 [R1M-CONTRACT.md](R1M-CONTRACT.md) 定义，不声称覆盖全量 PRD 或 R1-V。

## Persona

调度创建、编辑草稿、确认人工承诺、派单、撤回、取消、授权退回；司机仅见分配给演示司机的任务，可接受／拒绝、确认取货、出发、申报收款、记录签收、执行退回；仓库复核装载、备货交接、退回点收；财务核验申报与司机交款。角色切换仅原型工具，所有操作仍由 mock service 校验角色和状态。

## User Flow

草稿 → 客户确认报价与人工承诺 → 待派 → 提案 → 司机接受 → 仓库装载核验及交接准备 → 司机点收 → 出发 → 收款申报 → 签收 → 财务核验及现金交款。

拒单／提案过期返回待派；超载阻断装载；部分签收保留待退件，调度授权退回后仓库点收，异常履约结案与财务分开。转账申报须财务核验才可交付；现金现场申报可按演示现金策略交付，不等于财务结清。演示不调用实际银行或地图。

## Screen Inventory

| ID | 视图 | 内容 |
| --- | --- | --- |
| S01 | 调度工作台／订单列表 | 搜索、筛选、分页、汇总、订单选择、路线示意 |
| S02 | 订单详情 | 三类时间、逐件货物、财务与履约、行动面板、时间线 |
| S03 | 录单／编辑对话框 | 地址、货物、件数、尺寸、重量、期望时间、收款方式、报价；字段校验 |
| S04 | 承诺／派单对话框 | 客户确认、人工依据、有效运力、提案 |
| S05 | 司机工作台 | 授权任务、接单、取货、出发、收款、签收、待同步 |
| S06 | 仓库工作台 | 逐项装载核验、交接准备、回仓点收 |
| S07 | 财务工作台 | 申报凭证、实收核验、差额、现金交款 |
| S08 | 业务确认／证据对话框 | 拒绝、撤回、取消、收款、签收、核验、退回与重置 |
| S09 | 原型导航与状态检查 | 四角色跳转、重置、状态注入与提案过期 |

## Interaction Matrix

| ID | 动作 | 数据结果与去向 |
| --- | --- | --- |
| I01 | 角色／导航切换 | 更新工作台与动作权限，共用订单状态 |
| I02 | 搜索／清空／状态筛选／分页 | 更新有界数据集；返回保留选择 |
| I03 | 新建 | 校验后新增草稿，进入详情 |
| I04 | 编辑草稿 | 保留 ID，更新版本及事件 |
| I05 | 确认承诺 | 客户确认及依据齐全，进入待派 |
| I06 | 发派单提案 | 锁定本系统演示运力，进入待确认 |
| I07 | 司机接受／拒绝 | 接受进入待取货；拒绝返回待派 |
| I08 | 撤回／过期 | 释放运力，保留原承诺 |
| I09 | 取消取货前订单 | 释放运力，保留历史 |
| I10 | 装载复核与交接准备 | 硬约束校验，逐项确认后允许司机点收 |
| I11 | 司机取货／出发 | 保管方转司机，再进入在途 |
| I12 | 收款申报 | 分方式记录 reported，不能司机核验 |
| I13 | 全部／部分签收 | 全部 delivered；部分 return_open 并保留待退件 |
| I14 | 财务核验／差额 | verified 或 mismatch，留核对依据 |
| I15 | 司机交款与财务确认 | submitted → reconciled；与履约独立 |
| I16 | 授权退回／司机返仓／仓库点收 | 件数一致才 closed_exception，差异保留 |
| I17 | 离线证据排队／同步 | 原事件 ID 重放，服务校验后应用或标失败 |
| I18 | 确认对话框关闭／返回 | 不变更业务，恢复焦点；脏表单离开须确认 |
| I19 | 状态检查／重试／重置 | 演示环境状态或恢复合成数据，不影响实际系统 |

## State Matrix

界面 12 类：正常、加载、空、搜索无结果、错误、不可用、过期、降级、无权限、离线、校验失败、提交中。状态检查可注入前述读状态；真实交互产生校验失败和提交中。业务态 11 类：draft、awaiting_dispatch、offered、accepted、ready、picked_up、in_transit、delivered、return_open、closed_exception、cancelled；这些是原型步骤，不能代替 PRD 独立状态机。collection：due/reported/verified/mismatch；remittance：open/submitted/reconciled。禁止以 delivered 同时代表核账或交款。

## Component Map

AppShell → Sidebar / PrototypeToolbar / Toast / StatusPanel。
Workspace → Metrics / OrderList / Detail / RouteDiagram / ActionPanel / Timeline。
Dialog → shared field helper / native select / validation / explicit confirmation。
DriverWorkspace 复用 badges、fields、buttons 和 service；单列移动布局。

原型无现有 UI 组件可复用。视觉权威为 ../PRD/docs/design-standards.md，行为权威为 ../PRD/docs/phase1-pages-and-ux.md §5。app.css 唯一运行时 token 映射。原生 select 接受操作系统弹层；日期时间使用带明确标签的原生输入（原型评审中文，时间按金边解释）。表单统一 novalidate，由应用显示关联错误；dialog 为原生语义模态、提供退出与焦点恢复；无多选表格，无批量写操作。

## Design direction

DESIGN_VARIANCE=3，MOTION_INTENSITY=2，VISUAL_DENSITY=6。以配送作业单、承诺时钟和交接链为视觉核心；深蓝窄侧栏、白色工作面、紧凑表格与有呼吸感的详情，路线仅为明确标识的示意。原 Logo 原样引用，品牌橙色不代替警告色。Inter／系统回退；不运行时下载字体；高棉语译文与字体包不在本轮完成范围。

## Validation

### Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Select/Listbox | 原生 select / openAction | 本契约 | 系统弹层 | 键盘选择及浏览器流程 |
| Date | field / datetime-local | 金边时间的 PRD 约定 | 原生输入 | 输入及格式化检查 |
| Form | field / submit / model.validateInput | 本契约与 PRD | 新建、编辑、核验 | 必填、错误恢复、服务拒绝 |
| Scrollbar | app.css 全局样式 | 设计标准 | 表格局部溢出 | 1280/390px 检查 |
| Toast | toast | 本契约 | 操作确认 | aria-live，持久错误另呈现 |
| CRUD | apply / openAction / orderTable | PRD 与本契约 | 草稿创建编辑、取消不删除 | 浏览器全流程与模型测试 |

必须以浏览器完成新建／编辑／承诺／派单／司机接受／仓库复核／司机取货出发／收款签收／财务核验与交款。另验拒单、超载、部分签收退回、离线队列、搜索无结果及窄屏。Node 内置测试覆盖角色、过期、版本、幂等、超载、财务和保管状态约束。PRD 全套 AT 仍为 NOT_RUN，原型检查另记，不冒充生产验收。
