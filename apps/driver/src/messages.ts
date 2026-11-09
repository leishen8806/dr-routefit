import { languageLabels, message, type MessageCatalog } from '@routefit/shared';
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
  custodyTransfers: '待签认交接', custodyEmpty: '没有待签认交接', custodyInitiated: '发起时间', confirmCustody: '确认接收这些包装', custodyConfirmed: '交接签认成功',
  departureReadiness: '出发就绪', departureReady: '已满足出发条件', departureBlocked: '尚未满足出发条件', depart: '确认出发', departed: '出发登记成功',
  executionReason: '履约说明', executionReasonPlaceholder: '填写本次签认或出发的业务说明', evidenceFileId: '合成证据文件 ID', evidenceFileIdPlaceholder: '本机合成证据 UUID', evidenceFileIdHelp: '本机开发占位；正式拍照与证据上传由 RF-PM-059 接入。',
  assignmentNotDepartable: '当前任务状态不允许出发', orderNotReadyToDepart: '订单尚未准备好出发', loadReviewNotReleased: '装载复核尚未放行', custodyNotReady: '仍有包装未完成交接签认',
  accept: '接单', reject: '拒单', rejectReason: '拒单原因', rejectReasonPlaceholder: '请输入业务原因',
  confirmReject: '再次点击确认拒单', cancelReject: '取消拒单', actionWorking: '正在提交', accepted: '接单成功', rejected: '拒单成功',
  offlineEvents: '离线到达事件', deviceId: '受控设备 ID', deviceIdPlaceholder: '本机合成设备 UUID', deviceIdLifecycle: '开发占位：RF-PM-055 批次 5 完成设备注册后删除手填入口。', pendingEvents: '待补传数量',
  recordArrival: '离线记录到达', syncEvents: '补传事件', syncWorking: '正在补传', arrivalQueued: '到达事件已安全保存',
  syncFinished: '补传完成', syncDelayed: '网络或服务暂不可用，事件已保留并退避重试', syncSequenceInvalid: '补传序号与服务器不一致，请联系调度。',
  quarantinedPrefix: '有', quarantinedSuffix: '条记录未被接受，请联系调度',
  queueLoadFailed: '无法读取本地离线队列', queueWriteFailed: '无法保存离线事件', syncFailed: '离线事件补传失败',
  taskNotFound: '任务不存在或已不属于你', taskChanged: '任务已变化', taskReadFailed: '任务读取失败', orderReadFailed: '订单读取失败', taskActionFailed: '任务操作失败', custodyReadFailed: '交接资料读取失败', departureReadFailed: '出发条件读取失败', navigationUnavailable: '无法打开系统地图', kmPending: '高棉语文案待负责人提供',
};

