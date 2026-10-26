# RF-API-01 本机同源与开发会话 v0.1

仅用于合成数据联调，不能作为生产登录或公网网关。启动 `services/routefit` 后，同一个 `http://127.0.0.1:4180` 提供原型静态文件和43个本地业务API（8费用、5录单、4策略、8受理/区域、2报价、11预付核销、5核销撤销）。原4173服务保持原样；不从4173跨域调用4180，不添加CORS放行。

## 1. 启动与建立身份

新工作机按[服务README](../services/routefit/README.md)安装依赖和本机PostgreSQL，运行bootstrap。新bootstrap生成两个合成企业身份；运行服务后，另开终端在 `services/routefit` 执行：

```powershell
npm run session:link
# 第二个合成企业（仅新bootstrap提供；不是页面角色切换）
npm run session:link -- 1
# 企业A独立复核与批准（新bootstrap）
npm run session:link -- 2
npm run session:link -- 3
```

命令读取本机受保护的 `.local/sessions.json`，生成60秒有效、一次性、绑定具体本机源与预配置身份的激活链接。本人在浏览器地址栏打开链接后，服务验证企业和主体启用状态，设置HttpOnly会话Cookie并303跳转 `/prototype/`，活动URL中不保留ticket。不要转发、截图或记录链接；前端源码不包含链接、Cookie、数据库连接或固定登录token。

启动参数 `ROUTEFIT_ALLOWED_ORIGIN` 必须等于 `http://127.0.0.1:<ROUTEFIT_PORT>`。访问localhost或其他Host会被拒绝。会话cookie名为 `rf_session`，HttpOnly、SameSite=Strict、Path=/；仅本机HTTP环境不设置Secure，不可用于生产。票据原子领取，重复访问／并发第二次访问返回401。链接失败时生成新链接，不循环使用旧链接。

浏览器会话最长8小时，且不能晚于来源开发身份的到期时间；重启服务或主动退出后失效。来源身份默认24小时，过期按README在本机续期并重启。旧bootstrap可能只有身份0，不擅自添加有权身份或复制他人的 `.local`；新工作机自行生成。

## 2. 本地专用端点

这些端点属于开发环境适配器，不加入业务OpenAPI的215个操作计数，也不是未来IdP协议。

| 路径 | 条件 | 响应 |
|---|---|---|
| GET `/dev/openapi.json` | 仅本机源；不需要业务会话 | OpenAPI JSON，仅包含17个已实现操作；调用业务接口仍须认证 |
| GET `/dev/activate?ticket=<one-use>` | 本机源、60秒有效票据、预配置身份仍有效 | 303、Set-Cookie、Location=/prototype/；无效／过期／已用401 |
| GET `/dev/session` | 有效浏览器会话、企业／主体启用 | 200：mode、companyId、principalId、permissions、expiresAt、csrfToken |
| POST `/dev/session/logout` | 有效浏览器会话、精确Origin、X-CSRF-Token | 200：mode=local-development、signedOut=true；撤销服务端会话并清Cookie |

session响应不返回登录token或tokenHash。csrfToken仅放在当前页面内存，不写入源文件或浏览器持久存储；页面刷新后重新获取。GET session与所有响应均no-store。没有会话返回401，客户端应展示“请在本机建立开发会话”，不能自动换成演示身份。激活链接重新登录会撤销当前Cookie对应的旧浏览器会话。

## 3. 大旺的页面接线示例

```js
// 在4180下打开的页面中执行；浏览器自动带同源Cookie与POST的Origin。
const sessionResponse = await fetch('/dev/session', {credentials: 'same-origin'});
if (!sessionResponse.ok) throw new Error('请先建立本机开发会话');
const session = await sessionResponse.json();
// session.companyId仅供显示，不能作为可信权限或自报租户写进费用DTO。
const response = await fetch('/api/ops/v1/pricing/tariffs', {
  method: 'POST', credentials: 'same-origin',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': session.csrfToken,
    'Idempotency-Key': crypto.randomUUID() // 新动作生成；重试必须复用原值
  },
  body: JSON.stringify({name:'DEMO',owner:'DR',currency:'USD',scope:'合成本地试算'})
});
const result = await response.json();
if (!response.ok) throw new Error(result.error.code); // 实际UI按code/fields处理
```

保存费目和试算仍要求If-Match；整数金额、版本、幂等、RLS和保险排除规则见[费用API](pricing-api.md)。业务GET无需CSRF，POST必须带。退出后停止写操作，清除内存中的CSRF，显示未登录；再次建立会话后重新查询资源版本。

目前只提供接入能力，原型费用按钮仍走原sessionStorage逻辑，尚未实现RF-WEB-01。页面上的模拟角色不能改变后端身份，页面业务内容也不会因为Cookie存在就自动来自数据库。联调验收必须区分“同源API已可调用”和“具体按钮已接线”。

## 4. 接入防护与文件边界

服务只监听127.0.0.1；所有请求校验Host和Origin，Fetch Metadata仅允许none或same-origin；跨站、跨端口和DNS重绑定Host拒绝403。没有Access-Control-Allow-Origin通配符，也没有读本机凭据的HTTP端点。

静态服务限定原型顶层运行资源与 `brand/logo/`；禁止服务源码、测试脚本、记录目录、隐藏路径、路径穿越和链接文件。不暴露整个仓库。原型仍为未接线演示数据，应仅输入合成信息。Cookie在本机HTTP环境使用，其他同机进程／同源代码仍在开发信任边界内；这不是生产隔离方案。

通用错误使用现有ApiError格式。新增开发错误：INVALID_ACTIVATION、BROWSER_SESSION_REQUIRED、LOCAL_ONLY、HOST_FORBIDDEN、SESSION_LIMIT。日志不记录票据URL、Cookie或CSRF。开发票据文件位于 `.local/browser-grants/`；未使用或进程中断留下的文件只能用于本机开发，过期后无效，可在停止服务后清理。

## 5. 验证与未完成项

测试覆盖单次／并发领取、过期、停用身份、企业隔离、Cookie属性、CSRF、跨源／Host拒绝、静态文件范围、退出及重启失效。真实浏览器以原型同源fetch完成保存、325美分试算及刷新读取；结果见[RF-API-01记录](../services/routefit/verification/rf-api-01/README.md)。

没有生产登录、设备认证、完整客户权限或公网部署。费用POST的JSON重复键与非法UTF-8防护已在续轮补齐，见[技术复核](../services/routefit/verification/rf-api-01-followup/README.md)。大旺的前端交互和双方RF-QA-01业务验收继续待执行，按[验收交接表](../PRD/docs/tasks/fee-integration-qa-v0.1.md)分别记录接口测试和页面测试。

## 本轮可调用范围

004受理切片后本机 OpenAPI 共25操作（费用8、客户录单5、策略审核4、受理区域8）；完整契约219操作，其余194仅设计。新权限和步骤见 [order-intake-api.md](order-intake-api.md)，旧.local不自动扩权。

## 006开发身份

新bootstrap含六个身份：0企业A经办，1企业B经办，2策略复核，3策略批准，4财务核验/复核，5财务审批/入账。使用 `npm run session:link -- 4` 等分别激活，独立浏览器上下文保持独立Cookie，不在页面传actorId。旧.local不扩权，生产同人不同账号的可信人员映射仍待实现。完整调用见 [预付核销](prepayment-api.md)。
