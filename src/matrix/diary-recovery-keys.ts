import type { ClientLike } from '@unomed/react-native-matrix-sdk';
import { AudioProbeError } from './audio-probe';

export async function restoreDiaryKeys(client: ClientLike, code: string, signal: AbortSignal,
  onStage: (stage: string) => void) {
  const normalized = code.replace(/[\s-]/g, '').toLowerCase();
  if (!/^[a-f0-9]{48}$/.test(normalized)) throw new AudioProbeError('Введи полный код восстановления, сохранённый на Tecno.');
  let encryption: ReturnType<ClientLike['encryption']> | undefined;
  try {
    encryption = client.encryption();
    onStage('Проверяем серверную копию ключей');
    if (!await encryption.backupExistsOnServer({ signal })) throw new AudioProbeError('Серверная копия ключей не найдена. Старую установку не удаляй.');
    onStage('Нативный SDK открывает секреты кодом восстановления');
    if (encryption.recoveryState() !== 1) await encryption.recover(normalized, { signal });
    await encryption.waitForE2eeInitializationTasks({ signal });
    if (encryption.recoveryState() !== 1) throw new AudioProbeError('SDK не подтвердил восстановление секретов. Старую установку не удаляй.');
  } catch (error) {
    if (error instanceof AudioProbeError) throw error;
    throw new AudioProbeError('SDK не смог открыть восстановление. Проверь код и связь; старую установку не удаляй.');
  } finally {
    if (encryption && 'uniffiDestroy' in encryption && typeof encryption.uniffiDestroy === 'function') encryption.uniffiDestroy();
  }
}
