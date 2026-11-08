import type { SiteCopy } from './types';

export const zh: SiteCopy = {
  localeName: '中文',
  meta: {
    title: 'DR RouteFit｜智慧调度与配送',
    description: '让车辆、路线和交付记录更清楚的配送协作平台。'
  },
  nav: { home: '首页', drivers: '司机与车队', pricing: '价格说明', about: '关于我们', help: '帮助中心', contact: '联系我们', menu: '打开导航', language: '语言', skip: '跳到主要内容' },
  pages: { drivers: '司机与车队', pricing: '价格说明', about: '关于我们', help: '帮助中心', contact: '联系我们', terms: '服务条款', privacy: '隐私政策' },
  hero: {
    eyebrow: '更清楚的配送协作',
    title: '让合适的车，走合适的路，准时送到。',
    body: 'DR RouteFit 帮助企业、调度和司机在同一条可追溯的流程里协作，从需求确认到交付记录，每一步都更清楚。',
    primary: '了解服务流程',
    secondary: '联系我们',
    note: 'The right vehicle. The right route. On time'
  },
  quick: [
    { title: '我要配送', body: '了解从需求确认到交付记录的完整流程。', action: '查看服务流程', href: '#process' },
    { title: '查询订单', body: '订单自助查询将在后续批次开放。', action: '即将开放', href: '#', badge: '即将开放' },
    { title: '司机与车队', body: '了解司机与车队加入方式及合作边界。', action: '了解合作方式', href: '/drivers/' }
  ],
  values: {
    eyebrow: '为什么选择 RouteFit',
    title: '配送不只是把货送到',
    items: [
      { icon: '01', title: '车对货', body: '让车型与货物需求清楚匹配，减少信息不完整带来的反复确认。' },
      { icon: '02', title: '路对线', body: '把服务区域、取送点和路线条件放在同一条业务主线上。' },
      { icon: '03', title: '准时送到', body: '围绕客户期望和履约节点协作，让每个人知道下一步。' },
      { icon: '04', title: '每一步有记录', body: '关键确认、状态变化和交付证据都有清楚记录。' }
    ]
  },
  process: {
    eyebrow: '服务流程',
    title: '四步看懂一笔配送',
    items: [
      { title: '提交需求', body: '提供取送地点、货物信息和期望时间。' },
      { title: '确认与报价', body: '核对服务条件，再提供清楚的报价依据。' },
      { title: '安排执行', body: '由调度协调车辆、司机与履约节点。' },
      { title: '完成交付', body: '记录交接与完成状态，保留可追溯证据。' }
    ]
  },
  coverage: {
    eyebrow: '服务区域',
    title: '先确认区域，再安排配送',
    body: '服务区域会按运营能力逐步开放。具体是否可承运，以正式确认结果为准。',
    action: '查看服务说明'
  },
  audiences: [
    { eyebrow: '加入 RouteFit', title: '司机与车队合作', body: '用清楚的任务、路线和交接记录，减少来回沟通。', action: '了解司机合作', href: '/drivers/' },
    { eyebrow: '企业合作', title: '让配送流程更可控', body: '把需求、报价和履约证据连接成一条清楚的业务主线。', action: '联系商务合作', href: '/contact/' }
  ],
  faq: {
    eyebrow: '常见问题',
    title: '开始之前，你可能想知道',
    items: [
      { question: 'RouteFit 提供什么服务？', answer: 'RouteFit 聚焦配送需求确认、报价协作、调度与履约记录。具体服务范围以正式确认结果为准。' },
      { question: '现在可以在线下单吗？', answer: '客户自助入口仍在后续批次中。本阶段请通过正式联系渠道提交需求。' },
      { question: '如何确认我的地址是否在服务区域？', answer: '提交需求后，运营人员会按已发布的服务区域进行核对。' },
      { question: '价格如何确定？', answer: '价格取决于已生效的费率策略和订单条件；官网不会发布未经批准的价格。' }
    ]
  },
  footer: {
    summary: '让车辆、路线和交付记录更清楚。',
    product: '服务', company: '公司', support: '支持', legal: '法律',
    terms: '服务条款', privacy: '隐私政策', rights: '保留所有权利。'
  },
  placeholder: { eyebrow: '页面建设中', title: '即将上线', body: '这个页面属于后续官网批次，当前还没有对外开放。', back: '返回首页' }
};
