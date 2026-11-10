# RF-PM-062 · React Native／Expo 一套代码方案

| 项目 | 内容 |
| --- | --- |
| 状态 | 批次 1 实现，待负责人批准 |
| 目标 | 司机原生 App、Telegram Mini App 与普通 H5 共享技术栈；不把网页能力伪装为原生能力 |
| 本批范围 | 客户网页骨架、运行环境分流、三语与 CI；不做业务接口、登录、Bot、部署或共享包迁移 |

## 1. 目标仓库结构

批次 2 才在根目录启用 npm workspaces，目标结构如下：

```text
apps/
  driver/       Android／iOS 原生 App
  customer/     同一份网页构建：Telegram Mini App＋普通 H5
packages/
  shared/       API 客户端、三语文案、通用 UI、纯数据类型
```

批次 1 保持 `apps/driver` 与 `apps/customer` 独立安装，避免在 #127、#128 合并前改动司机端依赖解析。`packages/shared` 现在不创建；只有两端确实共用且不依赖原生运行时的代码才进入该包。

## 2. 平台分流

优先使用文件后缀分流完整实现（`*.native.ts`／`*.web.ts`）；仅对很小的展示差异使用 `Platform.OS`。分流必须发生在能力边界，不能让网页入口显示一个实际无法执行的原生动作。

| 能力 | 原生 App | Mini App／H5 | 规则 |
| --- | --- | --- | --- |
| 后台定位 | 支持，需系统权限和真机验证 | 不支持 | 网页不显示“后台持续定位” |
| 推送 | 支持，需平台凭据 | 仅 Telegram／浏览器各自通知能力，未接入 | 不宣称等价 |
| 相机取证 | 原生相机与权限 | 可在明确支持时使用网页文件选择 | 无支持时禁用并解释 |
| 离线事件队列 | SQLite 持久化、顺序与去重 | 本批不支持 | 不用 localStorage 冒充履约离线队列 |
| 页面与纯展示组件 | React Native | React Native Web | 允许共享 |
| API 客户端与数据类型 | 可共享 | 可共享 | 不包含令牌持久化策略 |

## 3. Mini App 运行时

只有检测到 Telegram WebApp 对象或 Telegram 启动参数时，网页才加载官方 `https://telegram.org/js/telegram-web-app.js`。普通 H5 不发起该请求。

初始化顺序：

1. 检测 Telegram 环境；
2. 必要时加载官方脚本；
3. 调用 `ready()` 和 `expand()`；
4. 读取主题参数和安全区，用于页面表面与内边距；
5. 非根路由显示 Telegram 返回按钮，离开时解除处理器。

原始 `initData` 在正式登录批次中只原样发送到服务端，由服务端按 Telegram 规范校验签名、时效和重放。客户端不得从 `initDataUnsafe` 读取或信任用户身份，也不得把 `initData` 写入日志、URL 或本地持久存储。本批没有登录交换接口，因此不读取或传输这两个字段。

## 4. 普通 H5

没有 Telegram 上下文时直接进入 H5 模式；它与 Mini App 使用同一次网页导出。运行模式只在开发构建显示，生产界面不暴露调试徽标。H5 保留同样的三语、四个页签与 `/track` 路由，但本批不读取任何订单。

## 5. 构建产物与部署边界

- `apps/driver` 输出 Android／iOS 安装包；签名与商店分发另行批准。
- `apps/customer` 通过 Expo Web 静态导出生成 Mini App／H5 共用文件。
- 静态文件的托管、域名、缓存、CSP 与回滚平台均为“待定”。本卡不部署、不创建 DNS、不配置 Cloudflare、不申请 Bot。

## 6. 三语与可用性

首次进入默认高棉语；本地选择失败时仍回退高棉语。高棉语当前全部标记“待母语审校，审校前不得上线”。语言切换不改变业务状态。390 px 和 1440 px 共用四个底部页签；高棉文本允许换行并使用较大行高，不通过缩小字号或单行截断塞入控件。

## 7. 批次 2 迁移步骤

批次 2 仅在 #127 与 #128 合并后开始：

1. 记录两个 App 当前依赖锁和 CI 结果；
2. 根目录启用 npm workspaces，先纳入两个 App，不改变任务名；
3. 识别真实双端复用代码，把纯 API 客户端、三语文案、通用 UI 和纯类型移动到 `packages/shared`；
4. 原生离线队列、SQLite、定位、推送、相机与设备认证留在 `apps/driver`；
5. 更新导入路径并运行两个 App 的原测试、导出和司机模拟器链路；
6. 只有行为与测试数量不退化才提交。

### 回滚

若 workspace 安装、Metro 解析或司机行为出现回归，回滚批次 2 的单个合并提交：恢复两个独立 `package-lock.json` 与原导入路径，删除尚未被其他代码依赖的 `packages/shared`，重新运行批次 1 的 `customer-app` 和既有 `driver-app` CI。回滚不修改批次 1 的客户网页功能和证据。

## 8. 验证边界

本批验证 H5 三语与四页签、模拟 Telegram 的 `ready()`／`expand()`、静态网页导出和 `/track` 占位路由。真实 Telegram、Bot、公网地址、服务端 initData 校验、业务接口、原生能力和部署均为 NOT_RUN 或范围外，不能从本批 PASS 推断为可上线。
