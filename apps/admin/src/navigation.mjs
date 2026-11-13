export const adminNavigation = [
  { id: 'dashboard', href: '/', label: '看板' },
  { id: 'orders', href: '/orders', label: '订单' },
  { id: 'dispatch', href: '/dispatch', label: '调度台' },
  { id: 'capacity', href: '/capacity', label: '运力' },
  { id: 'customers', href: '/customers', label: '客户与客服' },
  { id: 'merchants', href: '/merchants', label: '商户' },
  { id: 'finance', href: '/finance', label: '财务' },
  { id: 'pricing', href: '/pricing', label: '价格与规则' },
  { id: 'marketing', href: '/marketing', label: '营销' },
  { id: 'integrations', href: '/integrations', label: '开放接口' },
  { id: 'areas', href: '/delivery-areas', label: '配送区域' },
  { id: 'settings', href: '/settings', label: '系统设置' },
];

export const ownedAdminRoutes = ['/', '/dispatch', '/auto-routing', '/delivery-areas'];
