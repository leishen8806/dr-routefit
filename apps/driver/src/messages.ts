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
  deliveryScanCode: '送达扫码', deliveryScanPlaceholder: '输入或扫描包裹编号', verifyDeliveryLocation: '确认送达位置', deliveryLocationVerified: '送达位置已核对', deliveryCheckMissing: '请完成扫码、位置核对并上传证据',
  appName: 'DR ROUTEFIT', title: '司机任务', caption: '仅连接本机开发服务；正式登录由 RF-PM-055 替换。',
  tokenLabel: '本机开发会话令牌', csrfLabel: '本机开发 CSRF 令牌', secretPlaceholder: '仅保存在当前进程内',
  refreshTasks: '刷新任务', connectTasks: '连接并读取任务', loadingTasks: '正在读取任务', emptyTasks: '当前没有司机任务',
  task: '任务', order: '订单', status: '状态', expires: '到期', routeVersion: '路线版本', viewDetails: '查看详情',
  assignmentRemaining: '派单剩余', assignmentExpired: '派单已过期，请等待调度重新派单',
  backToList: '返回任务列表', assignmentDetails: '任务详情', orderDetails: '订单资料', loadingDetails: '正在读取详情',
  pickup: '取货', delivery: '送货', contact: '联系人', phone: '电话', itemCount: '件数', navigatePickup: '导航到取货点', navigateDelivery: '导航到送货点', coordinatesUnavailable: '该地点没有可用坐标',
  packageDetails: '订单件级资料', itemId: '品项 ID', packageIds: '包装 ID', noPackages: '无包装编号',
  custodyTransfers: '待签认交接', custodyEmpty: '没有待签认交接', custodyInitiated: '发起时间', confirmCustody: '确认接收这些包装', custodyConfirmed: '交接签认成功',
  departureReadiness: '出发就绪', departureReady: '已满足出发条件', departureBlocked: '尚未满足出发条件', depart: '确认出发', departed: '出发登记成功',
  executionReason: '履约说明', executionReasonPlaceholder: '填写本次签认或出发的业务说明', evidenceFileId: '合成证据文件 ID', evidenceFileIdPlaceholder: '本机合成证据 UUID', evidenceFileIdHelp: '本机开发占位；正式拍照与证据上传由 RF-PM-059 接入。',
  evidencePhoto: '履约证据', takePhoto: '拍照', retakePhoto: '重新拍照', uploadPhoto: '上传照片', photoReady: '照片已保存到 App 私有目录', photoStoredPrivately: '照片不会写入系统相册', photoUploaded: '证据上传完成，本地照片已删除', photoRequired: '请先拍照并上传证据', cameraDenied: '相机权限被拒绝；可到系统设置中开启', openSettings: '打开系统设置', evidenceReady: '证据已就绪', photoFailed: '拍照或压缩失败', evidenceUploadFailed: '证据上传失败，可重试同一张照片',
  needsNetwork: '需要联网', executionMissing: '请先填写说明并上传证据',
  assignmentNotDepartable: '当前任务状态不允许出发', orderNotReadyToDepart: '订单尚未准备好出发', loadReviewNotReleased: '装载复核尚未放行', custodyNotReady: '仍有包装未完成交接签认',
  accept: '接单', reject: '拒单', rejectReason: '拒单原因', rejectReasonPlaceholder: '请输入业务原因',
  confirmReject: '再次点击确认拒单', cancelReject: '取消拒单', actionWorking: '正在提交', accepted: '接单成功', rejected: '拒单成功',
  offlineEvents: '离线到达事件', deviceId: '受控设备 ID', deviceIdPlaceholder: '本机合成设备 UUID', deviceIdLifecycle: '开发占位：RF-PM-055 批次 5 完成设备注册后删除手填入口。', pendingEvents: '待补传数量',
  recordArrival: '离线记录到达', syncEvents: '补传事件', syncWorking: '正在补传', arrivalQueued: '到达事件已安全保存',
  recordSyntheticArrival: '写合成到达事件（开发）',
  deliveryRecord: '按件交付', recipientAuthorizationReady: '收货授权有效', recipientAuthorizationMissing: '没有可用的收货授权', package: '包装', markDelivered: '已交付', markRemaining: '待退回', partialReason: '部分交付原因', partialReasonPlaceholder: '说明剩余件为何未交付', deliverySummary: '汇总', deliveredCount: '件已交付', remainingCount: '件待退回', submitDelivery: '提交交付', confirmDelivery: '再次确认提交', deliveryMissing: '请逐件选择结果、上传证据并确认收货授权；部分交付还需填写原因', deliveryComplete: '已送达', deliveryPartial: '部分送达，剩余待退回', deliveryFailed: '交付记录提交失败',
  syncFinished: '补传完成', syncDelayed: '网络或服务暂不可用，事件已保留并退避重试', syncSequenceInvalid: '补传序号与服务器不一致，请联系调度。',
  quarantinedPrefix: '有', quarantinedSuffix: '条记录未被接受，请联系调度',
  queueLoadFailed: '无法读取本地离线队列', queueWriteFailed: '无法保存离线事件', syncFailed: '离线事件补传失败',
  networkTimeout: '网络超时，请重试',
  taskNotFound: '任务不存在或已不属于你', taskChanged: '任务已变化', taskReadFailed: '任务读取失败', orderReadFailed: '订单读取失败', taskActionFailed: '任务操作失败', custodyReadFailed: '交接资料读取失败', departureReadFailed: '出发条件读取失败', navigationUnavailable: '无法打开系统地图', kmPending: '高棉语文案待负责人提供',
};

