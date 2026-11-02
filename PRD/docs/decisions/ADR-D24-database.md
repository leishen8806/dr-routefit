# ADR D24 · 数据库选型：PostgreSQL 16，PostGIS 后置

| 项目 | 内容 |
| --- | --- |
| 编号 | D24（数据库部分）；PRD V1.4 第 19 章 D24“开源选型”的其余候选组件不在本 ADR |
| 日期 | 2026-10-27 |
| 状态 | 待批准（本文件合入 `develop` 即视为项目负责人批准） |
| 起草 | Claude（任务 RF-DEC-04） |
| 批准人 | 项目负责人 |
| 依据 | 2026-10-26 产品需求会 M08 结论；[数据库架构](../database-architecture.md)；[开发标准](../development-standards.md) 第 11 章 |

## 背景

[数据库架构](../database-architecture.md)建议“PostgreSQL 16 及以上 + PostGIS 3.4 及以上”，并要求正式选定写入 ADR。需求会 M08 采纳：当前采用 PostgreSQL 16，PostGIS 在 GeoCore 服务区落地时引入。

截至 `develop` `a12b15f` 的事实：

- `services/routefit` 的 63 个迁移只使用 PostgreSQL 16 原生能力：行级安全（RLS，按 `app.company_id`／`app.principal_id`）、限制性策略、排他约束与部分唯一索引、只追加触发器。迁移不依赖 PostGIS。测试夹具另用咨询锁串行创建集群级角色。
- CI 使用 `postgres:16` 镜像，每个集成测试文件新建随机合成库、从零应用全部迁移并清理；最近一次 `develop` CI 集成测试 77/77 通过。
- 服务区目前以合成区域和坐标点（`{lng,lat}`）在应用层判定；`geocore-g1-schema-draft.sql` 中的 PostGIS 草案未进入迁移。

## 决定

1. **当前数据库为 PostgreSQL 16**（16.x 次版本可升级）。开发、CI、试点环境均使用同一主版本。
2. **暂不引入 PostGIS。**引入时点：GeoCore 服务区（多边形边界、距离与覆盖查询）开始落到迁移时。届时用新的前向迁移启用扩展，不改写已有迁移。
3. 不使用 PostgreSQL `ENUM` 类型表达状态，沿用 `text` + `CHECK`（见数据库架构）。
4. 迁移只追加；已应用迁移的内容由 `migrate.mjs` 的校验和保护。修改已发布迁移须人类批准，并说明受影响的数据库需重建。

## 理由

- 现有安全与一致性要求（多企业隔离、同车时段排他、幂等与只追加）都由 PostgreSQL 原生能力满足，并已有真实数据库集成测试证据。
- PostGIS 目前没有调用方；提前引入只增加 CI 镜像、运维与许可审核（PostGIS 为 GPL-2.0 及以上，作为独立数据库扩展运行，不随 RouteFit 代码分发）负担。

## 后果

- CI 继续用官方 `postgres:16` 镜像；引入 PostGIS 时改用含 PostGIS 的镜像，并在同一 PR 中更新本 ADR。
- 服务区判定暂在应用层完成，精度与性能限于试点规模；GeoCore 落地前不对客户承诺基于真实路网的距离或时效（与 M03 一致）。
- 生产数据库的托管方式、备份、监控与恢复不在本 ADR，属生产发布门槛，另行决定。

## 未决

- PostGIS 版本（建议 3.4 及以上）与镜像来源，待 GeoCore 服务区任务时确定。
- V1.4 D24 中除数据库以外的开源候选组件，仍按 V1.4 第 19 章待审。
