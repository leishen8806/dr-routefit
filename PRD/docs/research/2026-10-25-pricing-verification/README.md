# 计价体系调研与文档验证记录

2026-10-25。用户要求调研并完善整套快递配送计价体系。

## 交付

- [计价体系](../../delivery-pricing-system-v0.1.md)：五类产品、准入／价表、主运费、费用归属、金额顺序、分成／成本、异常补退、仓储、跨端页面及算例。
- [资料核查](../2026-10-25-delivery-pricing.md)与[sources.json](../2026-10-25-pricing-sources.json)：8项可读来源记录＋J&T集团信息、空正文站点和404限制；不以营销资料代替合同。
- [开发与验收对照](../../pricing-development-map-v0.1.md)：当前代码／机器契约缺口、待补领域和接口、28项候选验收（NOT_RUN）。
- [未启用价表模板](../../pricing/ratecard-template.json)：费率待填、enabled=false、税务未核实、审批待完成；不是现有运行时配置。
- [20个合成算例](../../pricing/calculation-examples.json)及 `scripts/check-pricing-examples.py`；假设价格不供生产使用。

## 验证与证据

- `python scripts/check-pricing-examples.py`：20个算术场景、7个非法数值校验通过，见 calculation-results.json。
- `node --test *.test.mjs`（prototype 目录）：原有164项通过，见 existing-prototype-tests.txt。只证明原有原型回归；不是新增28项业务验收通过。
- `git diff --check` 通过。修改文档相对链接、价表保持关闭、OpenAPI／运行代码及正式 PRD／SQL保留检查见 consistency.json。
- unchanged-baseline-sha256.json 记录本轮未变动的契约／运行源文件；source-sha256.json 与 source.zip 为本轮资料快照；before/ 保存维护文档修改前版本。

## 实现边界

没有修改 Demo 运行代码、HTML／CSS、现有 OpenAPI 或 SQL；没有上线统一计价引擎、真实地图测距、保险、KESS 或 Telegram。文档页面规划不代表页面已开发；未重跑本地 UI 浏览器验证，因为无 UI 改动。

公开研究中只读打开 VET 产品页以获取 JavaScript 渲染内容，未创建订单、登录或发送供应商消息。未提交／推送 GitHub、购买服务、发布正式费率或更新长期记忆。
