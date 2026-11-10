# RF-PM-056 · 司机 App 技术选型

状态：待负责人批准。基线：`develop` `bd848893dd88018cdb332e6686c1eb39dba5b818`。本文件只做技术选型和骨架边界，不批准应用商店账号、签名凭据、生产登录、地图供应商或试运营部署。

## 1. 事实、假设与未知

### 已知事实

- PRD 要求 iOS 与 Android 原生 App；网页和 PWA 不算交付。
- 后端已有 `/api/driver/v1` 契约，任务列表返回司机自己的 assignment 摘要；`/sync/events` 要求设备 `sequence` 连续，并按 `eventId` 永久去重。
- 现有认证只适用于本机开发会话，正式登录依赖尚未批准的 RF-PM-055。
- 外部导航只负责导航到当前站，返回 App 不能自动签收或推进任务状态。
- 当前团队按两人维护估算，服务端与页面主栈是 Node.js／TypeScript。

### 假设

- 首期不需要内嵌收费导航 SDK；通过系统外部地图应用跳转即可。
- 首期可以使用跨平台框架，但后台定位、权限撤销、进程终止恢复必须用真机分别验收。
- App 的离线事件最终要持久化，但本卡只验证队列语义，不选择本地数据库。

### 未知

- 柬埔寨真实设备上的后台定位稳定性、电量影响与商店审核口径。
- 推送供应商、应用商店账号、包名、证书保管人和分发方式。
- RF-PM-055 最终会话、刷新令牌和设备绑定契约。

## 2. 三种方案比较

| 维度 | React Native（Expo development build） | Flutter | Kotlin + Swift 原生 |
| --- | --- | --- | --- |
| 后台定位与权限撤销 | `expo-location`／TaskManager 可统一接入；后台能力必须使用 development build，Expo Go 不可作为证明；仍须分别处理 iOS/Android 权限撤销与进程终止 | 插件与后台 isolate 可实现；平台差异仍需原生配置与真机验证 | 对 Core Location、Android foreground service 和权限状态控制最直接，平台行为最透明 |
| 离线事件队列 | TypeScript 可直接表达 `sequence`、`eventId` 与服务端结果；后续可接 SQLite/安全存储 | Dart 实现清晰，但无法复用现有 TypeScript 类型与校验知识 | 两套队列与持久化实现，最容易产生协议漂移 |
| 拍照与证据上传 | Expo Camera/Image Picker/FileSystem 可覆盖首期；10 MiB、MIME、上传 capability 和完成步骤仍由 API 层校验 | 插件成熟，能力相当 | 能力最完整，但两端重复实现上传、重试与元数据处理 |
| 推送 | Expo Notifications 可先统一；生产仍依赖 APNs/FCM 凭据和服务端绑定 | Firebase/APNs 插件成熟 | 两端原生 SDK，控制最强、工作量最大 |
| 外部导航跳转与返回 | `Linking` 打开系统地图；App 回前台只刷新任务，不自动改变业务状态 | `url_launcher` 可做同等能力 | 两端系统 API 直接接入，控制最细 |
| 签名构建与分发 | EAS 或本机构建均可；商店分发仍必须签名。凭据方案须另批，本卡不申请、不生成 | Flutter 构建后仍需 Apple/Google 签名与商店流程 | 原生工具链最标准，但证书、构建和发布流水线维护量最高 |
| 现有 Node/TypeScript 复用 | 可复用语言、校验思路与将来的契约类型；不能直接复用服务端运行时代码 | 几乎不能复用语言层代码 | 不能复用；还要维护 Kotlin/Swift 两套模型 |
| 两人团队维护成本 | 最低：一套 UI 与业务代码，平台特殊能力按需下沉 | 中：一套 Dart，但团队增加新语言与工具链 | 最高：两套 UI、网络、存储、测试与发布流程 |
| 主要风险 | 框架/插件升级、后台能力最终仍需原生调试；不能把 Expo Go 当真机证明 | 新语言学习与插件原生边界；同样不能免除两端验证 | 交付慢、两端行为漂移、两人团队长期维护压力大 |

官方边界参考：Expo 明确说明 Android 前后台服务与后台定位不在 Expo Go 中提供，应使用 development build；敏感权限需要构建期原生配置。iOS 后台定位受授权级别、系统挂起和进程终止规则约束。应用商店分发无论是否使用 EAS 都需要平台签名凭据。

## 3. 最强反对意见

1. **后台定位是核心能力，跨平台抽象可能隐藏平台差异。** 如果现场要求进程被系统终止后仍持续可靠定位，最终仍可能需要 Kotlin/Swift 原生模块，Expo 的低成本优势会缩小。
2. **开发便捷不等于生产可控。** EAS、Expo 模块版本和 config plugin 引入额外供应链；签名、推送、权限声明和商店审核仍不能省略。
3. **当前正式登录未定。** 过早固化网络和本地存储可能导致 RF-PM-055 批准后返工，尤其是刷新令牌轮换、设备绑定和撤销。

