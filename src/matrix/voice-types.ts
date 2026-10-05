import type { AudioProbeReport } from './audio-probe';
import { AudioProbeError } from './audio-probe';

export const VOICE_LIMIT_SECONDS = 15;
export const VOICE_MAX_BYTES = 1024 * 1024;
export type VoiceDraft = { uri: string; durationMs: number; waveform: number[] };
// Called at the actual native attachment boundary, after SDK preparation.
export type VoiceBeforeUpload = (signal: AbortSignal) => Promise<void>;
export type VoiceProbeReport = AudioProbeReport & {
  playbackUri: string;
  playbackSource?: 'server' | 'tecno';
  offlineCopy?: 'saved' | 'unavailable';
};
export type PreparedVoice = {
  bytes: Uint8Array<ArrayBuffer>;
  filename: string;
  durationMs: number;
  mimetype: 'audio/mp4';
  waveform: number[];
};

export function validateVoiceDraft(draft: VoiceDraft) {
  if (!draft.uri.startsWith('file:///') || !draft.uri.endsWith('.m4a') ||
      !Number.isInteger(draft.durationMs) || draft.durationMs < 800 || draft.durationMs > (VOICE_LIMIT_SECONDS + 1) * 1000 ||
      draft.waveform.length > 120 || draft.waveform.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new AudioProbeError('Запись не подходит для теста. Запиши фразу от 1 до 15 секунд.');
  }
}

export function validateVoiceBytes(bytes: Uint8Array) {
  if (bytes.length < 32 || bytes.length > VOICE_MAX_BYTES ||
      String.fromCharCode(...bytes.subarray(4, 8)) !== 'ftyp') {
    throw new AudioProbeError('Не удалось получить короткую запись в формате M4A. Запиши фразу ещё раз.');
  }
}

// SDK sendVoiceMessage takes f32 amplitudes in [0,1], not the integer waveform
// received in message content. Values come from recorder metering, not filler.
export function voiceWaveform(metering: number[]): number[] {
  const values = metering.filter(Number.isFinite).map((db) => Math.min(1, Math.max(0, Math.pow(10, db / 20))));
  const step = Math.max(1, Math.ceil(values.length / 100));
  const result: number[] = [];
  for (let i = 0; i < values.length; i += step) result.push(Math.max(...values.slice(i, i + step)));
  return result;
}

export function isCacheVoiceUri(uri: string, cacheUri: string): boolean {
  try {
    const file = new URL(uri), cache = new URL(cacheUri);
    const path = decodeURIComponent(file.pathname), root = decodeURIComponent(cache.pathname).replace(/\/+$/, '') + '/';
    return file.protocol === 'file:' && !file.host && !file.search && !file.hash && path.startsWith(root) &&
      !path.split('/').some((part) => part === '..' || part === '.') && !path.includes('\\') && !path.includes('\0') && path.endsWith('.m4a');
  } catch { return false; }
}
