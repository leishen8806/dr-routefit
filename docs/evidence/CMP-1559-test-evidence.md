# CMP-1559 证据补跑（OpsLead，来源 RF-Q-021 / CMP-1546）

执行日期 2026-11-12，Windows 11，Node 24.22.2（`E:/VirtualAIOffice/tools/node24.cmd`），不改任何实现代码。
每条在对应提交的**独立 detached 工作树**上运行（`git worktree add --detach <dir> <sha>`），
`services/routefit/node_modules` 用目录联接指向已装好的既有工作树（pg 8.23.1、ajv 8.20.0、ajv-formats 3.0.1，与 package.json 一致），未联网、未 npm install、未改锁文件。

## CMP-1484 @ c4528cd
- 全量：`cd services/routefit && node24.cmd npm test` → `tests 293 / pass 290 / fail 0 / skipped 3`（3 条 skip 为既有用例，与本卡无关）。
- 本卡相关 15 个文件（`ad-client-routes`、`open-platform*.test.mjs` 全部）：
  `node --test --test-concurrency=1 <15 files>` → `tests 84 / pass 84 / fail 0 / skipped 0`。
- 新增 `open-platform-r2-rework.test.mjs`：`tests 14 / pass 14 / fail 0`（AC-1…AC-7 各有断言，含 AC-4 回调黑名单、AC-3 权限闸口、AC-5 限流/幂等）。
- 结论：**通过**，无环境问题、无实现问题。

## CMP-1485 @ 648ef9d（真库）
- 一次性容器：`postgres:17`（本机已有镜像，未拉取），绑定 127.0.0.1:55439（非 5432），口令现生成、只在进程环境变量，日志已做脱敏替换，跑完 `docker rm -f` 并确认容器已不存在。
- `node --test --test-concurrency=1 tests/open-platform.integration.mjs` → `tests 8 / pass 8 / fail 0 / skipped 0`
  （key expiry 3 条、撤销与审计、client/key 审计写入、ad 创建审计、084 CHECK 与适配器双重拒绝站外链接）。
- 结论：**通过**。

## CMP-1505 @ a9ddf53
- ajv 已具备（联接到既有 node_modules），不再有「加载缺 ajv」。
- 全量 `npm test` → `tests 293 / pass 290 / fail 0 / skipped 3`；相关 15 文件 → `84 / 84 / 0`；`open-platform-r2-rework.test.mjs` → `14 / 14 / 0`，
  其中 `AC-4 回调地址：放行/拒绝清单` 通过（该测试在本提交内含 `.localhost/.lan/.home.arpa` 断言，见 `git show a9ddf53`）。
- 附：在此提交上串行跑全部 `*.integration.mjs`（同款一次性 postgres:17）→ `tests 99 / pass 97 / fail 2 / skipped 0`；
  2 条失败均为 `tests/trial-chain.integration.mjs`（`trial chain …`、`trial init reports cleanup failures …`），
  是 Windows 文件权限位断言（期望 0o600，Windows 得 0o666）已知基线，**未改断言**。
- 结论：黑名单测试**通过**；integration 的 2 条红为已知 Windows 基线，与本卡无关。

## CMP-1524 @ e663554
一致性判据：`--write` 之后 `git diff --stat` 与 `git status --short` 均为空。
- **在 e663554 本身上：红。** `node scripts/build-contract-modules.mjs`（带或不带 `--write`）均 `EXIT=1`：
  `contracts/modules/ops-ad-campaigns.json: /api/ops/v1/ad-campaigns/{campaignId} must be lowercase and start with /api/`。
  原因：e663554 基线里的 `scripts/build-contract-modules.mjs` 是旧版，校验正则不放过 `{campaignId}` 大写花括号参数；它不是本卡改动引入的（本卡只动两个模块 json）。装配无法完成，所以该提交上 diff 判据无法成立。
- **在载体分支 0d22e9c（含 1524 内容 + 新版脚本）上：绿。**
  不带 `--write`：`EXIT=0`，11 个模块、351 条 path；`--write` 后 `git diff --stat` 为空、`git status --short` 为空（已手工确认并 `git checkout -- contracts/openapi.json` 恢复，本提交不带 openapi.json）。
  装配结果中 `/api/ops/v1/ad-campaigns/{campaignId}` 为 `patch,get`，`roles/{roleId}` 为 `patch`，`staff/{personId}`、`staff/{staffId}` 均含 `patch`。
- 观察（不改，交 Lead）：载体里 `staff/{personId}` 与 `staff/{staffId}` 两条 path 都带 patch，参数名不同、语义是否重复需另行核对；另 e663554 单独不可装配，应以载体分支（PR #155）为准复验。
- 结论：e663554 单独**红**（旧脚本）；并入载体后**绿**。如实记录。

## AC-3 自证
- 验证期间每个工作树 `git status --porcelain` 为空；`git diff --name-only` 无任何 lock 文件；本卡工作树提交仅新增本文件。
- 临时工作树与联接已清理（先 `rmdir` 联接，再 `git worktree remove`；被联接的既有 node_modules 验证仍在）。

## 原始日志 SHA-256（保存在 `E:/VirtualAIOffice/pc-worktrees/_cmp1559/`）
- w1484-unit.log 768BD34DF1ED5266153B481D142821F243344E85848A840021B7B064E2DD7018
- w1505-unit.log 8146293E80F2969F84FB5974C10B7C1FB468A241FB0E51C83268C435B14258A2
- w1485-integ.log 1F0E41F75E8B9B9B09913B355DD7EE01F46D3732D7A47388CB817A3272214EDC
- w1505-integ-all.log B3BD58BFD945BBFCEB5FC2C2288E1F2D99ECFA1ACFEF3416B569C23D04160995
