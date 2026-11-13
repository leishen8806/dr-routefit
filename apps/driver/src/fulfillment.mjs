const stepByStage = {
  none: 'warehouse',
  pickup_pending: 'load_scan',
  picked_up: 'delivery',
  in_transit: 'delivery',
  delivery_recorded: 'delivery_proof',
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
    case 'pickup_pending':
      return ['warehouse', 'load_scan', 'offline'];
    case 'picked_up':
    case 'in_transit':
      return [
        'delivery',
        'delivery_scan',
        'location_check',
        'collection',
        'problem_report',
        'offline',
      ];
    case 'delivery_recorded':
      return ['delivery_proof', 'offline'];
    default:
      return ['warehouse', 'offline'];
  }
}

export function fulfillmentSurfacePlan(stage, language) {
  const sections = fulfillmentSections(stage);
  return {
    status: fulfillmentStatusPresentation(stage, language),
    panels: [
      ...(sections.includes('warehouse') ? ['warehouse'] : []),
      ...(sections.includes('load_scan') ? ['load_scan'] : []),
      ...(sections.includes('delivery') ? ['delivery'] : []),
      ...(sections.includes('delivery_proof') ? ['delivery_proof'] : []),
      ...(sections.includes('collection') ? ['collection'] : []),
    ],
  };
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

export function collectionConfirmationState(method, confirmed, alreadyRecorded = false) {
  return {
    ...collectionState(method),
    confirmationRequired: true,
    canRecord: Boolean(confirmed) && !alreadyRecorded,
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
