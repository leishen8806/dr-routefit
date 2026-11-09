# RouteFit Driver App skeleton

RF-PM-056 的 React Native（Expo + TypeScript）工程骨架，RF-PM-057 增加任务详情、必要订单资料、接单／拒单和外部地图跳转；不是可分发的生产 App。

## 本机运行

要求 Node 24、npm、Android Studio。服务端必须在本机 `127.0.0.1:4180` 运行并配置开发司机身份。

```powershell
cd apps/driver
npm ci
adb reverse tcp:4180 tcp:4180
npm run android
```

Android 模拟器通过 `adb reverse` 把模拟器内的 `127.0.0.1:4180` 映射到开发机；App 不接受远端服务地址。启动后同时输入本机开发会话的原始令牌和 CSRF 令牌，两者只保存在当前进程内，不写磁盘、不进日志。写操作固定携带精确的本机 Origin 和 CSRF 请求头；这是开发占位，RF-PM-055 批次 5 正式会话上线后删除。

设备 ID 手填同样只用于本机开发；RF-PM-055 批次 5 的设备注册上线后删除该入口。

iOS 模拟器须在安装了 Xcode 的 macOS 上运行：

```bash
cd apps/driver
npm ci
npm run ios
```

## 检查

```powershell
npm run lint
npm test
npm run typecheck
npm run build:check
```

## 本卡运行结果

- lint、类型检查、离线队列单元测试与 Android export 构建检查：见 PR CI。
- Android 模拟器：PASS；Windows 上以 API 30 模拟器连接本机开发服务，使用合成司机身份，任务列表正常显示空列表提示。脱敏截图：`E:\RouteFit-QA\evidence\RF-PM-056\android-empty-list.png`。
- iOS 模拟器：NOT_RUN；Windows 不能运行 Xcode 与 iOS Simulator。
- 真机后台定位、拍照、推送、外部导航返回、签名构建与分发：NOT_RUN；不在本骨架范围，且需要真机、权限与负责人批准。
- `/sync/events` 真实上报：NOT_RUN；本卡只定义并测试队列行为，避免在正式登录和持久化方案批准前形成错误客户端契约。
- 永久拒收隔离：NOT_RUN；当前永久拒收事件会阻塞队首，接入 `/sync/events` 时须按服务端结果隔离并提示司机或调度。

## RF-PM-057 运行结果

- lint、类型检查、任务操作单元测试与 Android export 构建检查：见 PR CI。
- Android 模拟器任务详情与接单／拒单链路：PASS；只使用本机开发服务、合成司机身份与合成派单。拒单二次确认和接单结果截图位于仓库外 `E:\RouteFit-QA\evidence\RF-PM-057\run-20261107-163733\`，接单事件只写入一次。
- iOS 模拟器：NOT_RUN；Windows 不能运行 Xcode 与 iOS Simulator。

## RF-PM-058 运行结果

- 本地持久化选择 `expo-sqlite`：它随 Expo 原生运行时提供事务，不把令牌或完整客户资料写入本地；数据库只保存 `/sync/events` 需要的事件字段、重试元数据和隔离结果。
- 离线队列：PASS；所有快照写入经同一串行通道，单元测试覆盖补传期间并发入队后内存、落盘与重启一致，以及重启恢复、事务失败、APPLIED／DUPLICATE 出队、永久拒收隔离、非推进型拒绝保留队首、退避重试和重传内容不变。
- `SYNC_SEQUENCE_INVALID` 连续 5 次后界面明确提示联系调度；根因仍由 RF-PM-055 批次 5 的设备注册解决。
- Android export、lint、类型检查：PASS；见 PR CI。
- 件级资料：PASS；订单详情按 `itemId`／`packageIds` 展示，并提示差异联系仓库。
- 交接签认、出发：NOT_RUN；当前司机读取接口不返回待交接记录 ID、版本或“全部件已保管”状态，无法在不修改后端／`openapi.json` 的前提下安全调用确认或显示出发按钮。
- Android 模拟器完整履约与真实补传：NOT_RUN；开发夹具没有受控设备和有效当班数据，且受上述待交接读取缺口阻塞。未修改开发夹具。
- iOS、真机：NOT_RUN；Windows 无 iOS Simulator，本卡也未申请真机权限或签名。
