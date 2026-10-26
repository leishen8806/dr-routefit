# 合作承运商准入接口（本地开发）

本组接口覆盖合作车辆和人工快递委托的准入事实：登记、独立核验、暂停、恢复和退出。它是后续合作方报价、委托、交接、签收核验和应付结算的前置，不替代这些尚未实现的流程。

## 证照预登记

合作方 ID 在登记时才生成，因此证照先通过现有 `POST /api/ops/v1/uploads` 上传为 `resourceType=PARTNER`、`purpose=QUALIFICATION` 的同一预登记证照包；调用方生成一个新的 UUID 作为该包的 `resourceId`。文件完成本机结构检查后，把所有文件 ID 一次性传入 `PartnerDraft.qualificationFileIds`。

预登记证照包只能绑定一次合作方；绑定后文件原始身份不改写。`available` 仅代表本机哈希／文件签名检查完成，不能替代生产恶意文件扫描、证照有效期核验、合同合规审查或主体身份尽调。

## 可调用操作

| 操作 | 路径 | 关键约束 |
|---|---|---|
| 列表 | `GET /api/ops/v1/carrier-partners` | 当前企业的稳定游标分页。 |
| 登记 | `POST /api/ops/v1/carrier-partners` | 同一预登记证照包必须完整、无重复并处于 `available`。 |
| 核验 | `POST .../{partnerId}/actions/verify` | 仅草稿；登记人与核验人必须是不同自然人；生成不可改准入版本。 |
| 暂停 | `POST .../{partnerId}/actions/suspend` | 仅活动合作方；阻断新任务，不改写未来在途、账款或争议事实。 |
| 恢复 | `POST .../{partnerId}/actions/reinstate` | 仅暂停合作方；重新复验同一完整证照协议包。 |
| 退出 | `POST .../{partnerId}/actions/exit` | 活动或暂停均可退出；仅结束新业务资格。 |

所有写操作使用幂等键和 `If-Match`（创建除外）。状态、版本、证照包、准入版本和事件历史在 PostgreSQL 中持久化，跨企业读取返回为不存在。

## 当前边界

尚未实现合作方委托单、承运商事件、签收核验、对账、应付结算或真实资质过期提醒；也没有接入外部快递商 API。合作方 `active` 只表示本机准入记录和证照包完整，不能当作真实保险、合同或监管合规的结论。
