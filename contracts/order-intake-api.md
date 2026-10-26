# 订单受理输入与配送区域 API

v0.1 本机开发切片，2026-10-25。以 `openapi.json` 为字段契约；正式 PRD／RULE／AT 未改。调用前按 [开发会话](local-development-api.md) 激活同源身份。全部使用合成资料，不接受生产登录或公网调用。

## 实现范围

| 方法与路径（前缀 `/api/ops/v1`） | 权限 | 输入 / 成功响应 |
|---|---|---|
| GET `/service-areas` | areas:read | limit、cursor / ServiceAreaPage |
| POST `/service-areas` | areas:create | ServiceAreaDraft / 201 ServiceArea v1 |
| POST `/service-areas/{id}/actions/publish` | areas:publish | IntakeReason、If-Match v1 / ServiceArea v2 active |
| POST `/service-areas/{id}/actions/retire` | areas:publish | IntakeReason、If-Match v2 / ServiceArea v3 superseded |
| POST `/orders/{id}/intake-evidence` | orders:verify | OrderIntakeInput、订单 If-Match / 201 OrderIntakeEvidence |
| GET `/orders/{id}/intake-check` | orders:read | OrderIntakeCheck，含当前依据、来源快照、阻断项 |
| POST `/orders/{id}/actions/submit` | orders:submit | `{}`、订单 If-Match / OrderDetail |
| POST `/orders/{id}/actions/return-to-draft` | orders:edit | IntakeReason、订单 If-Match / OrderDetail |

每个写操作要求 `Idempotency-Key`、`X-CSRF-Token`；动作还要求双引号整数 `If-Match`。同一请求结果未知时保留方法、路径、请求体、版本和幂等键原样重试；成功响应含 `Idempotent-Replayed`。区域列表使用身份绑定的签名游标，不是 UUID after 参数。

## 受理顺序

1. 创建、读取订单草稿；取送 `point` 格式 `{lng,lat}`，不是 GeoJSON 数组。联系人、地址、货物和时间依原有 OrderDraft 校验。
2. 配置并发布合成配送区域。没有发布区域时阻断，不默认全城可送。
3. 用 [order-intake.json](examples/order-intake.json) 登记当前订单版本依据。取送分别提供确认渠道 PHONE／IN_PERSON／MESSAGE、reference 与具体入口 entrance。每行货物按 clientItemId 提供来源 CUSTOMER_DECLARED／WAREHOUSE_MEASURED、reference 及是否为包装后数据。
4. 读取 intake-check；`ready` 只表示当前受理输入完整且取送点落入当前有效区域。响应 `evidence` 包含原始来源快照、登记人及时间；无当前版本依据时为 null。
5. submit 在事务中重新读取并检查，不信任先前 GET 的 ready。通过后 `draft→validating`、订单版本 +1；保留 evidenceId、sourceOrderVersion、acceptedOrderVersion、areaRevision、checkedAt。缺项返回 422 INTAKE_BLOCKED 和字段阻断列表，订单版本、状态、历史均不改变。
6. validating 不可直接编辑或登记新依据。需修改时以 reason 退回 draft，版本 +1；退回原因只追加保存。修改草稿再次 +1；任何新版本都需重新登记依据。

登记依据本身不递增订单版本，但每次产生独立不可改写记录；同一版本有多份时，submit 选锁内最新一份并冻结其 ID。登记人和时间由服务端生成，禁止客户端伪造。普通 GET 检查不会提交或改状态。

`sourceQuality=MANUAL_RECORDED`、`automationEligible=false`。人工称为仓库实测也不等于系统验证了测量、地图、三维装箱或车辆可装载。当前仅为输入核验，不承诺时效，不生成报价、应收、付款、车辆指派。正式报价接口仍未实现。

## 区域约束与变更

GeoJSON 坐标为 `[lng,lat]`，首尾闭合；当前单外环 3–100 个不同顶点，不支持孔洞。自交、重复点、极小面积拒绝。局部平面算法技术边界为经纬跨度各不超过 1°、纬度绝对值不超过 70°；这些是本地实现限制，不是正式业务服务区。生产地理处理仍需 GeoCore／PostGIS 评审。

最多 50 个 active 区域；effectiveFrom 到时才生效。DENY 优先于 ALLOW，双方边界均算命中；取送两点都必须通过。没有 ALLOW 命中、全部停用、仅有未来区域均拒绝，不能靠加价放行。不提供编辑、删除区域接口；变更采用停用旧区域并发布新草稿，保留历史。

区域发布／停用与订单提交共享企业级锁。每次变化产生企业内递增 revision。变化后旧受理快照仍保留，GET 返回 COVERAGE_CHANGED，需退回重核；不会静默改成取消、换区或重新承诺。检查也会在期望送达窗口结束时阻断。

## 错误与接入注意

| 情况 | 行为 |
|---|---|
| 缺依据、坐标、尺寸重量，包装未确认、超区、禁送、时间过期 | 422 INTAKE_BLOCKED；明细在 error.fields |
| 旧版本 | 412 VERSION_CONFLICT，刷新后重新判断，不覆盖 |
| 错状态 | 409 INVALID_STATE，不替用户自动退回 |
| 超出本地几何能力 | 422 CAPABILITY_DISABLED；不悄悄简化多边形 |
| 货物依据重复或遗漏 | 422 CARGO_EVIDENCE_MISMATCH |
| 跨企业、无客户授权、授权已撤销 | 404，包括成功请求的重放 |

本轮将原区域 publish 的泛用 EvidenceAction 收敛为明确 `IntakeReason {reason}`，没有伪造可用附件上传。领域权限沿用区域发布权限，不引入财务复核权限。新 bootstrap 身份 0／1 可验证各自企业的区域与受理，身份 2／3 仍只做价格复核／批准；旧会话不会自动扩权。

大旺接线：现有 `orders.html` 仅录单和只读核验状态；受理依据、区域发布及退回动作尚无新交互页面。可先通过接口与 `npm run smoke:intake` 联调。不要用共享 Demo 的本地状态代替数据库返回值，也不要修改 `app.mjs`／`app.css` 来绕过权限。

验证见 [本轮记录](../services/routefit/verification/order-intake/README.md)。004 增量迁移保留 001–003；原记录不可覆盖。D24、正式身份、地图及后续报价仍属后续交付。

## 005报价增量

quoted仍使用原受理来源版本，不因报价递增版本而丢失依据。return-to-draft现在允许validating/quoted，清除当前quoteId，使旧报价在GET时为superseded；尚无确认报价能力。详见 [订单报价](order-quotes-api.md)。
