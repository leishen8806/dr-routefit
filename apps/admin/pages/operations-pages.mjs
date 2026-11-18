import {
  ORDER_COLUMNS,
  ORDER_DEMO_ROWS,
  ORDER_DETAIL_RECIPIENTS,
  ORDER_DETAIL_TIMELINES,
  ORDER_STATUS_FILTERS,
} from './orders-demo.mjs';

const pages = {
  orders: {
    id: 'orders',
    title: '订单',
    description: '订单状态与处理入口（全部为演示示例）',
    columns: ORDER_COLUMNS,
    rows: ORDER_DEMO_ROWS.map((row) => row.slice(0, -1)),
    action: '查看订单详情',
  },
  capacity: {
    id: 'capacity',
    title: '运力',
    description: '司机、注册审批、车辆与 KPI 的统一入口',
    columns: ['对象', '类型', '状态', '提醒', 'KPI'],
    rows: [
      ['Sokha', '自营司机', '在线', '证件正常', '示例：准时率 96%'],
      ['VAN-018', '车辆', '可调度', '年检 12-20 到期', '示例：本月 42 单'],
      ['Dara', '注册审批', '待审核', '资料待补充', '—'],
    ],
    action: '打开运力详情',
  },
  support: {
    id: 'support',
    title: '客服与异常',
    description: '按 SLA 处理客户工单、配送异常和升级记录',
    columns: ['工单', '关联订单', '类型', '负责人', 'SLA'],
    rows: [
      ['CS-082', 'RF-240811-018', '配送延迟', '待分配', '示例：30 分钟'],
      ['CS-083', 'RF-240811-017', '签收争议', 'Sreyneang', '示例：今天 17:00'],
    ],
    action: '查看工单详情',
  },
  merchants: {
    id: 'merchants',
    title: '商户',
    description: '查看商户资料、合同状态和服务订单',
    columns: ['商户', '合同状态', '服务订单', '负责人', '最近更新'],
    rows: [
      ['金边家居', '有效', '示例：18 单', 'Merchant Team', '今天 10:20'],
      ['森速商贸', '待续约', '示例：7 单', 'Merchant Team', '昨天 16:40'],
    ],
    action: '查看商户详情',
  },
  users: {
    id: 'users',
    title: '用户',
    description: '查看用户状态、订单概览与客服关联记录',
    columns: ['用户', '状态', '订单', '最近活动', '客服标签'],
    rows: [
      ['张女士', '正常', '示例：3 单', '今天 09:40', '收件人'],
      ['陈先生', '已冻结', '示例：0 单', '昨天 18:10', '需复核'],
    ],
    action: '查看用户详情',
  },
};

const routePageIds = {
  '/orders': 'orders',
  '/capacity': 'capacity',
  '/customers': 'support',
  '/merchants': 'merchants',
  '/users': 'users',
};

export function getOperationsRoutePageId(pathname) {
  return typeof pathname === 'string' && Object.hasOwn(routePageIds, pathname)
    ? routePageIds[pathname]
    : null;
}

function getOwnPage(source, id) {
  return source && typeof source === 'object' && Object.hasOwn(source, id)
    ? source[id]
    : undefined;
}

function isValidOperationsPage(id, page) {
  return typeof id === 'string'
    && Object.hasOwn(pages, id)
    && page
    && typeof page === 'object'
    && !Array.isArray(page)
    && page.id === id
    && typeof page.title === 'string'
    && typeof page.description === 'string'
    && typeof page.action === 'string'
    && Array.isArray(page.columns)
    && page.columns.length > 0
    && page.columns.every((column) => typeof column === 'string')
    && Array.isArray(page.rows);
}

export function getOperationsPage(id, configuredPages) {
  const configuredPage = getOwnPage(configuredPages, id);
  if (configuredPage !== undefined) {
    return isValidOperationsPage(id, configuredPage) ? configuredPage : null;
  }
  const demoPage = getOwnPage(pages, id);
  return isValidOperationsPage(id, demoPage) ? demoPage : null;
}

function isValidOperationsRow(page, row) {
  return Array.isArray(page?.columns)
    && Array.isArray(row)
    && row.length >= 5
    && row.length <= page.columns.length;
}

export function getOperationsRows(id, configuredPages) {
  const page = getOperationsPage(id, configuredPages);
  if (!page) return [];
  return page.rows.flatMap((row, index) => (
    isValidOperationsRow(page, row) ? [{ index, row }] : []
  ));
}

export function getOperationsRecord(id, index, configuredPages) {
  const page = getOperationsPage(id, configuredPages);
  const row = page?.rows[index];
  if (!page || !isValidOperationsRow(page, row)) return null;
  return {
    pageId: page.id,
    title: page.title,
    fields: page.columns.slice(0, row.length).map((column, fieldIndex) => [column, row[fieldIndex]]),
  };
}

export function getOperationsDrawerAccessibility(id, configuredPages) {
  const page = getOperationsPage(id, configuredPages);
  if (!page) return null;
  return {
    accessibilityLabel: `${page.title}详情`,
    isModal: true,
  };
}

export function getOperationsDrawerAction(pageId, dataset, configuredPages) {
  if (dataset?.action === 'close-detail') return { type: 'close' };
  if (dataset?.action === 'open-detail') {
    const index = Number(dataset.recordIndex);
    if (!Number.isInteger(index) || index < 0 || !getOperationsRecord(pageId, index, configuredPages)) return null;
    return { type: 'open', pageId, index };
  }
  return null;
}

