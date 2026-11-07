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
