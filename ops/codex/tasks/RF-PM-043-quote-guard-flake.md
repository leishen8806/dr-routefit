# RF-PM-043 · 报价脚本“未发布策略守卫”间歇性超时

状态：已合并（PR [#75](https://github.com/leishen8806/dr-routefit/pull/75) → `faa6a2c`，2026-10-30 11:33）· 分支：`fix/RF-PM-043-quote-guard-flake` · 批准 head `bee9c87`

## 交付范围

- 读取费率策略失败时，页面必须显示明确错误并阻止生成报价，不得把 `null` 当作可提交状态。
- 浏览器验收脚本保存策略读取／报价生成请求状态；失败时保存通知、守卫文字与截图。
- 过期报价验收使用报价返回的 `expiresAt` 确定等待条件，不依赖固定 sleep。
- 补页面策略读取失败单测，并用合成测试库连续运行脚本 20 次。

## 交付证据

- 修复提交后附 PR 描述：页面守卫、诊断信息、20/20 PASS、3 次 JSON 证据与 CI 五项结果。
- 只使用本机合成数据；不提交 `.local/`、数据库凭据或 `node_modules/`。
- 修复前基线与不重启 20 次的汇总证据位于 `services/routefit/verification/rf043/`。
- 第 3 轮：补回 `policyPrecheckFailure` import 与列表读取失败手填兜底测试；403/404 预检放行并由服务端判定，401/429/5xx/网络错误继续阻断；RF-QA-02 固定运行配置为 `ROUTEFIT_DEV_RATE_LIMIT=1000`。

## 审查记录

### 2026-10-30 · 负责人侧 Claude 审查

- 09:43 `ad68e87`：CHANGES_REQUESTED。`orders.mjs` 删了 `policyPrecheckFailure` 的 import 但仍在使用，列表读取失败会让页面报错；403/404 改为阻断，与 RF-PM-037 第 3 项冲突；缺修复前复现数据。
- 10:15 `559c750`：CHANGES_REQUESTED。根因已查清：修复前同一服务进程连跑 20 次失败 17 次，探针 130 次请求中 10 次返回 429，是每主体每分钟 120 次的固定窗口限流。但上一轮两项未处理，修复后的 20/20 是在 `ROUTEFIT_DEV_RATE_LIMIT=1000` 下得到的。
- 10:50 `8177f32`：三项均已改好（import 补回、403/404 恢复 RF-PM-037 行为、验收结论限定在 `ROUTEFIT_DEV_RATE_LIMIT=1000`），代码可批准；当时与 develop 冲突，CI 未运行。
- `bee9c87`：同步 develop、解决看板冲突，除看板外与 `8177f32` 逐字一致；CI 五项 SUCCESS。负责人与 leishen8806 批准后，11:33 合并，合并 head 即批准的 `bee9c87`。

claude-bridge 曾在 `559c750` 上给出 APPROVED 并发出合并指令，未看到负责人审查，之后撤回。

后续：RF-QA-02 第 7 步报价脚本按 `ROUTEFIT_DEV_RATE_LIMIT=1000` 重跑 3 次，结果补入复验报告。
