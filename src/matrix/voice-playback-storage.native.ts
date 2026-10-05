import { AudioProbeError } from './audio-probe';
import { VoicePlaybackCache, VOICE_CACHE_SLOTS } from './voice-playback-cache';
import { isIncomingAudioUri, INCOMING_AUDIO_MAX_BYTES } from './incoming-audio-probe';
import { discardIncomingAudio, retainIncomingAudio } from './incoming-audio-files.native';

const directoryName = 'matrix-voice-playback';
async function files() { return import('expo-file-system'); }
async function secure() {
  const store = await import('expo-secure-store');
  if (!await store.isAvailableAsync()) throw new AudioProbeError('Защищённое хранилище записей недоступно.');
  return store;
}
function secretName(slot: number) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= VOICE_CACHE_SLOTS) throw new AudioProbeError('Некорректное место сохранения записи.');
  return `matrix.voice-playback.v1.${slot}`;
}
async function cipherFile(id: string) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new AudioProbeError('Некорректный файл сохранённой записи.');
  const { File, Directory, Paths } = await files();
  return new File(new Directory(Paths.document, directoryName), `voice-${id}.bin`);
}
async function randomId() {
  const bytes = await (await import('expo-crypto')).getRandomBytesAsync(16);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
export const voicePlaybackStorage = new VoicePlaybackCache({
  async readSecret(slot) { return (await secure()).getItemAsync(secretName(slot)); },
  async writeSecret(slot, text) {
    const store = await secure();
    await store.setItemAsync(secretName(slot), text, { keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  async eraseSecret(slot) { await (await secure()).deleteItemAsync(secretName(slot)); },
  randomId,
  async newKey() { return (await (await import('expo-crypto')).AESEncryptionKey.generate()).encoded('hex'); },
  async readPlayback(uri) {
    const { File, Paths } = await files();
    if (!isIncomingAudioUri(uri, Paths.cache.uri)) throw new AudioProbeError('Для сохранения нужна проверенная запись из истории.');
    const file = new File(uri);
    if (!file.exists || file.size < 32 || file.size > INCOMING_AUDIO_MAX_BYTES) throw new AudioProbeError('Файл прослушивания недоступен.');
    return { bytes: await file.bytes(), extension: uri.endsWith('.ogg') ? 'ogg' : 'm4a' };
  },
  async digest(bytes) {
    const crypto = await import('expo-crypto');
    return Array.from(new Uint8Array(await crypto.digest(crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes))),
      byte => byte.toString(16).padStart(2, '0')).join('');
  },
  async encrypt(bytes, key, aad) {
    const crypto = await import('expo-crypto');
    return (await crypto.aesEncryptAsync(bytes, await crypto.AESEncryptionKey.import(key, 'hex'),
      { nonce: { length: 12 }, tagLength: 16, additionalData: new TextEncoder().encode(aad) })).combined();
  },
  async decrypt(bytes, key, aad) {
    const crypto = await import('expo-crypto');
    return crypto.aesDecryptAsync(crypto.AESSealedData.fromCombined(bytes, { ivLength: 12, tagLength: 16 }),
      await crypto.AESEncryptionKey.import(key, 'hex'), { output: 'bytes', additionalData: new TextEncoder().encode(aad) });
  },
  async writeCipher(id, bytes) {
    const { Directory, Paths } = await files();
    new Directory(Paths.document, directoryName).create({ intermediates: true, idempotent: true });
    const file = await cipherFile(id); file.create(); file.write(bytes);
  },
  async readCipher(id, size) {
    const file = await cipherFile(id);
    if (!file.exists || file.size !== size || size > INCOMING_AUDIO_MAX_BYTES + 28) throw new AudioProbeError('Сохранённая копия повреждена.');
    const bytes = await file.bytes();
    if (bytes.length !== size) throw new AudioProbeError('Размер сохранённой копии изменился.');
    return bytes;
  },
  async cleanCiphers(keepIds) {
    try {
      const { File, Directory, Paths } = await files();
      const directory = new Directory(Paths.document, directoryName);
      if (!directory.exists) return;
      const keep = new Set(keepIds.map(id => `voice-${id}.bin`));
      for (const file of directory.list()) {
        if (file instanceof File && /^voice-[a-f0-9]{32}\.bin$/.test(file.name) && !keep.has(file.name)) {
          try { file.delete(); } catch { /* The protected key no longer references this file. */ }
        }
      }
    } catch { /* Orphan cleanup must not invalidate a committed cache slot. */ }
  },
  async writePreview(bytes, extension) { return retainIncomingAudio(bytes, `ipad-voice-${await randomId()}.${extension}`, extension); },
  discardPreview: discardIncomingAudio,
});

export function eraseVoicePlaybackCache(): Promise<void> { return voicePlaybackStorage.eraseAll(); }
