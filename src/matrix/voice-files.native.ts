import { Directory, File, Paths } from 'expo-file-system';
import { AudioProbeError } from './audio-probe';
import { isCacheVoiceUri, validateVoiceBytes, validateVoiceDraft, VOICE_MAX_BYTES } from './voice-types';
import type { PreparedVoice, VoiceDraft } from './voice-types';

export function discardVoiceFile(uri: string | undefined) {
  if (!uri || !isCacheVoiceUri(uri, Paths.cache.uri)) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* Cache cleanup is best effort; never affect a saved Matrix session. */ }
}

export async function prepareVoice(draft: VoiceDraft, signal: AbortSignal): Promise<PreparedVoice> {
  validateVoiceDraft(draft);
  if (!isCacheVoiceUri(draft.uri, Paths.cache.uri)) throw new AudioProbeError('Запись должна находиться в кэше этого приложения.');
  if (signal.aborted) throw new AudioProbeError('Отправка записи отменена.');
  const file = new File(draft.uri);
  if (!file.exists || file.size < 32 || file.size > VOICE_MAX_BYTES) throw new AudioProbeError('Запись отсутствует или слишком велика. Запиши короткую фразу ещё раз.');
  const bytes = await file.bytes();
  validateVoiceBytes(bytes);
  const crypto = await import('expo-crypto');
  const nonce = Array.from(await crypto.getRandomBytesAsync(16), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (signal.aborted) throw new AudioProbeError('Отправка записи отменена.');
  return { bytes, filename: `matrix-voice-${nonce}.m4a`, durationMs: draft.durationMs, mimetype: 'audio/mp4', waveform: [...draft.waveform] };
}

export function retainVerifiedVoice(bytes: Uint8Array, filename: string): string {
  if (!/^matrix-voice-[a-f0-9]{32}\.m4a$/.test(filename)) throw new AudioProbeError('Не удалось сохранить проверенную запись.');
  validateVoiceBytes(bytes);
  const directory = new Directory(Paths.cache, 'matrix-voice-verified');
  directory.create({ intermediates: true, idempotent: true });
  const file = new File(directory, filename);
  file.create();
  try { file.write(bytes); return file.uri; }
  catch { discardVoiceFile(file.uri); throw new AudioProbeError('Не удалось сохранить расшифрованный звук для прослушивания.'); }
}
