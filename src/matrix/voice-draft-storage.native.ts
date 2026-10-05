import { VoiceDraftStore } from './voice-draft-store';
import { AudioProbeError } from './audio-probe';
import { isCacheVoiceUri, VOICE_MAX_BYTES } from './voice-types';

const secretName = 'matrix.voice-draft.v1';
const directoryName = 'matrix-voice-drafts';
async function files() { return import('expo-file-system'); }
async function secure() {
  const store = await import('expo-secure-store');
  if (!await store.isAvailableAsync()) throw new AudioProbeError('Защищённое хранилище Tecno недоступно. Черновик не сохранён.');
  return store;
}
async function cipherFile(id: string) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new AudioProbeError('Некорректный файл черновика.');
  const { File, Directory, Paths } = await files();
  return new File(new Directory(Paths.document, directoryName), `draft-${id}.bin`);
}
async function clean(cache: boolean, keepId?: string) {
  try {
    const { File, Directory, Paths } = await files();
    const directory = new Directory(cache ? Paths.cache : Paths.document, directoryName);
    if (!directory.exists) return;
    const pattern = cache ? /^preview-[a-f0-9]{32}\.m4a$/ : /^draft-[a-f0-9]{32}\.bin$/;
    for (const file of directory.list()) {
      if (file instanceof File && pattern.test(file.name) && file.name !== `draft-${keepId}.bin`) {
        try { file.delete(); } catch { /* The key is already deleted or belongs to keepId. */ }
      }
    }
  } catch { /* Orphan cleanup is best effort; it must not invalidate a committed key. */ }
}
async function randomId() {
  const { getRandomBytesAsync } = await import('expo-crypto');
  return Array.from(await getRandomBytesAsync(16), byte => byte.toString(16).padStart(2, '0')).join('');
}

export const voiceDraftStorage = new VoiceDraftStore({
  async readSecret() { return (await secure()).getItemAsync(secretName); },
  async writeSecret(text) {
    const store = await secure();
    await store.setItemAsync(secretName, text, { keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  async eraseSecret() { await (await secure()).deleteItemAsync(secretName); },
  async readCapture(draft) {
    const { File, Paths } = await files();
    if (!isCacheVoiceUri(draft.uri, Paths.cache.uri)) throw new AudioProbeError('Черновик должен находиться в кэше приложения.');
    const file = new File(draft.uri);
    if (!file.exists || file.size < 32 || file.size > VOICE_MAX_BYTES) throw new AudioProbeError('Запись не найдена или превышает размер теста.');
    return file.bytes();
  },
  randomId,
  async newKey() { return (await (await import('expo-crypto')).AESEncryptionKey.generate()).encoded('hex'); },
  async encrypt(bytes, key, aad) {
    const crypto = await import('expo-crypto');
    const sealed = await crypto.aesEncryptAsync(bytes, await crypto.AESEncryptionKey.import(key, 'hex'),
      { nonce: { length: 12 }, tagLength: 16, additionalData: new TextEncoder().encode(aad) });
    return sealed.combined();
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
    if (!file.exists || file.size !== size || size > VOICE_MAX_BYTES + 28) throw new AudioProbeError('Защищённая запись отсутствует или повреждена. Черновик не отправлен.');
    const bytes = await file.bytes();
    if (bytes.length !== size) throw new AudioProbeError('Размер сохранённого черновика изменился. Черновик не отправлен.');
    return bytes;
  },
  // Queue cleanup as part of the same operation; never launch detached file
  // deletion that could race a later save or preview creation.
  cleanCiphers: (keepId) => clean(false, keepId),
  cleanPreviews: () => clean(true),
  async writePreview(bytes) {
    const { Directory, File, Paths } = await files();
    const directory = new Directory(Paths.cache, directoryName);
    directory.create({ intermediates: true, idempotent: true });
    const file = new File(directory, `preview-${await randomId()}.m4a`);
    file.create();
    try { file.write(bytes); return file.uri; }
    catch (error) { try { file.delete(); } catch {} throw error; }
  },
});

export function eraseVoiceDraft(): Promise<void> { return voiceDraftStorage.eraseAll(); }