## 4. 最强支持意见

1. **与现有 TypeScript 团队和契约最贴近。** 两人团队先维护一套业务代码，能把精力放在离线顺序、证据与任务状态不变量上。
2. **可逐步下沉。** Expo development build 允许加入原生配置和模块；若某个能力实测不达标，可以只下沉该能力，不必立即维护两个完整 App。
3. **当前切片可低成本验证关键风险。** 任务列表、离线队列、外部导航返回和权限撤销都能在不申请商店账号的前提下先做真机实验。

## 5. 结论

### Verdict

推荐 **React Native + Expo SDK 58 + TypeScript + development build**。Expo Go 只允许用于无原生权限的快速 UI 检查，不作为后台定位、推送、相机或生产分发证据。若后台定位最小实验失败，再把定位模块下沉原生；不因此提前改成两套完整原生 App。

### Confidence

78%。

### Key Variables

- iOS/Android 真机在锁屏、后台、权限撤销和进程终止后的定位表现；
- RF-PM-055 的令牌轮换、设备绑定和撤销契约；
- 两人团队对 Expo 原生构建与商店流程的掌握程度。

### Largest Unknown

真实司机设备与当地网络条件下，后台定位和离线重放是否达到业务可接受的可靠性与电量成本。

### Reversal Condition

若两端真机验证证明 Expo development build 无法在批准的权限和电量预算内完成后台定位，且所需原生补丁覆盖多个核心模块，则改为 Kotlin + Swift 原生；单一插件缺口只下沉该模块。

## 6. 最小验证实验

- **假设：** Expo development build 能在两端保留同一业务代码，并满足任务期间后台定位和离线事件恢复。
- **测试：** 各用一台真机覆盖前台、后台、锁屏、断网、进程终止、定位权限撤销、导航跳出并返回；事件队列制造 1–20 连续序号、重复 `eventId` 和网络中断。
- **成功标准：** 不丢已确认入队事件；重放顺序连续；重复 `eventId` 不产生第二条；权限撤销后立即停止采集并提示；导航返回不改变任务状态。
- **失败阈值：** 任何未告知的持续定位、事件丢失/乱序/重复、或导航返回自动推进任务，均停止扩展。
- **时限：** 两个工作日；不申请商店账号。
- **测试后决策：** 通过则保留 Expo；失败先定位到单一模块，无法局部下沉时才重评整体技术栈。

## 7. 本卡工程边界

`apps/driver/` 只包含：

1. `developmentSessionAuth`：原始开发会话令牌仅驻留当前进程，API 固定连接 `127.0.0.1`；这是 RF-PM-055 前的占位，不是生产登录。
2. `listAssignments`：真实调用 `GET /api/driver/v1/assignments`，显示 assignment、订单、状态与到期时间。
3. `createOfflineEventQueue`：自动生成连续序号、按 `eventId` 去重、网络失败后保留未确认事件并按原顺序重放；发送函数是注入的测试边界，未连接 `/sync/events`。

未做：持久化数据库、正式认证、后台定位、相机/证据上传、推送、导航跳转、签名构建、商店分发。上述能力必须在后续独立批次中实现和验收。

## 8. 后续批次建议

| 批次 | 范围 | 验收 |
| --- | --- | --- |
| A（低风险） | assignment 详情、空态/错误态、契约类型生成 | Android/iOS 模拟器均通过；跨企业与非司机返回正确错误 |
| B（高风险，单独批准） | RF-PM-055 正式登录、访问/刷新令牌、设备绑定、安全存储、撤销 | 令牌轮换/重放/失窃/撤销真实集成测试通过 |
| C（高风险，单独批准） | SQLite 队列、`/sync/events`、证据上传 | 断网/进程终止/重复事件/版本冲突真机通过 |
| D（高风险，单独批准） | 后台定位、推送、外部导航返回 | 两端真机与权限撤销矩阵通过；无隐式签收 |
| E（高风险，单独批准） | 签名、内测分发、商店材料 | 凭据不进仓库；负责人批准后再执行 |

## 9. 参考资料

- [RouteFit 司机接口](../../contracts/driver-api.md)
- [RouteFit 证据接口](../../contracts/evidence-api.md)
- [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)
- [Expo 权限配置](https://docs.expo.dev/guides/permissions/)
- [Expo App credentials](https://docs.expo.dev/app-signing/app-credentials/)
- [React Native 开发环境](https://reactnative.dev/docs/set-up-your-environment)
- [Apple Core Location 授权](https://developer.apple.com/documentation/corelocation/requesting-authorization-to-use-location-services)
- [Flutter 后台进程](https://docs.flutter.dev/packages-and-plugins/background-processes)
