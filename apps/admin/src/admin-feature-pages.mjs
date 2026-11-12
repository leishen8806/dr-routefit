const demoNotice = '演示数据；当前操作仅为纯前端展示，不调用任何真实服务。';

export const adminFeaturePages = [
  {
    route: 'finance',
    title: '财务',
    description: '查看财务演示数据与需要人工复核的流程。',
    notice: demoNotice,
    demoOnly: true,
    tabs: [
      { label: '统计', rows: [{ title: '收入构成', detail: '运费、增值服务与结算手续费（演示）' }, { title: '待处理项', detail: '等待人工复核（演示）' }] },
      { label: '司机现金', rows: [{ title: '司机现金交回', detail: '现金交接记录（演示）', action: '点钞确认', requiresConfirmation: true }] },
      { label: 'KHQR 到账', rows: [{ title: 'KHQR 到账记录', detail: '仅展示匹配结果（演示）', action: '查看' }] },
      { label: '商户结算', rows: [{ title: '商户结算单', detail: '生成与审批分离（演示）', action: '查看' }] },
      { label: '司机提现', rows: [{ title: '提现申请', detail: '运营审批后由财务复核（演示）', action: '确认出款', requiresConfirmation: true }] },
      { label: '工资单', rows: [{ title: '工资单', detail: '规则与金额均为示例（演示）', action: '查看' }] },
    ],
  },
  {
    route: 'pricing',
    title: '价格与规则',
    description: '价格、车型和计酬规则的后台可配置示例。',
    notice: demoNotice,
    demoOnly: true,
    tabs: [{ label: '拼车', rows: [{ title: '拼车价格', detail: '示例价格规则，待后台配置', action: '提交审批' }] }, { label: '包车', rows: [{ title: '包车规则', detail: '示例车型与车厢规则，待后台配置', action: '查看' }] }],
  },
  {
    route: 'marketing',
    title: '营销',
    description: '营销活动与核销流程的示例配置。',
    notice: demoNotice,
    demoOnly: true,
    tabs: [{ label: '优惠券', rows: [{ title: '新商户首单立减', detail: '预算与审批均为示例', action: '查看' }] }, { label: '核销记录', rows: [{ title: '核销记录', detail: '支付成功后才核销（演示）', action: '查看' }] }],
  },
  {
    route: 'integrations',
    title: '开放接口',
    description: '外部系统接入状态的脱敏演示。',
    notice: demoNotice,
    demoOnly: true,
    tabs: [{ label: '接入状态', rows: [{ title: 'ERP 接入', detail: '已启用（演示）', action: '查看' }] }, { label: '调用日志', rows: [{ title: '调用日志', detail: '仅展示演示记录', action: '查看' }] }],
  },
  {
    route: 'settings',
    title: '系统设置',
    description: '角色、员工和偏好设置的演示数据。',
    notice: demoNotice,
    demoOnly: true,
    tabs: [{ label: '角色权限', rows: [{ title: '财务角色', detail: '查看、审批与出款权限（演示）', action: '查看' }] }, { label: '员工', rows: [{ title: '员工账号', detail: '账号状态（演示）', action: '查看' }] }],
  },
];

export function getAdminFeaturePage(route) {
  return adminFeaturePages.find((page) => page.route === route) ?? null;
}
