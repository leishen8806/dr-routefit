import type { SiteCopy } from './types';

export const zh: SiteCopy = {
  localeName: '中文',
  meta: {
    title: 'DR RouteFit｜智慧调度与配送',
    description: '车对货，路对线，准时送到。金边及周边仓配一体配送服务。'
  },
  nav: { home: '首页', services: '服务', drivers: '司机与车队', pricing: '价格说明', track: '查单', about: '关于我们', help: '帮助中心', contact: '联系我们', menu: '打开导航', language: '语言', skip: '跳到主要内容' },
  pages: { drivers: '司机与车队', pricing: '价格说明', about: '关于我们', help: '帮助中心', contact: '联系我们', terms: '服务条款', privacy: '隐私政策' },
  hero: {
    eyebrow: '金边及周边 · 仓配一体',
    title: '车对货，路对线，准时送到。',
    body: 'RouteFit 帮商家把货从仓库送到客户手里：按货物选车，按路线派单，交接、在途、签收每一步都有记录可查。',
    primary: '咨询企业合作',
    secondary: '我是司机，想加入',
    note: 'The right vehicle. The right route. On time.'
  },
  quick: [
    { title: '我要发货', body: '商家、仓储客户的配送服务，支持企业月结（需审批）。', action: '咨询合作', href: '/contact/' },
    { title: '我是司机', body: '个人司机和合作车队都可以申请加入，按完成的配送结算收入。', action: '了解加入方式', href: '/drivers/' },
    { title: '查询订单', body: '输入单号查看配送进度。', action: '即将开放', href: '#', badge: '即将开放' }
  ],
  values: {
    eyebrow: '我们怎么做',
    title: '把三件事做对：车、路线、时间',
    items: [
      { icon: '01', title: '车对货', body: '按货物重量、体积和类型选车，装不下、不适合的车不会被派出。' },
      { icon: '02', title: '路对线', body: '按服务区域和送达时间安排线路，调度人员确认后才派单。' },
      { icon: '03', title: '准时送到', body: '派单前核对能否按约定时间送到，做不到会提前告诉你。' },
      { icon: '04', title: '每一步有记录', body: '仓库交接、司机点收、签收都留凭证，出了问题能查清是哪一环。' }
    ]
  },
  process: {
    eyebrow: '下单流程',
    title: '四步，从下单到签收',
    items: [
      { title: '提交订单', body: '填写取送地址、货物件数和期望送达时间。' },
      { title: '确认报价并付款', body: '费用逐项列明，确认后付款；获批月结的企业客户按月结算。' },
      { title: '安排车辆和司机', body: '调度按货物和路线安排车辆，司机在仓库逐件点收后出发。' },
      { title: '签收与回单', body: '收货人签收并拍照留证，你可以查到每件货的结果。' }
    ]
  },
  coverage: {
    eyebrow: '服务区域',
    title: '金边及周边',
    body: '目前从金边的发货仓出发，服务金边市区及周边。具体能否送达，以下单时的地址校验为准；新开通的区域会在这里更新。',
    action: '问一下我的地址能不能送'
  },
  audiences: [
    { eyebrow: '加入 RouteFit', title: '加入 RouteFit 司机与车队', body: '按完成的配送单计收入，按周期结算。个人司机和合作车队都可以申请，审核通过后开始接单。', action: '了解加入方式', href: '/drivers/' },
    { eyebrow: '关于我们', title: '商务与投资合作', body: '我们在柬埔寨建设仓配调度平台。欢迎仓储、商家、车队和投资方与我们联系。', action: '留下合作意向', href: '/contact/' }
  ],
  faq: {
    eyebrow: '帮助中心',
    title: '常见问题',
    items: [
      { question: '怎么下单？', answer: '目前通过客户经理下单；Telegram 自助下单开放后，会在这里提供入口。' },
      { question: '什么时候付款？', answer: '确认报价后先付款，再安排车辆；获批月结的企业客户按月结算。' },
      { question: '下单后能改地址吗？', answer: '可以申请改址，系统会重新报价，你确认后生效。' },
      { question: '货物丢了或坏了怎么办？', answer: '配送服务包含基础货损保障，也可以另外加购商业保险。具体以服务条款为准。' }
    ]
  },
  footer: {
    summary: '车对货，路对线，准时送到。',
    product: '服务', company: '公司', support: '支持', legal: '法律',
    terms: '服务条款', privacy: '隐私政策', rights: '保留所有权利。'
  },
  placeholder: { eyebrow: '页面建设中', title: '即将上线', body: '这个页面属于后续官网批次，当前还没有对外开放。', back: '返回首页' }
};
