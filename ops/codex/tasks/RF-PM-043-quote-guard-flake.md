# RF-PM-043 · 报价脚本“未发布策略守卫”间歇性超时

状态：IN_REVIEW · 分支：`fix/RF-PM-043-quote-guard-flake` · PR：[PR #75](https://github.com/leishen8806/dr-routefit/pull/75) · head `03d79e9e4839f9f1d98c1b029939dc341bb25252`

## 交付范围

- 读取费率策略失败时，页面必须显示明确错误并阻止生成报价，不得把 `null` 当作可提交状态。
- 浏览器验收脚本保存策略读取／报价生成请求状态；失败时保存通知、守卫文字与截图。
- 过期报价验收使用报价返回的 `expiresAt` 确定等待条件，不依赖固定 sleep。
- 补页面策略读取失败单测，并用合成测试库连续运行脚本 20 次。

## 交付证据

- 修复提交后附 PR 描述：页面守卫、诊断信息、20/20 PASS、3 次 JSON 证据与 CI 五项结果。
- 只使用本机合成数据；不提交 `.local/`、数据库凭据或 `node_modules/`。
- 修复前基线与不重启 20 次的汇总证据位于 `services/routefit/verification/rf043/`。

## 审查记录

待 Claude 审查固定提交 SHA；PR 保持 Draft，未经合并指令不得合并。
