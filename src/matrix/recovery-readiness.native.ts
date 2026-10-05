import type { ClientLike } from '@unomed/react-native-matrix-sdk';
import { AudioProbeError } from './audio-probe';
import { recoveryReadiness } from './recovery-readiness-model';

function destroy(value: object | undefined) {
  if (value && 'uniffiDestroy' in value && typeof value.uniffiDestroy === 'function') value.uniffiDestroy();
}

export async function inspectRecoveryReadiness(client: ClientLike, signal: AbortSignal,
  onStage: (stage: string) => void) {
  if (signal.aborted) throw new AudioProbeError('Проверка восстановления остановлена.');
  let encryption: ReturnType<ClientLike['encryption']> | undefined;
  try {
    encryption = client.encryption();
    onStage('Проверяем состояние ключей на Tecno без изменений');
    await encryption.waitForE2eeInitializationTasks({ signal });
    if (signal.aborted) throw new AudioProbeError('Проверка восстановления остановлена.');
    const backupState = encryption.backupState();
    const recoveryState = encryption.recoveryState();
    onStage('Спрашиваем сервер, есть ли резервная копия ключей');
    const serverBackupExists = await encryption.backupExistsOnServer({ signal });
    if (signal.aborted) throw new AudioProbeError('Проверка восстановления остановлена.');
    return recoveryReadiness(serverBackupExists, backupState, recoveryState);
  } catch (error) {
    if (error instanceof AudioProbeError) throw error;
    throw new AudioProbeError('Не удалось прочитать состояние восстановления. Вход и ключи Tecno не изменены.');
  } finally { destroy(encryption); }
}

export async function enableDiaryRecovery(client: ClientLike, code: string, signal: AbortSignal,
  onStage: (stage: string) => void) {
  // The generated code is recorded by the user before this call begins. Never
  // log it or rely on the SDK-returned key surviving a cancelled native call.
  if (!/^[a-f0-9]{48}$/.test(code)) throw new AudioProbeError('Создай новый код восстановления и сохрани его вне Tecno.');
  if (signal.aborted) throw new AudioProbeError('Включение восстановления остановлено до начала.');
  let encryption: ReturnType<ClientLike['encryption']> | undefined;
  try {
    encryption = client.encryption();
    onStage('Повторно проверяем существующую копию ключей');
    await encryption.waitForE2eeInitializationTasks({ signal });
    if (signal.aborted) throw new AudioProbeError('Включение восстановления остановлено до начала.');
    const backupExists = await encryption.backupExistsOnServer({ signal });
    if (!backupExists || encryption.backupState() !== 4 || encryption.recoveryState() !== 2) {
      throw new AudioProbeError('Состояние ключей изменилось. Сначала повтори проверку готовности. Существующая копия не менялась.');
    }
    onStage('Включаем восстановление для уже подключённой копии');
    await encryption.enableRecovery(true, code, { onUpdate(progress) {
      // The Done event contains the SDK recovery key. Never pass it to UI
      // status text, reports, logs, or errors.
      if (progress.tag === 'BackingUp') onStage('Дожидаемся загрузки ключей дневника');
      else if (progress.tag === 'CreatingRecoveryKey') onStage('SDK сохраняет секреты восстановления');
      else if (progress.tag === 'RoomKeyUploadError') onStage('Загрузка ключей задержалась; SDK повторяет попытку');
    } }, { signal });
    onStage('Проверяем, что копия ключей и восстановление включены');
    const result = recoveryReadiness(await encryption.backupExistsOnServer({ signal }),
      encryption.backupState(), encryption.recoveryState());
    if (!result.serverBackupExists || result.backupState !== 'ready' || result.recoveryState !== 'ready') {
      throw new AudioProbeError('SDK завершил настройку, но итоговый статус не подтвердился. Код сохрани; сначала повтори проверку статуса.');
    }
    return result;
  } catch (error) {
    if (error instanceof AudioProbeError) throw error;
    throw new AudioProbeError('SDK не завершил настройку восстановления. Код сохрани и сначала проверь статус; повторно включать вслепую нельзя.');
  } finally { destroy(encryption); }
}
