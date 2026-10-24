# R1-M 原型覆盖与验证

v0.1 草案 · 2026-10-24。只记录本地交互原型证据，不代表 PRD AT 或生产验收通过。

## 实现与浏览器证据

| 单元 | 范围 | 实际验证 |
| --- | --- | --- |
| M01 | 合作方登记、准入、暂停、退出 | 浏览器登记、审核、暂停保留授权任务、退出隐藏任务通过；模型测试补到期阻断 |
| M02 | 自营、合作车、快递入口 | 浏览器方式展示、未准入禁选、取消待确认隐藏改派；模型验证实例互斥 |
| M03 | 合作司机任务 | 浏览器隔离自营任务、接单双确认、拒单重派、交接、完整与部分签收、退回点收通过 |
| M04 | 人工快递委托 | 浏览器草稿、人工联系、确认、安排交接、取消待确认与释放通过 |
| M05 | 承运保管与签收 | 浏览器逐件交接、未知／重复／迟到事件、送达报告、数量差异阻断、POD 核验通过 |
| M06 | 异常退回 | 浏览器负责人／期限、退回确认、到仓、错误件数阻断、正确点收结案通过 |
| M07 | 合作应付 | 浏览器独立应付、争议、核对、部分付款、凭证防重、冲正、重新核对及付清通过 |

MI01–MI18 已接入可操作流程。浏览器脚本包含 9 组 R1-M 检查；新增模型测试 13 项，原 R1 模型 14 项，共 27 项通过。原 browser-flow.js 的 9 组流程及 browser-ui-checks.js 的 5 组 UI 回归也通过。不是 27 项 PRD 验收。

## 状态覆盖

- 合作方：pending、available、paused、exited 由浏览器覆盖；expired 由模型覆盖，未单独模拟浏览器时间过期。
- 委托：draft、pending_confirmation、confirmed、awaiting_handover、handed_over、in_transit、delivery_reported、delivery_verified、cancel_requested、cancellation_confirmed、return_requested、returning、returned 均在浏览器流程中经过。
- 应付：pending、verified、disputed、partially_paid、paid 均在浏览器流程中经过。
- 共 23 种新增业务状态，22 种浏览器经过、1 种模型验证。全局加载／空／错误／过期／无权限／降级及离线行为由 R1 回归覆盖，不声称每种状态在每个新增页面全矩阵覆盖。
- 1280px 合作方／委托／应付工作台、390px 合作司机布局通过无整页横向溢出检查；R1 回归包含原生选择器键盘、脏表单、焦点恢复及司机文字放大检查。已查看准入、司机、承运签收、应付截图，与原型共用设计一致。
- 浏览器控制台记录为 0 error / 0 warning。strict 静态审查为 0 findings。

## 证据入口

[本轮结果与截图目录](records/2026-10-24-r1m/)；[浏览器结果 JSON](records/2026-10-24-r1m/browser-r1m-results.json)；[模型测试输出](records/2026-10-24-r1m/model-tests.txt)；[全量文档索引](RECORDS.md)。

可重跑：`node --test prototype/model.test.mjs prototype/r1m-model.test.mjs`。浏览器服务启动后，用 Playwright MCP 的 browser_run_code_unsafe 执行 browser-flow.js、browser-ui-checks.js、browser-r1m.js。脚本通过 UI 重置合成数据，会清除当前会话演示进度。

## 限制与未验证

未接真实快递、银行、身份认证、合同资格系统或通知；未做 Android 真机、完整读屏／无障碍认证、高棉语译文、生产 CI 或部署。固定合作司机 P01 与固定演示车厢参数不是正式多租户／车队架构。资金仅登记凭证，不转账。无构建、TypeScript 或 formatter 配置，使用浏览器 ES 模块与 Node 语法／测试验证。

原 PRD、规则、验收编号、四份 v0.1 标准和 Logo 资产保持原样；文件哈希比对结果另存档。当前工作目录无 Git 仓库，因此记录为本地文件归档，不声称已提交或推送。
