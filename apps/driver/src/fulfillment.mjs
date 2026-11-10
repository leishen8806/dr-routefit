const stepByStage = {
  to_warehouse: 'warehouse',
  loading: 'load_scan',
  delivering: 'delivery',
  delivered: 'delivery_proof',
};

const stepLabels = {
  'zh-Hans': {
    warehouse: '前往仓库',
    load_scan: '扫码装车',
    delivery: '配送中',
    delivery_proof: '扫码送达',
  },
  en: {
    warehouse: 'Heading to warehouse',
    load_scan: 'Load scan',
    delivery: 'Delivering',
    delivery_proof: 'Delivery scan',
  },
};

export function fulfillmentStep(stage) {
  return stepByStage[stage] ?? 'warehouse';
}

export function fulfillmentStatusPresentation(stage, language) {
  const step = fulfillmentStep(stage);
  const labels = stepLabels[language] ?? stepLabels.en;
  return { step, label: labels[step] };
}

export function fulfillmentSections(stage) {
  switch (stage) {
    case 'loading':
      return ['warehouse', 'load_scan', 'offline'];
    case 'delivering':
      return [
        'delivery',
        'delivery_scan',
        'location_check',
        'collection',
        'problem_report',
        'offline',
      ];
    default:
      return ['warehouse', 'offline'];
  }
}

export function deliveryProofState(scanCode, locationVerified) {
  const missing = [];
  if (!scanCode.trim()) missing.push('scan');
  if (!locationVerified) missing.push('location');
  return { canSubmit: missing.length === 0, missing };
}

export function deliverySubmissionState({ scanCode, locationVerified, evidenceReady }) {
  const proof = deliveryProofState(scanCode, locationVerified);
  const missing = evidenceReady ? proof.missing : [...proof.missing, 'evidence'];
  return { canSubmit: missing.length === 0, missing };
}

export function collectionState(method) {
  if (method !== 'cash' && method !== 'khqr') throw new Error('Collection method is not supported');
  return { method, live: false, label: '示例' };
}

export function collectionConfirmationState(method, confirmed) {
  return {
    ...collectionState(method),
    confirmationRequired: true,
    canRecord: Boolean(confirmed),
  };
}

export function collectionDialogResult(action) {
  if (action === 'confirm') return { closeDialog: true, record: true };
  if (action === 'cancel' || action === 'escape') return { closeDialog: true, record: false };
  throw new Error('Collection dialog action is not supported');
}

export function offlineNotice(offline) {
  return offline
    ? { visible: true, message: '当前离线，操作将等待网络恢复后同步。' }
    : { visible: false, message: null };
}

export function undeliveredReasonState(reason) {
  const selected = reason.trim();
  return { canSubmit: Boolean(selected), reason: selected || null };
}

export function problemReportState(summary) {
  const trimmed = summary.trim();
  return { canSubmit: Boolean(trimmed), summary: trimmed || null };
}
