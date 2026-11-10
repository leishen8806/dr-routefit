const stepByStage = {
  to_warehouse: 'warehouse',
  loading: 'load_scan',
  delivering: 'delivery',
  delivered: 'delivery_proof',
};

export function fulfillmentStep(stage) {
  return stepByStage[stage] ?? 'warehouse';
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
