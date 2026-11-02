# RF-PM-033-R1 · P01 验收脚本空检查修复 + #57 缺失测试

状态：已合并（PR #69 → `e083202`，2026-10-29 13:00；基线 develop `5dd595c`）
来源：项目负责人 10-29 09:23 指令（原文如下）
截止：10-31 合并　基线：R2 合并后的 develop HEAD

```text
任务：RF-PM-033-R1，处理 PR #54 合并后遗留的 4 项和 PR #57 缺的测试。R2（#68）合并后再开始，10-31 前合并。
分支 fix/RF-PM-033-R1-acceptance-checks，提交信息以 RF-PM-033-R1 开头，PR 指向 develop。
依据：ops/codex/tasks/RF-PM-033-p01-post-merge-rework.md“审查记录”中 2026-10-28 那一条。

1. 策略脚本 prototype/browser-policy-approval-acceptance.mjs：
   “复核说明为空不发请求”“发布说明为空不发请求”两项不能写死为 true。
   改为统计点击后对应请求数为 0，并断言说明框 aria-invalid 或状态未变。
2. 角色提醒脚本：删掉 noticeCount>=0 这类恒真断言和近乎恒真的徽标检查；
   断言运营角色看到全部提醒、映射外角色（如客户）看到空列表；默认端口改为 4180。
3. 把“已确认报价普通重报被拒”拆成独立命名的 t.test 集成测试。
4. app.css 新增的 .driver-mode .topbar{display:flex} 不在范围内：在 PR 描述里说明原因，或撤回。
5. 补 #57 的测试：网络重放后重新 GET 报价，页面以服务端结果为准。

验证：改过的浏览器脚本各连跑 3 次全部 PASS，附输出 JSON；CI 全绿；PR 描述按 PASS/FAIL/NOT_RUN 写证据。
不改与上述无关的代码。等 Claude 审查通过后再合并，不要自己合并。
```

通道补充：先写 `outbox/ACK-RF-PM-033-R1.md` 再开始；完成写 `outbox/RF-PM-033-R1-report.md`。PR 保持 Draft，合并按 MERGE 指令。只用合成数据。

### 交付 · 2026-10-29

- 浏览器策略验收改为统计空理由点击后的 POST=0，并断言 `aria-invalid=true`；角色提醒验收改用 4180，验证运营/司机的全量提醒集合与客户空列表，移除恒真断言。
- 把“已确认报价普通重报被拒”拆成独立命名的 PostgreSQL 集成测试；补网络幂等重放后重新 GET 报价并由页面展示服务端结果的浏览器覆盖。
- 撤回范围外的 `.driver-mode .topbar { display:flex }` CSS 变更。
- 本地 `node --check` PASS；原型定向测试 29/29 PASS；服务定向单测 127/127 PASS；CI run `40814802809` 五项 SUCCESS。
- 本地真实 PostgreSQL 集成与浏览器三连跑 **NOT_RUN**：本工作树没有 `ROUTEFIT_TEST_DATABASE_URL`，且本机 4180 服务未启动。
- 分支 `fix/RF-PM-033-R1-acceptance-checks`，提交 `68687eda5f72d1aa3980092feefe48727ac89da4`，Draft PR #69，状态 IN_REVIEW；未合并。

### 第 2 轮交付 · 2026-10-29 · IN_REVIEW

- 新提交：`3136ab0600cd64a3278aa8e0ad6262011e6a9f80`；Draft PR #69 保持草稿。
- 三个浏览器脚本各真实运行 3 次，9 份 JSON：`services/routefit/verification/rf033r1/policy-{1,2,3}.json`、`roles-{1,2,3}.json`、`quote-{1,2,3}.json`。
- policy：每次 11 checks PASS；roles：每次 33 checks PASS；quote：每次 11 checks PASS。
- 角色提醒按 `dispatch-ui` 数据源逐角色比对条数和 ID；quote 重放后页面总应收与服务端 GET 的 `total.amountMinor` 比对；补齐确认后普通重报价锁定的不变断言；修复订单页读取顶层 `quoteId`。
- `npm test`：127/127 PASS；CI run `40816198270` 五项 SUCCESS。
- 一次性数据库已删除；未合并、未部署。

