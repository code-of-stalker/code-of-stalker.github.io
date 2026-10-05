import type { SavedSession } from './saved-session';
import { parseSavedSession, SerializedSessionStorage, SessionPersistenceError, SessionVaultCore } from './saved-session';

const key = 'matrix.session.v1';

async function secureStore() {
  try {
    const store = await import('expo-secure-store');
    if (!await store.isAvailableAsync()) throw new Error();
    return store;
  } catch {
    throw new Error('Для сохранения входа установите обновлённый APK с защищённым хранилищем.');
  }
}

const storage = new SerializedSessionStorage({
  async read() { return (await secureStore()).getItemAsync(key); },
  async write(text) {
    const store = await secureStore();
    try { await store.setItemAsync(key, text, { keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); }
    catch (error) {
      const code = error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
      throw new SessionPersistenceError('secure-store', code);
    }
  },
  async erase() { await (await secureStore()).deleteItemAsync(key); },
});

async function directory(id: string) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('Некорректный каталог сессии.');
  const { Directory, Paths } = await import('expo-file-system');
  return new Directory(Paths.document, 'matrix-sessions', id);
}

export async function sessionPaths(id: string, create: boolean) {
  const root = await directory(id);
  if (create) await root.create({ intermediates: true });
  else if (!root.exists) throw new Error('Локальные ключи сохранённого входа отсутствуют. Забыть вход и войти заново можно кнопкой ниже.');
  const { Directory, File } = await import('expo-file-system');
  const data = new Directory(root, 'data');
  const cache = new Directory(root, 'cache');
  if (create) {
    await data.create();
    await cache.create();
  } else if (!data.exists || !cache.exists) {
    throw new Error('Хранилище этой сессии не найдено. Забыть вход и войти заново можно кнопкой ниже.');
  }
  if (!create && (!new File(data, 'matrix-sdk-crypto.sqlite3').exists || !new File(data, 'matrix-sdk-state.sqlite3').exists)) {
    throw new Error('Файлы ключей или данных сохранённой сессии отсутствуют. Новый вход возможен после удаления сохранённого входа.');
  }
  // The Rust SDK expects OS paths rather than file:// URIs.
  return { data: decodeURIComponent(data.uri.replace(/^file:\/\//, '')), cache: decodeURIComponent(cache.uri.replace(/^file:\/\//, '')) };
}

export async function deleteSessionDirectory(id: string) {
  const root = await directory(id);
  if (root.exists) await root.delete();
}

export async function readSavedSession(): Promise<SavedSession | null> {
  const text = await storage.read();
  return text === null ? null : parseSavedSession(text);
}

export async function forgetSavedSession() {
  let saved: SavedSession | null = null;
  try { saved = await readSavedSession(); } catch { /* A malformed record can still be deleted. */ }
  await storage.erase();
  if (saved) await deleteSessionDirectory(saved.id);
}

export async function newSessionIdentity() {
  // Check that the credential store is usable before making a server login.
  if (await readSavedSession()) throw new Error('На телефоне уже сохранён вход. Сначала восстановите его или забудьте.');
  const { getRandomBytesAsync } = await import('expo-crypto');
  const bytes = await getRandomBytesAsync(48);
  const hex = (part: Uint8Array) => Array.from(part, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { id: hex(bytes.slice(0, 16)), passphrase: hex(bytes.slice(16)) };
}

export class SessionVault extends SessionVaultCore {
  constructor(identity: { id: string; passphrase: string }, saved: SavedSession | null = null) {
    super(identity, saved, storage, () => deleteSessionDirectory(identity.id));
  }
}
