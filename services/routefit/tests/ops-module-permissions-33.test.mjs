// CMP-1596: 33 个操作的权限点逐项对照（只读 contracts/modules，不碰 openapi.json）。
// 22 个沿用 Q-V1 2026-11-12 定名；另 11 个沿用既有权限名，不新造、不删减。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MODULES = ['ops-ad-campaigns', 'ops-roles-staff', 'ops-dashboard', 'ops-open-api', 'open-api-events'];

// operationId -> [method, path, permissions]
const NAMED_22 = {
  listAdCampaigns: ['GET', '/api/ops/v1/ad-campaigns', ['ads:read']],
  createAdCampaign: ['POST', '/api/ops/v1/ad-campaigns', ['ads:write']],
  patchAdCampaign: ['PATCH', '/api/ops/v1/ad-campaigns/{campaignId}', ['ads:write']],
  actOnAdCampaign: ['POST', '/api/ops/v1/ad-campaigns/{campaignId}/actions', ['ads:write', 'ads:approve', 'ads:offline']],
  getAdCampaignStats: ['GET', '/api/ops/v1/ad-campaigns/{campaignId}/stats', ['ads:read']],
  listRoles: ['GET', '/api/ops/v1/roles', ['roles:read']],
  createRole: ['POST', '/api/ops/v1/roles', ['roles:write']],
  patchRole: ['PATCH', '/api/ops/v1/roles/{roleId}', ['roles:write']],
  listStaff: ['GET', '/api/ops/v1/staff', ['staff:read']],
  assignStaffRoles: ['POST', '/api/ops/v1/staff', ['staff:write']],
  patchStaffRoles: ['PATCH', '/api/ops/v1/staff/{personId}', ['staff:write']],
  listAuditLogs: ['GET', '/api/ops/v1/audit-logs', ['audit:read']],
  getDashboardSummary: ['GET', '/api/ops/v1/dashboard/summary', ['dashboard:read']],
  openCreateQuote: ['POST', '/api/open/v1/quotes', ['open:quotes:create']],
  openCreateOrder: ['POST', '/api/open/v1/orders', ['open:orders:create']],
  openGetOrder: ['GET', '/api/open/v1/orders/{orderId}', ['open:orders:read']],
  openCancelOrder: ['POST', '/api/open/v1/orders/{orderId}/actions/cancel', ['open:orders:cancel']],
  openGetTracking: ['GET', '/api/open/v1/orders/{orderId}/tracking', ['open:tracking:read']],
  getDriverAd: ['GET', '/api/driver/v1/ads', ['driver:ads:read']],
  recordDriverAdInteraction: ['POST', '/api/driver/v1/ad-interactions', ['driver:ads:report']],
  getCustomerAd: ['GET', '/api/customer/v1/ads', ['customer:ads:read']],
  recordCustomerAdInteraction: ['POST', '/api/customer/v1/ad-interactions', ['customer:ads:report']],
};
// 其余 11 个：沿用既有权限名（getPermissionCatalog、通知 4 个另有 CMP-1589 的 Lead2 裁定，不在这 33 内）
const CARRIED_11 = {
  getAdCampaign: ['GET', '/api/ops/v1/ad-campaigns/{campaignId}', ['ads:read']],
  getDashboardTrends: ['GET', '/api/ops/v1/dashboard/trends', ['dashboard:read']],
  rotateApiKey: ['POST', '/api/ops/v1/api-keys/{keyId}/actions/rotate', ['openapi:keys:manage']],
  updateWebhookEndpoint: ['PATCH', '/api/ops/v1/webhook-endpoints/{endpointId}', ['openapi:webhooks:manage']],
  testWebhookEndpoint: ['POST', '/api/ops/v1/webhook-endpoints/{endpointId}/actions/test', ['openapi:webhooks:manage']],
  listAllWebhookDeliveries: ['GET', '/api/ops/v1/webhook-deliveries', ['openapi:webhooks:manage']],
  setRolePermissions: ['POST', '/api/ops/v1/roles/{roleId}/actions/set-permissions', ['roles:write']],
  disableStaff: ['POST', '/api/ops/v1/staff/{staffId}/actions/disable', ['staff:write']],
  enableStaff: ['POST', '/api/ops/v1/staff/{staffId}/actions/enable', ['staff:write']],
  patchStaff: ['PATCH', '/api/ops/v1/staff/{staffId}', ['staff:write']],
  // 开放事件读取：定名文件未覆盖，沿用基线密钥范围 order:read，待 Q-V1 补定名（不在本卡自行新造）
  openListEvents: ['GET', '/api/open/v1/events', ['order:read']],
};
const ACTION_MAP = {
  submit: 'ads:write', withdraw: 'ads:write', approve: 'ads:approve', reject: 'ads:approve', offline: 'ads:offline',
};

