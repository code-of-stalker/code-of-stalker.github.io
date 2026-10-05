import type { MatrixTestSession, ServerReport } from './network-types';

function unsupported(): never {
  throw new Error('Откройте этот экран в установленном development APK на телефоне. Сетевая проверка использует нативный Matrix SDK.');
}

export async function checkMatrixServer(_url: string, _signal: AbortSignal): Promise<ServerReport> {
  return unsupported();
}

export async function loginMatrix(
  _url: string, _username: string, _password: string, _signal: AbortSignal, _forRecovery = false,
): Promise<MatrixTestSession> {
  return unsupported();
}

export async function hasSavedMatrixSession(): Promise<boolean> { return false; }
export async function savedMatrixSessionHasDiary(): Promise<boolean> { return false; }

export async function restoreMatrixSession(_signal: AbortSignal, _forRecovery = false): Promise<MatrixTestSession | null> {
  return null;
}

export async function forgetMatrixSession(): Promise<void> { return unsupported(); }
