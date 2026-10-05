import { Directory, File, Paths } from 'expo-file-system';
import { AudioProbeError } from './audio-probe';
import { isIncomingAudioUri, validateIncomingAudioBytes } from './incoming-audio-probe';

export function discardIncomingAudio(uri: string | undefined) {
  if (!uri || !isIncomingAudioUri(uri, Paths.cache.uri)) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* Best effort, limited to our own temporary audio. */ }
}

// A forced process stop can leave a player file behind. Only startup calls
// this, before the restored session exposes any player to the screen.
export function cleanIncomingAudioPreviews() {
  try {
    const directory = new Directory(Paths.cache, 'matrix-incoming-audio');
    if (!directory.exists) return;
    for (const file of directory.list()) {
      if (file instanceof File && /^ipad-voice-[a-f0-9]{32}\.(ogg|m4a)$/.test(file.name)) discardIncomingAudio(file.uri);
    }
  } catch { /* Best effort; unrelated files and SDK media are never removed. */ }
}

export function retainIncomingAudio(bytes: Uint8Array, filename: string, extension: 'ogg' | 'm4a'): string {
  if (!/^ipad-voice-[a-f0-9]{32}\.(ogg|m4a)$/.test(filename) || !filename.endsWith(`.${extension}`)) {
    throw new AudioProbeError('Не удалось подготовить имя полученной записи.');
  }
  validateIncomingAudioBytes(bytes, extension);
  const directory = new Directory(Paths.cache, 'matrix-incoming-audio');
  directory.create({ intermediates: true, idempotent: true });
  const file = new File(directory, filename);
  file.create();
  try { file.write(bytes); return file.uri; }
  catch { discardIncomingAudio(file.uri); throw new AudioProbeError('Не удалось сохранить полученную запись для прослушивания.'); }
}
