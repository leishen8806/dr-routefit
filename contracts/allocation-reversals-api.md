# 核销撤销 API · v0.1 本地开发

2026-10-25。扩展 [预付核销](prepayment-api.md)，新增5个操作；下述“55个本地可调用、180个仍设计”是本切片完成时的历史快照。当前全量状态以 [接口包首页](README.md) 为准。不修改正式PRD/RULE/AT。本切片只撤销未派单订单的一整笔已入账核销；保留原件、银行收款及金额，不能冒充退款、银行流水冲正或订单改价。

## 路由与版本

前缀 `/api/ops/v1`。全部POST须同源Cookie、CSRF、Idempotency-Key和带双引号If-Match。

| 方法及路径 | 权限 | 版本对象 / 结果 |
|---|---|---|
| POST /prepayment-allocations/{allocationId}/reversals | prepayment:correct | 原核销 version4；201返回AllocationReversal version1 |
| GET /allocation-reversals/{reversalId} | prepayment:read | 撤销申请、原核销快照及审核事件 |
| POST /allocation-reversals/{reversalId}/actions/review | prepayment:review | 撤销version1→2，REVIEWED或REJECTED |
| POST /allocation-reversals/{reversalId}/actions/approve | prepayment:approve | 撤销version2→3，APPROVED或REJECTED |
| POST /allocation-reversals/{reversalId}/actions/post | prepayment:post | 撤销version3→4 POSTED |

申请仅接受 `{ "reason": "原因", "reference": "核查依据" }`。目标、费用行、金额与来源审核链由服务器读取并冻结在sourceAllocation中，客户端不能指定负金额、改费用或改银行信息。review/approve使用 `{ "approve": true, "reason": "依据" }`，post仅reason。false终止该申请，另建申请必须重新审核。

经办、复核、审批按服务端person_id三人分离，同人多账号不能替代；post不对外付款。身份0/1新增prepayment:correct，4复核，5审批/入账；生产可信人员映射仍待开发。每单最多100次撤销申请；同一原核销只允许一份非拒绝申请，最终撤销入账在数据库上最多一次。

## 金额和页面状态

- 申请SUBMITTED/REVIEWED/APPROVED：原核销继续占用余额；PaymentAdmission.blockers加入ALLOCATION_REVERSAL_PENDING，paymentSatisfied=false；Order.collectionState显示disputed（有争议）。
- REJECTED：不改金额，解除该申请的暂停；其他阻断仍有效。
- POSTED：原核销GET变为version5/state REVERSED并返回reversalId，原始事件和费用不删改；原核销从有效分配中排除。confirmedMinor不变，allocatedMinor减少，unallocatedMinor及remainingMinor增加。银行交易唯一性不释放，不允许重新登记同一到账。
- 新核销：使用恢复后的未分配资金，另建PrepaymentAllocation，重新复核、审批、入账。新ID与旧件/撤销记录同时保留。

例：已确认收款300、配送200、保险75，原核销275、余25。整笔撤销入账后收款仍300、有效核销0、未分配300、未结275；再建正确核销275后，回到有效核销275、未分配25。保险75逐项恢复，不并入配送分成。撤销一笔部分核销只恢复该笔的费用分配，其余核销不变。

PaymentAdmission新增reversals数组，包含本单所有撤销申请及状态。allocationIds只列有效POSTED原核销。订单版本不随账务增长，必须重新GET财务状态；原件幂等重放仍返回原成功响应，不保证是当前状态。原POST可能重放POSTED/version4，但GET已是REVERSED/version5；界面不得凭旧响应显示已结清。

## 错误和恢复

403：权限不足或经办/复核/审批同人；404：不存在、跨企业、客户授权不足（旧幂等重放也检查）；409：原核销未入账/已撤销、已有待处理申请、审核顺序不符或订单已进入履约；412：原核销或撤销版本变更；422：未知字段、空白依据、超过本地限制。

服务端锁订单后重新检查状态，写入反向分配事件；GET使用一致性只读快照。重试保留原幂等键、正文及版本，不能更换键制造新撤销。记录不可覆盖/删除，拒绝后重提也保留拒绝记录。纠错申请本身不撤销客户报价，不清除订单锁；即使全部撤销，已确认订单仍不能退回。

## 大旺接线与边界

原核销详情增加“申请撤销”入口：必须显示源订单、币种、逐项金额、原收款及审核记录，提交前明确整笔撤销且不退款。待审显示有争议和下一责任角色；审批后仍显示待入账。完成后提供原核销、撤销及新核销的相互跳转。现有orders.html会显示有争议/待核销/部分核销/已核销；完整财务表单尚未实现。

`npm run smoke:reversals` 在新空目录bootstrap后运行，使用五个独立开发身份，走完报价、预付、整笔撤销、余额恢复、重新核销。脚本停用合成区域后准入会因区域变化阻断。HTTP模板见 [allocation-reversals.http](examples/allocation-reversals.http)。007迁移保留001–006。

暂不支持部分金额撤销、银行收款事实纠错、退款、资金退回、跨单核销、已履约订单纠错、月结、关账期间/总账冲正。上述功能须另有规则和事件，不通过管理员改余额解决。本模块的“冲回”仅指核销分配，不代表完整会计冲正。
