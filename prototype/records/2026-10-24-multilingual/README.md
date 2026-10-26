# 三语设计验证 · 2026-10-24

规范：[MULTILINGUAL-DESIGN.md](../../MULTILINGUAL-DESIGN.md)。页面：[language-preview.html](../../language-preview.html)。仍为 v0.1 设计预览，高棉文待母语审校。

- `tests.txt`：现有业务模型、外部接口、语言字典共 78 项通过。
- `browser-results.json`：三种语言、四个分区、1280/390/360px 无页面横向溢出；切换保留输入和分组，刷新保留语言及已存草稿，金额不改变。
- `audit.json`：静态 UI 检查结果；不代替母语审校或完整可访问性测试。
- `khmer-desktop.png` / `khmer-mobile-fees.png`：浏览器截图。已目视检查手机费用页，无缺字方框或溢出；不据此确认译文质量。

完整业务原型尚未全量三语迁移；未进行 Android 真机、离线字体、读屏器、母语运营/司机验收。本记录不表示上线完成。

静态审核记录：audit.json 有9项 actionless-button 报告。检查器只识别 HTML 内联 onclick / Vue click，无法追踪独立 .mjs 中的 addEventListener。各按钮均在 language-preview.mjs 绑定事件，浏览器已覆盖分区、订单分组和查看订单动作；保留原始报告，不宣称静态零告警。
