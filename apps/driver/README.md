# RouteFit Driver App skeleton

RF-PM-056 的 React Native（Expo + TypeScript）最小工程骨架。当前只有本机开发会话占位、司机任务列表读取和未接真实上报的离线事件队列；不是可分发的生产 App。

## 本机运行

要求 Node 24、npm、Android Studio。服务端必须在本机 `127.0.0.1:4180` 运行并配置开发司机身份。

```powershell
cd apps/driver
npm ci
adb reverse tcp:4180 tcp:4180
npm run android
```

Android 模拟器通过 `adb reverse` 把模拟器内的 `127.0.0.1:4180` 映射到开发机；App 不接受远端服务地址。启动后输入本机开发会话的原始令牌，令牌只保存在当前进程内，不写磁盘、不进日志。

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
```

## 本卡运行结果

- lint 与离线队列单元测试：见 PR CI。
- Android 模拟器：NOT_RUN；当前验收机未连接可用的 Android 模拟器或设备。
- iOS 模拟器：NOT_RUN；Windows 不能运行 Xcode 与 iOS Simulator。
- 真机后台定位、拍照、推送、外部导航返回、签名构建与分发：NOT_RUN；不在本骨架范围，且需要真机、权限与负责人批准。
- `/sync/events` 真实上报：NOT_RUN；本卡只定义并测试队列行为，避免在正式登录和持久化方案批准前形成错误客户端契约。
