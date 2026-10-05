import type { MatrixDiagnosticResult } from './types';

export async function checkMatrixSdk(): Promise<MatrixDiagnosticResult> {
  const startedAt = Date.now();
  let stage = 'Загрузка TurboModule и инициализация Rust/UniFFI';

  try {
    // Import only on button press: getEnforcing/FFI initialization can throw.
    // uniffiInitAsync() is a no-op on native and would not prove an SDK call.
    const sdk = await import('@unomed/react-native-matrix-sdk');

    stage = 'Нативный вызов sdkGitSha()';
    const sdkGitSha = sdk.sdkGitSha();
    if (typeof sdkGitSha !== 'string' || sdkGitSha.trim().length === 0) {
      throw new Error('Rust SDK вернул пустой SHA.');
    }

    stage = 'Нативный вызов isRoomAliasFormatValid()';
    const validAlias = '#matrix-probe:example.org';
    const invalidAlias = 'not-a-room-alias';
    const validAliasResult = sdk.isRoomAliasFormatValid(validAlias);
    const invalidAliasResult = sdk.isRoomAliasFormatValid(invalidAlias);
    if (validAliasResult !== true || invalidAliasResult !== false) {
      throw new Error(
        `Неожиданный результат Rust: valid=${String(validAliasResult)}, invalid=${String(invalidAliasResult)}.`,
      );
    }

    return {
      ok: true,
      sdkGitSha,
      validAlias,
      validAliasResult,
      invalidAlias,
      invalidAliasResult,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    const details = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    const missingModule = /ReactNativeMatrixSdk|TurboModuleRegistry|could not be found/i.test(details);
    const message = missingModule
      ? 'Matrix-модуль не удалось загрузить. Установите свежий development APK с Matrix SDK и откройте проект в нём. Expo Go для этой проверки не подходит.'
      : 'Нативная проверка не завершилась. Сохраните текст ошибки; проверьте логи сборки и устройства на ошибки JSI, UniFFI и загрузки .so.';
    return { ok: false, stage, message, details };
  }
}
