import type { MatrixDiagnosticResult } from './types';

// Metro selects diagnostics.native.ts for Android/iOS. Web never imports the SDK.
export async function checkMatrixSdk(): Promise<MatrixDiagnosticResult> {
  return {
    ok: false,
    stage: 'Проверка платформы',
    message: 'Нативный Matrix SDK проверяется в Android development APK на телефоне.',
    details: 'Веб-проверка нативного SDK не поддерживается.',
  };
}
