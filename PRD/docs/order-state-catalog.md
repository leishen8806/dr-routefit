# 订单状态目录 v0.1（草案）

依据 V1.4 §6.1–6.3，冲突以 PRD 为准。保持原规则和验收编号。此次“重新定义”是统一语义和页面投影，不另造与 PRD 冲突的状态机，也不迁移数据库。

| 维度 | 状态与含义 | 页面要求 |
|---|---|---|
| 订单意向 | draft 草稿；validating 核验中；quoted 已报价；awaiting_dispatch 已承诺待派；executing 履约中；delivered 已签收；cancelled 已取消；return_open 退回中；returned 已退回；closed_exception 异常结案 | 已报价不等于已承诺；终态不等于账务关闭 |
| 车辆指派 | offered 待接受；accepted 已接受；completed 执行完成；expired 已过期；rejected 已拒绝；revoked 已撤回；superseded 被替代 | 提案失效释放预留，原承诺不重置 |
| 履约阶段 | pickup_pending 待取货；picked_up 已取货；in_transit 配送中；delivery_recorded 签收已记录 | 件数与交接凭证驱动，不能随意切换 |
| 退回任务 | requested / authorized / assigned / picked_up / received / inspected / closed | 途中持货继续占容量，逐件去向明确才结案 |
| 收款 | due 待收；reported 已申报待核验；verified 已核验；mismatch 差异待核；voided_by_correction 更正作废 | 银行截图只是申报，核销交易唯一 |
| 交款 | open 待交款；submitted 已交待核；verified 已核；discrepancy 差异；reconciled 已结清 | 仅现金需交款；转账显示不适用 |
| 快递委托 | 使用现有 booking 状态；承运签收上报与内部核验分开 | 不伪造车辆指派状态 |
| 异常 | 原因、责任人、阻断动作、期限、证据、处理结果 | 事故、超时是独立风险，不替代订单/收款状态 |

## 原型兼容映射

当前持久化原型复合 status 暂不改代码值：draft→草稿待核验；awaiting_dispatch→待派单；offered→待司机确认（订单仍待派）；accepted→履约中/待装载复核；ready→履约中/待取货；picked_up→履约中/已取货；in_transit→履约中/配送中；delivered→已签收（财务另核）；return_open→退回处理中；closed_exception→异常已结案（非正常签收）；cancelled→已取消。incident_open/rescue_waiting/rescue_accepted 仅为现有事故原型兼容阶段，目标模型应使用异常+接驳指派。

完整后端应按 PRD 分实体持久化；本轮不宣称已实现 validating、quoted、returned 等独立动作，不用界面标签冒充数据库迁移。订单详情同时显示履约、实物保管、收款、交款、快递核验。未知代码显示“状态待核实”，不能默认为已完成。

## 流程与防误操作

草稿 → 校对报价/承诺 → 待派 → 提案 → 指定司机在线接受 → 仓库放行 → 点收取货 → 出发 → 实收件数与签收凭证。收款核验和现金交款沿独立支线推进。部分收货 → 持货退回 → 授权 → 返仓 → 实物点收 → 异常结案。事故转运保留每件货去向，不能直接结束旧车保管。

司机“已超时/配送中/已完成/已取消”为互斥查询分组，超时由承诺时间派生，不写回订单状态；“已完成”包括正常签收和异常结案，卡片必须标明区别及未结账务。已取消仍保留费用和审计。客户只见自己的申请与配送进度，不见内部交款账及其他订单。

所有状态变化走现有动作、权限、版本及幂等校验。查看详情、返回、标消息已读、试听声音、图片预览、切换查询分组均不改变业务状态。离线只允许现有授权证据队列，接单必须在线。保险独立记账，不参与配送分成；退费不是删除原收款。

## 后续闭环状态增补

来源：[执行规划](future-closure-plan-v0.1.md) F01–F08。以下为目标候选状态，尚未写入 SQL/OpenAPI 或迁移当前原型。不能将展示页 fee_review 等流程步骤直接当作全平台订单状态。

| 领域对象 | 候选流转 | 关键限制 |
|---|---|---|
| 件级交付事实 | 未交付 → 部分/全部实收记录 | 已实收不能因退回其他件而撤销；剩余件继续有保管方 |
| 退回/检验 | 授权 → 执行 → 到仓 → 点收/差异 → 待检 → 处置 → 实物结案 | 到仓不转保管；差异不伪装点收；实物结案不关闭财务案件 |
| 费用裁定 | draft → submitted → approved / rejected → applied | 审批与生效留版本及责任人；原报价/收款不改写 |
| 退款任务 | requested → approved → processing → succeeded / failed / unknown；审批前可 rejected / cancelled | unknown 保留可退额预留，先查询再决定；失败重试不新建另一笔业务退款 |
| 提现任务 | requested → reserved → approved → processing → paid / failed / unknown | 拒绝/获准取消才释放预留；未知保持冻结，已付款不重放 |
| 收入账项 | pending / available / held / paid；另记 reversal 或待处理调整 | 不是允许任意互相切换的枚举；每次动作生成账项及余额投影 |
| 通知投递 | queued → sent / failed；另有 read/acknowledged | 已读与确认收到不改变异常、承诺或资金状态 |

订单列表的“已完成”必须区分正常交付、部分交付后退回、异常结案，并显示未结账务。退款任务成功不自动将订单改为 cancelled；客户申请取消也不撤销已交付事实。


## 财务状态拆分补充（目标，未迁移）

采用[财务闭环设计 §5](financial-closure-design-v0.1.md)的独立维度：收款证据申报／确认／差异；应收核销未结／部分／全额；司机保管待交／部分点收／已点收／差额；付款审批、执行、银行核对、应付核销分别流转。审批通过不等于出款，执行登记不等于到账，到账不等于已分配。

正常部分付款显示“部分核销”，不得用 mismatch 冒充；真实证据差额另列。unknown 保留预留、查询原指令，不能新发付款。撤销分配恢复未结和按原到期日的提醒，不删除真实资金。现有 Demo 尚未迁移这些状态；旧测试只对应旧契约。


## 跨端财务同步更新（2026-10-24）

新版 finance-ledger.mjs 已在合成订单实现 draft→submitted→reviewed→approved，付款再经 processing／unknown／failed／confirmed→posted，其他核销及调整审批后 posted；旧订单字段仅为投影，partial 不作 mismatch。已点收事实与审核批次分开，未审现金不可付款。

以[跨端需求与报表 v0.1](cross-end-finance-and-reports-v0.1.md)为最新增补，保持本文草案状态；此前未实现／待确认描述为历史阶段记录，本次实现边界和证据以新专项为准。
