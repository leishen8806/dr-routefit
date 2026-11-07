import type { DriverLanguage } from './driver-api';
import {
  ORDER_READ_FAILED,
  TASK_ACTION_FAILED,
  TASK_CHANGED,
  TASK_NOT_FOUND,
  TASK_READ_FAILED,
} from './task-actions.mjs';

const zh = {
  appName: 'DR ROUTEFIT', title: '司机任务', caption: '仅连接本机开发服务；正式登录由 RF-PM-055 替换。',
  tokenLabel: '本机开发会话令牌', csrfLabel: '本机开发 CSRF 令牌', secretPlaceholder: '仅保存在当前进程内',
  refreshTasks: '刷新任务', connectTasks: '连接并读取任务', loadingTasks: '正在读取任务', emptyTasks: '当前没有司机任务',
  task: '任务', order: '订单', status: '状态', expires: '到期', routeVersion: '路线版本', viewDetails: '查看详情',
  backToList: '返回任务列表', assignmentDetails: '任务详情', orderDetails: '订单资料', loadingDetails: '正在读取详情',
  pickup: '取货', delivery: '送货', contact: '联系人', phone: '电话', itemCount: '件数', navigatePickup: '导航到取货点', navigateDelivery: '导航到送货点', coordinatesUnavailable: '该地点没有可用坐标',
  packageDetails: '订单件级资料', itemId: '品项 ID', packageIds: '包装 ID', noPackages: '无包装编号',
  executionContractBlocked: '当前接口未提供待签认交接的读取入口；不能安全显示交接确认或出发操作。如有差异请联系仓库。',
  accept: '接单', reject: '拒单', rejectReason: '拒单原因', rejectReasonPlaceholder: '请输入业务原因',
  confirmReject: '再次点击确认拒单', cancelReject: '取消拒单', actionWorking: '正在提交', accepted: '接单成功', rejected: '拒单成功',
  offlineEvents: '离线到达事件', deviceId: '受控设备 ID', deviceIdPlaceholder: '本机合成设备 UUID', pendingEvents: '待补传数量',
  recordArrival: '离线记录到达', syncEvents: '补传事件', syncWorking: '正在补传', arrivalQueued: '到达事件已安全保存',
  syncFinished: '补传完成', syncDelayed: '网络或服务暂不可用，事件已保留并退避重试',
  quarantinedPrefix: '有', quarantinedSuffix: '条记录未被接受，请联系调度',
  queueLoadFailed: '无法读取本地离线队列', queueWriteFailed: '无法保存离线事件', syncFailed: '离线事件补传失败',
  taskNotFound: '任务不存在或已不属于你', taskChanged: '任务已变化', taskReadFailed: '任务读取失败', orderReadFailed: '订单读取失败', taskActionFailed: '任务操作失败', navigationUnavailable: '无法打开系统地图', kmPending: '高棉语文案待负责人提供',
};

const en: typeof zh = {
  appName: 'DR ROUTEFIT', title: 'Driver tasks', caption: 'Local development service only; RF-PM-055 will replace this login.',
  tokenLabel: 'Local development session token', csrfLabel: 'Local development CSRF token', secretPlaceholder: 'Kept in process memory only',
  refreshTasks: 'Refresh tasks', connectTasks: 'Connect and load tasks', loadingTasks: 'Loading tasks', emptyTasks: 'No driver tasks',
  task: 'Task', order: 'Order', status: 'Status', expires: 'Expires', routeVersion: 'Route version', viewDetails: 'View details',
  backToList: 'Back to task list', assignmentDetails: 'Assignment details', orderDetails: 'Order details', loadingDetails: 'Loading details',
  pickup: 'Pickup', delivery: 'Delivery', contact: 'Contact', phone: 'Phone', itemCount: 'Item count', navigatePickup: 'Navigate to pickup', navigateDelivery: 'Navigate to delivery', coordinatesUnavailable: 'Coordinates are unavailable for this location',
  packageDetails: 'Order item details', itemId: 'Item ID', packageIds: 'Package IDs', noPackages: 'No package IDs',
  executionContractBlocked: 'The current API cannot list a pending transfer, so custody confirmation and departure cannot be offered safely. Contact the warehouse about any discrepancy.',
  accept: 'Accept', reject: 'Reject', rejectReason: 'Rejection reason', rejectReasonPlaceholder: 'Enter a business reason',
  confirmReject: 'Tap again to confirm rejection', cancelReject: 'Cancel rejection', actionWorking: 'Submitting', accepted: 'Assignment accepted', rejected: 'Assignment rejected',
  offlineEvents: 'Offline arrival event', deviceId: 'Controlled device ID', deviceIdPlaceholder: 'Local synthetic device UUID', pendingEvents: 'Pending events',
  recordArrival: 'Record arrival offline', syncEvents: 'Sync events', syncWorking: 'Syncing', arrivalQueued: 'Arrival event saved safely',
  syncFinished: 'Sync complete', syncDelayed: 'Network or service is temporarily unavailable; the event remains queued with backoff',
  quarantinedPrefix: '', quarantinedSuffix: 'record(s) were not accepted; contact dispatch',
  queueLoadFailed: 'Unable to load the offline queue', queueWriteFailed: 'Unable to save the offline event', syncFailed: 'Unable to sync offline events',
  taskNotFound: 'Assignment is unavailable or no longer belongs to you', taskChanged: 'Assignment has changed', taskReadFailed: 'Unable to load tasks', orderReadFailed: 'Unable to load order', taskActionFailed: 'Unable to update assignment', navigationUnavailable: 'Unable to open the system map', kmPending: 'Khmer copy is pending owner approval',
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

const errorKeys: Record<string, MessageKey> = {
  [TASK_NOT_FOUND]: 'taskNotFound',
  [TASK_CHANGED]: 'taskChanged',
  [TASK_READ_FAILED]: 'taskReadFailed',
  [ORDER_READ_FAILED]: 'orderReadFailed',
  [TASK_ACTION_FAILED]: 'taskActionFailed',
  SYNC_FAILED: 'syncFailed',
  SYNC_RESULT_INVALID: 'syncFailed',
};

export function errorText(language: DriverLanguage, code: string): string | null {
  const key = errorKeys[code];
  return key ? text(language, key) : null;
}
