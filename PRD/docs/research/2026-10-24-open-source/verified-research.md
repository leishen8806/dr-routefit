# 开源候选资料复核与 R0 尽调范围

核查日期：2026-10-24。状态：**候选与来源复核完成；深度源码、安全、性能和部署验证未完成；不是 D24 选型批准。**

本轮读取用户附件全文，查询八个官方仓库、默认分支提交和七份许可文件；对 Crowdshipping 固定提交检查完整文件树。保留 [附件原文](user-research.txt) 与 [元数据快照](repository-snapshot.json)。没有下载/运行候选代码，没有修改 RouteFit 业务代码或三张设计图任务。

## 1. 固定来源快照

| 仓库 | 仓库许可标识 | 默认分支 SHA | pushed_at（UTC） |
|---|---|---|---|
| [fleetbase/fleetbase](https://github.com/fleetbase/fleetbase) | AGPL-3.0 | [9c5e164e5476](https://github.com/fleetbase/fleetbase/tree/9c5e164e5476b6038d24653f6e557b43aa27959c) | 2026-10-23T06:27:26Z |
| [fleetbase/fleetops](https://github.com/fleetbase/fleetops) | AGPL-3.0 | [33032e53ebee](https://github.com/fleetbase/fleetops/tree/33032e53ebee5e4a514970ee2379c12348c77c54) | 2026-10-24T12:08:42Z |
| [Volodymyr4K/ownfleet](https://github.com/Volodymyr4K/ownfleet) | MIT | [98744125c827](https://github.com/Volodymyr4K/ownfleet/tree/98744125c827b6e5bbe2af384c3ef9308c445ec8) | 2026-06-12T21:21:07Z |
| [VROOM-Project/vroom](https://github.com/VROOM-Project/vroom) | BSD-2-Clause | [07be776fc20b](https://github.com/VROOM-Project/vroom/tree/07be776fc20b8d6c85d9f78797e38a9f4e44ec44) | 2026-10-08T15:06:43Z |
| [google/or-tools](https://github.com/google/or-tools) | Apache-2.0 | [100f66e6242a](https://github.com/google/or-tools/tree/100f66e6242ab8bf8d32feb8f3bf086db66ae2b5) | 2026-10-23T21:14:06Z |
| [Project-OSRM/osrm-backend](https://github.com/Project-OSRM/osrm-backend) | BSD-2-Clause | [afd7d061981c](https://github.com/Project-OSRM/osrm-backend/tree/afd7d061981c8574872bbed5376112e76a8b2bb1) | 2026-10-21T09:35:08Z |
| [graphhopper/jsprit](https://github.com/graphhopper/jsprit) | Apache-2.0 | [2a4ccbc2f53a](https://github.com/graphhopper/jsprit/tree/2a4ccbc2f53a39e936ee45d512bd54c8029cf9be) | 2026-09-14T13:05:13Z |
| [arash-dehghan/Matching-Pricing-Crowdshipping](https://github.com/arash-dehghan/Matching-Pricing-Crowdshipping) | 未识别许可证；树中未见许可文件 | [1db36a3a26f0](https://github.com/arash-dehghan/Matching-Pricing-Crowdshipping/tree/1db36a3a26f09afc6a406f9b495c919f0a418a67) | 2026-04-03T15:40:54Z |

上表列顺序为仓库、仓库许可标识、默认分支 SHA、仓库 pushed_at（UTC）。全部八个仓库在查询时 archived=false。pushed_at 是仓库活动字段，不等于默认分支提交时间、最近稳定发布或维护质量；完整 commit_date 在 JSON 中。星数、README 测试数量和功能清单均不能证明生产成熟。

## 2. 候选定位核查

- **Fleetbase / Fleet-Ops**：官方将 Fleet-Ops 定义为 Fleetbase 的物流扩展，不能作为两套互相独立的平台叠加部署。可作业务流程对标；代码复用要逐组件看许可与依赖。[Fleet-Ops 官方说明](https://github.com/fleetbase/fleetops)
- **OwnFleet**：README 确认 NestJS、Next.js、React Native/Expo 及手工/推荐/自动派单，场景为自有配送队伍的餐饮商家。MIT 文件已读取，但其并发安全、GPS、ETA、签收与隔离测试说明仍属项目自述，本轮未运行或逐实现审计。不能据此宣布适配 DR 的大件装载和仓配财务。[官方仓库](https://github.com/Volodymyr4K/ownfleet)
- **VROOM**：路线优化引擎，BSD-2-Clause 许可文件已读取。保留为路线 POC 候选，不将“支持容量”翻译成“证明货物能装进车辆”。既有路线冻结、原承诺、服务时间、未分配任务与超时返回仍要逐项验证。[官方仓库](https://github.com/VROOM-Project/vroom)
- **OR-Tools**：Apache-2.0，组合优化候选；取送配对、时窗与容量模型需要业务层正确建立。作为复杂约束对照，不默认与 VROOM 同时进入生产。[官方仓库](https://github.com/google/or-tools)
- **OSRM**：BSD-2-Clause，道路路径和矩阵候选；金边道路质量、车型通行和实际时长未验证。道路时间不能直接等同含等待/装卸的履约 ETA，更不是实时路况或准时保证。[官方仓库](https://github.com/Project-OSRM/osrm-backend)
- **jsprit**：Apache-2.0 的 Java 路径优化工具，保留后备对照；没有证据支持现阶段再引入第三套求解器运行栈。[官方仓库](https://github.com/graphhopper/jsprit)
- **Matching-Pricing-Crowdshipping**：论文研究代码，README 明确要求 IBM CPLEX 单独安装；不能因为仓库公开就视为已获商用授权。固定提交完整树未发现 license/copying/notice 文件名，API license=null；必须取得明确授权后才考虑代码复用。研究数据/收益不外推金边。[官方 README](https://github.com/arash-dehghan/Matching-Pricing-Crowdshipping)

七份已读取的许可证原文件链接保存在快照中。Fleetbase README 当前还描述商业许可选项；不能由此推断报价、全部扩展/依赖覆盖或某部署方案已经获准。AGPL 相关网络服务源码义务须按修改、组合及交付方式评估，不能简化成“所有周边系统必须公开”或“隔一层 API 就自动免责”。[Fleetbase 许可说明](https://github.com/fleetbase/fleetbase#license)

## 3. 对原材料的必要修正

1. “值得做、非常适合”属于原作者判断，不是已验证商业结论。当前任务只评估能否支持已确认业务，不新增市场验证任务。
2. 原附件 OwnFleet 附图标题指向 **Onfleet**，名称不同；第三方文章和图片缓存不能用作 OwnFleet 功能证据。复核版只链接官方仓库，不复用这些图片。
3. “最小增量成本”必须加前提：安全、装载及所有已有承诺先通过，及时送业务优先；成本不能抵消硬约束。[已确认规则](../../confirmed-dispatch-loading-baseline.md)
4. 15 分钟/15% 继续只是候选配置，不冻结正式绕行制度；司机意愿、补偿、保险分账、客户确认、原承诺、交接和幂等由 DR 业务层负责。
5. 原材料缺独立 **3D 装箱**评估项，补回尽调清单。容积向量、路线容量和三维静态摆放都不能自动证明门洞进入、支撑、固定与卸货顺序。
6. 原材料 R0–R4 是历史拆分。当前 R1 为人工闭环，R1-M 为受控合作/快递，R1-V 为首期只读中控；推荐用 R2-A/B，合单/途中插单/返程用 R3-A/B/C。不要将推荐塞进 R1，也不要把 R1-V 顺延为历史 R4。
7. “未发现成熟整套项目”只能描述本次候选范围，不能证明 GitHub 上不存在任何适合项目。
8. 四项经营指标不必同时全部改善才有价值。正确评估应首先不破坏承诺与安全，再按服务等级比较增量收益与成本；匹配率上升但旧单延误，应直接否决。没有实验数据，不计算收益结论。

## 4. 采用组合前的决策分析

**Known Facts（事实）**：候选职责不同；目前 DR 只有原型与草案；硬约束和独立装载验证已确认；本轮仅核验来源/许可文件及提交。

**Assumptions（假设）**：单个路线引擎加独立装载验证能覆盖首轮试点；现有数据质量足以生成有意义样例。这两项尚未由本轮证明。

**Inferences（推断）**：保留 DR 业务层、把求解器当可替换计算组件，比替换全部后台的改动面更可控；这是工程判断，不是集成工时估算。

**Unknowns（未知）**：完整依赖许可、并发实现质量、地图误差、3D约束完整性、求解耗时、司机设备与集成维护成本。

最强反对理由：① 多引擎与业务平台组合会放大状态/版本不一致；② 路线可行不等于装载或实际时效可行；③ 许可和成熟度未审计，直接采用会形成替换成本。

最强支持理由：① 路线与业务层分离便于保持既有流程；② 候选提供不同层次的可复用能力，可用统一样例比较；③ 隔离 POC 不接生产，失败可以低成本撤回。

### Verdict

支持进入受限 R0 技术验证，不支持把附件组合直接定为生产技术栈。OwnFleet/Fleetbase 作参考；VROOM 首个路线 POC 候选，OR-Tools 对照；OSRM 为可替换矩阵来源；3D 引擎单独筛选；jsprit 后备，Crowdshipping 仅研究思路、许可先澄清。

### Confidence

80%：仅对“先做隔离技术验证而非直接集成”的流程判断，不是任一候选安全性或性能通过概率。

### Why

官方来源支持候选职责划分，但本轮没有任何候选满足 DR 全部硬约束的运行证据。可替换适配和统一反例能直接降低最大技术不确定性。

### Key Variables

已承诺路线与时窗能否保持；逐段实际装载能否可靠验证；数据质量及集成/许可成本。

### Largest Unknown

路线求解与装载验证结合后，在合理求解预算内是否仍能稳定返回可解释、安全的结果。

### Reversal Condition

统一反例出现硬约束违规、关键约束无法表达或许可不可接受，就取消该候选的主选资格；若对照引擎在相同输入/预算下更可靠，调整 POC 首选。

## 5. 最小技术验证计划（尚未执行）

- **Hypothesis**：一个路线候选器结合独立可行性校验即可支持受控场景，不需整套替换运营后台。
- **Test**：使用同一固定矩阵及车辆/货物/路线版本构造至少 12 个正反例：超载、超容积、内部尺寸/门洞不符、禁止旋转/堆叠、途中区段超载、先送后取、已有低等级承诺被新 S1 挤占、无可行车、旧版本、重复确认，以及一个合法拼单。对 VROOM 与 OR-Tools 分别记录候选与拒绝原因；装载未证明返回 UNKNOWN，禁止派发。并发/幂等在 DR 提交层单独测，不指望求解器负责。
- **Success Metric**：全部已定义硬约束反例无误放行；合法样例可复现；超时/无解/未知有明确区分；所有输出绑定相同输入版本。仅记录耗时，不凭未测数据承诺生产延迟。
- **Failure Threshold**：任一安全或原承诺违规被当作可派发即失败；若只是实现缺项，记录缺项，不跳过用例宣布通过。
- **Time Limit**：建议两个工程日用于首轮合成 POC；属于提议预算，不是工期承诺。到期提交结果或阻塞证据，不无限加组件。
- **Decision After Test**：通过才进入 D24 的组件比较；不通过先判断数据/建模/组件问题，再换候选或保持人工路径。真实金边道路及真机联调另行记录。

## 6. 深度尽调仍需交付

固定 SHA 的关键源码路径、派单并发/幂等/越权复现、依赖与许可证清单、求解器输入输出适配、路线锁定和装载反馈、故障降级、基准结果、API/数据库兼容差异及 ADR。当前没有逐文件安全审计或运行基准，不能把本文件标题中的 R0 误读为 R0 已验收。

本轮仅归档复核材料，不修改已确认规则、正式技术栈、业务实现、设计图任务，也不向其他开发者发任务。