### 第 3 轮小改交付 · 2026-10-29 · IN_REVIEW

- 新提交：`8d438da7809e9b319fe23ada86a8b899178de77d`。
- 独立普通重报价测试改用顶层 `beforeOrder.quoteId` / `afterOrder.quoteId`，并断言 `beforeOrder.quoteId === confirmed.id`，避免空对空。
- 全文件搜查未发现其他 `.order.quoteId` 误用。
- `node --check` PASS；CI run `40816717732` 五项 SUCCESS。
- PR #69 保持 Draft，未合并、未部署。

## 审查记录

### 第 1 轮 · 2026-10-29 11:05 · CHANGES_REQUESTED（Draft PR #69 head `68687ed`，CI 五项 SUCCESS）

通过：策略脚本两项空说明改为统计 POST 次数 = 0 + `aria-invalid`；角色提醒删除 `noticeCount>=0` 恒真断言、端口 4180；`.driver-mode .topbar` 撤回；重放测试用同一 Idempotency-Key 两次请求并断言 `Idempotency-Replayed`、同一 id，再 reload + 读报价。

**须修改：**
1. **卡片验收没做：三个浏览器脚本各连跑 3 次全部 PASS、附输出 JSON**——报告记 NOT_RUN。这是本卡唯一的“证据”，角色提醒脚本里 `[data-role="customer"]` 是否存在、新断言能否通过，只有跑了才知道。请按 RF-PM-035 当时的方式在本机起 4180 服务 + 一次性合成测试库，跑 3×3 次，把 9 份 JSON（含 checks、allPass、testDatabase）放进 PR 描述或 `services/routefit/verification/rf033r1/`，测试库用完删除。
2. **`quotes.integration.mjs` 拆分后留下恒真断言，并丢了原有保护**：
   - 原测试里 `before` 和 `after` 现在中间没有任何操作，`deepEqual` 必然成立——删掉这对读取，或把它们移到新测试里。
   - 新的独立测试只断言 409 + `CONFIRMED_QUOTE_LOCKED`，没断言“被拒后报价状态、金额、订单 quoteId 不变”（拆分前有）。请在新测试里补上这三项不变断言。
3. **“运营看到全部提醒”没有真正断言**：现在只是 `>=1`。请和提醒数据源比对（运营看到的条数 = 提醒定义的总条数，或逐条 id 一致）。另外“司机条数 = 运营条数”是什么依据？若司机按设计应只看司机相关提醒，这条断言是错的；若 #43 的映射确实让司机看全量，请在 PR 描述引用对应代码行说明。finance / dispatch / warehouse 至少断言各自应看到的那几条（或与映射表比对），不要只写 `>=1`。

**建议：** 重放后“页面以服务端结果为准”的检查现在是 `innerText.includes('$')`，建议改成页面显示的总额等于 `GET /quotes/{id}` 返回的 `total`。

同一分支返工，保持 Draft；10-31 前合并。

### 第 2 轮 · 2026-10-29 11:25 · CHANGES_REQUESTED（一处，小改；Draft PR #69 head `3136ab0`，CI 五项 SUCCESS）

通过：三个浏览器脚本各 3 次真实运行，9 份 JSON 已提交（policy 11 项、roles 33 项、quote 11 项，allPass）；角色提醒按 `dispatch-ui` 数据源逐角色比对条数和 id，客户为空，司机按 `driverAccess` 映射；重放后页面总额与 `GET /quotes/{id}` 比对；拆分后的旧测试删掉了恒真读取。
`orders.mjs` 把 `current.order.quoteId` 改为 `current.quoteId` 属实：按 openapi，`OrderDetail.quoteId` 在顶层，`OrderSummary` 里没有 `quoteId`——之前订单页“读取报价”按钮永远是禁用的。这是真实缺陷，修复接受（虽超出卡片范围，但是重放验收所必需），请在 PR 描述单列说明。

