import type { DriverLanguage } from './driver-api';

const zh = {
  appName: 'DR ROUTEFIT', title: '司机任务', caption: '仅连接本机开发服务；正式登录由 RF-PM-055 替换。',
  tokenLabel: '本机开发会话令牌', csrfLabel: '本机开发 CSRF 令牌', secretPlaceholder: '仅保存在当前进程内',
  refreshTasks: '刷新任务', connectTasks: '连接并读取任务', loadingTasks: '正在读取任务', emptyTasks: '当前没有司机任务',
  task: '任务', order: '订单', status: '状态', expires: '到期', routeVersion: '路线版本', viewDetails: '查看详情',
  backToList: '返回任务列表', assignmentDetails: '任务详情', orderDetails: '订单资料', loadingDetails: '正在读取详情',
  pickup: '取货', delivery: '送货', contact: '联系人', phone: '电话', itemCount: '件数', navigate: '导航到送货点',
  accept: '接单', reject: '拒单', rejectReason: '拒单原因', rejectReasonPlaceholder: '请输入业务原因',
  confirmReject: '再次点击确认拒单', cancelReject: '取消拒单', actionWorking: '正在提交', accepted: '接单成功', rejected: '拒单成功',
  taskReadFailed: '任务读取失败', navigationUnavailable: '无法打开系统地图', kmPending: '高棉语文案待负责人提供',
};

const en: typeof zh = {
  appName: 'DR ROUTEFIT', title: 'Driver tasks', caption: 'Local development service only; RF-PM-055 will replace this login.',
  tokenLabel: 'Local development session token', csrfLabel: 'Local development CSRF token', secretPlaceholder: 'Kept in process memory only',
  refreshTasks: 'Refresh tasks', connectTasks: 'Connect and load tasks', loadingTasks: 'Loading tasks', emptyTasks: 'No driver tasks',
  task: 'Task', order: 'Order', status: 'Status', expires: 'Expires', routeVersion: 'Route version', viewDetails: 'View details',
  backToList: 'Back to task list', assignmentDetails: 'Assignment details', orderDetails: 'Order details', loadingDetails: 'Loading details',
  pickup: 'Pickup', delivery: 'Delivery', contact: 'Contact', phone: 'Phone', itemCount: 'Item count', navigate: 'Navigate to delivery',
  accept: 'Accept', reject: 'Reject', rejectReason: 'Rejection reason', rejectReasonPlaceholder: 'Enter a business reason',
  confirmReject: 'Tap again to confirm rejection', cancelReject: 'Cancel rejection', actionWorking: 'Submitting', accepted: 'Assignment accepted', rejected: 'Assignment rejected',
  taskReadFailed: 'Unable to load tasks', navigationUnavailable: 'Unable to open the system map', kmPending: 'Khmer copy is pending owner approval',
};

const messages = { 'zh-Hans': zh, en, km: en } satisfies Record<DriverLanguage, typeof zh>;
export const languageOptions: { code: DriverLanguage; label: string }[] = [
  { code: 'zh-Hans', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'km', label: 'ខ្មែរ' },
];
export type MessageKey = keyof typeof zh;

export function text(language: DriverLanguage, key: MessageKey): string {
  return messages[language][key];
}