function loadOps() {
  const ops = new Map();
  for (const m of MODULES) {
    const j = JSON.parse(readFileSync(path.join(root, 'contracts/modules', `${m}.json`), 'utf8'));
    for (const [p, v] of Object.entries(j.paths || {})) {
      for (const [method, o] of Object.entries(v)) {
        if (o && o.operationId) ops.set(o.operationId, { m, method: method.toUpperCase(), path: p, o });
      }
    }
    for (const o of j['x-recorded-operations'] || []) {
      ops.set(o.operationId, { m, method: o.method.toUpperCase(), path: o.path, o });
    }
  }
  return ops;
}
const ops = loadOps();
const ALL = { ...NAMED_22, ...CARRIED_11 };

test('33 个操作：数量与 operationId 齐全', () => {
  assert.equal(Object.keys(NAMED_22).length, 22);
  assert.equal(Object.keys(CARRIED_11).length, 11);
  for (const id of Object.keys(ALL)) assert.ok(ops.has(id), `${id} 不在模块契约里`);
});

test('33 个操作：方法、路径、x-permissions 与对照表逐项一致', () => {
  for (const [id, [method, p, perms]] of Object.entries(ALL)) {
    const e = ops.get(id);
    assert.equal(e.method, method, `${id} method`);
    assert.equal(e.path, p, `${id} path`);
    assert.deepEqual(e.o['x-permissions'], perms, `${id} x-permissions`);
  }
});

test('33 个操作：x-permissions 非空，且不再有「待 Lead 裁定」', () => {
  for (const id of Object.keys(ALL)) {
    const o = ops.get(id).o;
    assert.ok(Array.isArray(o['x-permissions']) && o['x-permissions'].length > 0, `${id} 权限为空`);
    assert.ok(!/待 ?Lead|Awaiting Lead/i.test(JSON.stringify(o)), `${id} 仍含待裁定字样`);
  }
});

test('actOnAdCampaign：x-action-permissions 恰好五个动作，映射与裁定一致', () => {
  const o = ops.get('actOnAdCampaign').o;
  assert.deepEqual(o['x-action-permissions'], ACTION_MAP);
  const declared = new Set(o['x-permissions']);
  for (const v of Object.values(o['x-action-permissions'])) assert.ok(declared.has(v), `${v} 不在 x-permissions 里`);
  // 其余 32 个操作不得带 x-action-permissions
  for (const id of Object.keys(ALL)) {
    if (id !== 'actOnAdCampaign') assert.equal(ops.get(id).o['x-action-permissions'], undefined, `${id} 不应带动作映射`);
  }
});

test('22 个定名：没有多出也没有缺少（新建名集合恰好是定名文件的 22 个操作所用名字）', () => {
  const used = new Set(Object.values(NAMED_22).flatMap((v) => v[2]));
  assert.deepEqual([...used].sort(), [
    'ads:approve', 'ads:offline', 'ads:read', 'ads:write', 'audit:read', 'customer:ads:read', 'customer:ads:report',
    'dashboard:read', 'driver:ads:read', 'driver:ads:report', 'open:orders:cancel', 'open:orders:create',
    'open:orders:read', 'open:quotes:create', 'open:tracking:read', 'roles:read', 'roles:write', 'staff:read', 'staff:write',
  ].sort());
});

test('getPermissionCatalog 示例列出全部 22 个定名所用权限点', () => {
  const cat = ops.get('getPermissionCatalog').o;
  const codes = new Set();
  const walk = (x) => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') {
      if (typeof x.code === 'string') codes.add(x.code);
      Object.values(x).forEach(walk);
    }
  };
  walk(cat['x-examples']);
  for (const v of Object.values(NAMED_22).flatMap((v) => v[2])) assert.ok(codes.has(v), `目录缺 ${v}`);
});
