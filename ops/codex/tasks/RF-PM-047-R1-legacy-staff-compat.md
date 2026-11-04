# RF-PM-047-R1 · 新员工命令兼容 v0.3.0 创建的员工数据

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | fix / 高（不修复则在已部署环境重跑 `trial:staff` 会重复建员工；阻塞 v0.3.1 部署） |
| 版本 | v0.3.1 |
| 执行人 | 大旺＋Codex |
| 基线 SHA | 最新 `develop` |
| 分支 | `fix/RF-PM-047-R1-legacy-staff-compat`，PR 目标 `develop` |
| 依赖 | RF-PM-047（#94，已合并） |
| 需人类批准 | 是：影响已部署员工身份；合并前须负责人侧 Claude 审查通过，并由作者以外的人批准最终 head |
| 状态 | TODO |

## 背景

2026-11-04 项目负责人的 Codex 在本机做了"v0.3.0 → `develop`（`d6c6d76`）"升级演练（用 v0.3.0 代码建员工和客户，再用 `develop` 代码操作），结论 FAIL：

- 重跑 `trial:staff`：预期复用 3 名员工，实际**新建 3 名，员工从 3 增至 6，会话从 3 增至 6**；
- `trial:staff:disable <sshLogin>`：只停用了新建的身份，**同一登录名对应的旧身份仍然 ACTIVE，授权和会话仍在**；
- 追加导入：新客户写入的授权数是预期的两倍（员工翻倍的连锁结果）。

根因：v0.3.0 的 `trial:staff` 生成会话时是 `newSession({companyId, principalId, sshLogin}, ...)`，**会话里没有 `authType` 字段**，员工主体的 `idp_subject` 是 `local:<principalId>`。RF-PM-047（#94）合并的代码按 `session.authType === 'staff'` 查找旧员工：

- `services/routefit/scripts/trial-staff.mjs`：`sessions.find(session=>session.authType==='staff'&&session.sshLogin===person.sshLogin)`
- `services/routefit/scripts/trial-disable.mjs`：`sessions.find(session=>session.authType==='staff'&&session.sshLogin===login)`

旧会话没有 `authType`，永远找不到。#94 的回归测试只把主体的 `idp_subject` 改成旧格式，会话仍由新代码生成（带 `authType`），所以没抓到。

服务器上 2026-11-03 部署的员工正是 v0.3.0 代码创建的，风险是真实的。**修复合并并通过升级演练之前，不得对服务器运行新版 `trial:staff`、`trial:staff:disable`。**

## 要做

1. **识别旧员工：** `trial:staff`、`trial:staff:disable`、`trial:import`（追加导入的授权资格）统一用同一个查找规则：
   - 先按会话：`sshLogin` 匹配且不是服务账号（`authType !== 'service'`）；**不得要求 `authType` 存在**；
   - 再按主体兜底：`org.principal` 里 `kind='STAFF'` 且 `idp_subject = 'local:' || <principalId>`（旧格式）；
   - 两种方式找到的必须是同一个主体；不一致时报错并停止，不要猜；
   - 抽成一个共用函数，三处调用，不要各写一份。
2. **会话字段补齐：** 对找到的旧员工，重跑 `trial:staff` 时给其会话补写 `authType: 'staff'` 与 `roles`（不改令牌，不改 `sshLogin`），使之后的命令走新格式。补写前后令牌哈希必须不变。
3. **测试夹具必须是 v0.3.0 的真实输出：**
   - 夹具形状：会话 `{companyId, principalId, sshLogin, tokenHash, csrfHash, permissions, expiresAt}`，**没有 `authType`、没有 `roles`**；员工主体 `idp_subject = 'local:' || principalId`；
   - 不要在新代码生成的夹具上改一个字段来冒充旧数据。优先在测试里直接用 v0.3.0 的 `trial:staff` 写法（或保存其输出样例）生成。
4. **集成测试（真实 PostgreSQL）：**
   - 旧数据重跑 `trial:staff`：员工数、主体数、会话数都不变；会话补写 `authType` 后令牌哈希不变；
   - 旧数据 `trial:staff --grant-customer-access`：只给 `order_quote`、`case_decider` 授权，幂等；
   - 旧数据 `trial:staff:disable`：旧主体变为 DISABLED，授权清零，对应会话移除；再重跑 `trial:staff` 明确拒绝；
   - 追加导入：新客户的授权数等于"需要客户范围的活动员工数"×新增客户数；
   - 两种查找方式不一致时报错。
5. **文档：** `ops/codex/tasks/RF-OPS-01-vps-trial-server.md` 加一条：升级到 v0.3.1 后首次运行 `trial:staff` 前，先在本机用 v0.3.0 数据演练并 PASS。

## 不做

- 不回收 v0.3.0 导入时给策略编制、复核、发布角色写入的旧客户授权（无功能影响，另立小卡）；
- 不改 `idp_subject` 的生成格式（新建员工的标识格式保持 #94 合并后的规则）；
- 不改令牌、会话有效期、`trial:renew`；
- `trial:start` 空会话提示属于 #95，不在本卡。

## 验收

- 上述集成测试在 CI 的真实 PostgreSQL 上通过；CI 五项全绿；
- PR 描述按 PASS／FAIL／NOT_RUN 逐项写，并写明夹具如何取得 v0.3.0 的真实形状；
- 合并后，项目负责人的 Codex 用同一份升级演练提示词重跑，**全部通过才能部署 v0.3.1**。

## 审查记录

（待填）
