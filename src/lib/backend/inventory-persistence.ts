export async function loadNormalizedInventorySnapshot() {
  return null;
}

export function isNormalizedInventoryAvailable() {
  return false;
}

export function getInventoryPersistenceMode():
  | "module_records_only"
  | "module_records_with_normalized_dual_write" {
  return "module_records_only";
}

async function noop(..._args: unknown[]) {}

export const upsertInventoryItem = noop;
export const upsertInventorySettings = noop;
export const upsertInventoryLocationPolicy = noop;
export const replaceInventoryLots = noop;
export const appendInventoryLedgerEntries = noop;
export const upsertInventoryDocument = noop;
export const syncInventoryItem = noop;
export const syncInventoryItemDeletion = noop;
export const deactivateInventoryItem = noop;
export const syncInventorySettings = noop;
export const syncInventoryLocationPolicy = noop;
export const syncInventoryLots = noop;
export const syncInventoryLedgerAppend = noop;
export const upsertGoatRegistration = noop;
export const upsertGoatRegistrations = noop;
export const deactivateGoatRegistrations = noop;
export const syncGoatRegistration = noop;
export const syncGoatRegistrations = noop;
export const syncGoatRegistrationRemovals = noop;
export const syncInventoryDocument = noop;
