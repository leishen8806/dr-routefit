# 数据库录单页面交付与验证

2026-10-25 · v0.1 本地开发增量。基础Git HEAD仍为`ba9a77ec78cd20a6bf72476e9c3410d7faa9a06e`；本轮没有提交或推送本地实现。GitHub README单文件更新提交为`efe8a2cf563d34e99f8029f75cdfa85578fa5a53`，远端回读与本地README逐字节一致，提交文件清单只有README.md。

## 实际完成

运营录单页调用原有5个客户／订单接口：新建多行货物、分页列表、详情回填、编辑与数据库刷新读取。另覆盖版本冲突、输入保留、丢失响应原请求重试、会话续期、身份变化清理和离线错误。未增加API或迁移；未接通正式报价、收款、派单等后续动作。

页面：[orders.html](../../../../prototype/orders.html)；[交互契约](../../../../prototype/ORDER-ENTRY-CONTRACT.md)；[全项目顺序](../../../../PRD/docs/project-delivery-depth-v0.1.md)。真实运行需启动4180服务并建立开发会话，直接打开HTML不是验收方式。

## 证据

| 检查 | 结果与来源 |
|---|---|
| 原型及新增HTTP客户端单测 | [unit.txt](unit.txt)：177通过，含新增4项丢失响应、同身份续期、跨身份保护和版本冲突测试 |
| 原有服务回归 | [service-tests.txt](service-tests.txt)：37通过；真实本机PostgreSQL16.15，运行角色经过RLS |
| 真实浏览器 | [browser-result.json](browser-result.json)：26项通过，0 JavaScript错误；1440桌面、390窄屏、减少动态效果 |
| 浏览器关键证据 | POST201落库，刷新回读；另一请求更新后PATCH412；断开已提交响应后复用相同键／请求体，返回原订单与重放头；同身份重连继续，另一企业不见原单 |
| UI状态 | 加载、空数据提示、字段焦点、Escape保留输入、原生select键盘、游标前后翻页、离线失败、窄屏不横向溢出；空数据和加载延迟由明确的响应注入验证，其余写入使用真实本机API |
| 静态UI审查 | [ui-audit.json](ui-audit.json)：strict 0错误／0警告；脚本绑定前按钮默认禁用 |
| 机器契约 | [contract-validation.json](contract-validation.json)：188路径／211操作／202 schema／415样例／23操作样例通过 |
| 公共文件保护 | [protected-files.json](protected-files.json)：相对前一快照检查共享入口、费用模块、正式PRD和验收映射、既有迁移未变 |
| 视觉 | [桌面](desktop.png)、[窄屏货物表单](mobile.png)；已人工查看，沿用品牌／表单／颜色与toast，不新建主题 |

浏览器脚本为`prototype/browser-order-entry.js`；其中3个激活链接占位符在执行时注入60秒本机票据，实际票据、Cookie、CSRF与连接字符串不写入证据。合成测试产生草稿，未创建真实客户、订单收付款或外部消息。

发现并修正：校验发生在fieldset禁用后导致首错无法聚焦；校验现先执行，异步错误待控件恢复后聚焦。编辑时间只展示到分钟，但未改变时保留原始秒数；浏览器检查确认未截断。未知结果只允许原请求重试，不复制新单。

## 交接及未验证边界

最新包以仓库本机`handoff/latest.json`的snapshotId为准，包校验与恢复结果记录在`handoff/restore-result.json`；两者必须指向同一快照才算本次恢复证据。包不含.git、node_modules、.local或真实凭据。

作者自测已完成，尚未取得大旺独立验收；未验证真实iOS／Android设备、生产身份、KESS、WMS或地图接入。未做完整200%缩放与跨浏览器矩阵。当前DESIGN.md是既有Markdown映射，本轮未改变它或全局token，也未迁移为新的设计工具格式。仅中文联调页，不宣称完成三语本地化。

待重试请求仅驻留当前页内存；关闭页面后需先查询再决定是否重建，不提供跨设备离线事务队列。完整P01仍待正式报价与跨端接线。
