export const financeTabs = ['对账总览', '司机现金', '待确认出款', '结算单', '工资单', '规则'];

export const adminFeaturePages = [
  { id: 'finance', title: '财务', description: '六个财务工作流均为本地模拟数据。', detail: '司机现金：Sokha 已交回现金（示例）', action: '点钱确认', isExample: true },
  { id: 'pricing', title: '价格与规则', description: '价格、车型与计费规则均可配置；当前仅展示示例。', detail: '城区起步规则（示例）', isExample: true },
  { id: 'marketing', title: '营销', description: '优惠券、核销记录与广告位均为示例配置。', detail: '新用户券 · 未核销（示例）', isExample: true },
  { id: 'integrations', title: '开放接口', description: '接口接入仅展示本地示例，不调用外部服务。', detail: '演示密钥：key_demo_••••（示例）', isExample: true },
  { id: 'settings', title: '系统设置', description: '权限与系统配置仅展示示例状态。', detail: '演示密钥：key_demo_••••（示例）', isExample: true },
];

const pageIds = new Set(adminFeaturePages.map((page) => page.id));
const confirmations = Object.freeze({ '点钱确认': 'take-cash', '确认出款': 'confirm-payout', 停用: 'disable-api-key' });

export function normalizeFeaturePage(page) {
  return pageIds.has(page) ? page : 'finance';
}

export function requiresConfirmation(action) {
  return confirmations[action] ?? null;
}
