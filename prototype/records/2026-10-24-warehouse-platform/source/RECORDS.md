# 文档与验证记录索引

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
