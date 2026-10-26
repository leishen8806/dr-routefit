# 运营证据文件 API（本机开发）

2026-10-25。本文件只说明 `opsUpload`、`opsCompleteUpload`、`opsEvidenceDownload` 三个本机接口；它们不是公网文件服务，也不构成生产级恶意文件扫描或长期对象存储。

## 可调用范围

| 操作 | 路径 | 当前结果 |
| --- | --- | --- |
| `opsUpload` | `POST /api/ops/v1/uploads` | 申请一次性、5 分钟有效的本机 `PUT` 能力链接 |
| `opsCompleteUpload` | `POST /api/ops/v1/uploads/{uploadId}/actions/complete` | 复核已上传对象，完成本机结构检查 |
| `opsEvidenceDownload` | `GET /api/ops/v1/evidence-files/{fileId}/download-url` | 签发仅本进程有效、5 分钟有效的下载链接 |

当前只接受已获授权的 `ORDER` 资源；`CASE`、`WAREHOUSE_REQUEST`、`FINANCE_DOCUMENT`、`PARTNER` 会以 `422 EVIDENCE_RESOURCE_UNSUPPORTED` 失败，不能借未接通对象写入证据。

## 本机流程

1. 运营人员以 `ops:evidence:create` 提交用途、订单、MIME、字节数和小写 SHA-256。
2. 服务端确认订单在当前企业／当前权限范围内，记录声明值并返回短期 `PUT` URL。
3. 客户端将原始内容放到 URL；服务端限制 JPEG、PNG、PDF 和 10 MiB，重算哈希并校验文件魔数。能力链接只能用于仍处于 `issued` 的同一对象。
4. 使用版本 `2` 调用完成接口。对象大小再次核对，并经历 `uploaded → scanning → available`。本机只做结构校验，不代表隔离式恶意文件扫描。
5. 拥有 `ops:evidence:read` 且仍能读取关联订单的主体才能取得下载 URL；跨企业或失去订单权限统一返回 `404`。

文件内容保存在 `ROUTEFIT_EVIDENCE_DIRECTORY`，数据库只保存对象键和校验元数据。上传与下载能力链接不写入数据库；服务重启会使已签发下载链接失效。

## 联调边界

- 本机服务只监听 loopback，临时上传／下载路径不配置 CORS。
- 不要将 `.local/evidence`、开发会话或合成测试文件提交到仓库。
- 上线前必须替换为受控对象存储、隔离扫描、保留策略、EXIF 脱敏和独立安全验收；当前 `available` 只代表本机哈希与文件签名通过。
