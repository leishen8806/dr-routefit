# 字段字典 v0.1

由 openapi.json 生成。所有对象拒绝未声明字段；“可省略”不代表接受null。关联ID均须校验企业、货主、仓库和对象授权。示例见 examples/schema-cases.json；跨字段业务校验见开发对照。

## Id

服务端分配的不透明ID；示例ID不代表正式编号规则

string


## Timestamp

RFC3339带时区；响应统一UTC；观测时间不替代服务端生效时间

string


## Currency

USD金额为分；KHR金额为瑞尔整数；不可跨币种抵销

`USD` / `KHR`


## Money

非负金额；币种精度由Currency确定

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| amountMinor | integer | 是 | 最小单位整数；minimum=0, maximum=9000000000000 |
| currency | [Currency](fields.md#currency) | 是 | ； |

## PositiveMoney

需要大于零的实际金额

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| amountMinor | integer | 是 | 最小单位整数；minimum=1, maximum=9000000000000 |
| currency | [Currency](fields.md#currency) | 是 | ； |

## ResourceVersion

关联聚合版本；同一事务重新检查

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |

## FieldError

单字段错误

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| path | string | 是 | JSON Pointer或查询参数名；minLength=1, maxLength=255 |
| code | string | 是 | 稳定错误码；minLength=1, maxLength=64 |
| message | string | 是 | 本地化提示；minLength=1, maxLength=500 |

## ErrorDetail

响应不包含密钥、内部堆栈或无权访问字段

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| code | string | 是 | 机器错误码；minLength=1, maxLength=64 |
| message | string | 是 | 本地化说明；minLength=1, maxLength=500 |
| messageKey | string | 是 | 翻译键；minLength=1, maxLength=128 |
| retryable | boolean | 是 | 是否可以按同键重试；未知付款不是重发； |
| requestId | [Id](fields.md#id) | 是 | ； |
| fields | array<[FieldError](fields.md#fielderror)> | 是 | ；minItems=0, maxItems=100 |
| currentVersion | integer | 可省略 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |

## ApiError

统一错误对象；404不得泄露对象是否存在

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| error | [ErrorDetail](fields.md#errordetail) | 是 | ； |

## Reason

须记录业务原因；没有状态/角色写入字段

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| reason | string | 是 | 原因；minLength=1, maxLength=1000 |

## EvidenceAction

确认、审核或驳回的证据；批准绑定当前版本

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| reason | string | 是 | 理由；minLength=1, maxLength=1000 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | 已完成扫描且有对象授权的文件；minItems=1, maxItems=20 |

## EmptyCommand

仅触发动作，不接收状态或金额

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|

## Actor

可信会话投影；personId标识自然人而非角色账号

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| personId | [Id](fields.md#id) | 是 | ； |
| operatingCompanyId | [Id](fields.md#id) | 是 | ； |
| subjectIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=100 |
| permissions | array<string> | 是 | ；minItems=0, maxItems=200 |
| locale | `km` / `en` / `zh-Hans` | 是 | 稳定编码，未知编码不得推断为成功； |

## Session

当前会话，不返回访问令牌、密码或刷新令牌

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| actor | [Actor](fields.md#actor) | 是 | ； |
| expiresAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| csrfToken | string | 可省略 | 仅Web会话使用；不写入日志；minLength=1, maxLength=256 |

## TimeWindow

start必须早于end；左闭右开

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| start | [Timestamp](fields.md#timestamp) | 是 | ； |
| end | [Timestamp](fields.md#timestamp) | 是 | ； |

## Point

WGS84坐标

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| lat | number | 是 | 纬度；minimum=-90, maximum=90 |
| lng | number | 是 | 经度；minimum=-180, maximum=180 |

## Location

地址原文保留；无坐标不填0；确认由后台写快照

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| address | string | 是 | 原文地址；minLength=1, maxLength=1000 |
| contactName | string | 是 | 本次交接联系人；minLength=1, maxLength=120 |
| phone | string | 是 | ；pattern=^\+[1-9][0-9]{7,14}$ |
| point | [Point](fields.md#point) 或 null | 是 | ； |
| landmark | string | 可省略 | 地标/入口；minLength=1, maxLength=500 |

## CargoItem

逐包装件；尺寸为包装后实测；缺失尺寸不得自动放行

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| clientItemId | [Id](fields.md#id) | 是 | ； |
| skuId | [Id](fields.md#id) | 可省略 | ； |
| name | string | 是 | 货物名称；minLength=1, maxLength=255 |
| quantity | integer | 是 | 件数；minimum=1, maximum=1000 |
| lengthCm | number 或 null | 是 | ； |
| widthCm | number 或 null | 是 | ； |
| heightCm | number 或 null | 是 | ； |
| weightKg | number 或 null | 是 | ； |
| unknownReason | string | 可省略 | 有未知尺寸/重量时必填；minLength=1, maxLength=500 |
| rotationAllowed | boolean | 是 | 允许旋转； |
| stackable | boolean | 是 | 允许堆叠； |
| uprightOnly | boolean | 是 | 禁止倒置； |
| restrictions | array<`FRAGILE` / `TEMPERATURE_CONTROLLED` / `SPECIAL_EQUIPMENT` / `NO_EXTERNAL_OVERHANG`> | 是 | ；minItems=0, maxItems=100 |
| measurementEvidenceIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=20 |

## OrderDraft

业务输入；无companyId/status/paid字段；货主归属由会话或授权客户ID确定

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| customerId | [Id](fields.md#id) | 是 | ； |
| pickup | [Location](fields.md#location) | 是 | ； |
| delivery | [Location](fields.md#location) | 是 | ； |
| items | array<[CargoItem](fields.md#cargoitem)> | 是 | ；minItems=1, maxItems=200 |
| serviceLevel | `S1` / `S2` / `S3` / `S4` | 是 | S1及时/S2当日/S3预约/S4经济拼单；S4默认关闭； |
| exclusiveVehicle | boolean | 是 | 付费独享要求，与服务等级分开； |
| requestedPickupWindow | [TimeWindow](fields.md#timewindow) | 是 | ； |
| requestedDeliveryWindow | [TimeWindow](fields.md#timewindow) | 是 | ； |
| paymentTerms | `PREPAID` / `APPROVED_CREDIT` | 是 | 月结必须服务器校验有效授信； |
| creditAgreementId | [Id](fields.md#id) | 可省略 | ； |
| cod | [Money](fields.md#money) | 可省略 | ； |
| merchantBeneficiaryId | [Id](fields.md#id) | 可省略 | ； |
| notes | string | 可省略 | 要求/上楼/装卸备注；minLength=1, maxLength=2000 |

## CustomerOrderDraft

C1-ORDER 受控下单开启后使用；customerId不接收，由服务端当前货主身份确定

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| pickup | [Location](fields.md#location) | 是 | ； |
| delivery | [Location](fields.md#location) | 是 | ； |
| items | array<[CargoItem](fields.md#cargoitem)> | 是 | ；minItems=1, maxItems=200 |
| serviceLevel | `S1` / `S2` / `S3` / `S4` | 是 | S1及时/S2当日/S3预约/S4经济拼单；S4默认关闭； |
| exclusiveVehicle | boolean | 是 | 付费独享要求，与服务等级分开； |
| requestedPickupWindow | [TimeWindow](fields.md#timewindow) | 是 | ； |
| requestedDeliveryWindow | [TimeWindow](fields.md#timewindow) | 是 | ； |
| paymentTerms | `PREPAID` / `APPROVED_CREDIT` | 是 | 月结必须服务器校验有效授信； |
| creditAgreementId | [Id](fields.md#id) | 可省略 | ； |
| cod | [Money](fields.md#money) | 可省略 | ； |
| merchantBeneficiaryId | [Id](fields.md#id) | 可省略 | ； |
| notes | string | 可省略 | 要求/上楼/装卸备注；minLength=1, maxLength=2000 |

## FeeItem

独立费用项，保险和COD不得进入配送分成

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| purpose | `DELIVERY` / `DISTANCE` / `EXCLUSIVE` / `HANDLING` / `STAIRS` / `WAITING` / `WAREHOUSE` / `INSURANCE` / `DISCOUNT` | 是 | 稳定编码，未知编码不得推断为成功； |
| money | [Money](fields.md#money) | 是 | ； |
| direction | `CHARGE` / `DISCOUNT` | 是 | 稳定编码，未知编码不得推断为成功； |
| basis | string | 是 | 计费依据；minLength=1, maxLength=1000 |

## QuoteRequest

按服务器计价版本计算；禁止直接传报价

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| pricingPolicyVersionId | [Id](fields.md#id) | 是 | ； |
| distanceEvidenceId | [Id](fields.md#id) | 可省略 | ； |
| insuranceRequested | boolean | 是 | 仅报价，不等于承保； |
| serviceCaseId | [Id](fields.md#id) | 可省略 | 仅确认报价后的受理变更申请可填写；候选重报价不直接生效； |

## Quote

只追加报价事实；GET实时派生expired/superseded，不覆盖原快照。orderVersion为报价生成后的订单版本；sourceOrderVersion为输入版本。ETag为报价自身版本。保险独立，不等于承保或收付款。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| orderId | [Id](fields.md#id) | 是 | ； |
| orderVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| state | `issued` / `confirmed` / `expired` / `superseded` | 是 | 稳定编码，未知编码不得推断为成功； |
| fees | array<[FeeItem](fields.md#feeitem)> | 是 | ；minItems=1, maxItems=100 |
| total | [Money](fields.md#money) | 是 | ； |
| expiresAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| pricingPolicyVersionId | [Id](fields.md#id) | 是 | ； |
| customerConfirmedAt | [Timestamp](fields.md#timestamp) 或 null | 是 | ； |
| sourceOrderVersion | integer | 可省略 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| createdAt | [Timestamp](fields.md#timestamp) | 可省略 | ； |
| insuranceRequested | boolean | 可省略 | ； |
| calculation | object | 可省略 | ； |
| sourceOrderSnapshot | [OrderDetail](fields.md#orderdetail) | 可省略 | ； |
| policySnapshot | [PricingPolicyVersion](fields.md#pricingpolicyversion) | 可省略 | ； |
| unusableReasons | array<string> | 可省略 | ；maxItems=500 |
| confirmation | object | 可省略 | ； |
| amendment | object | 可省略 | 已确认订单的候选重报价；客户确认仍不直接改原订单或资金； |

## PromiseCheck

只读可行性结果，不能直接派单

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| orderId | [Id](fields.md#id) | 是 | ； |
| orderVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| quoteId | [Id](fields.md#id) | 是 | ； |
| feasible | boolean | 是 | 硬约束全满足才true； |
| reasons | array<string> | 是 | ；minItems=0, maxItems=100 |
| expiresAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| planVersion | integer 或 null | 是 | 人工快递无路线版本时null，不能伪造； |

## PromiseCheckRequest

车辆与人工快递分别检查，不强迫快递填虚构车辆

[VehiclePromiseCheckRequest](fields.md#vehiclepromisecheckrequest) 或 [CarrierPromiseCheckRequest](fields.md#carrierpromisecheckrequest)


## PromiseRequest

受控人工承诺，不是保证真实ETA

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| quoteId | [Id](fields.md#id) | 是 | ； |
| checkId | [Id](fields.md#id) | 是 | ； |
| customerConsentEvidenceIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |
| pickupWindow | [TimeWindow](fields.md#timewindow) | 是 | ； |
| deliveryWindow | [TimeWindow](fields.md#timewindow) | 是 | ； |
| supersedesPromiseId | [Id](fields.md#id) | 可省略 | ； |

## Promise

不可覆盖原承诺

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| orderId | [Id](fields.md#id) | 是 | ； |
| acceptedAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| pickupWindow | [TimeWindow](fields.md#timewindow) | 是 | ； |
| deliveryWindow | [TimeWindow](fields.md#timewindow) | 是 | ； |
| basis | `APPROVED_MANUAL` / `CALIBRATED` | 是 | 稳定编码，未知编码不得推断为成功； |
| supersedesPromiseId | [Id](fields.md#id) 或 null | 是 | ； |

## OrderSummary

门户安全投影，不含采购价、利润、内部备注或整车路径

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| orderNo | string | 是 | 业务单号；minLength=1, maxLength=64 |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| state | `draft` / `validating` / `quoted` / `awaiting_dispatch` / `executing` / `delivered` / `cancelled` / `return_open` / `returned` / `closed_exception` | 是 | 稳定编码，未知编码不得推断为成功； |
| serviceLevel | `S1` / `S2` / `S3` / `S4` | 是 | 稳定编码，未知编码不得推断为成功； |
| fulfillmentStage | `none` / `pickup_pending` / `picked_up` / `in_transit` / `delivery_recorded` | 是 | 稳定编码，未知编码不得推断为成功； |
| customerId | [Id](fields.md#id) | 是 | ； |
| promiseId | [Id](fields.md#id) 或 null | 是 | ； |
| collectionState | `unpaid` / `reported` / `partial` / `allocated` / `disputed` | 是 | 稳定编码，未知编码不得推断为成功； |
| updatedAt | [Timestamp](fields.md#timestamp) | 是 | ； |

## OrderDetail

运营订单详情；只返回有相应字段权限的业务资料，财务单独授权查询

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| order | [OrderSummary](fields.md#ordersummary) | 是 | ； |
| pickup | [Location](fields.md#location) | 是 | ； |
| delivery | [Location](fields.md#location) | 是 | ； |
| items | array<[OrderItem](fields.md#orderitem)> | 是 | ；minItems=1, maxItems=200 |
| activeExecutionId | [Id](fields.md#id) 或 null | 是 | ； |
| quoteId | [Id](fields.md#id) 或 null | 是 | ； |
| blockingExceptionIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=100 |
| draft | [OrderDraft](fields.md#orderdraft) | 可省略 | 运营录单完整输入快照；本地订单接口始终返回，供编辑回填。不能据此认定付款或时效已承诺。； |
| intake | object | 可省略 | ； |

## CustomerOrderDetail

当前货主订单，联系信息仅本次交付用途；不返回内部执行成本

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| order | [OrderSummary](fields.md#ordersummary) | 是 | ； |
| pickup | [Location](fields.md#location) | 是 | ； |
| delivery | [Location](fields.md#location) | 是 | ； |
| items | array<[OrderItem](fields.md#orderitem)> | 是 | ；minItems=1, maxItems=200 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=100 |
| quoteId | [Id](fields.md#id) 或 null | 是 | ； |

## TimelineEvent

可见领域事件；不直接暴露审计原始载荷

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| type | string | 是 | 领域事件编码；minLength=1, maxLength=128 |
| occurredAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| summary | string | 是 | 对当前角色可见的说明；minLength=1, maxLength=1000 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=100 |

## Vehicle

车辆资料与当前占用版本

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| label | string | 是 | 识别标签；minLength=1, maxLength=64 |
| kind | `MOTORCYCLE` / `TRICYCLE` / `VAN` / `LIGHT_TRUCK` / `BOX_TRUCK` | 是 | 稳定编码，未知编码不得推断为成功； |
| specVersionId | [Id](fields.md#id) | 是 | ； |
| state | `available` / `busy` / `paused` / `incident` | 是 | 稳定编码，未知编码不得推断为成功； |
| maxPayloadKg | number | 是 | 实测有效载重；minimum=0.001, maximum=100000 |
| internalLengthCm | number | 是 | 有效内长；minimum=0.01, maximum=100000 |
| internalWidthCm | number | 是 | 有效内宽；minimum=0.01, maximum=100000 |
| internalHeightCm | number | 是 | 有效内高；minimum=0.01, maximum=100000 |
| doorWidthCm | number | 是 | 门宽；minimum=0.01, maximum=100000 |
| doorHeightCm | number | 是 | 门高；minimum=0.01, maximum=100000 |

## Candidate

规则初筛候选，不是算法最优承诺

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| vehicleId | [Id](fields.md#id) | 是 | ； |
| driverId | [Id](fields.md#id) | 是 | ； |
| vehicleVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| planVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| eligible | boolean | 是 | 是否满足当前硬约束； |
| reasons | array<string> | 是 | ；minItems=0, maxItems=100 |
| estimatedCost | [Money](fields.md#money) 或 null | 是 | ； |
| estimateType | `MANUAL` / `UNCALIBRATED` / `CALIBRATED` / `UNAVAILABLE` | 是 | 稳定编码，未知编码不得推断为成功； |

## AssignmentRequest

发出提案前重新检查支付、承诺、资格及装载

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| vehicleId | [Id](fields.md#id) | 是 | ； |
| driverId | [Id](fields.md#id) | 是 | ； |
| vehicleVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| planVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| loadReviewId | [Id](fields.md#id) | 是 | ； |
| promiseId | [Id](fields.md#id) | 是 | ； |
| availabilityId | [Id](fields.md#id) | 可省略 | ； |

## Assignment

提案与指派同一聚合，不另存一套DispatchOffer状态

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| orderId | [Id](fields.md#id) | 是 | ； |
| vehicleId | [Id](fields.md#id) | 是 | ； |
| driverId | [Id](fields.md#id) | 是 | ； |
| state | `offered` / `accepted` / `completed` / `expired` / `rejected` / `revoked` / `superseded` | 是 | 稳定编码，未知编码不得推断为成功； |
| expiresAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| planVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |

## AcceptAssignment

必须在线；TTL使用服务器时间

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| planVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |

## LoadReviewRequest

装箱证据与约束逐项记录；REJECTED不能人工强制覆盖

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| vehicleId | [Id](fields.md#id) | 是 | ； |
| specVersionId | [Id](fields.md#id) | 是 | ； |
| result | `RELEASED` / `REJECTED` / `NEEDS_REVIEW` | 是 | 稳定编码，未知编码不得推断为成功； |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |
| reason | string | 是 | 实测/装箱/人工模式依据；minLength=1, maxLength=1000 |

## LoadReview

只追加复核事实

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| orderId | [Id](fields.md#id) | 是 | ； |
| orderVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| vehicleId | [Id](fields.md#id) | 是 | ； |
| specVersionId | [Id](fields.md#id) | 是 | ； |
| result | `RELEASED` / `REJECTED` / `NEEDS_REVIEW` | 是 | 稳定编码，未知编码不得推断为成功； |
| reviewerPersonId | [Id](fields.md#id) | 是 | ； |
| recordedAt | [Timestamp](fields.md#timestamp) | 是 | ； |

## ItemMovement

具体件标识，不接受只给总件数

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| itemId | [Id](fields.md#id) | 是 | ； |
| packageIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=1000 |

## TransferRequest

双方签认才改变实物保管；from/to由当前托管记录校验

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| orderId | [Id](fields.md#id) | 是 | ； |
| orderVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| assignmentId | [Id](fields.md#id) | 是 | ； |
| assignmentVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| fromCustodianId | [Id](fields.md#id) | 是 | ； |
| toCustodianId | [Id](fields.md#id) | 是 | ； |
| items | array<[ItemMovement](fields.md#itemmovement)> | 是 | ；minItems=1, maxItems=100 |
| loadReviewId | [Id](fields.md#id) | 是 | ； |
| observedAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## Transfer

签认记录不可覆盖；差异保留原保管关系

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| orderId | [Id](fields.md#id) | 是 | ； |
| state | `proposed` / `partially_signed` / `confirmed` / `discrepancy` | 是 | 稳定编码，未知编码不得推断为成功； |
| fromCustodianId | [Id](fields.md#id) | 是 | ； |
| toCustodianId | [Id](fields.md#id) | 是 | ； |
| items | array<[ItemMovement](fields.md#itemmovement)> | 是 | ；minItems=1, maxItems=100 |
| signedPersonIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=2 |

## DeliveryRequest

部分收货如实记录；剩余货物走退回，不能整单delivered

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| deliveredPackageIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=1000, uniqueItems=True |
| remainingPackageIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=1000, uniqueItems=True |
| recipientAuthorizationId | [Id](fields.md#id) | 是 | ； |
| observedAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |
| reason | string | 可省略 | 部分/拒收原因；minLength=1, maxLength=1000 |

## ExceptionRequest

异常上报不自动认责或赔偿

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| orderId | [Id](fields.md#id) | 是 | ； |
| category | `ACCIDENT` / `MISSING` / `DAMAGED` / `WRONG_GOODS` / `RECIPIENT_UNAVAILABLE` / `REFUSED` / `PRICE_DISPUTE` / `OTHER` | 是 | 稳定编码，未知编码不得推断为成功； |
| description | string | 是 | 事实；minLength=1, maxLength=2000 |
| packageIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=1000 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=20 |
| observedAt | [Timestamp](fields.md#timestamp) | 是 | ； |

## Exception

独立异常聚合

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| orderId | [Id](fields.md#id) | 是 | ； |
| state | `open` / `assigned` / `resolving` / `resolved` / `closed` | 是 | 稳定编码，未知编码不得推断为成功； |
| category | string | 是 | 异常类型；minLength=1, maxLength=64 |
| ownerId | [Id](fields.md#id) 或 null | 是 | ； |
| dueAt | [Timestamp](fields.md#timestamp) 或 null | 是 | ； |
| blockingActions | array<string> | 是 | ；minItems=0, maxItems=100 |

## ReturnRequest

不直接取消已取货订单

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| packageIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=1000 |
| reason | string | 是 | 退回理由；minLength=1, maxLength=1000 |
| warehouseId | [Id](fields.md#id) | 是 | ； |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## ReturnTask

回仓、点收、检验分开；到仓不自动上架

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| orderId | [Id](fields.md#id) | 是 | ； |
| warehouseId | [Id](fields.md#id) | 是 | ； |
| state | `requested` / `authorized` / `assigned` / `picked_up` / `received` / `inspected` / `closed` | 是 | 稳定编码，未知编码不得推断为成功； |
| packageIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=1000 |
| discrepancyOpen | boolean | 是 | 差异未闭合则不能关闭； |

## ReturnReceipt

据实点收，不以计划量补齐

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| receivedPackageIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=1000 |
| missingPackageIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=1000 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## ReturnInspection

仅按仓储权威写入处置；不能自动增加可售库存

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| packageIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=1000 |
| disposition | `QUARANTINE` / `RESTOCK_APPROVED` / `DAMAGED_HOLD` | 是 | 稳定编码，未知编码不得推断为成功； |
| reason | string | 是 | 检验依据；minLength=1, maxLength=1000 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## PartnerDraft

合作单位/个人准入

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| name | string | 是 | 名称；minLength=1, maxLength=255 |
| kind | `PARTNER_VEHICLE` / `PARCEL_CARRIER` | 是 | 稳定编码，未知编码不得推断为成功； |
| contact | string | 是 | 联系人；minLength=1, maxLength=255 |
| phone | string | 是 | 联系号码；minLength=1, maxLength=32 |
| qualificationFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## Partner

停用不抹掉在途货物和应付

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| name | string | 是 | 名称；minLength=1, maxLength=255 |
| kind | `PARTNER_VEHICLE` / `PARCEL_CARRIER` | 是 | 稳定编码，未知编码不得推断为成功； |
| state | `draft` / `pending_verification` / `active` / `suspended` / `exited` | 是 | 稳定编码，未知编码不得推断为成功； |
| agreementVersionId | [Id](fields.md#id) 或 null | 是 | ； |

## BookingRequest

人工快递委托，不生成虚构渠道回执

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| partnerId | [Id](fields.md#id) | 是 | ； |
| agreementVersionId | [Id](fields.md#id) | 是 | ； |
| proposedCost | [PositiveMoney](fields.md#positivemoney) | 是 | ； |
| serviceDescription | string | 是 | 服务内容；minLength=1, maxLength=1000 |

## Booking

与有效车辆指派互斥；取消未知不释放有效执行

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| orderId | [Id](fields.md#id) | 是 | ； |
| partnerId | [Id](fields.md#id) | 是 | ； |
| state | `draft` / `pending_confirmation` / `confirmed` / `pickup_pending` / `in_transit` / `delivery_reported` / `delivered_verified` / `cancel_requested` / `cancelled` / `exception` | 是 | 稳定编码，未知编码不得推断为成功； |
| externalTrackingNo | string 或 null | 是 | ； |

## BookingConfirm

确认委托不等于已交货

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| externalTrackingNo | string | 是 | 承运商单号；minLength=1, maxLength=128 |
| confirmedCost | [PositiveMoney](fields.md#positivemoney) | 是 | ； |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## CarrierEvent

外部报告与平台核验分开

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| externalEventId | string | 是 | 来源事件ID；minLength=1, maxLength=128 |
| reportedStatus | string | 是 | 原始状态；minLength=1, maxLength=128 |
| observedAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## RescueLeg

事故单件只分给一个救援任务；预留不改变保管

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| packageIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=1000 |
| vehicleId | [Id](fields.md#id) | 是 | ； |
| driverId | [Id](fields.md#id) | 是 | ； |
| vehicleVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| planVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| loadReviewId | [Id](fields.md#id) | 是 | ； |

## RescueRequest

事故应急例外，非正常业务随意拆单；父单只计费一次

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| exceptionId | [Id](fields.md#id) | 是 | ； |
| exceptionVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| legs | array<[RescueLeg](fields.md#rescueleg)> | 是 | ；minItems=1, maxItems=20 |
| reason | string | 是 | 安全处置依据；minLength=1, maxLength=1000 |

## RescuePlan

各子任务接受及交接后才转保管

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| orderId | [Id](fields.md#id) | 是 | ； |
| exceptionId | [Id](fields.md#id) | 是 | ； |
| state | `proposed` / `executing` / `custody_closed` | 是 | 稳定编码，未知编码不得推断为成功； |
| assignmentIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |
| remainingPackageIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=1000 |

## AccountMasked

只读脱敏结算账户，不返回完整账号

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| subjectId | [Id](fields.md#id) | 是 | ； |
| bankCode | string | 是 | 银行标识；minLength=1, maxLength=64 |
| last4 | string | 是 | ；pattern=^[0-9]{4}$ |
| holderDisplayName | string | 是 | 脱敏名称；minLength=1, maxLength=120 |
| state | `pending_review` / `verified` / `suspended` | 是 | 稳定编码，未知编码不得推断为成功； |

## ReceiptReport

人工申报不等于确认到账；不接收provider=KESS伪造成功

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| payerSubjectId | [Id](fields.md#id) | 是 | ； |
| money | [PositiveMoney](fields.md#positivemoney) | 是 | ； |
| method | `BANK_TRANSFER` / `CASH` | 是 | 稳定编码，未知编码不得推断为成功； |
| receivingAccountId | [Id](fields.md#id) | 可省略 | ； |
| externalReference | string | 是 | 银行交易引用或现金凭证号；minLength=1, maxLength=128 |
| orderIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=100 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |
| observedAt | [Timestamp](fields.md#timestamp) | 是 | ； |

## OwnReceiptReport

付款主体由客户会话推导；仅申报向公司付款

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| money | [PositiveMoney](fields.md#positivemoney) | 是 | ； |
| receivingAccountId | [Id](fields.md#id) | 是 | ； |
| externalReference | string | 是 | 交易引用；minLength=1, maxLength=128 |
| orderIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=100 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |
| observedAt | [Timestamp](fields.md#timestamp) | 是 | ； |

## DriverCashReport

只允许本人授权任务现金；用途金额按订单分项

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| orderId | [Id](fields.md#id) | 是 | ； |
| orderVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| deliveryAmountMinor | integer | 是 | 配送费现金金额；minimum=0, maximum=9000000000000 |
| insuranceAmountMinor | integer | 是 | 保险费现金金额；minimum=0, maximum=9000000000000 |
| codAmountMinor | integer | 是 | 代收货款现金金额；minimum=0, maximum=9000000000000 |
| currency | [Currency](fields.md#currency) | 是 | ； |
| cashVoucherRef | string | 是 | 现金收据号；minLength=1, maxLength=128 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |
| observedAt | [Timestamp](fields.md#timestamp) | 是 | ； |

## Receipt

确认来源与核销余额分开；收款不随司机交公司重复增加

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| payerSubjectId | [Id](fields.md#id) | 是 | ； |
| money | [PositiveMoney](fields.md#positivemoney) | 是 | ； |
| method | `BANK_TRANSFER` / `CASH` / `KESS` | 是 | 稳定编码，未知编码不得推断为成功； |
| state | `reported` / `confirmed` / `disputed` | 是 | 稳定编码，未知编码不得推断为成功； |
| custodyType | `DRIVER` / `COMPANY` / `CHANNEL` | 是 | 稳定编码，未知编码不得推断为成功； |
| custodianSubjectId | [Id](fields.md#id) | 是 | ； |
| confirmedAt | [Timestamp](fields.md#timestamp) 或 null | 是 | ； |
| allocatedMinor | integer | 是 | 已分配；minimum=0, maximum=9000000000000 |
| unallocatedMinor | integer | 是 | 未分配；minimum=0, maximum=9000000000000 |
| refundReservedMinor | integer | 是 | 退款预留；minimum=0, maximum=9000000000000 |
| refundedMinor | integer | 是 | 已确认退款；minimum=0, maximum=9000000000000 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=20 |

## LedgerItem

应收/应付同源不可直接改余额；保险与COD单列

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| orderId | [Id](fields.md#id) | 是 | ； |
| subjectId | [Id](fields.md#id) | 是 | ； |
| direction | `RECEIVABLE` / `PAYABLE` | 是 | 稳定编码，未知编码不得推断为成功； |
| purpose | `DELIVERY` / `INSURANCE` / `COD` / `CARRIER` / `DRIVER_INCOME` / `WAREHOUSE` | 是 | 稳定编码，未知编码不得推断为成功； |
| currency | [Currency](fields.md#currency) | 是 | ； |
| originalMinor | integer | 是 | 原额；minimum=0, maximum=9000000000000 |
| adjustmentMinor | integer | 是 | ；minimum=-9000000000000, maximum=9000000000000 |
| allocatedMinor | integer | 是 | 核销额；minimum=0, maximum=9000000000000 |
| outstandingMinor | integer | 是 | 未结额；minimum=0, maximum=9000000000000 |
| reservedMinor | integer | 是 | 付款/提现占用；minimum=0, maximum=9000000000000 |
| dueDate | string | 是 | Asia/Phnom_Penh业务日期；format=date |
| sourceType | string | 是 | 来源类型；minLength=1, maxLength=64 |
| sourceId | [Id](fields.md#id) | 是 | ； |

## AllocationLine

每项版本与来源锁在同一事务中检查

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| ledgerItemId | [Id](fields.md#id) | 是 | ； |
| ledgerItemVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| amountMinor | integer | 是 | 本次核销最小单位；minimum=1, maximum=9000000000000 |

## AllocationDraft

一款多单；所有目标同公司、付款主体、币种

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| kind | `ALLOCATION` | 是 | ； |
| receiptId | [Id](fields.md#id) | 是 | ； |
| receiptVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| items | array<[AllocationLine](fields.md#allocationline)> | 是 | ；minItems=1, maxItems=100 |
| reason | string | 是 | 分配依据；minLength=1, maxLength=1000 |

## PaymentDraft

应付/提现/COD返还使用同一原子资金预留；不允许客户运费直接当承运价

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| kind | `PAYMENT` | 是 | ； |
| ledgerItemId | [Id](fields.md#id) | 是 | ； |
| ledgerItemVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| money | [PositiveMoney](fields.md#positivemoney) | 是 | ； |
| accountId | [Id](fields.md#id) | 是 | ； |
| accountVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| reason | string | 是 | 业务理由；minLength=1, maxLength=1000 |

## RefundDraft

退款源头、受益人和上限固定；渠道未结算不能走手工公司退款

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| kind | `REFUND` | 是 | ； |
| receiptId | [Id](fields.md#id) | 是 | ； |
| receiptVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| money | [PositiveMoney](fields.md#positivemoney) | 是 | ； |
| accountId | [Id](fields.md#id) | 是 | ； |
| accountVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| reason | string | 是 | 退款理由；minLength=1, maxLength=1000 |

## AdjustmentDraft

调整原收费不覆盖原报价；COD与已核销费用不可直接减免

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| kind | `ADJUSTMENT` | 是 | ； |
| ledgerItemId | [Id](fields.md#id) | 是 | ； |
| candidateQuoteId | [Id](fields.md#id) | 是 | 已确认的候选变更报价；调整不得猜测或自动选择候选报价； |
| ledgerItemVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| direction | `INCREASE` / `DECREASE` | 是 | 稳定编码，未知编码不得推断为成功； |
| money | [PositiveMoney](fields.md#positivemoney) | 是 | ； |
| reason | string | 是 | 调价依据；minLength=1, maxLength=1000 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## ReversalDraft

追加反向核销，不删除原资金事实；已返COD先处理资金追回

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| kind | `REVERSAL` | 是 | ； |
| allocationId | [Id](fields.md#id) | 是 | ； |
| reason | string | 是 | 错误归属更正理由；minLength=1, maxLength=1000 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## PayableDraft

已履约及批准协议价或分成快照产生；不得把保险/COD加入收入

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| kind | `PAYABLE` | 是 | ； |
| orderId | [Id](fields.md#id) | 是 | ； |
| orderVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| purpose | `CARRIER` / `DRIVER_INCOME` | 是 | 稳定编码，未知编码不得推断为成功； |
| beneficiarySubjectId | [Id](fields.md#id) | 是 | ； |
| money | [PositiveMoney](fields.md#positivemoney) | 是 | ； |
| agreementVersionId | [Id](fields.md#id) | 是 | ； |
| reason | string | 是 | 费用计算依据；minLength=1, maxLength=1000 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## AccountChangeDraft

敏感信息加密入专用存储；操作日志只留摘要，不回显原值

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| kind | `ACCOUNT_CHANGE` | 是 | ； |
| subjectId | [Id](fields.md#id) | 是 | ； |
| currency | [Currency](fields.md#currency) | 是 | ； |
| currentAccountVersion | integer | 是 | 0表示首次登记且服务器必须确认主体尚无账户；更新必须等于当前版本；minimum=0, maximum=9000000000000 |
| bankCode | string | 是 | 银行标识；minLength=1, maxLength=64 |
| holderName | string | 是 | 账户户名；minLength=1, maxLength=120, writeOnly=True |
| accountNumber | string | 是 | 银行账号；示例必须为合成占位值；minLength=1, maxLength=64, writeOnly=True |
| reason | string | 是 | 变更理由；minLength=1, maxLength=1000 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## FinanceDraft

按kind判别的严格联合；不同单据不接受彼此字段

[AllocationDraft](fields.md#allocationdraft) 或 [PaymentDraft](fields.md#paymentdraft) 或 [RefundDraft](fields.md#refunddraft) 或 [AdjustmentDraft](fields.md#adjustmentdraft) 或 [ReversalDraft](fields.md#reversaldraft) 或 [PayableDraft](fields.md#payabledraft) 或 [AccountChangeDraft](fields.md#accountchangedraft)


## ApprovalRecord

复核审批绑定同一单据版本及完整内容摘要

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| personId | [Id](fields.md#id) | 是 | ； |
| role | `MAKER` / `REVIEWER` / `APPROVER` / `EXECUTOR` / `CHECKER` | 是 | 稳定编码，未知编码不得推断为成功； |
| documentVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| contentHash | string | 是 | ；pattern=^[a-f0-9]{64}$ |
| at | [Timestamp](fields.md#timestamp) | 是 | ； |
| comment | string | 是 | 操作说明；minLength=1, maxLength=1000 |

## FinanceDocument

内部审核单；关键字段/凭证变化重置审核，保留历史

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| kind | `ALLOCATION` / `PAYMENT` / `REFUND` / `ADJUSTMENT` / `REVERSAL` / `PAYABLE` / `ACCOUNT_CHANGE` / `CASH_HANDOVER` / `CHANNEL_SETTLEMENT` | 是 | 稳定编码，未知编码不得推断为成功； |
| state | `draft` / `submitted` / `reviewed` / `approved` / `rejected` / `processing` / `unknown` / `failed` / `confirmed` / `posted` | 是 | 稳定编码，未知编码不得推断为成功； |
| money | [Money](fields.md#money) | 是 | ； |
| subjectId | [Id](fields.md#id) | 是 | ； |
| makerPersonId | [Id](fields.md#id) | 是 | ； |
| contentHash | string | 是 | ；pattern=^[a-f0-9]{64}$ |
| sourceIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=100 |
| accountSnapshot | [AccountMasked](fields.md#accountmasked) 或 null | 是 | ； |
| history | array<[ApprovalRecord](fields.md#approvalrecord)> | 是 | ；minItems=0, maxItems=1000 |
| reason | string | 是 | 业务说明；minLength=1, maxLength=1000 |
| details | [FinanceDocumentDetails](fields.md#financedocumentdetails) | 是 | ； |

## OwnFinanceRequest

对外申请仅显示本人来源及进度，无内部审核人员资料/采购价

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| kind | `REFUND` / `PAYMENT` / `WAREHOUSE_FEE` | 是 | 稳定编码，未知编码不得推断为成功； |
| state | `draft` / `submitted` / `reviewed` / `approved` / `rejected` / `processing` / `unknown` / `failed` / `confirmed` / `posted` | 是 | 稳定编码，未知编码不得推断为成功； |
| money | [Money](fields.md#money) | 是 | ； |
| sourceIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=100 |
| nextAction | string | 是 | 下一步业务说明；minLength=1, maxLength=500 |
| updatedAt | [Timestamp](fields.md#timestamp) | 是 | ； |

## ExecutionRecord

登记银行端人工执行事实，绝不调用自动出款

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| externalReference | string | 是 | 唯一付款指令引用；minLength=1, maxLength=128 |
| executedAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## PaymentResult

执行人不得核对自己付款；unknown保持全部预留

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| result | `CONFIRMED` / `FAILED` / `UNKNOWN` | 是 | 稳定编码，未知编码不得推断为成功； |
| externalReference | string | 是 | 同一付款指令引用；minLength=1, maxLength=128 |
| verifiedAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |
| reason | string | 是 | 独立核对依据；minLength=1, maxLength=1000 |

## CashHandoverLine

必须来自本人已确认现金且未交余额

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| receiptId | [Id](fields.md#id) | 是 | ； |
| receiptVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| amountMinor | integer | 是 | 申报交回金额；minimum=1, maximum=9000000000000 |

## CashHandoverRequest

内部现金保管交接，不是第二次客户收入

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| currency | [Currency](fields.md#currency) | 是 | ； |
| items | array<[CashHandoverLine](fields.md#cashhandoverline)> | 是 | ；minItems=1, maxItems=100 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## CashHandover

实际点收与审批批次分开，差额不得自动扣薪

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| driverSubjectId | [Id](fields.md#id) | 是 | ； |
| declared | [Money](fields.md#money) | 是 | ； |
| counted | [Money](fields.md#money) 或 null | 是 | ； |
| differenceMinor | integer 或 null | 是 | ； |
| differenceDirection | `NONE` / `SHORT` / `OVER` / `UNKNOWN` | 是 | 稳定编码，未知编码不得推断为成功； |
| state | `submitted` / `counted` / `disputed` / `reviewed` / `posted` | 是 | 稳定编码，未知编码不得推断为成功； |
| reviewDocumentId | [Id](fields.md#id) 或 null | 是 | ； |

## CashCount

先记录实际点收；多/少款均入差异，未经审核不作可用款

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| actual | [Money](fields.md#money) | 是 | ； |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |
| reason | string | 是 | 点收依据；minLength=1, maxLength=1000 |

## PaymentIntentRequest

金额由指定应收账项计算；不收浏览器金额/provider状态

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| orderId | [Id](fields.md#id) | 是 | ； |
| orderVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| quoteId | [Id](fields.md#id) | 是 | ； |
| ledgerItems | array<[ResourceVersion](fields.md#resourceversion)> | 是 | ；minItems=1, maxItems=100 |

## PaymentIntent

成功表示渠道已收，结算/核销是独立维度

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| orderId | [Id](fields.md#id) | 是 | ； |
| provider | `KESS` | 是 | ； |
| mode | `sandbox` / `live` | 是 | 稳定编码，未知编码不得推断为成功； |
| state | `creating` / `waiting` / `unknown` / `succeeded` / `closed` / `failed` / `needs_review` | 是 | 稳定编码，未知编码不得推断为成功； |
| money | [PositiveMoney](fields.md#positivemoney) | 是 | ； |
| feeItems | array<[FeeItem](fields.md#feeitem)> | 是 | ；minItems=1, maxItems=100 |
| paymentUrl | string 或 null | 是 | ； |
| expiresAt | [Timestamp](fields.md#timestamp) 或 null | 是 | ； |
| receiptId | [Id](fields.md#id) 或 null | 是 | ； |
| settlementState | `not_received` / `channel_held` / `partially_settled` / `bank_reconciled` | 是 | 稳定编码，未知编码不得推断为成功； |
| lastCheckedAt | [Timestamp](fields.md#timestamp) 或 null | 是 | ； |

## SettlementRuleDraft

按主体/方向/币种生效的不可覆盖规则版本；预览不出账

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| subjectId | [Id](fields.md#id) | 是 | ； |
| direction | `RECEIVABLE` / `PAYABLE` | 是 | 稳定编码，未知编码不得推断为成功； |
| purpose | `DELIVERY` / `INSURANCE` / `COD` / `CARRIER` / `DRIVER_INCOME` / `WAREHOUSE` | 是 | 稳定编码，未知编码不得推断为成功； |
| currency | [Currency](fields.md#currency) | 是 | ； |
| period | `PER_ORDER` / `DAILY` / `WEEKLY` / `MONTHLY` / `EVERY_N_DAYS` | 是 | 稳定编码，未知编码不得推断为成功； |
| anchorDate | string | 是 | Asia/Phnom_Penh业务日期；format=date |
| intervalDays | integer | 可省略 | EVERY_N_DAYS使用；minimum=1, maximum=366 |
| weekDay | integer | 可省略 | ISO周一1到周日7；minimum=1, maximum=7 |
| monthDay | integer | 可省略 | 月出账日；minimum=1, maximum=31 |
| shortMonthPolicy | `MONTH_END` / `NEXT_VALID_MONTH` | 是 | 稳定编码，未知编码不得推断为成功； |
| issueDelayDays | integer | 是 | 出账延迟自然日；minimum=0, maximum=366 |
| dueAfterDays | integer | 是 | 出账后到期自然日；minimum=0, maximum=366 |
| remindBeforeDays | integer | 是 | 到期前提醒天数；minimum=0, maximum=366 |
| overdueRepeatDays | integer | 是 | 逾期提醒间隔；minimum=1, maximum=366 |
| effectiveFrom | string | 是 | Asia/Phnom_Penh业务日期；format=date |
| ownerPersonId | [Id](fields.md#id) | 是 | ； |

## SettlementRule

新规则不回写已绑账项和历史账单

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| state | `draft` / `active` / `superseded` | 是 | 稳定编码，未知编码不得推断为成功； |
| rule | [SettlementRuleDraft](fields.md#settlementruledraft) | 是 | ； |

## Statement

客户确认与内部审核状态分开；仅核销减少未结

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| subjectId | [Id](fields.md#id) | 是 | ； |
| direction | `RECEIVABLE` / `PAYABLE` | 是 | 稳定编码，未知编码不得推断为成功； |
| currency | [Currency](fields.md#currency) | 是 | ； |
| periodStart | string | 是 | Asia/Phnom_Penh业务日期；format=date |
| periodEndExclusive | string | 是 | Asia/Phnom_Penh业务日期；format=date |
| ruleVersionId | [Id](fields.md#id) | 是 | ； |
| ledgerItems | array<[ResourceVersion](fields.md#resourceversion)> | 是 | ；minItems=1, maxItems=1000 |
| openingMinor | integer | 是 | 期初未结；minimum=0, maximum=9000000000000 |
| chargesMinor | integer | 是 | 本期新增；minimum=0, maximum=9000000000000 |
| adjustmentMinor | integer | 是 | ；minimum=-9000000000000, maximum=9000000000000 |
| allocatedMinor | integer | 是 | 本期核销净额；minimum=0, maximum=9000000000000 |
| closingMinor | integer | 是 | 期末未结；minimum=0, maximum=9000000000000 |
| dueDate | string | 是 | Asia/Phnom_Penh业务日期；format=date |
| internalState | `draft` / `reviewed` / `approved` / `issued` | 是 | 稳定编码，未知编码不得推断为成功； |
| customerState | `unseen` / `acknowledged` / `disputed` | 是 | 稳定编码，未知编码不得推断为成功； |
| paymentState | `unpaid` / `partial` / `settled` | 是 | 稳定编码，未知编码不得推断为成功； |

## FinanceTask

财务按待办处理；已读不关闭业务

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| type | `RECEIPT_REVIEW` / `CASH_COUNT` / `DOCUMENT_REVIEW` / `APPROVAL` / `EXECUTE` / `RECONCILE` / `ISSUE_STATEMENT` / `COLLECT` / `PAY` / `CHANNEL_SETTLEMENT` / `DIFFERENCE` | 是 | 稳定编码，未知编码不得推断为成功； |
| subjectId | [Id](fields.md#id) | 是 | ； |
| sourceId | [Id](fields.md#id) | 是 | ； |
| money | [Money](fields.md#money) | 是 | ； |
| ownerId | [Id](fields.md#id) 或 null | 是 | ； |
| dueAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| state | `open` / `held` / `done` | 是 | 稳定编码，未知编码不得推断为成功； |
| readAt | [Timestamp](fields.md#timestamp) 或 null | 是 | ； |
| nextAction | string | 是 | 下一步；minLength=1, maxLength=500 |

## HoldTask

暂停催收不等于免账；到期重新检查未结

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| reason | string | 是 | 暂缓依据；minLength=1, maxLength=1000 |
| until | [Timestamp](fields.md#timestamp) | 是 | ； |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## ReportRow

按权限生成，不返回全企业数据让前端裁剪

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| sourceId | [Id](fields.md#id) | 是 | ； |
| orderId | [Id](fields.md#id) 或 null | 是 | ； |
| subjectId | [Id](fields.md#id) | 是 | ； |
| purpose | `DELIVERY` / `INSURANCE` / `COD` / `CARRIER` / `DRIVER_INCOME` / `WAREHOUSE` | 是 | 稳定编码，未知编码不得推断为成功； |
| direction | `RECEIVABLE` / `PAYABLE` | 是 | 稳定编码，未知编码不得推断为成功； |
| currency | [Currency](fields.md#currency) | 是 | ； |
| originalMinor | integer | 是 | 原额；minimum=0, maximum=9000000000000 |
| adjustmentMinor | integer | 是 | ；minimum=-9000000000000, maximum=9000000000000 |
| allocatedMinor | integer | 是 | 核销额；minimum=0, maximum=9000000000000 |
| outstandingMinor | integer | 是 | 未结；minimum=0, maximum=9000000000000 |
| dueDate | string | 是 | Asia/Phnom_Penh业务日期；format=date |

## MoneyOverview

不能把保管和负债维度相加；按当前时间投影，不伪造历史重放

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| currency | [Currency](fields.md#currency) | 是 | ； |
| asOf | [Timestamp](fields.md#timestamp) | 是 | ； |
| receivableMinor | integer | 是 | 客户未结应收；minimum=0, maximum=9000000000000 |
| payableMinor | integer | 是 | 合作/司机未结应付；minimum=0, maximum=9000000000000 |
| driverHeldMinor | integer | 是 | 司机保管现金；minimum=0, maximum=9000000000000 |
| codLiabilityMinor | integer | 是 | 商户待返货款；minimum=0, maximum=9000000000000 |
| channelHeldMinor | integer | 是 | 渠道待结算；minimum=0, maximum=9000000000000 |
| companyHeldMinor | integer | 是 | ； |
| paymentReservedMinor | integer | 是 | 在途付款预留；minimum=0, maximum=9000000000000 |
| unmatchedMinor | integer | 是 | 到账待认领；minimum=0, maximum=9000000000000 |
| quality | `fresh` / `stale` / `partial` / `unavailable` | 是 | 稳定编码，未知编码不得推断为成功； |

## ExportRequest

服务端按创建及下载时的当前权限复验；不得扩大查询范围

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| report | `LEDGER` / `AGING` / `STATEMENTS` / `CASH_HANDOVERS` / `COD` / `WAREHOUSE` | 是 | 稳定编码，未知编码不得推断为成功； |
| currency | [Currency](fields.md#currency) | 是 | ； |
| subjectId | [Id](fields.md#id) | 可省略 | ； |
| dateFrom | string | 是 | Asia/Phnom_Penh业务日期；format=date |
| dateToExclusive | string | 是 | Asia/Phnom_Penh业务日期；format=date |
| format | `CSV` | 是 | ； |

## ExportJob

签名下载短期有效，CSV防公式注入；明细导出不叫会计凭证

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| state | `queued` / `running` / `ready` / `failed` / `expired` | 是 | 稳定编码，未知编码不得推断为成功； |
| createdAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| downloadUrl | string 或 null | 是 | ； |
| expiresAt | [Timestamp](fields.md#timestamp) 或 null | 是 | ； |

## BankTransactionDraft

只登记事实，交易唯一约束不等于只能分配一次；不得上传完整银行凭据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| accountId | [Id](fields.md#id) | 是 | ； |
| externalTransactionId | string | 是 | 银行唯一流水号；minLength=1, maxLength=128 |
| direction | `IN` / `OUT` | 是 | 稳定编码，未知编码不得推断为成功； |
| money | [PositiveMoney](fields.md#positivemoney) | 是 | ； |
| bookedAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## BankTransaction

一笔流水可匹配多笔业务但总额不可超配

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| accountId | [Id](fields.md#id) | 是 | ； |
| externalTransactionId | string | 是 | 银行唯一流水号；minLength=1, maxLength=128 |
| direction | `IN` / `OUT` | 是 | 稳定编码，未知编码不得推断为成功； |
| money | [PositiveMoney](fields.md#positivemoney) | 是 | ； |
| matchedMinor | integer | 是 | 已匹配；minimum=0, maximum=9000000000000 |
| unmatchedMinor | integer | 是 | 未匹配；minimum=0, maximum=9000000000000 |
| bookedAt | [Timestamp](fields.md#timestamp) | 是 | ； |

## ChannelSettlementDraft

渠道批次独立核对；不直接增加第二笔客户收款

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| provider | `KESS` | 是 | ； |
| externalBatchId | string | 是 | 渠道批次引用；minLength=1, maxLength=128 |
| currency | [Currency](fields.md#currency) | 是 | ； |
| receiptIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=1000 |
| grossMinor | integer | 是 | 本批渠道收款毛额；minimum=1, maximum=9000000000000 |
| feeMinor | integer | 是 | 手续费；minimum=0, maximum=9000000000000 |
| refundMinor | integer | 是 | 已确认渠道退款；minimum=0, maximum=9000000000000 |
| netMinor | integer | 是 | 本批银行净到账；minimum=0, maximum=9000000000000 |
| bankTransaction | [ResourceVersion](fields.md#resourceversion) | 是 | ； |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |
| reason | string | 是 | 匹配依据；minLength=1, maxLength=1000 |

## ChannelSettlement

gross-fee-refund=net，同币种；处理成功才移转保管净额和记录手续费

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| state | `draft` / `submitted` / `reviewed` / `approved` / `posted` / `disputed` | 是 | 稳定编码，未知编码不得推断为成功； |
| reviewDocumentId | [Id](fields.md#id) | 是 | ； |
| data | [ChannelSettlementDraft](fields.md#channelsettlementdraft) | 是 | ； |

## KnownStock

同一SKU/货主/仓库/批次/单位快照；预留与隔离数量互斥

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| bookQty | integer | 是 | 账面在库；minimum=0, maximum=9000000000000 |
| reservedQty | integer | 是 | 已预留；minimum=0, maximum=9000000000000 |
| quarantineQty | integer | 是 | 异常隔离；minimum=0, maximum=9000000000000 |
| requestableQty | integer | 是 | 可申请；等于账面-预留-隔离，不是提交成功保证；minimum=0, maximum=9000000000000 |

## InventoryRow

只有可靠来源才返回数量；不可把未知替换成0

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| ownerAccountId | [Id](fields.md#id) | 是 | ； |
| warehouseId | [Id](fields.md#id) | 是 | ； |
| skuId | [Id](fields.md#id) | 是 | ； |
| lotRef | string 或 null | 是 | ； |
| unit | string | 是 | 库存单位；minLength=1, maxLength=32 |
| quantities | [KnownStock](fields.md#knownstock) 或 null | 是 | ； |
| source | `ROUTEFIT_WMS` / `EXTERNAL_WMS` / `UNAVAILABLE` | 是 | 稳定编码，未知编码不得推断为成功； |
| observedAt | [Timestamp](fields.md#timestamp) 或 null | 是 | ； |
| quality | `fresh` / `stale` / `partial` / `unavailable` | 是 | 稳定编码，未知编码不得推断为成功； |
| unknownReason | string 或 null | 是 | ； |

## WarehouseLine

客户申请数量，实际收发另记事实

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| skuId | [Id](fields.md#id) | 是 | ； |
| quantity | integer | 是 | 申请数量；minimum=1, maximum=100000 |
| inventoryId | [Id](fields.md#id) | 可省略 | ； |
| inventoryVersion | integer | 可省略 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |

## InboundNoticeRequest

预报不增加实物库存

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| warehouseId | [Id](fields.md#id) | 是 | ； |
| expectedWindow | [TimeWindow](fields.md#timewindow) | 是 | ； |
| lines | array<[WarehouseLine](fields.md#warehouseline)> | 是 | ；minItems=1, maxItems=200 |
| packingEvidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=20 |
| note | string | 可省略 | 包装及到货安排；minLength=1, maxLength=1000 |

## OutboundRequest

申请不等于库存预留或车辆指派；受理再检查并发库存

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| warehouseId | [Id](fields.md#id) | 是 | ； |
| lines | array<[WarehouseLine](fields.md#warehouseline)> | 是 | ；minItems=1, maxItems=200 |
| delivery | [Location](fields.md#location) | 是 | ； |
| requestedWindow | [TimeWindow](fields.md#timewindow) | 是 | ； |
| serviceLevel | `S1` / `S2` / `S3` / `S4` | 是 | 稳定编码，未知编码不得推断为成功； |
| exclusiveVehicle | boolean | 是 | 独享车辆申请； |

## WarehouseRequest

客户申请状态，内部实际收发与库存账分开

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| type | `INBOUND_NOTICE` / `OUTBOUND_DELIVERY` | 是 | 稳定编码，未知编码不得推断为成功； |
| ownerAccountId | [Id](fields.md#id) | 是 | ； |
| warehouseId | [Id](fields.md#id) | 是 | ； |
| state | `draft` / `submitted` / `under_review` / `accepted` / `rejected` / `withdrawn` / `fulfilled` | 是 | 稳定编码，未知编码不得推断为成功； |
| relatedOrderId | [Id](fields.md#id) 或 null | 是 | ； |
| createdAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| nextAction | string | 是 | 下一步说明；minLength=1, maxLength=500 |

## ReservationRequest

内部WMS权威才可预留；外部WMS权威必须等其确认回执

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| warehouseRequestId | [Id](fields.md#id) | 是 | ； |
| warehouseRequestVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| lines | array<[WarehouseLine](fields.md#warehouseline)> | 是 | ；minItems=1, maxItems=200 |

## StockReservation

库存预留与物理出库分开，重复不双扣

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| state | `requested` / `confirmed` / `released` / `consumed` / `disputed` | 是 | 稳定编码，未知编码不得推断为成功； |
| warehouseRequestId | [Id](fields.md#id) | 是 | ； |
| lines | array<[WarehouseLine](fields.md#warehouseline)> | 是 | ；minItems=1, maxItems=200 |
| authority | `ROUTEFIT_WMS` / `EXTERNAL_WMS` | 是 | 稳定编码，未知编码不得推断为成功； |

## WmsStockEvent

仅凭据绑定的仓库/货主；来源版本单调，旧观测不能覆盖新快照

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| externalEventId | string | 是 | 来源唯一事件号；minLength=1, maxLength=128 |
| warehouseId | [Id](fields.md#id) | 是 | ； |
| ownerAccountId | [Id](fields.md#id) | 是 | ； |
| skuId | [Id](fields.md#id) | 是 | ； |
| lotRef | string 或 null | 是 | ； |
| unit | string | 是 | 单位；minLength=1, maxLength=32 |
| quantities | [KnownStock](fields.md#knownstock) | 是 | ； |
| sourceVersion | integer | 是 | 来源版本；minimum=1, maximum=9000000000000 |
| observedAt | [Timestamp](fields.md#timestamp) | 是 | ； |

## ExternalOrderRequest

外部订单先导入待核验；来源系统和货主从凭据绑定，不接受自报

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| externalOrderId | string | 是 | 外部平台单号；minLength=1, maxLength=128 |
| externalRevision | integer | 是 | 单调修订版本；minimum=1, maximum=9000000000000 |
| pickup | [Location](fields.md#location) | 是 | ； |
| delivery | [Location](fields.md#location) | 是 | ； |
| items | array<[CargoItem](fields.md#cargoitem)> | 是 | ；minItems=1, maxItems=200 |
| requestedPickupWindow | [TimeWindow](fields.md#timewindow) | 是 | ； |
| requestedDeliveryWindow | [TimeWindow](fields.md#timewindow) | 是 | ； |
| serviceLevel | `S1` / `S2` / `S3` / `S4` | 是 | 稳定编码，未知编码不得推断为成功； |
| deliveryPrice | [Money](fields.md#money) | 是 | ； |
| insurancePrice | [Money](fields.md#money) | 是 | ； |
| sourcePlatform | string | 是 | 人工复制时的平台名称；minLength=1, maxLength=128 |

## ImportResult

外部价格只保留来源报价，重新核价确认后派单

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| externalOrderId | string | 是 | 外部单号；minLength=1, maxLength=128 |
| orderId | [Id](fields.md#id) | 是 | ； |
| state | `pending_review` / `validated` / `rejected` / `dispatch_requested` | 是 | 稳定编码，未知编码不得推断为成功； |
| duplicate | boolean | 是 | 返回原同版本结果，不生成第二笔订单； |

## DispatchRequest

只是申请派单，报价/承诺/支付门槛由调度原子复验

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| quoteId | [Id](fields.md#id) | 是 | ； |
| quoteVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| consentEvidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## ServiceRequest

客户/收货人申请不改原承诺，不自动认责赔付

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| orderId | [Id](fields.md#id) | 是 | ； |
| orderVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| type | `ADDRESS_CHANGE` / `TIME_CHANGE` / `MISSING` / `DAMAGED` / `WRONG_GOODS` / `REFUSAL` / `FEE_DISPUTE` / `RETURN` | 是 | 稳定编码，未知编码不得推断为成功； |
| description | string | 是 | 申请说明；minLength=1, maxLength=2000 |
| requestedDelivery | [Location](fields.md#location) | 可省略 | ； |
| requestedWindow | [TimeWindow](fields.md#timewindow) | 可省略 | ； |
| disputedMoney | [Money](fields.md#money) | 可省略 | ； |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=20 |

## ServiceCase

事实留痕与争议处置；财务调整单另行审批

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| orderId | [Id](fields.md#id) | 是 | ； |
| type | string | 是 | 申请类型；minLength=1, maxLength=64 |
| state | `submitted` / `under_review` / `needs_customer_consent` / `accepted` / `rejected` / `resolved` / `withdrawn` | 是 | 稳定编码，未知编码不得推断为成功； |
| ownerDisplayName | string 或 null | 是 | ； |
| nextAction | string | 是 | 下一步；minLength=1, maxLength=1000 |
| relatedQuoteId | [Id](fields.md#id) 或 null | 是 | ； |
| relatedFinanceDocumentId | [Id](fields.md#id) 或 null | 是 | ； |

## CaseDecision

接受申请后仍通过相应领域动作生效；不能写成功标志跳过门槛

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| decision | `ACCEPT` / `REJECT` / `REQUEST_CUSTOMER_CONSENT` | 是 | 稳定编码，未知编码不得推断为成功； |
| reason | string | 是 | 处理说明；minLength=1, maxLength=1000 |
| newQuoteId | [Id](fields.md#id) | 可省略 | ； |
| newPromiseId | [Id](fields.md#id) | 可省略 | ； |
| financeDocumentId | [Id](fields.md#id) | 可省略 | ； |

## PortalMembershipDraft

权限限制在该货主可委派权限内，不允许授予内部财务/调度角色

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| invitationEmail | string | 是 | ；format=email |
| permissions | array<`ORDERS_READ` / `EVIDENCE_READ` / `INVENTORY_READ` / `WAREHOUSE_REQUEST` / `ORDER_REQUEST` / `FINANCE_READ` / `PAYMENT_REQUEST` / `CASE_CREATE` / `MEMBERS_MANAGE` / `QUOTES_CONFIRM` / `STATEMENTS_ACKNOWLEDGE` / `FINANCE_EXPORT`> | 是 | ；minItems=1, maxItems=12 |
| expiresAt | [Timestamp](fields.md#timestamp) | 是 | ； |

## PortalMembership

同一个人可有多个会员关系，但财务独立性按personId检查

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| ownerAccountId | [Id](fields.md#id) | 是 | ； |
| personId | [Id](fields.md#id) 或 null | 是 | ； |
| state | `invited` / `active` / `suspended` / `revoked` | 是 | 稳定编码，未知编码不得推断为成功； |
| permissions | array<string> | 是 | ；minItems=0, maxItems=20 |

## PublicTracking

匿名分享仅展示本次配送摘要；无地址电话姓名/车队轨迹/财务

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| orderLabel | string | 是 | 脱敏单号；minLength=1, maxLength=64 |
| state | `preparing` / `pickup_pending` / `in_transit` / `delivered` / `returning` / `exception` / `cancelled` | 是 | 稳定编码，未知编码不得推断为成功； |
| promiseWindow | [TimeWindow](fields.md#timewindow) 或 null | 是 | ； |
| etaAt | [Timestamp](fields.md#timestamp) 或 null | 是 | ； |
| etaType | `MANUAL` / `UNCALIBRATED` / `CALIBRATED` / `UNAVAILABLE` | 是 | 稳定编码，未知编码不得推断为成功； |
| updatedAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| quality | `fresh` / `stale` / `partial` / `unavailable` | 是 | 稳定编码，未知编码不得推断为成功； |
| contactEntry | string | 是 | 获批准的平台联系入口，不返回司机私号；format=uri |

## RecipientChallengeRequest

短信只送预登记收货人，不接受任意输入手机号

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| trackingRef | string | 是 | 至少128位随机熵的不透明引用；服务端只存哈希，日志脱敏；pattern=^[A-Za-z0-9_-]{22,128}$ |

## RecipientChallenge

有效/无效引用响应形状一致，不泄露手机或订单存在性

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| challengeId | [Id](fields.md#id) | 是 | ； |
| expiresAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| message | string | 是 | 固定通用提示；minLength=1, maxLength=500 |

## RecipientVerify

限次、限时、单次验证码；令牌只授权该订单允许的动作

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| challengeId | [Id](fields.md#id) | 是 | ； |
| code | string | 是 | ；pattern=^[0-9]{6}$, writeOnly=True |

## RecipientSession

短期token不在URL，不能作为客户门户或司机凭据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| accessToken | string | 是 | 仅一次返回，日志禁止记录；minLength=1, maxLength=2048 |
| expiresAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| orderId | [Id](fields.md#id) | 是 | ； |
| permissions | array<`DELIVERY_READ` / `ARRANGEMENT_REQUEST` / `DELIVERY_ACK` / `CASE_CREATE`> | 是 | ；minItems=1, maxItems=4 |

## RecipientAcknowledgement

收货人声明；不能凭链接点击直接标已签收

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| deliveredPackageIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=1000 |
| deliveryRecordId | [Id](fields.md#id) | 是 | ； |
| deliveryRecordVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=20 |
| observedAt | [Timestamp](fields.md#timestamp) | 是 | ； |

## RecipientAckResult

等待业务核验；最终交付由后端核对司机证据/授权/件数/状态

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| state | `recorded` / `needs_review` / `matched` | 是 | 稳定编码，未知编码不得推断为成功； |
| orderId | [Id](fields.md#id) | 是 | ； |
| deliveryRecordId | [Id](fields.md#id) | 是 | ； |

## EvidenceUploadRequest

先授权关联对象，上传不允许任意文件类型/无限大小

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| purpose | `PACKAGING` / `HANDOVER` / `DELIVERY` / `PAYMENT` / `DISPUTE` / `QUALIFICATION` | 是 | 稳定编码，未知编码不得推断为成功； |
| resourceType | `ORDER` / `CASE` / `WAREHOUSE_REQUEST` / `FINANCE_DOCUMENT` / `PARTNER` | 是 | 稳定编码，未知编码不得推断为成功； |
| resourceId | [Id](fields.md#id) | 是 | ； |
| mimeType | `image/jpeg` / `image/png` / `application/pdf` | 是 | 稳定编码，未知编码不得推断为成功； |
| sizeBytes | integer | 是 | 最高10MiB；业务策略可更低；minimum=1, maximum=10485760 |
| sha256 | string | 是 | ；pattern=^[a-f0-9]{64}$ |

## UploadTicket

短期定向上传；对象存储签名不是业务权限

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| uploadUrl | string | 是 | ；format=uri |
| method | `PUT` | 是 | ； |
| expiresAt | [Timestamp](fields.md#timestamp) | 是 | ； |

## EvidenceFile

扫描完成之前不得绑定关键业务证据；凭证不能因此认定钱已到账

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| state | `uploaded` / `scanning` / `available` / `rejected` | 是 | 稳定编码，未知编码不得推断为成功； |
| mimeType | string | 是 | 校验后类型；minLength=1, maxLength=64 |
| sizeBytes | integer | 是 | 实际大小；minimum=1, maximum=10485760 |
| sha256 | string | 是 | ；pattern=^[a-f0-9]{64}$ |

## DownloadLink

仅当前对象授权可生成；短期有效，过期需重新鉴权

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| url | string | 是 | ；format=uri |
| expiresAt | [Timestamp](fields.md#timestamp) | 是 | ； |

## SyncEvent

type与payload严格对应；批内sequence递增，逐事件判定

[SyncArrived](fields.md#syncarrived) 或 [SyncHandoverSigned](fields.md#synchandoversigned) 或 [SyncDeparted](fields.md#syncdeparted) 或 [SyncDeliveryRecorded](fields.md#syncdeliveryrecorded) 或 [SyncCashReported](fields.md#synccashreported) 或 [SyncExceptionReported](fields.md#syncexceptionreported)


## SyncBatch

请求头不使用单一If-Match；每事件带任务版本

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| deviceId | [Id](fields.md#id) | 是 | ； |
| events | array<[SyncEvent](fields.md#syncevent)> | 是 | ；minItems=1, maxItems=100 |

## SyncResult

每事件独立事务；单项失败不掩盖其他结果

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| eventId | [Id](fields.md#id) | 是 | ； |
| result | `APPLIED` / `DUPLICATE` / `REJECTED` / `NEEDS_REVIEW` | 是 | 稳定编码，未知编码不得推断为成功； |
| resourceId | [Id](fields.md#id) 或 null | 是 | ； |
| resourceVersion | integer 或 null | 是 | ； |
| errorCode | string 或 null | 是 | ； |

## LocationPoint

过期补传保存原观测时间，不覆盖更新的当前位置

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| clientPointId | [Id](fields.md#id) | 是 | ； |
| observedAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| point | [Point](fields.md#point) | 是 | ； |
| accuracyM | number | 是 | 水平精度米；minimum=0, maximum=100000 |
| permission | `ALWAYS` / `WHILE_USING` / `DENIED` | 是 | 稳定编码，未知编码不得推断为成功； |
| foreground | boolean | 是 | 当时前台状态； |
| batteryRatio | number | 是 | 电量比例；minimum=0, maximum=1 |

## LocationBatch

设备绑定/当班授权窗口/大小限制均服务端校验

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| deviceId | [Id](fields.md#id) | 是 | ； |
| shiftId | [Id](fields.md#id) | 是 | ； |
| points | array<[LocationPoint](fields.md#locationpoint)> | 是 | ；minItems=1, maxItems=100 |

## LocationResult

接收不等于采用为当前位置

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| acceptedPointIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=100 |
| rejectedPointIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=100 |
| latestObservedAt | [Timestamp](fields.md#timestamp) 或 null | 是 | ； |

## VehicleMapPoint

调度地图可显示车况与来源，不向客户公开整车路线

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| vehicleId | [Id](fields.md#id) | 是 | ； |
| point | [Point](fields.md#point) 或 null | 是 | ； |
| observedAt | [Timestamp](fields.md#timestamp) 或 null | 是 | ； |
| quality | `fresh` / `stale` / `partial` / `unavailable` | 是 | 稳定编码，未知编码不得推断为成功； |
| state | `available` / `busy` / `paused` / `incident` | 是 | 稳定编码，未知编码不得推断为成功； |
| activeAssignmentIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=100 |
| exceptionIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=100 |

## DispatchBoard

独立地图/队列/紧急信息；数据缺失不伪装0

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| asOf | [Timestamp](fields.md#timestamp) | 是 | ； |
| orderIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=1000 |
| vehicles | array<[VehicleMapPoint](fields.md#vehiclemappoint)> | 是 | ；minItems=0, maxItems=500 |
| urgentExceptionIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=1000 |
| nextCursor | string 或 null | 是 | ； |

## NotificationRequest

已批准模板、明确主体和用途，不允许传任意收件地址绕过权限

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| templateId | [Id](fields.md#id) | 是 | ； |
| subjectId | [Id](fields.md#id) | 是 | ； |
| resourceType | `ORDER` / `STATEMENT` / `CASE` | 是 | 稳定编码，未知编码不得推断为成功； |
| resourceId | [Id](fields.md#id) | 是 | ； |
| resourceVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| channel | `IN_APP` / `SMS` / `EMAIL` | 是 | 稳定编码，未知编码不得推断为成功； |
| reason | string | 是 | 通知理由；minLength=1, maxLength=500 |

## Notification

已读不改变异常/账款/承诺

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| state | `queued` / `sent` / `failed` / `unknown` | 是 | 稳定编码，未知编码不得推断为成功； |
| resourceId | [Id](fields.md#id) | 是 | ； |
| readAt | [Timestamp](fields.md#timestamp) 或 null | 是 | ； |
| failureCode | string 或 null | 是 | ； |

## SnapshotModule

每个模块独立数据质量；未知值为null，不当0

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| mode | `live` / `demo` / `shadow` / `unavailable` | 是 | 稳定编码，未知编码不得推断为成功； |
| quality | `fresh` / `stale` / `partial` / `unavailable` | 是 | 稳定编码，未知编码不得推断为成功； |
| value | integer 或 null | 是 | ； |
| observedAt | [Timestamp](fields.md#timestamp) 或 null | 是 | ； |
| unknownReason | string 或 null | 是 | ； |

## OpsSnapshot

R1-V只读汇总，不提供中控写接口

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| schemaVersion | `1.0.0` | 是 | ； |
| generatedAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| orders | [SnapshotModule](fields.md#snapshotmodule) | 是 | ； |
| vehicles | [SnapshotModule](fields.md#snapshotmodule) | 是 | ； |
| exceptions | [SnapshotModule](fields.md#snapshotmodule) | 是 | ； |
| inventory | [SnapshotModule](fields.md#snapshotmodule) | 是 | ； |

## ServiceAreaDraft

GeoJSON Polygon，[经度,纬度]；闭合环/自交由几何校验；禁送区优先

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| name | string | 是 | 区域名；minLength=1, maxLength=120 |
| type | `ALLOW` / `DENY` | 是 | 稳定编码，未知编码不得推断为成功； |
| polygon | object | 是 | ； |
| effectiveFrom | [Timestamp](fields.md#timestamp) | 是 | ； |

## ServiceArea

区域新版本不静默撤销在途已承诺订单

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| state | `draft` / `active` / `superseded` | 是 | 稳定编码，未知编码不得推断为成功； |
| data | [ServiceAreaDraft](fields.md#serviceareadraft) | 是 | ； |

## AccessGrantDraft

内部权限委派不能超过操作者可委派范围；货主成员另用门户接口

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| principalId | [Id](fields.md#id) | 是 | ； |
| role | `OPS` / `DISPATCH` / `WAREHOUSE` / `LOAD_REVIEWER` / `FINANCE_MAKER` / `FINANCE_REVIEWER` / `FINANCE_APPROVER` / `CASHIER` / `CHECKER` / `ADMIN` | 是 | 稳定编码，未知编码不得推断为成功； |
| warehouseIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=100 |
| subjectIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=100 |
| expiresAt | [Timestamp](fields.md#timestamp) | 是 | ； |

## AccessGrant

同人多账号不绕过职责分离；撤销后后台任务/下载仍复验权限

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| version | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| state | `active` / `revoked` | 是 | 稳定编码，未知编码不得推断为成功； |
| data | [AccessGrantDraft](fields.md#accessgrantdraft) | 是 | ； |

## PeriodPreview

只预览，不出账、不发通知

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| start | string | 是 | Asia/Phnom_Penh业务日期；format=date |
| endExclusive | string | 是 | Asia/Phnom_Penh业务日期；format=date |
| issueDate | string | 是 | Asia/Phnom_Penh业务日期；format=date |
| dueDate | string | 是 | Asia/Phnom_Penh业务日期；format=date |

## ArrivalPayload

只记录到达观测，不自动签收或收款

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| point | [Point](fields.md#point) | 是 | ； |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=20 |

## HandoverSignature

离线签认仍需服务器校验当前保管及对方签名

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| transferId | [Id](fields.md#id) | 是 | ； |
| transferVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## SyncArrived

离线事件 ARRIVED

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| eventId | [Id](fields.md#id) | 是 | ； |
| sequence | integer | 是 | 设备单调序号；minimum=1, maximum=9000000000000 |
| assignmentId | [Id](fields.md#id) | 是 | ； |
| assignmentVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| planVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| observedAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| type | `ARRIVED` | 是 | ； |
| payload | [ArrivalPayload](fields.md#arrivalpayload) | 是 | ； |

## SyncHandoverSigned

离线事件 HANDOVER_SIGNED

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| eventId | [Id](fields.md#id) | 是 | ； |
| sequence | integer | 是 | 设备单调序号；minimum=1, maximum=9000000000000 |
| assignmentId | [Id](fields.md#id) | 是 | ； |
| assignmentVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| planVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| observedAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| type | `HANDOVER_SIGNED` | 是 | ； |
| payload | [HandoverSignature](fields.md#handoversignature) | 是 | ； |

## SyncDeparted

离线事件 DEPARTED

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| eventId | [Id](fields.md#id) | 是 | ； |
| sequence | integer | 是 | 设备单调序号；minimum=1, maximum=9000000000000 |
| assignmentId | [Id](fields.md#id) | 是 | ； |
| assignmentVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| planVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| observedAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| type | `DEPARTED` | 是 | ； |
| payload | [Reason](fields.md#reason) | 是 | ； |

## SyncDeliveryRecorded

离线事件 DELIVERY_RECORDED

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| eventId | [Id](fields.md#id) | 是 | ； |
| sequence | integer | 是 | 设备单调序号；minimum=1, maximum=9000000000000 |
| assignmentId | [Id](fields.md#id) | 是 | ； |
| assignmentVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| planVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| observedAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| type | `DELIVERY_RECORDED` | 是 | ； |
| payload | [DeliveryRequest](fields.md#deliveryrequest) | 是 | ； |

## SyncCashReported

离线事件 CASH_REPORTED

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| eventId | [Id](fields.md#id) | 是 | ； |
| sequence | integer | 是 | 设备单调序号；minimum=1, maximum=9000000000000 |
| assignmentId | [Id](fields.md#id) | 是 | ； |
| assignmentVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| planVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| observedAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| type | `CASH_REPORTED` | 是 | ； |
| payload | [DriverCashReport](fields.md#drivercashreport) | 是 | ； |

## SyncExceptionReported

离线事件 EXCEPTION_REPORTED

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| eventId | [Id](fields.md#id) | 是 | ； |
| sequence | integer | 是 | 设备单调序号；minimum=1, maximum=9000000000000 |
| assignmentId | [Id](fields.md#id) | 是 | ； |
| assignmentVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| planVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| observedAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| type | `EXCEPTION_REPORTED` | 是 | ； |
| payload | [ExceptionRequest](fields.md#exceptionrequest) | 是 | ； |

## OrderSummaryPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[OrderSummary](fields.md#ordersummary)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## TimelineEventPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[TimelineEvent](fields.md#timelineevent)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## PromisePage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[Promise](fields.md#promise)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## VehiclePage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[Vehicle](fields.md#vehicle)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## CandidatePage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[Candidate](fields.md#candidate)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## PartnerPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[Partner](fields.md#partner)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## ExceptionPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[Exception](fields.md#exception)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## AssignOwner

授权负责人及期限

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| ownerId | [Id](fields.md#id) | 是 | ； |
| dueAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| reason | string | 是 | 交办说明；minLength=1, maxLength=1000 |

## WarehouseRequestPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[WarehouseRequest](fields.md#warehouserequest)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## FinanceTaskPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[FinanceTask](fields.md#financetask)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## LedgerItemPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[LedgerItem](fields.md#ledgeritem)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## ReceiptPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[Receipt](fields.md#receipt)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## FinanceDocumentPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[FinanceDocument](fields.md#financedocument)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## CashHandoverPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[CashHandover](fields.md#cashhandover)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## PaymentIntentPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[PaymentIntent](fields.md#paymentintent)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## BankTransactionPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[BankTransaction](fields.md#banktransaction)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## SettlementRulePage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[SettlementRule](fields.md#settlementrule)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## PeriodPreviewPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[PeriodPreview](fields.md#periodpreview)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## StatementPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[Statement](fields.md#statement)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## StatementGenerate

后台调度或授权补跑使用同一持久任务去重，不由浏览器日期驱动

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| ruleId | [Id](fields.md#id) | 是 | ； |
| ruleVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| periodStart | string | 是 | Asia/Phnom_Penh业务日期；format=date |
| periodEndExclusive | string | 是 | Asia/Phnom_Penh业务日期；format=date |

## ReportRowPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[ReportRow](fields.md#reportrow)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## ServiceCasePage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[ServiceCase](fields.md#servicecase)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## InventoryRowPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[InventoryRow](fields.md#inventoryrow)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## OwnFinanceRequestPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[OwnFinanceRequest](fields.md#ownfinancerequest)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## PortalMembershipPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[PortalMembership](fields.md#portalmembership)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## AssignmentPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[Assignment](fields.md#assignment)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## SyncResultPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[SyncResult](fields.md#syncresult)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## ServiceAreaPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[ServiceArea](fields.md#servicearea)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## AccessGrantPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[AccessGrant](fields.md#accessgrant)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## AccountChangeView

只返回脱敏账户变更内容

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| kind | `ACCOUNT_CHANGE` | 是 | ； |
| subjectId | [Id](fields.md#id) | 是 | ； |
| currency | [Currency](fields.md#currency) | 是 | ； |
| currentAccountVersion | integer | 是 | 聚合乐观锁版本；minimum=0, maximum=9000000000000 |
| bankCode | string | 是 | 银行标识；minLength=1, maxLength=64 |
| holderDisplayName | string | 是 | 脱敏名称；minLength=1, maxLength=120 |
| last4 | string | 是 | ；pattern=^[0-9]{4}$ |
| secretFingerprint | string | 是 | 账户明文的不可逆审核绑定值；pattern=^[a-f0-9]{64}$ |
| reason | string | 是 | 理由；minLength=1, maxLength=1000 |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## HandoverReviewView

点收记录与审核关联

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| kind | `CASH_HANDOVER` | 是 | ； |
| handoverId | [Id](fields.md#id) | 是 | ； |
| handoverVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| declared | [Money](fields.md#money) | 是 | ； |
| counted | [Money](fields.md#money) | 是 | ； |

## ChannelReviewView

渠道结算审核内容，不包含完整银行流水

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| kind | `CHANNEL_SETTLEMENT` | 是 | ； |
| settlementId | [Id](fields.md#id) | 是 | ； |
| settlementVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| grossMinor | integer | 是 | 毛额；minimum=0, maximum=9000000000000 |
| feeMinor | integer | 是 | 手续费；minimum=0, maximum=9000000000000 |
| refundMinor | integer | 是 | 已确认渠道退款；minimum=0, maximum=9000000000000 |
| netMinor | integer | 是 | 净额；minimum=0, maximum=9000000000000 |
| bankTransaction | [ResourceVersion](fields.md#resourceversion) | 是 | ； |
| receiptIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=1000 |

## FinanceDocumentDetails

审核必须看到费用构成、核销分项、来源版本；kind必须等于根对象kind

[AllocationDraft](fields.md#allocationdraft) 或 [PaymentDraft](fields.md#paymentdraft) 或 [RefundDraft](fields.md#refunddraft) 或 [AdjustmentDraft](fields.md#adjustmentdraft) 或 [ReversalDraft](fields.md#reversaldraft) 或 [PayableDraft](fields.md#payabledraft) 或 [AccountChangeView](fields.md#accountchangeview) 或 [HandoverReviewView](fields.md#handoverreviewview) 或 [ChannelReviewView](fields.md#channelreviewview)


## RecipientServiceRequest

只接受当前收货人、本订单的安排和异常请求；不接受费用异议或任意身份

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| orderId | [Id](fields.md#id) | 是 | ； |
| orderVersion | integer | 是 | 聚合乐观锁版本；minimum=1, maximum=9000000000000 |
| type | `ADDRESS_CHANGE` / `TIME_CHANGE` / `MISSING` / `DAMAGED` / `WRONG_GOODS` / `REFUSAL` / `RETURN` | 是 | 稳定编码，未知编码不得推断为成功； |
| description | string | 是 | 申请说明；minLength=1, maxLength=2000 |
| requestedDelivery | [Location](fields.md#location) | 可省略 | ； |
| requestedWindow | [TimeWindow](fields.md#timewindow) | 可省略 | ； |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=20 |

## SyncBatchResult

结果与请求eventId对应，无分页；每事件独立结果

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| results | array<[SyncResult](fields.md#syncresult)> | 是 | ；minItems=1, maxItems=100 |

## VehiclePromiseCheckRequest

自营/合作车辆承诺检查

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| quoteId | [Id](fields.md#id) | 是 | ； |
| vehicleId | [Id](fields.md#id) | 是 | ； |
| pickupWindow | [TimeWindow](fields.md#timewindow) | 是 | ； |
| deliveryWindow | [TimeWindow](fields.md#timewindow) | 是 | ； |
| fulfillmentMode | `VEHICLE` | 是 | ； |

## CarrierPromiseCheckRequest

人工快递按批准服务能力及协议证据检查；不伪造车辆/路线版本

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| quoteId | [Id](fields.md#id) | 是 | ； |
| pickupWindow | [TimeWindow](fields.md#timewindow) | 是 | ； |
| deliveryWindow | [TimeWindow](fields.md#timewindow) | 是 | ； |
| fulfillmentMode | `PARCEL_CARRIER` | 是 | ； |
| partnerId | [Id](fields.md#id) | 是 | ； |
| agreementVersionId | [Id](fields.md#id) | 是 | ； |
| serviceEvidenceIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## OrderItem

服务端逐件实物标识；packageIds长度等于quantity，跨单不复用，存在交接后禁止改写

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| clientItemId | [Id](fields.md#id) | 是 | ； |
| skuId | [Id](fields.md#id) | 可省略 | ； |
| name | string | 是 | 货物名称；minLength=1, maxLength=255 |
| quantity | integer | 是 | 件数；minimum=1, maximum=1000 |
| lengthCm | number 或 null | 是 | ； |
| widthCm | number 或 null | 是 | ； |
| heightCm | number 或 null | 是 | ； |
| weightKg | number 或 null | 是 | ； |
| unknownReason | string | 可省略 | 有未知尺寸/重量时必填；minLength=1, maxLength=500 |
| rotationAllowed | boolean | 是 | 允许旋转； |
| stackable | boolean | 是 | 允许堆叠； |
| uprightOnly | boolean | 是 | 禁止倒置； |
| restrictions | array<`FRAGILE` / `TEMPERATURE_CONTROLLED` / `SPECIAL_EQUIPMENT` / `NO_EXTERNAL_OVERHANG`> | 是 | ；minItems=0, maxItems=100 |
| measurementEvidenceIds | array<[Id](fields.md#id)> | 是 | ；minItems=0, maxItems=20 |
| id | [Id](fields.md#id) | 是 | ； |
| packageIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=1000, uniqueItems=True |

## AccountMaskedPage

稳定排序的游标分页；只包含授权数据

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[AccountMasked](fields.md#accountmasked)> | 是 | ；minItems=0, maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## RecipientAuthorization

服务端签发的收货授权记录；记录登记收货人或已核验代理人，不是签收事实。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| orderId | [Id](fields.md#id) | 是 | ； |
| orderVersion | integer | 是 | ；minimum=1, maximum=9000000000000 |
| expiresAt | [Timestamp](fields.md#timestamp) | 是 | ； |
| state | `active` / `revoked` / `expired` | 是 | ； |
| evidenceFileIds | array<[Id](fields.md#id)> | 是 | ；minItems=1, maxItems=20 |

## PricingTariffCreate

新建本企业费用草稿；不接收身份、审批或费目字段。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| name | string | 是 | ；minLength=1, maxLength=120 |
| owner | `DR` / `VET` / `ZTO` / `CE` / `JT` | 是 | ； |
| currency | [Currency](fields.md#currency) | 是 | ； |
| scope | string | 是 | ；minLength=1, maxLength=300 |

## PricingFeeDraft

替换草稿中的一个费目；所有字段必填，跨字段规则见pricing-api.md。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| code | `base` / `weight` / `distance` / `flash` / `pickup` / `door` / `remote` / `handling` / `stairs` / `waiting` / `redelivery` / `return` / `cancel` / `cod` / `insurance` / `storage` / `inbound` / `outbound` / `packing` | 是 | ； |
| enabled | boolean | 是 | ； |
| method | `fixed` / `unit` / `percent` | 是 | ； |
| amount | integer | 是 | ；minimum=0, maximum=9000000000000 |
| unit | `cbmDay` / `day` / `floor` / `kg` / `km` / `minute` / `piece` / `stop` 或 null | 是 | ； |
| includedMilli | integer | 是 | ；minimum=0, maximum=9000000000000 |
| stepMilli | integer | 是 | ；minimum=1, maximum=9000000000000 |
| share | boolean | 是 | ； |
| scope | string | 是 | ；minLength=1, maxLength=300 |
| evidence | string | 是 | ；minLength=1, maxLength=300 |

## PricingTariff

草稿当前版本及完整费目；不是已批准价表或订单报价。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | string | 是 | ；format=uuid |
| name | string | 是 | ；minLength=1, maxLength=120 |
| owner | `DR` / `VET` / `ZTO` / `CE` / `JT` | 是 | ； |
| currency | [Currency](fields.md#currency) | 是 | ； |
| scope | string | 是 | ；minLength=1, maxLength=300 |
| state | `DRAFT` | 是 | ； |
| version | integer | 是 | ；minimum=1, maximum=9000000000000 |
| rules | array<[PricingFeeDraft](fields.md#pricingfeedraft)> | 是 | ；minItems=0, maxItems=19 |
| createdAt | string | 是 | ；format=date-time |
| updatedAt | string | 是 | ；format=date-time |

## PricingTrialInput

单费目试算输入：fixed两项均null；unit仅quantityMilli；percent仅basisMinor。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| code | `base` / `weight` / `distance` / `flash` / `pickup` / `door` / `remote` / `handling` / `stairs` / `waiting` / `redelivery` / `return` / `cancel` / `cod` / `insurance` / `storage` / `inbound` / `outbound` / `packing` | 是 | ； |
| quantityMilli | integer 或 null | 是 | ； |
| basisMinor | integer 或 null | 是 | ； |

## PricingTrialRequest

明确选择本次模拟费目，代码不可重复；不自动推断订单应收费目。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| lines | array<[PricingTrialInput](fields.md#pricingtrialinput)> | 是 | ；minItems=1, maxItems=19 |

## PricingTrialLine

逐行费用及使用的原始输入、规则快照。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| code | `base` / `weight` / `distance` / `flash` / `pickup` / `door` / `remote` / `handling` / `stairs` / `waiting` / `redelivery` / `return` / `cancel` / `cod` / `insurance` / `storage` / `inbound` / `outbound` / `packing` | 是 | ； |
| amountMinor | integer | 是 | ；minimum=0, maximum=9000000000000 |
| units | integer | 是 | ；minimum=0, maximum=9000000000000 |
| input | [PricingTrialInput](fields.md#pricingtrialinput) | 是 | ； |
| rule | [PricingFeeDraft](fields.md#pricingfeedraft) | 是 | ； |

## PricingTrialResult

持久化模拟快照；totalMinor=shareMinor+separateMinor，保险是独立部分的子集。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | string | 是 | ；format=uuid |
| tariffId | string | 是 | ；format=uuid |
| tariffVersion | integer | 是 | ；minimum=1, maximum=9000000000000 |
| state | `SIMULATION` | 是 | ； |
| currency | [Currency](fields.md#currency) | 是 | ； |
| totalMinor | integer | 是 | ；minimum=0, maximum=9000000000000 |
| insuranceMinor | integer | 是 | ；minimum=0, maximum=9000000000000 |
| shareMinor | integer | 是 | ；minimum=0, maximum=9000000000000 |
| separateMinor | integer | 是 | ；minimum=0, maximum=9000000000000 |
| lines | array<[PricingTrialLine](fields.md#pricingtrialline)> | 是 | ；minItems=1, maxItems=19 |
| createdAt | string | 是 | ；format=date-time |

## PricingTariffPage

本企业草稿列表；UUID升序，nextAfter=null表示没有下一页。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[PricingTariff](fields.md#pricingtariff)> | 是 | ；minItems=0, maxItems=100 |
| nextAfter | string 或 null | 是 | ； |

## PricingRevision

不可覆盖的价表版本及经办主体。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| tariffId | string | 是 | ；format=uuid |
| version | integer | 是 | ；minimum=1, maximum=9000000000000 |
| snapshot | [PricingTariff](fields.md#pricingtariff) | 是 | ； |
| principalId | string | 是 | ；format=uuid |
| createdAt | string | 是 | ；format=date-time |

## PricingRevisionPage

版本降序；nextAfterVersion=null表示没有下一页。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<[PricingRevision](fields.md#pricingrevision)> | 是 | ；minItems=0, maxItems=100 |
| nextAfterVersion | integer 或 null | 是 | ； |

## PricingCatalogEntry

允许的费目单位、基数与分成限制；不包含正式费率。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| code | `base` / `weight` / `distance` / `flash` / `pickup` / `door` / `remote` / `handling` / `stairs` / `waiting` / `redelivery` / `return` / `cancel` / `cod` / `insurance` / `storage` / `inbound` / `outbound` / `packing` | 是 | ； |
| name | string | 是 | ；minLength=1, maxLength=300 |
| group | string | 是 | ；minLength=1, maxLength=300 |
| units | array<`cbmDay` / `day` / `floor` / `kg` / `km` / `minute` / `piece` / `stop`> | 是 | ；minItems=0, maxItems=8 |
| share | boolean | 可省略 | ； |
| basis | `goods` / `cod` | 可省略 | ； |
| locked | boolean | 可省略 | ； |

## PricingCatalog

19个费目目录；与原型目录通过一致性测试。

array<[PricingCatalogEntry](fields.md#pricingcatalogentry)>


## OrderCustomerPage

当前主体获授权的启用客户，开发库仅含合成客户；不提供客户维护或授信能力。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<object> | 是 | ；maxItems=100 |
| nextCursor | string 或 null | 是 | ； |

## PricingPolicySubmit

指定费率草稿版本的不可变审核申请；有效期与报价TTL必须显式给定，固定费切片，不产生订单报价。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| validFrom | string | 是 | ；format=date-time |
| validUntil | string | 是 | ；format=date-time |
| quoteValiditySeconds | integer | 是 | ；minimum=1, maximum=86400 |
| serviceLevels | array<`S1` / `S2` / `S3`> | 是 | ；minItems=1, maxItems=3, uniqueItems=True |
| reason | string | 是 | ；minLength=1, maxLength=1000 |

## PricingPolicyDecision

本机开发中的人工复核／批准说明，不假称已上传或核验文件；操作者由会话确定。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| reason | string | 是 | ；minLength=1, maxLength=1000 |

## PricingPolicyDecisionRecord

独立主体的只追加审核事实。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| principalId | string | 是 | ；format=uuid |
| reason | string | 是 | ；minLength=1, maxLength=1000 |
| createdAt | string | 是 | ；format=date-time |

## PricingPolicyVersion

冻结的费率快照与审批投影，版本1提交／2复核／3发布；有效期另外判断。来源tariff仍为DRAFT快照，不是原草稿自动升级。

| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | string | 是 | ；format=uuid |
| tariffId | string | 是 | ；format=uuid |
| tariffVersion | integer | 是 | ；minimum=1, maximum=9000000000000 |
| preparedBy | string | 是 | ；format=uuid |
| contributors | array<string> | 是 | ；minItems=1, uniqueItems=True |
| tariff | [PricingTariff](fields.md#pricingtariff) | 是 | ； |
| validFrom | string | 是 | ；format=date-time |
| validUntil | string | 是 | ；format=date-time |
| quoteValiditySeconds | integer | 是 | ；minimum=1, maximum=86400 |
| serviceLevels | array<`S1` / `S2` / `S3`> | 是 | ；minItems=1, maxItems=3, uniqueItems=True |
| reason | string | 是 | ；minLength=1, maxLength=1000 |
| createdAt | string | 是 | ；format=date-time |
| version | integer | 是 | ；minimum=1, maximum=3 |
| state | `SUBMITTED` / `REVIEWED` / `PUBLISHED` | 是 | ； |
| review | [PricingPolicyDecisionRecord](fields.md#pricingpolicydecisionrecord) 或 null | 是 | ； |
| publication | [PricingPolicyDecisionRecord](fields.md#pricingpolicydecisionrecord) 或 null | 是 | ； |

## IntakeReason



| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| reason | string | 是 | ；minLength=1, maxLength=1000 |

## OrderIntakeInput



| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| pickup | object | 是 | ； |
| delivery | object | 是 | ； |
| measurements | array<object> | 是 | ；minItems=1, maxItems=200 |

## OrderIntakeEvidence



| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| orderId | [Id](fields.md#id) | 是 | ； |
| orderVersion | integer | 是 | ；minimum=1, maximum=9000000000000 |
| recordedBy | [Id](fields.md#id) | 是 | ； |
| recordedAt | string | 是 | ；format=date-time |
| sourceQuality | `MANUAL_RECORDED` | 是 | ； |
| data | [OrderIntakeInput](fields.md#orderintakeinput) | 是 | ； |
| sourceSnapshot | [OrderDraft](fields.md#orderdraft) | 是 | ； |

## OrderIntakeCheck



| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| orderId | [Id](fields.md#id) | 是 | ； |
| orderVersion | integer | 是 | ；minimum=1, maximum=9000000000000 |
| evidenceId | [Id](fields.md#id) 或 null | 是 | ； |
| areaRevision | integer | 是 | ；minimum=0 |
| checkedAt | string | 是 | ；format=date-time |
| ready | boolean | 是 | ； |
| automationEligible | `False` | 是 | ； |
| sourceQuality | `MANUAL_RECORDED` | 是 | ； |
| blockers | array<object> | 是 | ；maxItems=500 |
| evidence | [OrderIntakeEvidence](fields.md#orderintakeevidence) 或 null | 是 | ； |

## ManualQuoteConfirmation



| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| customerContact | string | 是 | ；minLength=1, maxLength=200 |
| method | `PHONE` / `MESSAGE` / `IN_PERSON` / `PORTAL` | 是 | ； |
| reference | string | 是 | ；minLength=1, maxLength=1000 |
| confirmedAt | string | 是 | ；format=date-time |
| evidenceFileIds | array<[Id](fields.md#id)> | 可省略 | ；minItems=1, maxItems=20, uniqueItems=True |

## PrepaymentAccounts



| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| items | array<object> | 是 | ； |

## PrepaymentReceiptInput



| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| receivingAccountId | [Id](fields.md#id) | 是 | ； |
| money | [PositiveMoney](fields.md#positivemoney) | 是 | ； |
| bankReference | string | 是 | ；minLength=1, maxLength=128, pattern=^[A-Za-z0-9._:/-]+$ |
| reference | string | 是 | ；minLength=1, maxLength=1000 |
| observedAt | string | 是 | ；format=date-time |

## PrepaymentDecision



| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| approve | boolean | 是 | ； |
| reason | string | 是 | ；minLength=1, maxLength=1000 |

## PrepaymentReceipt



| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| orderId | [Id](fields.md#id) | 是 | ； |
| quoteId | [Id](fields.md#id) | 是 | ； |
| preparedBy | [Id](fields.md#id) | 是 | ； |
| personId | [Id](fields.md#id) | 是 | ； |
| receivingAccountId | [Id](fields.md#id) | 是 | ； |
| money | [PositiveMoney](fields.md#positivemoney) | 是 | ； |
| bankReference | string | 是 | ；minLength=1, maxLength=128, pattern=^[A-Za-z0-9._:/-]+$ |
| reference | string | 是 | ；minLength=1, maxLength=1000 |
| observedAt | string | 是 | ；format=date-time |
| recordedAt | string | 是 | ；format=date-time |
| version | integer | 是 | ；minimum=1, maximum=9000000000000 |
| state | `REPORTED` / `CONFIRMED` / `REJECTED` | 是 | ； |
| verification | object 或 null | 是 | ； |

## PrepaymentAllocationInput



| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| receiptId | [Id](fields.md#id) | 是 | ； |
| lines | array<object> | 是 | ；minItems=1, maxItems=100 |
| reason | string | 是 | ；minLength=1, maxLength=1000 |

## PrepaymentAllocation



| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| orderId | [Id](fields.md#id) | 是 | ； |
| quoteId | [Id](fields.md#id) | 是 | ； |
| preparedBy | [Id](fields.md#id) | 是 | ； |
| personId | [Id](fields.md#id) | 是 | ； |
| receiptId | [Id](fields.md#id) | 是 | ； |
| lines | array<object> | 是 | ；minItems=1, maxItems=100 |
| reason | string | 是 | ；minLength=1, maxLength=1000 |
| amountMinor | integer | 是 | ；minimum=1, maximum=9000000000000 |
| createdAt | string | 是 | ；format=date-time |
| version | integer | 是 | ；minimum=1, maximum=9000000000000 |
| state | `SUBMITTED` / `REVIEWED` / `APPROVED` / `POSTED` / `REJECTED` / `REVERSED` | 是 | ； |
| events | array<object> | 是 | ； |
| reversalId | [Id](fields.md#id) | 可省略 | ； |

## PaymentAdmission



| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| orderId | [Id](fields.md#id) | 是 | ； |
| orderVersion | integer | 是 | ；minimum=1, maximum=9000000000000 |
| quoteId | [Id](fields.md#id) 或 null | 是 | ； |
| currency | [Currency](fields.md#currency) 或 null | 是 | ； |
| requiredMinor | integer 或 null | 是 | ； |
| confirmedMinor | integer | 是 | ；minimum=0, maximum=9000000000000 |
| allocatedMinor | integer | 是 | ；minimum=0, maximum=9000000000000 |
| unallocatedMinor | integer | 是 | ；minimum=0, maximum=9000000000000 |
| remainingMinor | integer 或 null | 是 | ； |
| fees | array<object> | 是 | ； |
| receipts | array<[PrepaymentReceipt](fields.md#prepaymentreceipt)> | 是 | ； |
| allocationIds | array<[Id](fields.md#id)> | 是 | ； |
| paymentSatisfied | boolean | 是 | ； |
| dispatchAllowed | `False` | 是 | ； |
| blockers | array<string> | 是 | ； |
| checkedAt | string | 是 | ；format=date-time |
| reversals | array<[AllocationReversal](fields.md#allocationreversal)> | 可省略 | ；maxItems=100 |

## AllocationReversalInput



| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| reason | string | 是 | ；minLength=1, maxLength=1000 |
| reference | string | 是 | ；minLength=1, maxLength=1000 |

## AllocationReversal



| 字段 | 类型 | 必填 | 约束和用途 |
|---|---|---|---|
| id | [Id](fields.md#id) | 是 | ； |
| orderId | [Id](fields.md#id) | 是 | ； |
| preparedBy | [Id](fields.md#id) | 是 | ； |
| personId | [Id](fields.md#id) | 是 | ； |
| createdAt | string | 是 | ；format=date-time |
| version | integer | 是 | ；minimum=1, maximum=9000000000000 |
| events | array<object> | 是 | ； |
| allocationId | [Id](fields.md#id) | 是 | ； |
| sourceAllocation | [PrepaymentAllocation](fields.md#prepaymentallocation) | 是 | ； |
| state | `SUBMITTED` / `REVIEWED` / `APPROVED` / `POSTED` / `REJECTED` | 是 | ； |
| reason | string | 是 | ；minLength=1, maxLength=1000 |
| reference | string | 是 | ；minLength=1, maxLength=1000 |
