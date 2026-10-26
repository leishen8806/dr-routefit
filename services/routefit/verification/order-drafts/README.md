# 订单录入服务交付记录

2026-10-25 · 基础HEAD `ba9a77ec78cd20a6bf72476e9c3410d7faa9a06e`，本地工作区增量，不是已提交版本。用户将优先级明确为服务端、接口与对大旺的接入文档。

新增5个操作：授权客户查询、创建订单草稿、订单列表、详情、完整草稿编辑。原8个费用接口保留；服务仍仅本机开发模式。新增002迁移，不编辑001；四张表为客户、客户授权、订单草稿、只追加修订，订单和修订具有企业及客户范围RLS。PATCH纳入既有幂等结果表，方法是指纹与唯一键的一部分。

机器契约与调用资料见[订单API](../../../../contracts/orders-api.md)。同源GET `/dev/openapi.json`仅导出13个已实现操作；完整契约211个操作中198个仍未实现。

## 验证证据

- [service-tests.txt](service-tests.txt)：13个单测、两个PG父测试及22个集成子场景，共37项；价格／保险、版本、快照、客户授权、RLS、重复提交与重启均通过。
- [contract-validation.json](contract-validation.json)：188条路径、211操作、202 schema、415结构样例和23操作样例通过。生成接口目录与字段字典已同步。
- 本地接口文档导出在真实HTTP测试中检查只包含已实现操作、使用实际监听源、不包含正式报价操作。
- [protected-files-check.json](protected-files-check.json)：公共前端、正式PRD／验收映射和001迁移与前一交接包哈希一致。
- [migration-upgrade.json](migration-upgrade.json)：在上一轮恢复验证的合成库执行001→002升级；已有价表、费用、版本、试算、幂等五表的行数与内容哈希全部不变，非空旧库升级通过。
- `handoff/latest.json`指向最新代码快照；`handoff/restore-result.json`记录相同snapshotId的空目录恢复、依赖安装、服务测试、费用与订单smoke，凭据不进入包。

实际测试使用Node24.22.1及本机PostgreSQL16.15合成数据库。运行角色不能维护客户授权；首次测试发现SELECT FOR SHARE要求额外写权限，已改为只读授权检查，订单写入仍由RLS和行锁保护，未为方便联调扩大角色权限。

## 当前边界

不是生产身份或完整P01。只有PREPAID草稿及S1/S2/S3输入；月结、COD、商品／证据引用和S4显式返回CAPABILITY_DISABLED。没有把草稿费率变成正式报价，没有收款或派单。大旺的页面未修改；本轮没有浏览器按钮验收、独立技术审查、提交、推送或部署。
