import { AudioProbeError } from './audio-probe';

export const MATRIX_READ_TIMEOUT_MS = 15_000;
type ReadRequest = (url: string, options: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

// Only authenticated GETs. If fetch or body parsing ignores AbortSignal, the
// caller still stops promptly. Late responses cannot resume any SDK operation.
export async function readMatrixJson(url: string, accessToken: string, signal: AbortSignal, request: ReadRequest = fetch): Promise<unknown> {
  const controller = new AbortController();
  let failure: Error | undefined;
  let rejectStopped: (error: Error) => void = () => {};
  const stopped = new Promise<never>((_, reject) => { rejectStopped = reject; });
  const stop = (error: Error) => {
    if (failure) return;
    failure = error;
    rejectStopped(error);
    controller.abort();
  };
  const cancel = () => stop(new Error('Aborted'));
  signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => stop(new AudioProbeError('Matrix-сервер не ответил вовремя. Проверь интернет и повтори действие.')), MATRIX_READ_TIMEOUT_MS);
  const active = () => { if (failure) throw failure; if (signal.aborted) throw new Error('Aborted'); };
  try {
    if (signal.aborted) cancel();
    const work = (async () => {
      active();
      const response = await request(url, { method: 'GET', signal: controller.signal,
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' }, cache: 'no-store' });
      active();
      if (!response.ok) throw new AudioProbeError(`Сервер не подтвердил данные проверки обмена (HTTP ${response.status}). Проверка не завершена.`);
      const value: unknown = await response.json();
      active();
      return value;
    })();
    const value = await Promise.race([work, stopped]);
    active();
    return value;
  } catch (error) {
    if (failure) throw failure;
    if (error instanceof AudioProbeError) throw error;
    throw new AudioProbeError('Не удалось получить ответ Matrix-сервера. Проверь интернет и повтори действие.');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
    controller.abort();
  }
}
