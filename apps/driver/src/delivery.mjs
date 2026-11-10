const allowedMimes = new Set(['image/jpeg', 'image/png']);
const maxEvidenceBytes = 10 * 1024 * 1024;

export function validateEvidencePhoto({ mimeType, sizeBytes, sha256 }) {
  if (!allowedMimes.has(mimeType)) throw new Error('Evidence photo type is not allowed');
  if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > maxEvidenceBytes) throw new Error('Evidence photo size is not allowed');
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error('Evidence photo SHA-256 is invalid');
  return true;
}

export function packageSelection(packageIds, selected = {}) {
  const ids = [...new Set(packageIds)];
  const unresolved = ids.filter((id) => selected[id] !== 'delivered' && selected[id] !== 'remaining');
  return {
    complete: unresolved.length === 0,
    deliveredPackageIds: ids.filter((id) => selected[id] === 'delivered'),
    remainingPackageIds: ids.filter((id) => selected[id] === 'remaining'),
    unresolved,
  };
}

export function deliveryConfirmationStep(armed) {
  return armed ? 'submit' : 'confirm';
}

export async function uploadTicketForPhoto(existingTicket, createTicket) {
  return existingTicket ?? createTicket();
}
