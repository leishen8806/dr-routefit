# RF-PM-011 · RF-UX-01 费用页接线设计稿

状态：PR-A，待负责人确认设计；不是已接通API的交付。基线main `5d766885c7a53035fa55128f06dabf478b451f41`。只新增设计文件，不改共享入口、契约、业务或迁移。

依据：[首批任务](../../PRD/docs/tasks/first-sprint-fee-integration-v0.1.md)、[开发分工](../../PRD/docs/development-responsibilities-v0.1.md)、[设计标准](../../PRD/docs/design-standards.md)、[体验规范](../../PRD/docs/web-app-experience-standard.md)、[费用接口](../../contracts/pricing-api.md)、[机器契约](../../contracts/openapi.json)。接口文档开头历史17/215数字过时，本设计仅使用8个pricing操作定义，不据旧总数判断现状。

## 方案与文件边界

| 方案 | 结果与代价 |
| --- | --- |
| A · 独立真实API费用页面（建议） | `prototype/fees.html`、独立样式、fee-api-client/model/ui与测试；通过现有4180同源静态服务和/dev/session接入，保留原index.html#pricing演示链接；不需要改app.mjs/app.css/server.mjs。先用直接地址联调，共享导航新增链接请对应负责人处理。 |
| B · 直接替换共享工作台费目面板 | 复用fee-settings-ui，但须协调app.mjs/platform-ui.mjs入口与全局状态，较容易混淆sessionStorage演示和数据库；需先登记共享文件变更并获得对应负责人处理。 |

待确认：选择A或B。以下为A的完整建议设计。费用草稿编辑、幂等与错误规则两方案相同。PR-B基于确认方案实施；当前静态设计稿不发网络请求、不保存任何配置。预览：[状态设计板](RF-PM-011-fee-api-states.html)。

## 页面流程与布局

```text
来源标记：本机数据库 / 开发会话    [返回原演示：浏览器会话]
  ↓ GET /dev/session → 目录 → 草稿第一页
草稿栏：[DR/VET/ZTO/CE/JT] [USD/KHR] [选择草稿] [新建] [更多草稿]
  ↓ 选中后读取tariff及独立ETag
页签：费目设置 | 服务端试算 | 配置历史 | 持久快照回读
  ↓ 单项编辑（本地未保存；原已存版本保持显示）
保存 → 锁定按钮与编辑 → 收到成功响应 → 替换已存版本、清除dirty
  ├ 超时/断网/结果未知 → 保留原操作待核实，仅原键原body原版本重试
  ├ 412 → 左侧我的输入 / 右侧最新服务端版本；刷新不会覆盖输入
  └ 422 → 字段错误、焦点首错；修正后构成新业务操作
```

桌面：草稿栏、19费目分组列表、右侧当前费目；移动390px：依次堆叠，金额16px输入、48px触控目标，不横向挤压高棉文字。品牌、深蓝/青绿/橙色及8px圆角沿用标准，不重做整站。

数据来源在页首常驻，显示草稿名、费用对象、币种、版本、最近读取时间。没有会话不显示“已连接”，读取失败不回退sessionStorage。新草稿状态DRAFT与试算SIMULATION保持区分。固定费为0只能由用户明确填写，空字符串显示“未配置”，不猜测正式费率。

## 目录、字段与按钮

以GET catalog响应作为允许的费目、单位、锁定与分成规则来源；本地名称仅作为展示fallback，不把现有演示配置导入数据库。

19费目：base基础运费、weight续重、distance超距、flash独享闪送；pickup取件、door上门、remote偏远、handling搬运、stairs上楼、waiting等待、redelivery二次配送、return退回、cancel取消；cod服务费、insurance保险；storage仓储、inbound入库、outbound出库、packing包装。按transport/service/funds/warehouse分组，禁用/未配置分别标明。

| 控件 | 输入与行为 |
| --- | --- |
| 新建草稿 | owner、currency、name、scope必填，服务端创建成功后才加入数据库列表，保留失败输入；无写权限时禁用并解释 |
| 费目编辑 | code只读；enabled显式开关；method按目录允许；scope/evidence必填；不预填正式费率 |
| fixed | amount按币种输入；unit=null，includedMilli=0，stepMilli=1000由适配层按契约明确设置，不来自缺失用户金额 |
| unit | 选择目录允许单位，amount币种金额、included数量、step数量；步长>0，数量最多3位小数 |
| percent | 仅insurance/cod；UI输入百分比字符串，精确转换到基点，最多2位小数、0–100%；明确是货值/COD本金基数 |
| 配送分成 | 仅DR且catalog允许项可勾选；保险、COD服务费、仓储作业及所有采购对象强制排除，不把shareMinor称为司机收入 |
| 保存 | dirty且前置校验通过、有pricing:write、会话有效、无pending时可用；提交中禁重复点击；成功提示“数据库已保存 · vN” |
| 试算 | 显式选择已保存且启用费目；未保存编辑先提示保存或放弃，不能悄悄用未保存值算；无pricing:read禁用 |
| 历史 | 按nextAfterVersion追加分页，不修改已存历史；同一历史游标不重复请求 |
| 快照回读 | 展示创建返回的trialId，可重新GET该ID；快照内容绑定tariffVersion，后续编辑只提示“当前草稿已变” |

所有数值从十进制字符串拆分、补位并以BigInt生成整数；检查0..9000000000000后转换JSON整数。USD两位、KHR零位、数量三位、比例两位；拒绝负数、指数、NaN、Infinity、多余精度、空值、超界，不以浮点乘100。保持不同币种独立，不能自动换汇。

