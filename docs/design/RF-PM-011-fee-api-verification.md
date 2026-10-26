# RF-PM-011 PR-B 验证与联调

方案A已由负责人在聊天批准。本轮只交独立页 `/prototype/fees.html`，原 `index.html#pricing` 演示入口保留。费用页来源为本机数据库，演示数据没有导入数据库。无需改服务端或共享工作台；共享导航链接请对应负责人后续添加。

## 重现

Node24、PostgreSQL16。按 services/routefit/README.md 创建自己的合成库，不复制他人 .local。启动现有4180同源服务，使用已有 `npm run session:link` 在同一浏览器建立本机开发会话，然后打开 `/prototype/fees.html`。新建DR/USD草稿，配置基础运费2.00、启用并参与分成；保险比例1.25%、启用且不参与分成；保存后试算勾选两项，货值100.00。预期325/200/125美分。

代码拆分：fee-api-model负责精确DTO，fee-api-client负责同源会话与不可变pending，fee-api-ui负责DOM和对象上下文，fees.html/css提供独立入口。没有生产认证、正式收费或支付发布。

## 自动检查

```sh
node --test prototype/*.test.mjs
npm test --prefix services/routefit
ROUTEFIT_TEST_DATABASE_URL=<自己的本机合成测试库管理员URL> npm run test:integration --prefix services/routefit
ROUTEFIT_TEST_DATABASE_URL=<自己的本机合成测试库管理员URL> node --test prototype/fee-api.integration.mjs
```

PASS：原型195项（原187+新增8）、服务单测101、服务集成77、新客户端HTTP/PostgreSQL6项（父用例+5子用例）。新增integration文件需显式运行，不冒称已纳入原型CI默认glob。

HTTP测试创建并清理独立合成库，复用现有localBrowser开发激活方式，使用真实HTTP与PostgreSQL。故意在数据库成功后丢弃响应，再由同一个客户端重试，验证相同key/body/If-Match、Idempotency-Replayed=true且仅递增一次版本。故障注入发生在测试传输边界，不是伪造数据库结果。

## RF-QA-01九项

| 场景 | 结果 | 证据与边界 |
| --- | --- | --- |
| 新建/保存/刷新重开 | PASS | 真实浏览器创建ID 38c60f05-6811-4408-b5b8-120d1d7a50b6，刷新选择读回USD2.00/v2；后续版本6可读 |
| 两页同版本 | PASS | 两页v4，一页保存USD3.00/v5，另一页USD2.50收到412、输入保留，摘要获焦点；三值比较200/2.50/300 |
| 重复点击/同键重试 | PASS | 客户端pending拒绝第二业务操作；真实HTTP丢失成功响应后原键重放且版本只+1；UI同步busy禁重复 |
| 断网/结果未知 | PASS | 停本机服务后点击保存，未显示成功，保留USD3.50、禁新写；重启并重新激活同主体后原请求重试成功/v6；数据库已提交但丢响应见上一行 |
| 保险试算 | PASS | 真实页面SIMULATION v4，total325/share200/separate125/insurance125 |
| 未配置/停用/重复/非法金额 | PASS | 客户端模型拒绝缺值/重复，真实HTTP未配置、重复、停用试算422；页面3.501摘要链接金额字段，aria-invalid=true、输入保留；负数/指数/KHR精度见单测 |
| 会话/权限/跨企业 | PASS（客户端及真实HTTP） | 客户端401、只读拒写403、企业B读A草稿404且列表空。401/403/404页面分支已实现；三种浏览器画面未逐一走查，NOT_RUN，不以HTTP替代其UI证据 |
| 历史/旧快照 | PASS | 页面历史v1–v6；原trial daab3873-2503-4d3b-809d-b11376440b48回读仍为v4/325且提示当前草稿已变化；HTTP历史游标两页及快照深比较 |
| 原Demo | PASS | 原187原型测试保持，浏览器现有工作台正常，独立页清楚标原演示来源链接；未修改原Demo文件 |

## UI及审查

PASS：真实浏览器桌面渲染、未保存切换确认、继续编辑保留2.50；错误摘要获焦点；清空草稿选择后历史为空、更多历史禁用。服务响应与表单内容一律textContent/DOM构造，无innerHTML注入。CSRF仅客户端私有内存，无storage/URL/DOM写入。

独立审查发现旧快照提示未更新、清空选择遗留历史两项P2，已修复并复审通过；新增快照版本测试先FAIL后PASS。新增草稿表单也纳入离开保护。

NOT_RUN：手机390px真实视口复验。当前工具接受viewport覆盖但实测innerWidth仍1280，不能将桌面截图称为手机通过；CSS已提供700px单列规则，待可用设备补验。三语母语复核、正式认证/支付/地图均NOT_RUN（本轮无此环境/权限）。

## 待翻译

费用草稿、本机数据库、开发会话、原演示、更多草稿、适用范围、配置依据、保存此费目、放弃修改、继续编辑、放弃修改并切换、读取最新并比较、使用最新版本作为编辑基线、原已存值/我的输入/最新服务端值、按原请求重试、费用合计、配送分成基数、不参与分成费用、其中保险独立金额、当前草稿已变化、读取数据库快照及错误提示。先中文fallback，不宣称英/高棉语验收。

截图与脱敏日志交bridge/outbox/RF-PM-011-evidence/；不保存Cookie、CSRF、ticket、HAR。作者自测不替代另一负责人独立验收；待Claude审查与人类合并授权，本轮不部署。
