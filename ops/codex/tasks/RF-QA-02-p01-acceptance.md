# RF-QA-02 · P01 独立浏览器验收

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | test / 低 |
| 版本 | v0.3.0 |
| 执行人 | 项目负责人（非页面实现方）；Claude 做技术复核 |
| 基线 SHA | RF-PM-022–025、RF-PM-028 与 RF-PM-028-R1 全部合并后的 `develop` |
| 依赖 | RF-PM-022、RF-PM-023、RF-PM-024、RF-PM-025、RF-PM-028、RF-PM-028-R1 |
| 需人类批准 | 否 |
| 状态 | TODO |

## 背景

P01 页面由大旺实现，按分工由另一方验收。参照 [RF-QA-01 费用联调验收](../../../PRD/docs/tasks/fee-integration-qa-v0.1.md) 的方法：两个独立浏览器身份、只记录脱敏证据。

## 要做

用合成数据，从录单开始完成一条主线并记录每步证据：

1. 录单 → 登记受理依据 → 受理检查 → 提交受理。
2. 编制人提交费率策略 → 另一人复核 → 第三人发布。
3. 生成报价 → 核对明细（金额按第 8 步的固定费等价场景）→ 客户确认。
4. 已确认后申请改址 → 候选报价显示差额 → 客户确认候选。
5. 反例：区域外订单被阻断；过期或被替代报价不能确认；同一人复核被拒；跨企业读取返回 404；页面无及时送选项。
6. 若 RF-DEC-02 已签批：用 §1.4 的区域、货类和营业时间核对页面选项；未签批时记为 NOT_RUN 并说明。
7. **实跑 P01 浏览器脚本**（2026-10-27 从 RF-PM-028 并入；PR #45 中这些脚本全部 NOT_RUN）。在本机合成 PostgreSQL 与真实 Chromium 上依次执行，记录每个脚本的输出 JSON（`checks`、`allPass`）和截图：
   - `prototype/browser-order-intake-acceptance.mjs`：区域外订单被阻断、阻断项标到送货坐标并能跳转（`00-outside-area-blocker.png`）；登记依据 → 检查通过 → 提交 → validating 只读 → 退回草稿；390px 无横向溢出。
   - `prototype/browser-policy-approval-acceptance.mjs`：本人不能复核、复核人不能发布、说明为空不发请求；提交 → 复核 → 发布到 v3。
   - `prototype/browser-order-quote-acceptance.mjs`：确认时间必填；过期报价、被替代报价都不能经页面确认；生成报价 → 明细 → 客户确认。
   - 执行前设置 `CHROME_BIN`（脚本默认是 macOS 路径；Windows／Linux 须显式指定），`ROUTEFIT_EVIDENCE_DIRECTORY` 指向本次验收的证据目录。脚本失败按 FAIL 记录，附错误输出，不改脚本凑通过。
8. **固定费等价场景**（从 RF-PM-028 并入）：服务端目前只能发布固定费，用基础 $15＋独享 $3 发布策略，生成投保报价，核对页面显示配送报价 $18.00、保费 $2.00（单列，标明不计入配送分成）、总应收 $20.00，与 `GET /quotes/{id}` 逐项一致。超距费 $5 的核对见 [RF-PM-032](RF-PM-032-distance-pricing-and-change-requote.md)，本卡记 NOT_RUN 并注明原因。

## 不做

不验收付款、派单、司机执行（不在 P01）。

## 验收

每条记录：场景、提交 SHA、执行人、日期、步骤、预期/实际、PASS／FAIL／NOT_RUN、脱敏证据路径；失败项附复现步骤并指派负责人。全部 PASS 后，Claude 发 v0.3.0 发布 PR。

## 审查记录

（Claude 填写）