## 全部界面状态

| 状态 | 用户可见内容 | 可操作行为与输入保留 |
| --- | --- | --- |
| 加载 | 骨架+正在读取本机数据库，不展示旧Demo金额 | 禁保存/试算；保留已有编辑但标“尚未更新” |
| 空白 | 本企业尚无草稿；新建与原演示分别入口 | 不自动创建、不用0伪装配置 |
| 正常已读取 | 明示草稿版本与来源；费目未配置与停用分开 | 有权者编辑；只读者可查看/试算 |
| 未保存 | 常驻“有未保存修改” | 切换草稿/币种/离开提供继续编辑、放弃切换；不静默丢输入 |
| 保存中 | 按钮“保存中…”与状态live region | 锁同一动作，双击不建第二请求；不先显示成功 |
| 401 | 会话已失效，需重新激活本机开发会话 | 保留输入但冻结写入；重连身份变化时不自动重放旧主体请求 |
| 403 | 无此操作权限 | 不显示他人数据，不自动换角色；保留本人的草稿输入待联系管理员 |
| 404 | 对象不可用或已无访问权限 | 不透露是否属于其他企业；保留未发送编辑，返回草稿选择 |
| 412 | 服务端版本已变，显示我的输入与最新版本 | 保留输入，允许另读最新；人工比较后重新编辑，不能盲目覆盖 |
| 422 | 按error.code和fields[].path列出字段原因 | aria-invalid、aria-describedby、焦点首错；不解析中文message推测状态 |
| 断网/未知 | 未确认保存结果；保持操作待核实 | 原键/原body/原If-Match重试，不换键重复创建；不显示已保存 |

还需处理400 INVALID_JSON、409 IDEMPOTENCY_KEY_REUSED/REQUEST_IN_PROGRESS、428前置条件缺失、429及5xx，作为稳定code分支；无法识别时显示通用错误及requestId，不把未知错误当成功。

## 请求与状态管理约定

会话来自GET /dev/session；Cookie由浏览器same-origin携带，csrfToken只在调用层内存，不写URL、local/sessionStorage、DOM、测试截图或报告。开发激活链接使用现有session:link，不设计第二套登录。前端角色下拉框不能改变服务端权限。

每个新业务动作生成一次UUID键；pending包含主体指纹(companyId/principalId)、path、序列化body、If-Match及key。未知结果保留pending；仅同主体可原样重试。若会话主体变化，提示重新评估编辑并丢弃旧主体pending，不能自动以新主体提交。确认成功后再更新价表与ETag。409同键不同内容不能静默换键；412是已知失败，保留编辑并让用户比较，新的确认修改才新建动作。

异步切换草稿使用序号/AbortController丢弃过期读取响应；保存中禁止切换。读取历史/快照以对象ID和游标隔离，不用全局页面版本取代tariffVersion。试算201不增加草稿版本，GET trial没有可编辑独立版本。

成功试算展示：SIMULATION、currency、tariffId/tariffVersion、逐费目basis/quantity/units/amountMinor、totalMinor、shareMinor、separateMinor、insuranceMinor；保险是独立费用的子集，不能重复相加。例：base200+10000×125bp=325；share200、insurance125、separate125。明确“不是正式收费、分成批准或司机已得收入”。

## 验收清单与当前证据边界

PR-A只有设计板与规则：静态渲染/链接可检查；以下9项真实接线验收当前全部NOT_RUN，待PR-B真实本机服务与合成库逐条执行，作者自测不替代对方验收。

1. 新建/保存/刷新/重新打开：同一数据库ID、金额、版本。
2. 两页同版本：一个成功、另一个412，失败页输入保留。
3. 双击/同键重试：一次变化，识别Idempotency-Replayed。
4. 断网未知：未显示保存成功、保留输入、原请求重试或查询核实。
5. 保险200+10000×125bp=325，分成200，保险125。
6. 未配置/停用/重复费目/非法金额拒绝，无错误快照。
7. 会话/权限/跨企业：401/403/404按契约，不泄露其他企业。
8. 保存后改草稿：历史版本与既有trial内容不变。
9. 原Demo入口与回归测试保持，两个来源不混淆。

PR-B前端测试还须覆盖精确换算边界、pending原样重试、身份变化、过期读取响应、错误code字段映射和双击抑制；Mock只能证明客户端行为，不替代真实数据库按钮走查。

## 接口核对与需要负责人处理的事项

现有8操作已覆盖目录、草稿列表/创建/读取/单项保存、试算创建/读取、历史。没有发现必须新增契约才能完成本轮的缺字段；实际联调若暴露缺口先登记，不修改contracts/services。

共享工作台入口需要对应负责人增加到fees.html的明确“本机数据库费用设置”链接；本卡先用直接4180地址，不自行修改app.mjs/app.css/server.mjs。若选择方案B，需要负责人明确共享文件修改边界。正式认证、真实费率/支付、订单计价发布均不在本轮。

## 待翻译文案

本机数据库、开发会话、原演示（浏览器会话）、有未保存修改、保存中、结果未知、按原请求重试、比较服务端版本、重新激活会话、无此操作权限、对象不可用、数据库已保存、试算非正式收费、配送分成基数、保险独立金额、草稿已变更、返回草稿选择。先中文fallback，英/高棉语为待翻译与母语复核，不能宣称三语已验收。
