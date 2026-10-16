export type MicrophoneInput = { deviceId: string; label: string };
type MediaPort = Pick<MediaDevices, 'getUserMedia' | 'enumerateDevices'>;
const rawAudio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
const pseudoIds = new Set(['default', 'communications']);

export async function listMicrophoneInputs(media: MediaPort): Promise<MicrophoneInput[]> {
  if (!media.enumerateDevices) return [];
  const devices = await media.enumerateDevices();
  return devices.filter(device => device.kind === 'audioinput' && !!device.deviceId && !pseudoIds.has(device.deviceId))
    .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Микрофон ${index + 1}` }));
}
function release(stream: MediaStream) { stream.getTracks().forEach(track => track.stop()); }
function named(problem: unknown) { return problem && typeof problem === 'object' && 'name' in problem ? String(problem.name) : ''; }
export function microphoneError(problem: unknown) {
  if (problem instanceof Error && problem.name === 'MicrophoneInputError') return problem.message;
  switch (named(problem)) {
    case 'NotAllowedError': case 'SecurityError': return 'Разреши доступ к микрофону в браузере.';
    case 'NotFoundError': case 'OverconstrainedError': return 'Выбранный микрофон недоступен. Подключи его или выбери другой в настройках.';
    case 'NotReadableError': case 'AbortError': return 'Микрофон не передаёт звук браузеру. Закрой другое приложение записи и переподключи микрофон.';
    default: return 'Не удалось включить микрофон. Проверь подключение и выбранный источник в настройках.';
  }
}
function inputError(message: string) { const error = new Error(message); error.name = 'MicrophoneInputError'; return error; }

/** Automatic means the browser/OS route. Enumerating or switching sources on
 * the capture path delays the first sample and can tear down a working input.
 * Manual USB/BT choices retain their exact ID and unprocessed audio request. */
export async function openMicrophone(media: MediaPort, selected = '', active: () => boolean = () => true) {
  const check = () => { if (!active()) throw inputError('Запись отменена.'); };
  check();
  const selection = { deviceId: { exact: selected } };
  let opened: MediaStream;
  try { opened = await media.getUserMedia({ audio: selected ? { ...rawAudio, ...selection } : true, video: false }); }
  catch (problem) {
    check();
    if (!selected || !['OverconstrainedError', 'NotReadableError', 'AbortError'].includes(named(problem))) throw problem;
    opened = await media.getUserMedia({ audio: selection, video: false });
  }
  try {
    check();
    const track = opened.getAudioTracks()[0];
    if (!track || track.readyState === 'ended') throw inputError('Браузер не передал звуковой поток микрофона.');
    const actualId = track.getSettings().deviceId;
    if (selected && actualId && actualId !== selected && !pseudoIds.has(selected)) {
      throw inputError('Браузер не переключился на выбранный микрофон. Выбери доступный источник в настройках.');
    }
    return { stream: opened, label: track.label || 'Микрофон браузера', deviceId: actualId || selected || '' };
  } catch (problem) { release(opened); throw problem; }
}

export function createMicrophoneSignalMonitor() {
  let samples = 0, hasSignal = false;
  return {
    sample(rms: number) { if (!Number.isFinite(rms)) return; samples++; if (rms > .00001) hasSignal = true; },
    warning(elapsedMs: number) { return samples >= 5 && !hasSignal && elapsedMs >= 3500
      ? 'От микрофона пока нет звука. Проверь подключение и источник в настройках.' : ''; },
    silent() { return samples >= 5 && !hasSignal; },
  };
}