const en: typeof zh = {
  appName: 'DR ROUTEFIT', title: 'Driver tasks', caption: 'Local development service only; RF-PM-055 will replace this login.',
  tokenLabel: 'Local development session token', csrfLabel: 'Local development CSRF token', secretPlaceholder: 'Kept in process memory only',
  refreshTasks: 'Refresh tasks', connectTasks: 'Connect and load tasks', loadingTasks: 'Loading tasks', emptyTasks: 'No driver tasks',
  task: 'Task', order: 'Order', status: 'Status', expires: 'Expires', routeVersion: 'Route version', viewDetails: 'View details',
  backToList: 'Back to task list', assignmentDetails: 'Assignment details', orderDetails: 'Order details', loadingDetails: 'Loading details',
  pickup: 'Pickup', delivery: 'Delivery', contact: 'Contact', phone: 'Phone', itemCount: 'Item count', navigatePickup: 'Navigate to pickup', navigateDelivery: 'Navigate to delivery', coordinatesUnavailable: 'Coordinates are unavailable for this location',
  packageDetails: 'Order item details', itemId: 'Item ID', packageIds: 'Package IDs', noPackages: 'No package IDs',
  custodyTransfers: 'Pending custody transfers', custodyEmpty: 'No pending custody transfer', custodyInitiated: 'Initiated', confirmCustody: 'Confirm receipt of these packages', custodyConfirmed: 'Custody confirmed',
  departureReadiness: 'Departure readiness', departureReady: 'Ready to depart', departureBlocked: 'Departure requirements are not complete', depart: 'Confirm departure', departed: 'Departure recorded',
  executionReason: 'Execution note', executionReasonPlaceholder: 'Enter the business reason for confirmation or departure', evidenceFileId: 'Synthetic evidence file ID', evidenceFileIdPlaceholder: 'Local synthetic evidence UUID', evidenceFileIdHelp: 'Local development placeholder; RF-PM-059 will add photo and evidence upload.',
  assignmentNotDepartable: 'The assignment cannot depart in its current state', orderNotReadyToDepart: 'The order is not ready to depart', loadReviewNotReleased: 'The load review has not been released', custodyNotReady: 'Some packages have not completed custody confirmation',
  accept: 'Accept', reject: 'Reject', rejectReason: 'Rejection reason', rejectReasonPlaceholder: 'Enter a business reason',
  confirmReject: 'Tap again to confirm rejection', cancelReject: 'Cancel rejection', actionWorking: 'Submitting', accepted: 'Assignment accepted', rejected: 'Assignment rejected',
  offlineEvents: 'Offline arrival event', deviceId: 'Controlled device ID', deviceIdPlaceholder: 'Local synthetic device UUID', deviceIdLifecycle: 'Development placeholder: remove manual entry after RF-PM-055 batch 5 adds device registration.', pendingEvents: 'Pending events',
  recordArrival: 'Record arrival offline', syncEvents: 'Sync events', syncWorking: 'Syncing', arrivalQueued: 'Arrival event saved safely',
  syncFinished: 'Sync complete', syncDelayed: 'Network or service is temporarily unavailable; the event remains queued with backoff', syncSequenceInvalid: 'The sync sequence does not match the server. Contact dispatch.',
  quarantinedPrefix: '', quarantinedSuffix: 'record(s) were not accepted; contact dispatch',
  queueLoadFailed: 'Unable to load the offline queue', queueWriteFailed: 'Unable to save the offline event', syncFailed: 'Unable to sync offline events',
  taskNotFound: 'Assignment is unavailable or no longer belongs to you', taskChanged: 'Assignment has changed', taskReadFailed: 'Unable to load tasks', orderReadFailed: 'Unable to load order', taskActionFailed: 'Unable to update assignment', custodyReadFailed: 'Unable to load custody transfers', departureReadFailed: 'Unable to load departure readiness', navigationUnavailable: 'Unable to open the system map', kmPending: 'Khmer copy is pending owner approval',
};

const messages = { 'zh-Hans': zh, en, km: en } satisfies MessageCatalog<DriverLanguage, typeof zh>;
export const languageOptions: { code: DriverLanguage; label: string }[] = [
  { code: 'zh-Hans', label: languageLabels['zh-Hans'] },
  { code: 'en', label: languageLabels.en },
  { code: 'km', label: languageLabels.km },
];
export type MessageKey = keyof typeof zh;

export function text(language: DriverLanguage, key: MessageKey): string {
  return message(messages, language, key);
}

const errorKeys: Record<string, MessageKey> = {
  [TASK_NOT_FOUND]: 'taskNotFound',
  [TASK_CHANGED]: 'taskChanged',
  [TASK_READ_FAILED]: 'taskReadFailed',
  [ORDER_READ_FAILED]: 'orderReadFailed',
  [TASK_ACTION_FAILED]: 'taskActionFailed',
  CUSTODY_READ_FAILED: 'custodyReadFailed',
  DEPARTURE_READ_FAILED: 'departureReadFailed',
  ASSIGNMENT_NOT_DEPARTABLE: 'assignmentNotDepartable',
  ORDER_NOT_READY_TO_DEPART: 'orderNotReadyToDepart',
  LOAD_REVIEW_NOT_RELEASED: 'loadReviewNotReleased',
  CUSTODY_NOT_READY: 'custodyNotReady',
  SYNC_FAILED: 'syncFailed',
  SYNC_RESULT_INVALID: 'syncFailed',
};

export function errorText(language: DriverLanguage, code: string): string | null {
  const key = errorKeys[code];
  return key ? text(language, key) : null;
}
