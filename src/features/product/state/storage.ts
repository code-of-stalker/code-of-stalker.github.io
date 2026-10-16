import { ProductRepository } from './repository';
import { audioByteLimit, emptyProduct, observationAad, validateSnapshot } from './model';
import type { ProductSnapshot } from './model';
import { backupAudioRecords } from './backup-model';

// Browser preview owns a separate encrypted IndexedDB store. It never imports
// the native Matrix module or shares a native account/session.
const databaseName = 'watcher-product-local-v1';
const objectStore = 'encrypted';
let database: Promise<IDBDatabase> | null = null;
const previews = new Set<string>();
function db() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined' || !globalThis.crypto?.subtle) {
      reject(new Error('Для локального дневника нужен современный браузер и защищённое соединение.')); return;
    }
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(objectStore);
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(new Error('Браузер не разрешил открыть локальное хранилище.'));
  }).catch(error => { database = null; throw error; });
  return database;
}
async function read<T>(name: string): Promise<T | undefined> {
  const connection = await db();
  return new Promise((resolve, reject) => {
    const transaction = connection.transaction(objectStore, 'readonly'), request = transaction.objectStore(objectStore).get(name);
    transaction.oncomplete = () => resolve(request.result as T | undefined);
    transaction.onerror = transaction.onabort = () => reject(new Error('Не удалось прочитать локальные данные.'));
  });
}
async function put(name: string, value: unknown, add = false) {
  const connection = await db();
  return new Promise<void>((resolve, reject) => {
    const transaction = connection.transaction(objectStore, 'readwrite'), store = transaction.objectStore(objectStore);
    if (add) store.add(value, name); else store.put(value, name);
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => reject(new Error('Браузер не смог сохранить запись. Проверь доступное место.'));
  });
}
async function remove(name: string) {
  const connection = await db();
  return new Promise<void>((resolve, reject) => {
    const transaction = connection.transaction(objectStore, 'readwrite'); transaction.objectStore(objectStore).delete(name);
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => reject(new Error('Не удалось удалить локальный файл.'));
  });
}
async function encryptionKey() {
  const saved = await read<CryptoKey>('key');
  if (saved) return saved;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  try { await put('key', key, true); return key; }
  catch (error) { const existing = await read<CryptoKey>('key'); if (existing) return existing; throw error; }
}
type Sealed = { iv: Uint8Array<ArrayBuffer>; bytes: ArrayBuffer };
async function seal(bytes: Uint8Array<ArrayBuffer>, aad: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12)), key = await encryptionKey();
  return { iv, bytes: await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad), tagLength: 128 }, key, bytes) };
}
async function open(value: Sealed, aad: string) {
  const key = await read<CryptoKey>('key');
  if (!key || !value?.iv || !value?.bytes) throw new Error('Локальный ключ или зашифрованная запись недоступны.');
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: value.iv, additionalData: new TextEncoder().encode(aad), tagLength: 128 }, key, value.bytes));
}
export const productStorage = new ProductRepository({
  async randomId() { return Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join(''); },
  async readState() {
    const value = await read<Sealed>('state');
    if (!value) return null;
    return validateSnapshot(JSON.parse(new TextDecoder().decode(await open(value, 'watcher.product.state.v1'))) as ProductSnapshot);
  },
  async writeState(value) {
    await put('state', await seal(new TextEncoder().encode(JSON.stringify(validateSnapshot(value))), 'watcher.product.state.v1'));
  },
  async saveAudio(record, draft) {
    if (!draft.uri.startsWith('blob:')) throw new Error('Для сохранения нужна запись микрофона в этом браузере.');
    const response = await fetch(draft.uri), blob = await response.blob();
    if (blob.size < 32 || blob.size > audioByteLimit(record)) throw new Error('Запись пуста или превышает допустимый размер.');
    const bytes = new Uint8Array(await blob.arrayBuffer()), encrypted = await seal(bytes, observationAad(record));
    await put(`audio-${record.id}`, encrypted);
    const saved = await read<Sealed>(`audio-${record.id}`);
    if (!saved) throw new Error('Не удалось проверить сохранённую запись.');
    const verified = await open(saved, observationAad(record));
    if (verified.length !== bytes.length || verified.some((value, index) => value !== bytes[index])) throw new Error('Сохранённая запись не прошла проверку.');
  },
  async loadAudio(record) {
    const value = await read<Sealed>(`audio-${record.id}`);
    if (!value) throw new Error('Эта локальная запись недоступна.');
    const bytes = await open(value, observationAad(record));
    const uri = URL.createObjectURL(new Blob([bytes], { type: record.mimeType })); previews.add(uri); return uri;
  },
  removeAudio: id => remove(`audio-${id}`),
  discardPlayback(uri) { if (previews.delete(uri)) URL.revokeObjectURL(uri); },
  async readAudioBytes(record) {
    const value = await read<Sealed>(`audio-${record.id}`);
    if (!value) throw new Error('Одна из голосовых записей недоступна. Полная копия не создана.');
    return open(value, observationAad(record));
  },
  async restoreBackup(next, audio, expected) {
    const before = await read<Sealed>('state');
    const current = before ? validateSnapshot(JSON.parse(new TextDecoder().decode(await open(before, 'watcher.product.state.v1')))) : emptyProduct();
    if (JSON.stringify(current) !== JSON.stringify(expected)) throw new Error('Данные изменились в другой вкладке. Повтори восстановление.');
    const key = await read<CryptoKey>('key') ?? await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const encryptWithKey = async (bytes: Uint8Array<ArrayBuffer>, aad: string): Promise<Sealed> => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      return { iv, bytes: await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad), tagLength: 128 }, key, bytes) };
    };
    const records = new Map(backupAudioRecords(next).map(record => [record.id, record]));
    const previous = new Set(backupAudioRecords(current).map(record => record.id));
    const pending: [string, Sealed][] = [];
    for (const item of audio) {
      const record = records.get(item.id)!;
      if (previous.has(item.id)) {
        const existing = await read<Sealed>(`audio-${item.id}`);
        if (existing) {
          try { await open(existing, observationAad(record)); continue; }
          catch { /* A valid external copy can repair an unreadable local file. */ }
        }
      }
      pending.push([`audio-${item.id}`, await encryptWithKey(item.bytes, observationAad(record))]);
    }
    pending.push(['state', await encryptWithKey(new TextEncoder().encode(JSON.stringify(validateSnapshot(next))), 'watcher.product.state.v1')]);
    const equal = (a: Sealed | undefined, b: Sealed | undefined) => {
      if (!a || !b) return a === b;
      const x = new Uint8Array(a.bytes), y = new Uint8Array(b.bytes);
      return a.iv.length === b.iv.length && a.iv.every((v, i) => v === b.iv[i]) && x.length === y.length && x.every((v, i) => v === y[i]);
    };
    const connection = await db();
    await new Promise<void>((resolve, reject) => {
      const transaction = connection.transaction(objectStore, 'readwrite'), store = transaction.objectStore(objectStore);
      let conflict = false;
      const request = store.get('state');
      request.onsuccess = () => {
        if (!equal(request.result, before)) { conflict = true; transaction.abort(); return; }
        store.put(key, 'key');
        pending.forEach(([name, value]) => store.put(value, name));
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error(conflict ? 'Данные изменились в другой вкладке. Повтори восстановление.' : 'Не удалось восстановить копию. Текущие данные не изменены; проверь свободное место.'));
    });
  },
  async resetStorage() {
    const connection = await db();
    await new Promise<void>((resolve, reject) => {
      const transaction = connection.transaction(objectStore, 'readwrite');
      transaction.objectStore(objectStore).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error('Не удалось сбросить данные. Попробуй ещё раз.'));
    });
    for (const uri of previews) URL.revokeObjectURL(uri);
    previews.clear();
  },
});
