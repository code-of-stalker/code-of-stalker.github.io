import { BACKUP_MAX_BYTES, BACKUP_METADATA_MAX_BYTES, validateBackup } from './backup-model';
import type { BackupData } from './backup-model';

const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
const magic = encoder.encode('WATCHER-BACKUP-V1\n');
const iterations = 600000;
const hex = (bytes: Uint8Array) => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
function unhex(value: unknown, length: number) {
  if (typeof value !== 'string' || value.length !== length * 2 || !/^[a-f0-9]+$/.test(value)) throw new Error('Некорректный заголовок копии.');
  return Uint8Array.from(value.match(/../g)!, pair => parseInt(pair, 16));
}
export function validateBackupPassword(password: string) {
  if (password.length < 12 || password.length > 512 || !password.trim()) throw new Error('Используй пароль от 12 до 512 символов.');
}
async function keyFor(password: string, salt: Uint8Array<ArrayBuffer>) {
  validateBackupPassword(password);
  if (!globalThis.crypto?.subtle) throw new Error('Для резервной копии нужно защищённое соединение и современный браузер.');
  const encoded = encoder.encode(password);
  try {
    const key = await crypto.subtle.importKey('raw', encoded, 'PBKDF2', false, ['deriveKey']);
    return await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  } finally { encoded.fill(0); }
}
function pack(data: BackupData) {
  validateBackup(data);
  const metadata = encoder.encode(JSON.stringify({ createdAt: data.createdAt, snapshot: data.snapshot, audio: data.audio.map(item => ({ id: item.id, length: item.bytes.byteLength })) }));
  const total = 4 + metadata.length + data.audio.reduce((size, item) => size + item.bytes.length, 0);
  if (metadata.length > BACKUP_METADATA_MAX_BYTES || total + 4096 > BACKUP_MAX_BYTES) throw new Error('Копия превышает 512 МБ.');
  const bytes = new Uint8Array(total); new DataView(bytes.buffer).setUint32(0, metadata.length); bytes.set(metadata, 4);
  let offset = metadata.length + 4;
  data.audio.forEach(item => { bytes.set(item.bytes, offset); offset += item.bytes.length; });
  return bytes;
}
function unpack(bytes: Uint8Array<ArrayBuffer>): BackupData {
  if (bytes.length < 4) throw new Error('Копия повреждена.');
  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  if (!length || length > BACKUP_METADATA_MAX_BYTES || length + 4 > bytes.length) throw new Error('Копия повреждена.');
  const metadata = JSON.parse(decoder.decode(bytes.subarray(4, length + 4)));
  if (!Array.isArray(metadata.audio) || metadata.audio.length > 10000) throw new Error('Копия повреждена.');
  let offset = length + 4;
  const data: BackupData = { createdAt: metadata.createdAt, snapshot: metadata.snapshot, audio: [] };
  try {
    for (const item of metadata.audio) {
      if (!Number.isSafeInteger(item.length) || item.length < 32 || item.length > 24 * 1024 * 1024 || offset + item.length > bytes.length) throw new Error('Копия повреждена.');
      data.audio.push({ id: item.id, bytes: bytes.slice(offset, offset + item.length) }); offset += item.length;
    }
    if (offset !== bytes.length) throw new Error('Копия повреждена.');
    validateBackup(data); return data;
  } catch (error) { data.audio.forEach(item => item.bytes.fill(0)); throw error; }
}
export async function encryptBackup(data: BackupData, password: string) {
  validateBackupPassword(password);
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(password, salt), payload = pack(data);
  const header = encoder.encode(JSON.stringify({ version: 1, kdf: 'PBKDF2-SHA256', iterations, cipher: 'AES-256-GCM', salt: hex(salt), iv: hex(iv) }));
  const aad = new Uint8Array(magic.length + 4 + header.length); aad.set(magic); new DataView(aad.buffer).setUint32(magic.length, header.length); aad.set(header, magic.length + 4);
  try {
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, key, payload));
    const file = new Uint8Array(aad.length + ciphertext.length); file.set(aad); file.set(ciphertext, aad.length); return file;
  } finally { payload.fill(0); }
}
export async function decryptBackup(file: Uint8Array<ArrayBuffer>, password: string): Promise<BackupData> {
  validateBackupPassword(password);
  if (file.length > BACKUP_MAX_BYTES || file.length < magic.length + 4 + 16 || !magic.every((value, index) => file[index] === value)) throw new Error('Выбери файл резервной копии Watcher (.watcherbackup), не больше 512 МБ.');
  const length = new DataView(file.buffer, file.byteOffset, file.byteLength).getUint32(magic.length), end = magic.length + 4 + length;
  if (!length || length > 4096 || end + 16 > file.length) throw new Error('Заголовок копии повреждён.');
  let header;
  try { header = JSON.parse(decoder.decode(file.subarray(magic.length + 4, end))); }
  catch { throw new Error('Заголовок копии повреждён.'); }
  if (!header || header.version !== 1 || header.kdf !== 'PBKDF2-SHA256' || header.iterations !== iterations || header.cipher !== 'AES-256-GCM') throw new Error('Эта версия резервной копии не поддерживается.');
  const key = await keyFor(password, unhex(header.salt, 16)), iv = unhex(header.iv, 12);
  let payload: Uint8Array<ArrayBuffer>;
  try { payload = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: file.subarray(0, end), tagLength: 128 }, key, file.subarray(end))); }
  catch { throw new Error('Пароль не подходит или файл повреждён. Текущие записи не изменены.'); }
  try { return unpack(payload); } finally { payload.fill(0); }
}
