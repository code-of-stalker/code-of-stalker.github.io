import { ProductRepository } from './repository';
import { audioByteLimit, DIARY_MAX_BYTES, observationAad, validateSnapshot } from './model';
import type { ProductSnapshot } from './model';
import { isCacheVoiceUri, validateVoiceBytes } from '../../../matrix/voice-types';

const secretName = 'watcher.product.v1';
const directoryName = 'watcher-product';
type Secret = { version: 1; key: string; stateId: string | null };
const idPattern = /^[a-f0-9]{32}$/;
async function randomId() {
  const crypto = await import('expo-crypto');
  return Array.from(await crypto.getRandomBytesAsync(16), value => value.toString(16).padStart(2, '0')).join('');
}
async function secureStore() {
  const store = await import('expo-secure-store');
  if (!await store.isAvailableAsync()) throw new Error('Защищённое хранилище телефона недоступно. Запись не сохранена.');
  return store;
}
async function writeSecret(secret: Secret) {
  const store = await secureStore();
  await store.setItemAsync(secretName, JSON.stringify(secret), { keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}
async function secret(create = false): Promise<Secret | null> {
  const text = await (await secureStore()).getItemAsync(secretName);
  if (text) {
    const value: Secret = JSON.parse(text);
    if (value.version !== 1 || !/^[a-f0-9]{64}$/.test(value.key) || (value.stateId !== null && !idPattern.test(value.stateId))) {
      throw new Error('Ключ локального дневника не удалось прочитать. Записи не изменены.');
    }
    return value;
  }
  if (!create) return null;
  const crypto = await import('expo-crypto');
  const value: Secret = { version: 1, key: await (await crypto.AESEncryptionKey.generate()).encoded('hex'), stateId: null };
  await writeSecret(value);
  return value;
}
async function fileFor(kind: 'state' | 'audio', id: string) {
  if (!idPattern.test(id)) throw new Error('Некорректный идентификатор записи.');
  const { Directory, File, Paths } = await import('expo-file-system');
  const directory = new Directory(Paths.document, directoryName);
  directory.create({ intermediates: true, idempotent: true });
  return new File(directory, `${kind}-${id}.bin`);
}
async function encrypt(bytes: Uint8Array, key: string, aad: string) {
  const crypto = await import('expo-crypto');
  return (await crypto.aesEncryptAsync(bytes, await crypto.AESEncryptionKey.import(key, 'hex'),
    { nonce: { length: 12 }, tagLength: 16, additionalData: new TextEncoder().encode(aad) })).combined();
}
async function decrypt(bytes: Uint8Array, key: string, aad: string) {
  const crypto = await import('expo-crypto');
  return crypto.aesDecryptAsync(crypto.AESSealedData.fromCombined(bytes, { ivLength: 12, tagLength: 16 }),
    await crypto.AESEncryptionKey.import(key, 'hex'), { output: 'bytes', additionalData: new TextEncoder().encode(aad) });
}
async function writeVerified(kind: 'state' | 'audio', id: string, bytes: Uint8Array, key: string, aad: string) {
  const sealed = await encrypt(bytes, key, aad), file = await fileFor(kind, id);
  file.create(); file.write(sealed);
  const opened = await decrypt(await file.bytes(), key, aad);
  if (opened.length !== bytes.length || opened.some((value, index) => value !== bytes[index])) throw new Error('Не удалось проверить сохранённую запись.');
}
async function readSealed(kind: 'state' | 'audio', id: string, key: string, aad: string) {
  const file = await fileFor(kind, id), limit = kind === 'audio' ? DIARY_MAX_BYTES + 28 : 8 * 1024 * 1024;
  if (!file.exists || file.size < 28 || file.size > limit) throw new Error('Защищённый файл отсутствует или повреждён.');
  return decrypt(await file.bytes(), key, aad);
}
function isPreview(uri: string, root: string) {
  return uri.startsWith(root.endsWith('/') ? root : `${root}/`) && /^preview-[a-f0-9]{32}\.m4a$/.test(uri.slice(uri.lastIndexOf('/') + 1));
}
async function clearPreviews() {
  const { Directory, File, Paths } = await import('expo-file-system');
  const directory = new Directory(Paths.cache, directoryName);
  if (!directory.exists) return;
  for (const file of directory.list()) if (file instanceof File && /^preview-[a-f0-9]{32}\.m4a$/.test(file.name)) {
    try { file.delete(); } catch { /* Only transient previews are removed. */ }
  }
}
export const productStorage = new ProductRepository({
  randomId,
  async readState() {
    await clearPreviews();
    const key = await secret();
    if (!key?.stateId) return null;
    return validateSnapshot(JSON.parse(new TextDecoder().decode(await readSealed('state', key.stateId, key.key, 'watcher.product.state.v1'))) as ProductSnapshot);
  },
  async writeState(value) {
    const key = (await secret(true))!, id = await randomId();
    const bytes = new TextEncoder().encode(JSON.stringify(validateSnapshot(value)));
    if (bytes.length > 8 * 1024 * 1024 - 28) throw new Error('Локальный список записей слишком велик. Освободи место в дневнике.');
    await writeVerified('state', id, bytes, key.key, 'watcher.product.state.v1');
    // The short SecureStore pointer is the commit point; the previous encrypted
    // snapshot survives until the new one has been written and verified.
    await writeSecret({ ...key, stateId: id });
    if (key.stateId) { try { (await fileFor('state', key.stateId)).delete(); } catch {} }
  },
  async saveAudio(record, draft) {
    const { File, Paths } = await import('expo-file-system');
    if (record.mimeType !== 'audio/mp4' || !isCacheVoiceUri(draft.uri, Paths.cache.uri)) throw new Error('Для сохранения нужна запись микрофона этого приложения.');
    const file = new File(draft.uri);
    if (!file.exists || file.size < 32 || file.size > audioByteLimit(record)) throw new Error('Запись отсутствует или превышает допустимый размер.');
    const bytes = await file.bytes(); validateVoiceBytes(bytes, audioByteLimit(record));
    const key = (await secret(true))!;
    await writeVerified('audio', record.id, bytes, key.key, observationAad(record));
  },
  async loadAudio(record) {
    const key = await secret();
    if (!key) throw new Error('Ключ локальной записи недоступен.');
    const bytes = await readSealed('audio', record.id, key.key, observationAad(record));
    validateVoiceBytes(bytes, audioByteLimit(record));
    const { Directory, File, Paths } = await import('expo-file-system');
    const directory = new Directory(Paths.cache, directoryName);
    directory.create({ intermediates: true, idempotent: true });
    const file = new File(directory, `preview-${await randomId()}.m4a`);
    file.create();
    try { file.write(bytes); return file.uri; } catch (error) { try { file.delete(); } catch {} throw error; }
  },
  async removeAudio(id) { const file = await fileFor('audio', id); if (file.exists) file.delete(); },
  discardPlayback(uri) {
    void import('expo-file-system').then(({ Directory, File, Paths }) => {
      const directory = new Directory(Paths.cache, directoryName);
      if (isPreview(uri, directory.uri)) { const file = new File(uri); if (file.exists) file.delete(); }
    }).catch(() => {});
  },
  async resetStorage() {
    const store = await secureStore();
    const { Directory, Paths } = await import('expo-file-system');
    // Only this product's private directories are removed, never a Matrix store
    // or the root document/cache directory. Old and orphaned files go with them.
    for (const root of [Paths.document, Paths.cache]) {
      const directory = new Directory(root, directoryName);
      if (directory.exists) directory.delete();
    }
    await store.deleteItemAsync(secretName);
  },
});
