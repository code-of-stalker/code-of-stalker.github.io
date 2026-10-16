export type StorageProtection = { state: 'protected' | 'standard' | 'unsupported'; usage?: number; quota?: number };
export async function storageProtection(request = false): Promise<StorageProtection> {
  const storage = globalThis.navigator?.storage;
  if (!storage?.persisted) return { state: 'unsupported' };
  let protectedStorage: boolean;
  try { protectedStorage = await storage.persisted(); } catch { return { state: 'unsupported' }; }
  if (request && !protectedStorage && storage.persist) {
    try { protectedStorage = await storage.persist(); } catch { /* Denial does not prevent local recording. */ }
  }
  let estimate: StorageEstimate = {};
  try { estimate = await storage.estimate(); } catch { /* Capacity reporting is optional. */ }
  return { state: protectedStorage ? 'protected' : 'standard', usage: estimate.usage, quota: estimate.quota };
}
