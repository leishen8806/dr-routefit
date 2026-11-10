const stepByStage = {
  to_warehouse: 'warehouse',
  loading: 'load_scan',
  delivering: 'delivery',
  delivered: 'delivery_proof',
};

export function fulfillmentStep(stage) {
  return stepByStage[stage] ?? 'warehouse';
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

export function collectionState(method) {
  if (method !== 'cash' && method !== 'khqr') throw new Error('Collection method is not supported');
  return { method, live: false, label: '示例' };
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
