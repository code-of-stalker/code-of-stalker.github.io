import { storageProtection, type StorageProtection } from './storage-protection';

/** Request persistence at launch, with one gesture retry for browsers that need
 * user activation. A denial never blocks startup or touches diary/audio data. */
export function enableAutomaticStorageProtection(activation: Pick<Document, 'addEventListener' | 'removeEventListener'> = document) {
  let alive = true, busy = false, retried = false, denied = false;
  let state: StorageProtection['state'] | undefined;
  const remove = () => { activation.removeEventListener('pointerup', retry); activation.removeEventListener('keydown', retry); };
  async function request() {
    if (!alive || busy) return;
    busy = true;
    try {
      const result = await storageProtection(true);
      if (!alive) return;
      state = result.state;
      window.dispatchEvent(new CustomEvent('watcher-storage-protection', { detail: result }));
      if (state !== 'standard') remove();
    } catch { state = 'unsupported'; remove(); } finally { busy = false; }
  }
  function retry() {
    if (state !== 'standard' || denied || busy || retried) return;
    retried = true; remove(); void request();
  }
  activation.addEventListener('pointerup', retry);
  activation.addEventListener('keydown', retry);
  // Firefox can expose an explicit denial; respect it instead of prompting again.
  try { void navigator.permissions?.query({ name: 'persistent-storage' as PermissionName }).then(value => { denied = value.state === 'denied'; }).catch(() => {}); } catch { /* Optional permission inspection. */ }
  void request();
  return () => { alive = false; remove(); };
}
