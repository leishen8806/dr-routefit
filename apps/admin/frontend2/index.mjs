export const adminFeaturePages = [
  { id: 'funds', title: '财务' }, { id: 'price', title: '价格与规则' },
  { id: 'marketing', title: '营销' }, { id: 'api', title: '开放接口' }, { id: 'settings', title: '系统设置' },
];

const demo = '示例数据 · 纯前端';
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const confirmActions = { '确认出款': 'confirm-payout', '停用': 'disable-api-key', '点钱确认': 'take-cash' };
const normalizeAdminFeaturePage = (page) => adminFeaturePages.some((item) => item.id === page) ? page : 'funds';
const rows = (items) => `<div class="rf2-list">${items.map(([title, detail, action]) => { const confirm = confirmActions[action]; return `<button class="rf2-row" data-detail="${escapeHtml(title)}"${confirm ? ` data-confirm="${confirm}"` : ''} type="button"><span><b>${escapeHtml(title)}</b><small>${escapeHtml(detail)}</small></span>${action ? `<em>${escapeHtml(action)}</em>` : '<em>查看</em>'}</button>`; }).join('')}</div>`;
const tabs = (items, active) => `<div class="rf2-tabs">${items.map((name) => `<button data-tab="${escapeHtml(name)}" class="${name === active ? 'is-active' : ''}" type="button">${escapeHtml(name)}</button>`).join('')}</div>`;

export function createAdminFeatureState() {
  return {
    page: 'funds', detail: '', toast: '', dialog: '',
    funds: { tabs: ['统计', '司机现金', 'KHQR 到账', '商户结算', '司机提现', '工资单'], active: '统计' },
    price: { active: '拼车（体积重）' }, marketing: { active: '优惠券' }, api: { active: '接入密钥' }, settings: { active: '角色权限' },
  };
}

export const requiresConfirmation = (action) => ['confirm-payout', 'disable-api-key', 'take-cash'].includes(action);
export const hasActionAttribute = (element, name) => element.hasAttribute(name);

function finance(state) {
  const active = state.funds.active;
  const content = {
    '统计': `<div class="rf2-stats"><b>$4,862<small>本月收入（示例）</small></b><b>$1,619<small>毛利（示例）</small></b><b>2<small>待处理项</small></b></div>${rows([['收入构成', '运费、增值服务与结算手续费', '查看'], ['按币种', 'USD、KHR 与 KHQR 统一对账', '导出']])}`,
    '司机现金': rows([['Sokha', '待交回 $86.50（示例）', '点钱确认'], ['Dara', '待交回 $42.00（示例）', '点钱确认']]),
    'KHQR 到账': rows([['RF-1110-032', '已自动匹配 · $12.50（示例）', '查看'], ['RF-1110-041', '金额不符，待人工处理（示例）', '处理']]),
    '商户结算': `<p class="rf2-note">生成结算单 → 财务审批 → 转账；生成与审批不能是同一人。</p>${rows([['Heng Long 建材', '待结算 $236.00（示例）', '生成结算单'], ['Angkor 瓷砖', '待财务审批（示例）', '查看']])}`,
    '司机提现': `<p class="rf2-note">所有出款都是两步：运营先审批，财务再确认出款，两个人不能是同一个。</p>${rows([['Piseth', '待财务出款 $40.00（示例）', '确认出款'], ['Mony', '已到账 $12.00（示例）', '查看']])}`,
    '工资单': `<p class="rf2-note">扣款默认关闭；上线前需当地法务确认。</p>${rows([['11 月工资单', '审批后财务出款（示例）', '审批'], ['KPI 奖励', '规则与金额均可配置（示例）', '查看']])}`,
  }[active];
  return `${tabs(state.funds.tabs, active)}${content}`;
}

