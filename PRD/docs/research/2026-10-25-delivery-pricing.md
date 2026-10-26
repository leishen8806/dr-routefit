# 快递配送计价公开资料核查

核查日：2026-10-25。仅公开网站与官方开发文档，未联系供应商、登录商户账户、提交配送单或付款。研究用于[RouteFit 计价设计](../delivery-pricing-system-v0.1.md)，不是市场验证、合作方准入或正式费率批准。

后续补查：[VET、中通、CE、极兔计价](2026-10-25-vet-zto-ce-jt-pricing.md)。取得CE历史国内价图、极兔国内起步宣传价、VET证件专项价及中通国际价图；下文“本轮未取得”保留为首次核查记录，新增结论以补查记录的日期和适用范围为准，仍未取得四家当前完整合同价。

## 1. 已读资料与能得到的结论

| 来源与地区 | 本轮证据 | 对 RouteFit 的启发／限制 |
|---|---|---|
| [Cambodia Post 国内服务](https://cambodiapost.com.kh/send-within) | PostPack 表列 S：25×25×20 cm／最多2 kg／7,000 KHR；M：35×35×30／5 kg／10,000 KHR；L：45×45×40／10 kg／15,000 KHR | 存在“限定箱型＋限重”的产品价。不是任意包裹通用价，也不能据此假定包含上门取件、COD 或承诺当天到达；页面未列价表生效日 |
| [Vireak Buntham 产品服务](https://www.vireakbuntham.com/product-service) | 浏览器读到门到门／门到网点等模式、COD 返款宣传，以及保险服务按货值1%收费的说明 | 取送方式、代收和保险应分项。属于官网营销说明，未取得实际报价、保单、赔付除外责任和服务合同；不把1%变成 DR 费率或 COD 费率 |
| [Cambodian Express 当日服务](https://www.cambodianexpress.com/products/express/same-day-service/) | 页面列同城当日产品、截单／交付时间、门到门和 COD；未列可核算完整费率 | 产品适用城市、截单和时效要与价表绑定；宣传时间不等于 RouteFit 可承诺时效 |
| [Cambodian Express 客户入口](https://cp.cambodianexpress.com/) | 可见取件方式、起讫行政区、预估重量、到门、COD 等表单维度 | 可参考核价输入。未提交表单，未取得实际运费或 COD 结算费 |
| [DHL Cambodia 大件指南](https://www.dhl.com/discover/en-kh/logistics-advice/import-export-advice/how-to-ship-heavy-items-cambodia) | 2025-08-25 文章在海外运输语境给出 cm³÷5000 的体积重，并与实重比较 | 证明重量／体积需并核；该系数不是国内包裹或所有车型的统一标准。货物实际装箱仍另校验 |
| [DHL Cambodia 附加服务](https://www.dhl.com/discover/en-kh/ship-with-dhl/services/optional-services) | 将附加服务与附加费区别于基础运输费 | 采用结构化费目；不将其国际清关服务扩入 DR 首期 |
| [Lalamove 新加坡费用页](https://www.lalamove.com/en-sg/all-vehicle-pricing-detail) | 按车型列停靠、等待、取消、搬运等，并限定某些倍率只作用于基础／里程费 | 学习费目范围、计费事件和倍率基数。新加坡价不能换算后当金边价；该页10ft货车多点费在两处出现不同数值，故不采作可执行价格 |
| [Lalamove API](https://developers.lalamove.com/) | 报价 ID、有效期、费用拆分与服务／站点信息绑定 | 采用报价快照和版本确认，避免同意后漂移。只是接口设计参考，不代表其柬埔寨运力或 API 已可供 DR 使用 |

以上摘要为本次观察，不保证供应商实时可履约或给予同样合同价格。没有用零售商包邮、社交媒体优惠或其他国家运价填补柬埔寨报价空白。

## 2. 读取限制与排除材料

- [J&T 集团联系页](https://www.jtexpress.com/en/contactUs)可读到柬埔寨国家项；搜索得到的柬埔寨候选站 https://www.jtexpresskh.com/ 本轮正文为空。未取得可核算国内价表、体积系数或 COD 费率，因此不填 J&T 柬埔寨价格。越南站国际价表不能替代。
- VET 页面普通文本抓取仅返回需要 JavaScript；使用隔离浏览器只读其产品页后获得服务内容。未执行登录、询价提交或其他写操作。
- HLH 服务页直接读取返回404，未作为已核验计价依据。
- 检索到 Cambodia Post 2023 国际价表与 DHL 2026 Cambodia 国际费率资料；本轮不将其国际价格移植到国内配送，也未以未逐表核验的 PDF 金额作为依据。
- 2U Delivery 的国内报价、COD 条款和运营主体仍未完成取证，沿用[此前核查](2026-10-24-2u-delivery-review.md)的未知状态。

## 3. 研究结论与 DR 自有设计的区别

已观察到的机制：箱型／限重产品、重量体积比较、车型与附加服务、COD／保险分列、报价有效期及拆分。

DR 的设计建议：PARCEL／VEHICLE／SHARED／CONTRACT 主模式分开，仓储费独立；统一版本化报价，先核能力后报价，先付款或获批月结后派单。不是对供应商内部实现的推断。

本地仍缺：获批司机与车辆成本、不同起讫区的合作协议价、实际里程和装卸耗时、拒收／返仓成本、保险产品正式条款、KESS 合同渠道费用及已核实税务配置。缺项不默认0，也不要求用户逐条即时回答；先用空白价表收集，由责任岗位一次性补齐。

最小数据清单：每种拟开产品至少一个有效价表版本；每种计费单位与取整方式；免费／包含范围；退回、等待、复测规则；费用受益者与分成白名单；有效期、审批人和来源凭据。优先用现有合同及脱敏作业记录完成，不购买调研服务，不用真实下单制造出车。

来源状态的结构化记录见 [sources.json](2026-10-25-pricing-sources.json)。官网声明、人工观察、设计假设和程序算例分开保存。