const en: typeof zh = {
  deliveryScanCode: 'Delivery scan', deliveryScanPlaceholder: 'Enter or scan a package ID', verifyDeliveryLocation: 'Confirm delivery location', deliveryLocationVerified: 'Delivery location confirmed', deliveryCheckMissing: 'Complete the scan, location check, and evidence upload first',
  appName: 'DR ROUTEFIT', title: 'Driver tasks', caption: 'Local development service only; RF-PM-055 will replace this login.',
  tokenLabel: 'Local development session token', csrfLabel: 'Local development CSRF token', secretPlaceholder: 'Kept in process memory only',
  refreshTasks: 'Refresh tasks', connectTasks: 'Connect and load tasks', loadingTasks: 'Loading tasks', emptyTasks: 'No driver tasks',
  task: 'Task', order: 'Order', status: 'Status', expires: 'Expires', routeVersion: 'Route version', viewDetails: 'View details',
  assignmentRemaining: 'Assignment time remaining', assignmentExpired: 'Assignment expired; wait for dispatch to reassign it',
  backToList: 'Back to task list', assignmentDetails: 'Assignment details', orderDetails: 'Order details', loadingDetails: 'Loading details',
  pickup: 'Pickup', delivery: 'Delivery', contact: 'Contact', phone: 'Phone', itemCount: 'Item count', navigatePickup: 'Navigate to pickup', navigateDelivery: 'Navigate to delivery', coordinatesUnavailable: 'Coordinates are unavailable for this location',
  packageDetails: 'Order item details', itemId: 'Item ID', packageIds: 'Package IDs', noPackages: 'No package IDs',
  custodyTransfers: 'Pending custody transfers', custodyEmpty: 'No pending custody transfer', custodyInitiated: 'Initiated', confirmCustody: 'Confirm receipt of these packages', custodyConfirmed: 'Custody confirmed',
  departureReadiness: 'Departure readiness', departureReady: 'Ready to depart', departureBlocked: 'Departure requirements are not complete', depart: 'Confirm departure', departed: 'Departure recorded',
  executionReason: 'Execution note', executionReasonPlaceholder: 'Enter the business reason for confirmation or departure', evidenceFileId: 'Synthetic evidence file ID', evidenceFileIdPlaceholder: 'Local synthetic evidence UUID', evidenceFileIdHelp: 'Local development placeholder; RF-PM-059 will add photo and evidence upload.',
  evidencePhoto: 'Execution evidence', takePhoto: 'Take photo', retakePhoto: 'Retake photo', uploadPhoto: 'Upload photo', photoReady: 'Photo saved in the app private directory', photoStoredPrivately: 'The photo is not saved to the system gallery', photoUploaded: 'Evidence uploaded and the local photo was deleted', photoRequired: 'Take and upload a photo first', cameraDenied: 'Camera permission was denied; enable it in system settings', openSettings: 'Open system settings', evidenceReady: 'Evidence is ready', photoFailed: 'Unable to capture or compress the photo', evidenceUploadFailed: 'Evidence upload failed; retry the same photo',
  needsNetwork: 'Network connection required', executionMissing: 'Enter a note and upload evidence first',
  assignmentNotDepartable: 'The assignment cannot depart in its current state', orderNotReadyToDepart: 'The order is not ready to depart', loadReviewNotReleased: 'The load review has not been released', custodyNotReady: 'Some packages have not completed custody confirmation',
  accept: 'Accept', reject: 'Reject', rejectReason: 'Rejection reason', rejectReasonPlaceholder: 'Enter a business reason',
  confirmReject: 'Tap again to confirm rejection', cancelReject: 'Cancel rejection', actionWorking: 'Submitting', accepted: 'Assignment accepted', rejected: 'Assignment rejected',
  offlineEvents: 'Offline arrival event', deviceId: 'Controlled device ID', deviceIdPlaceholder: 'Local synthetic device UUID', deviceIdLifecycle: 'Development placeholder: remove manual entry after RF-PM-055 batch 5 adds device registration.', pendingEvents: 'Pending events',
  recordArrival: 'Record arrival offline', syncEvents: 'Sync events', syncWorking: 'Syncing', arrivalQueued: 'Arrival event saved safely',
  recordSyntheticArrival: 'Write synthetic arrival event (development)',
  deliveryRecord: 'Package delivery', recipientAuthorizationReady: 'Recipient authorization is valid', recipientAuthorizationMissing: 'No valid recipient authorization', package: 'Package', markDelivered: 'Delivered', markRemaining: 'Return pending', partialReason: 'Partial-delivery reason', partialReasonPlaceholder: 'Explain why remaining packages were not delivered', deliverySummary: 'Summary', deliveredCount: 'delivered', remainingCount: 'return pending', submitDelivery: 'Submit delivery', confirmDelivery: 'Confirm submission', deliveryMissing: 'Select every package, upload evidence, and confirm recipient authorization; partial delivery also needs a reason', deliveryComplete: 'Delivered', deliveryPartial: 'Partially delivered; remaining packages await return', deliveryFailed: 'Unable to submit delivery record',
  syncFinished: 'Sync complete', syncDelayed: 'Network or service is temporarily unavailable; the event remains queued with backoff', syncSequenceInvalid: 'The sync sequence does not match the server. Contact dispatch.',
  quarantinedPrefix: '', quarantinedSuffix: 'record(s) were not accepted; contact dispatch',
  queueLoadFailed: 'Unable to load the offline queue', queueWriteFailed: 'Unable to save the offline event', syncFailed: 'Unable to sync offline events',
  networkTimeout: 'Network timed out; try again',
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
  REQUEST_TIMEOUT: 'networkTimeout',
  EVIDENCE_UPLOAD_CREATE_FAILED: 'evidenceUploadFailed',
  EVIDENCE_UPLOAD_FAILED: 'evidenceUploadFailed',
  EVIDENCE_UPLOAD_COMPLETE_FAILED: 'evidenceUploadFailed',
  RECIPIENT_AUTHORIZATION_READ_FAILED: 'deliveryFailed',
  DELIVERY_RECORD_FAILED: 'deliveryFailed',
};

export function errorText(language: DriverLanguage, code: string): string | null {
  const key = errorKeys[code];
  return key ? text(language, key) : null;
}