**须修改：**
1. 新的独立测试 `confirmed quote rejects ordinary requote…` 里用的是 `afterOrder.order.quoteId` / `beforeOrder.order.quoteId`——同样的错误字段，两边都是 `undefined`，“订单当前 quoteId 不变”这一项实际没断言。改为 `afterOrder.quoteId` / `beforeOrder.quoteId`，并加 `assert.equal(beforeOrder.quoteId, confirmed.id)` 保证不是空对空。顺便全文件搜一下其他 `.order.quoteId`。

建议（不阻断）：openapi 里同时出现 `Idempotency-Replayed` 和 `Idempotent-Replayed` 两种头名，脚本两者都接受可以；建议另开小卡统一契约。

同一分支返工，保持 Draft；改完 CI 绿即可，不需要重跑 3×3 浏览器（这处只改集成测试）。

### 第 3 轮 · 2026-10-29 11:30 · APPROVED（Draft PR #69 head `8d438da`，CI 五项 SUCCESS）
独立测试改为顶层 `quoteId`，并断言 `beforeOrder.quoteId === confirmed.id`；全文件无其他 `.order.quoteId`；PR 描述已单列 orders.mjs 修复。通过。合并按 `MERGE-20261029-1130`。**不要再推送提交。**

### 第 4 轮 · 2026-10-29 11:35 · CHANGES_REQUESTED（负责人 11:25 在 #69 GitHub 审查；Claude 第 3 轮 APPROVED 撤回）

Claude 复核负责人意见，前两项属实，是 Claude 第 3 轮漏看的：
1. **角色提醒期望值和页面用的是同一个 `filterAlertsByRole()`**——函数写错时两边一起错，测试照样通过。加两条不依赖该函数的硬断言：`expectedByRole.ops.length === sourceAlerts.length` 且 id 集合与 `sourceAlerts` 相同；`expectedByRole.customer.length === 0`。
2. **“mobile navigation remains usable”是空检查**：司机、客户模式 640px 以下 `.topbar`、`.mobile-nav` 都是 `display:none`，`.mobile-nav` 的 `count()>0` 只数元素不看可见性，恒真（roles-*.json 里司机、客户这条都是这样通过的）。二选一：断言该角色自己的主操作区可见（司机 `.driver-bottom`，客户端对应的主操作区）；或删掉这条、在 JSON/描述里记为“按设计无顶栏菜单，不计入检查”。并且这个回退分支只能对司机、客户生效——其他角色找不到“更多”菜单必须失败，不能走回退。
3. **PR 描述**补一句 `app.css`：撤回 `.driver-mode .topbar{display:flex}` 的原因，以及撤回后司机端移动视图不显示顶栏属于原设计。
4. **补任务卡进仓库**：把本卡（去掉“审查记录”以外的通道说明亦可）作为 `ops/codex/tasks/RF-PM-033-R1-acceptance-checks.md` 加进同一 PR，并在 `ops/codex/README.md` 看板登记一行。

建议（不阻断）：空说明“不发请求”改用 `page.waitForRequest(…,{timeout:500})` 并断言超时，防止将来异步提交时漏掉晚到的请求。

验证：改了角色提醒脚本，`roles` 脚本重跑 3 次并替换 `roles-{1,2,3}.json`；策略/报价脚本若未改可不重跑。CI 五项绿。
完成后把 #69 转为 Ready 并在 PR 里请求重新审查（负责人要求）。**批准之后不要再推提交。**

### 第 5 轮 · 2026-10-29 12:46 · APPROVED（PR #69 head `604815c`，CI 五项 SUCCESS；负责人在 GitHub 批准）

- 运营期望与源提醒逐条 id 比对、客户期望为空，两条独立断言已加。
- 移动端回退只对司机、客户生效：司机断言 `.driver-bottom` 可见，客户断言 `.customer-app` 可见；其他角色缺“更多”菜单直接失败。
- PR 描述已写明 `app.css` 撤回原因；`roles-{1,2,3}.json` 由新脚本连跑 3 次，每次 35 项 allPass。

建议（不阻断）：客户端检查改为 `.customer-app nav` 可见。

合并：13:00 由大旺按 `MERGE-20261029-1155` 合并，合并 head 即批准的 `604815c`，合并内容与重新合并一致，develop CI 通过。