function pageContent(page, state) {
  if (page === 'funds') return finance(state);
  if (page === 'price') return `${tabs(['拼车（体积重）', '包车', '增值服务', '司机计酬', '汇率'], state.price.active)}<p class="rf2-note">价格、车型、汇率均为后台可配置的示例；体积重 = 长 × 宽 × 高 ÷ 6000，超过 3 米只能包车。</p>${rows([['拼车价格', '起步 $1.50，含 5 kg（示例）', '提交审批'], ['司机计酬', '按优惠前运费计算（示例）', '提交审批']])}`;
  if (page === 'marketing') return `${tabs(['优惠券', '核销记录', '广告位'], state.marketing.active)}<p class="rf2-note">第一批只做立减、满减；8 条核销规则包含预算上限和审批。</p>${rows([['新商户首单立减', '预算上限 $500（示例）', '审批'], ['核销记录', '付款成功才核销；取消后退回', '查看'], ['首页弹窗广告', '另一位同事审核后才能上线', '提交审核']])}`;
  if (page === 'api') return `${tabs(['接入密钥', '回调地址', '调用日志'], state.api.active)}<p class="rf2-note">演示环境只展示脱敏标识；先用沙箱测通，密钥创建时才完整显示一次。</p>${rows([['Heng Long ERP', '已启用 · key_demo_••••（示例）', '停用'], ['订单状态回调', '失败自动重试 3 次（示例）', '查看'], ['调用日志', '保留 30 天（示例）', '查看']])}`;
  return `${tabs(['角色权限', '员工', '操作日志', '偏好'], state.settings.active)}<p class="rf2-note">每人一个账号；操作日志不能删改。减少动态效果开启后仅保留淡入淡出。</p>${rows([['财务', '查看、审批与出款权限（示例）', '查看'], ['Bopha', '财务 · 已启用（示例）', '查看'], ['减少动态效果', '遵循系统偏好', '切换']])}`;
}

export function renderAdminFeaturePage(page = 'funds', state = createAdminFeatureState()) {
  const safePage = normalizeAdminFeaturePage(page);
  const title = adminFeaturePages.find((item) => item.id === safePage).title;
  const dialog = state.dialog ? `<div class="rf2-modal" role="dialog" aria-modal="true"><div><b>请确认</b><p>${escapeHtml(state.dialog)}</p><button data-close-dialog type="button">取消</button><button data-demo-confirm type="button">确认（纯前端）</button></div></div>` : '';
  return `<section class="rf2" data-page="${escapeHtml(safePage)}"><header><div><p>${demo}</p><h1>${escapeHtml(title)}</h1></div><button class="rf2-primary" data-create="${escapeHtml(safePage)}" type="button">新建（纯前端）</button></header>${pageContent(safePage, state)}<aside class="rf2-detail" ${state.detail ? '' : 'hidden'}>${state.detail ? escapeHtml(state.detail) : ''}</aside>${dialog}</section>`;
}

export function mountAdminFeaturePages(root, initialPage = 'funds') {
  const state = createAdminFeatureState(); state.page = normalizeAdminFeaturePage(initialPage);
  const render = () => { state.page = normalizeAdminFeaturePage(state.page); root.innerHTML = renderAdminFeaturePage(state.page, state); };
  root.addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.tab) { const pageState = state[state.page]; pageState.active = button.dataset.tab; if (state.page === 'funds') pageState.active = button.dataset.tab; render(); return; }
    if (button.dataset.confirm && requiresConfirmation(button.dataset.confirm)) { state.dialog = `确认${button.dataset.detail}？此示例操作不可撤回；不调用真实支付或银行接口。`; render(); return; }
    if (hasActionAttribute(button, 'data-close-dialog')) { state.dialog = ''; render(); return; }
    if (hasActionAttribute(button, 'data-demo-confirm')) { state.dialog = ''; state.detail = '已完成纯前端示例确认，未调用任何支付或银行接口。'; render(); return; }
    if (button.dataset.detail) { state.detail = `${button.dataset.detail}：${demo}`; render(); return; }
    if (button.dataset.create) { state.detail = `新建 ${adminFeaturePages.find((p) => p.id === button.dataset.create)?.title}：${demo}`; render(); }
  });
  render(); return { setPage(page) { state.page = page; render(); }, state };
}
