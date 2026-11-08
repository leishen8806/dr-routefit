# RF-PM-062 · 一套代码覆盖司机 App、Telegram Mini App 和 H5（React Native／Expo）

| 项目 | 内容 |
| --- | --- |
| 类型 / 风险 | feat+refactor / 中（新建客户端工程、调整仓库结构；不改后端） |
| 版本 | v0.8 前置（客户端与支付） |
| 执行人 | 苏晨＋Codex |
| 基线 SHA | 最新 `develop` |
| 分支 | 批次 1：`feat/RF-PM-062-customer-web-skeleton`；批次 2：`feat/RF-PM-062-shared-packages`；PR 目标都是 `develop` |
| 依赖 | 批次 1 无依赖，现在开始；**批次 2 必须等 #127（RF-PM-058）和 #128（RF-PM-060）都合并后才开始** |
| 需人类批准 | 是：每个 PR 合并前须负责人侧 Claude 审查，并由作者以外的人批准最终 head |
| 状态 | IN_PROGRESS（批次 1） |

## 背景

负责人决定继续使用 React Native（Expo），并且只维护一套代码：司机 App（Android／iOS 原生）、客户端 Telegram Mini App、H5（收货人查单、企业客户电脑端）都从同一个技术栈出。Expo 可以把同一套 React Native 代码导出成网页，Mini App 和 H5 用同一个网页构建，区别只在运行环境。

产品分工按 `PRD/docs/telegram-and-driver-app-scope-v0.1.md`：发货人／商户走 Mini App＋Bot；司机走原生 App；收货人走无需 Telegram 的轻量入口。官网（`website/`，Astro）不在本卡范围。

## 批次 1（现在做，不碰 `apps/driver/`）

1. **设计文档** `PRD/docs/RF-PM-062-one-codebase.md`，写清：
   - 目标结构：npm workspaces；`apps/driver`（原生）、`apps/customer`（网页：Mini App＋H5）、`packages/shared`（接口客户端、三语文案、通用界面组件、数据类型）；
   - 平台分流规则：用 `.native.ts`／`.web.ts` 或 `Platform.OS` 分开；**只在原生可用**的能力列清楚（后台定位、推送、相机、离线事件队列与 SQLite），网页端不得假装支持；
   - Mini App 接入：只在 Telegram 环境里加载官方 `telegram-web-app.js`，调用 `ready()`、`expand()`，适配主题色、安全区和返回按钮；原始 `initData` 只原样交给服务端验证（服务端验证是 v0.8 的后端工作，不在本卡）；**不得把 `initDataUnsafe` 里的用户信息当身份使用**；
   - H5：不在 Telegram 里时按普通网页运行，同一构建；
   - 构建产物：司机端出安装包，客户端出静态网页文件；部署方式写“待定”，本卡不部署；
   - 批次 2 的迁移步骤和回滚方法。
2. **客户端骨架 `apps/customer/`：**
   - Expo SDK 与 `apps/driver` 同一个大版本（58），TypeScript；需要多页面路由时可用 Expo Router，在 PR 里说明理由；
   - 底部四个页签：寄件／订单／消息／我的，先做空状态页面，不调用业务接口；
   - 语言切换：高棉语、英语、中文；高棉语文案标“待母语审校”；首次进入默认高棉语，选择记在本地，读写本地存储用 `try/catch` 包住，失败就用默认值；
   - 运行环境识别：Telegram 里显示 Mini App 模式（调用 `ready()`／`expand()`、跟随主题色），普通浏览器显示 H5 模式；页面角落显示当前模式，仅开发构建显示；
   - 收货人查单入口先做一个占位页（路由如 `/track`），显示“即将开放”，不读取任何订单；
   - 390 宽手机和 1440 宽电脑两种尺寸都要能正常显示，高棉文不裁切。
3. **CI：** 新增 `customer-app` 任务：lint、类型检查、单元测试、网页导出（`npx expo export --platform web`）。不改现有任务。
4. **测试：**
   - 单元测试：语言选择与本地存储失败兜底、运行环境识别（有／无 `window.Telegram.WebApp`）；
   - 本机浏览器实测：H5 模式三种语言切换、四个页签可进入；用模拟的 `window.Telegram.WebApp` 对象验证 Mini App 模式会调用 `ready()`／`expand()`；
   - 真实 Telegram 内打开：NOT_RUN（还没有 Bot 和公网地址）；
   - 截图存仓库外 `E:\RouteFit-QA\evidence\RF-PM-062\`，不进仓库。

## 批次 2（#127 和 #128 都合并后再做，单独 PR）

1. 根目录启用 npm workspaces，把 `apps/driver` 和 `apps/customer` 都纳入；
2. 把司机端已有的接口客户端、文案、类型中**两端都用得到**的部分抽到 `packages/shared`；离线队列、SQLite、定位等原生专用代码留在 `apps/driver`；
3. 司机端行为不变：原有单元测试全部保留并通过，Android 模拟器跑一遍“列表 → 详情 → 接单”；
4. CI 改为按 workspace 安装，`driver-app` 和 `customer-app` 两个任务名不变（分支保护不受影响）；
5. 更新 `apps/driver/README.md`、`apps/customer/README.md` 和根目录说明。

## 不做

- 不做 Telegram 登录交换、Bot、webhook、下单、报价、付款等任何业务功能（属于 v0.8）；
- 不申请 Bot、不配置域名或 Cloudflare、不部署；
- 不改后端代码、迁移、`openapi.json`；
- 不改 `website/`；
- 批次 1 不动 `apps/driver/` 的任何文件。

## 验收

- 批次 1：CI 全绿（含新增 `customer-app`）；设计文档覆盖第 1 条全部要点；H5 和模拟 Mini App 两种模式实测 PASS；仓库里没有 Bot token、真实地址或真实客户资料。
- 批次 2：CI 全绿；司机端单元测试数量不减少；模拟器链路 PASS；`packages/shared` 里没有原生专用依赖。
- 每个 PR 描述按条目逐项写 PASS／FAIL／NOT_RUN，范围外发现写进“发现但未处理”。

## 审查记录

（待填）


