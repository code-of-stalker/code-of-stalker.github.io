import { BACKUP_MAX_BYTES } from './backup-model';
export function downloadBackup(bytes: Uint8Array<ArrayBuffer>, createdAt: number) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url; link.download = `watcher-${new Date(createdAt).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.watcherbackup`;
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
}
export function chooseBackup(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.watcherbackup,application/octet-stream'; input.style.display = 'none';
    let settled = false, timer: ReturnType<typeof setTimeout> | undefined;
    const done = (file: File | null) => { if (settled) return; settled = true; clearTimeout(timer); window.removeEventListener('focus', focus); input.remove(); resolve(file); };
    const focus = () => { timer = setTimeout(() => { if (!input.files?.length) done(null); }, 500); };
    input.onchange = () => done(input.files?.[0] ?? null); input.oncancel = () => done(null);
    window.addEventListener('focus', focus); document.body.appendChild(input); input.click();
  });
}
export async function readBackupFile(file: File) {
  if (!file.size || file.size > BACKUP_MAX_BYTES) throw new Error('Выбери копию не больше 512 МБ.');
  return new Uint8Array(await file.arrayBuffer());
}