export function reduceOperationsDrawer(state, action, configuredPages) {
  if (action?.type === 'close') return null;
  if (action?.type !== 'open') return state ?? null;
  const index = Number(action.index);
  if (!Number.isInteger(index) || index < 0) return state ?? null;
  if (!getOperationsRecord(action.pageId, index, configuredPages)) return state ?? null;
  return { pageId: action.pageId, index };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function notFound() {
  return '<section aria-labelledby="operations-page-title"><h1 id="operations-page-title">页面暂不可用</h1><p>请选择已授权的管理后台业务页面。</p></section>';
}

function recordUnavailable() {
  return '<section role="status"><p>记录暂不可用，请返回列表后重新选择。</p></section>';
}

export function renderOperationsPage(id, configuredPages) {
  const page = getOperationsPage(id, configuredPages);
  if (!page) return notFound();

  if (id === 'orders' && configuredPages === undefined) {
    const headings = `${page.columns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join('')}<th scope="col">操作</th>`;
    const rows = ORDER_DEMO_ROWS.map((row, index) => `<tr><td>${row.slice(0, -1).map((value) => `<span>${escapeHtml(value)}</span>`).join('</td><td>')}</td><td><button type="button" data-mode="frontend-only" data-action="open-detail" data-record-index="${index}">查看订单详情</button></td></tr>`).join('');
    const filters = ORDER_STATUS_FILTERS.map(([value, label]) => `<button type="button" role="tab" aria-selected="${value === 'all'}" data-order-filter="${value}">${label}</button>`).join('');
    return `<section aria-labelledby="operations-page-title" data-page="orders">
  <header><h1 id="operations-page-title">订单</h1><p>${escapeHtml(page.description)}</p></header>
  <p role="note">以下为演示数据（示例）；所有订单号、金额与时间均为示例，当前操作为纯前端。</p>
  <div role="tablist" aria-label="订单状态筛选">${filters}</div>
  <table><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody></table>
</section>`;
  }

  const headings = `${page.columns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join('')}<th scope="col">操作</th>`;
  const rows = (Array.isArray(page.rows) ? page.rows : []).flatMap((row, index) => (
    isValidOperationsRow(page, row)
      ? [`<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}<td><button type="button" data-mode="frontend-only" data-action="open-detail" data-record-index="${index}">${escapeHtml(page.action)}</button></td></tr>`]
      : []
  )).join('');
  return `<section aria-labelledby="operations-page-title" data-page="${escapeHtml(page.id ?? id)}">
  <header><h1 id="operations-page-title">${escapeHtml(page.title)}</h1><p>${escapeHtml(page.description)}</p></header>
  <p role="note">以下为演示数据（示例）；当前操作为纯前端，接入接口后替换。</p>
  <table><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody></table>
</section>`;
}

export function renderOperationsDetail(id, index, configuredPages) {
  const page = getOperationsPage(id, configuredPages);
  const record = getOperationsRecord(id, index, configuredPages);
  if (!page || !record) return recordUnavailable();
  const accessibility = getOperationsDrawerAccessibility(id, configuredPages);

  if (id === 'orders' && configuredPages === undefined) {
    const [trackingNumber, merchant, , status, driver, fee, cod, , statusClass] = ORDER_DEMO_ROWS[index];
    const fields = [
      ['收件人', ORDER_DETAIL_RECIPIENTS[index]],
      ['司机', driver],
      ['运费', fee],
      ['代收货款', cod === '—' ? '无（示例）' : cod],
    ];
    const keyValues = fields.map(([label, value]) => `<div data-order-detail-kv><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
    const records = ORDER_DETAIL_TIMELINES[index].map(([message, time]) => `<li><span class="timeline-dot"></span><div>${escapeHtml(message)}<time>${escapeHtml(time)}</time></div></li>`).join('');
    const dispatchAction = statusClass === 'plain'
      ? '<button type="button" data-mode="frontend-only" data-action="go-dispatch">去调度台派车（示例）</button>'
      : '';

    return `<aside role="dialog" aria-modal="${accessibility.isModal}" aria-label="${escapeHtml(accessibility.accessibilityLabel)}" aria-describedby="operations-detail-note">
  <header><h2 class="num">${escapeHtml(trackingNumber)}</h2><button type="button" data-mode="frontend-only" data-action="close-detail" aria-label="关闭">关闭</button></header>
  <div class="order-detail-meta"><span class="chip status-${escapeHtml(statusClass)}">${escapeHtml(status)}</span><span class="meta">${escapeHtml(merchant)}</span></div>
  <dl class="order-detail-kv">${keyValues}</dl>
  <section aria-label="记录"><h3>记录</h3><ol class="timeline">${records}</ol></section>
  ${dispatchAction}
  <p id="operations-detail-note" role="note">演示数据（示例）；当前操作为纯前端。</p>
</aside>`;
  }

  const fields = record.fields.map(([column, value]) => `<div><dt>${escapeHtml(column)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
  return `<aside role="dialog" aria-modal="${accessibility.isModal}" aria-label="${escapeHtml(accessibility.accessibilityLabel)}" aria-describedby="operations-detail-note">
  <header><h2>${escapeHtml(page.title)}详情</h2><button type="button" data-mode="frontend-only" data-action="close-detail" aria-label="关闭详情">关闭</button></header>
  <dl>${fields}</dl>
  <p id="operations-detail-note" role="note">演示数据（示例）；当前操作为纯前端。</p>
  <button type="button" data-mode="frontend-only">${escapeHtml(page.action)}</button>
</aside>`;
}

export function renderOperationsScreen(id, drawerState, configuredPages) {
  const drawer = drawerState?.pageId === id
    ? renderOperationsDetail(drawerState.pageId, drawerState.index, configuredPages)
    : '';
  return `${renderOperationsPage(id, configuredPages)}${drawer}`;
}
