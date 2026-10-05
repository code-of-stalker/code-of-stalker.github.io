import { AudioProbeError } from './audio-probe';
import { validateServerUrl } from './network-types';

export class VoiceConnectionError extends AudioProbeError {}
export const VOICE_CONNECTION_TIMEOUT_MS = 8000;
const responseLimit = 16 * 1024;
const unavailable = 'Не удалось связаться с Matrix-сервером. Черновик сохранён на Tecno. Включи интернет и нажми отправку ещё раз.';
const cancelled = 'Проверка связи остановлена. Черновик сохранён на Tecno. Отправку можно начать снова.';
type ConnectionFetch = (url: string, options: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'headers' | 'text'>>;

// Read-only gate before the persistent sending marker and before handing any
// audio to the SDK. An offline failure here cannot enqueue a Matrix message.
export async function checkVoiceConnection(server: string, signal: AbortSignal, request: ConnectionFetch = fetch): Promise<void> {
  if (signal.aborted) throw new VoiceConnectionError(cancelled);
  let url: string;
  try { url = `${validateServerUrl(server)}/_matrix/client/versions`; }
  catch { throw new VoiceConnectionError('Не удалось проверить адрес Matrix-сервера. Черновик не отправлен. Открой экран заново.'); }
  const controller = new AbortController();
  let rejectStop: (error: VoiceConnectionError) => void = () => {};
  const stopped = new Promise<never>((_, reject) => { rejectStop = reject; });
  let stopError: VoiceConnectionError | null = null;
  const stop = (error: VoiceConnectionError) => {
    if (stopError) return;
    stopError = error; rejectStop(error); controller.abort();
  };
  const cancel = () => stop(new VoiceConnectionError(cancelled));
  signal.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => {
    stop(new VoiceConnectionError('Matrix-сервер не ответил вовремя. Черновик сохранён на Tecno. Проверь интернет и попробуй отправить ещё раз.'));
  }, VOICE_CONNECTION_TIMEOUT_MS);
  const active = () => { if (stopError) throw stopError; if (signal.aborted) throw new VoiceConnectionError(cancelled); };
  try {
    if (signal.aborted) cancel();
    const work = (async () => {
      active();
      const response = await request(url, { method: 'GET', signal: controller.signal,
        // Expo 57's native fetch forwards headers but not RequestInit.cache.
        // Require validation even if this public endpoint was cached earlier.
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' },
        credentials: 'omit', cache: 'no-store' });
      active();
      if (!response.ok || response.status !== 200) throw new VoiceConnectionError(response.status === 429
        ? 'Matrix-сервер просит подождать. Черновик сохранён на Tecno. Попробуй отправить позже.' : unavailable);
      const declaredLength = response.headers.get('content-length');
      if (declaredLength && Number(declaredLength) > responseLimit) throw new VoiceConnectionError(unavailable);
      const text = await response.text();
      active();
      if (text.length > responseLimit || new TextEncoder().encode(text).length > responseLimit) throw new VoiceConnectionError(unavailable);
      const value: unknown = JSON.parse(text);
      const versions = value && typeof value === 'object' && 'versions' in value ? value.versions : null;
      if (!Array.isArray(versions) || !versions.length || versions.length > 100 ||
          versions.some(item => typeof item !== 'string' || item.length > 32) ||
          !versions.some(item => /^(v\d+\.\d+|r\d+\.\d+\.\d+)$/.test(item))) {
        throw new VoiceConnectionError('Сервер не подтвердил работу Matrix. Черновик сохранён на Tecno. Попробуй отправить позже.');
      }
    })();
    // Also bound waiting when a platform ignores fetch cancellation. Promise.race
    // observes late rejections; an abandoned GET cannot reach the sending code.
    await Promise.race([work, stopped]);
    active();
  } catch (error) { throw error instanceof VoiceConnectionError ? error : new VoiceConnectionError(unavailable); }
  finally { clearTimeout(timeout); signal.removeEventListener('abort', cancel); controller.abort(); }
}
