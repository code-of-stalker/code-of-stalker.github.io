import { AudioProbeError } from './audio-probe';
import { validateVoiceBytes, validateVoiceDraft, VOICE_MAX_BYTES } from './voice-types';
import type { VoiceDraft } from './voice-types';

export type VoiceDraftScope = { userId: string; serverUrl: string; deviceId: string; roomId: string; peerUserId: string };
export type SavedVoiceDraft = { id: string; state: 'draft' | 'sending'; createdAt: number };
export type RestoredVoiceDraft = SavedVoiceDraft & { draft: VoiceDraft };
type DraftRecord = SavedVoiceDraft & { version: 1; scope: VoiceDraftScope; key: string; byteLength: number; durationMs: number; waveform: number[] };
export type DraftStorePorts = {
  readSecret(): Promise<string | null>;
  writeSecret(text: string): Promise<void>;
  eraseSecret(): Promise<void>;
  readCapture(draft: VoiceDraft): Promise<Uint8Array>;
  randomId(): Promise<string>;
  newKey(): Promise<string>;
  encrypt(bytes: Uint8Array, key: string, aad: string): Promise<Uint8Array>;
  decrypt(bytes: Uint8Array, key: string, aad: string): Promise<Uint8Array>;
  writeCipher(id: string, bytes: Uint8Array): Promise<void>;
  readCipher(id: string, size: number): Promise<Uint8Array>;
  cleanCiphers(keepId?: string): void | Promise<void>;
  cleanPreviews(): void | Promise<void>;
  writePreview(bytes: Uint8Array): Promise<string>;
};

export function draftErrorText(error: unknown): string {
  return error instanceof AudioProbeError ? error.message
    : 'Не удалось сохранить или открыть черновик на Tecno. Предыдущий черновик не удалён. Попробуй снова.';
}
function invalid(): never { throw new AudioProbeError('Сохранённый черновик повреждён или имеет неподдерживаемый формат. Удали его кнопкой «Удалить черновик» и запиши фразу снова.'); }
function validateScope(scope: VoiceDraftScope) {
  if (!scope || Object.values(scope).some(value => typeof value !== 'string' || !value || value.length > 256)) invalid();
  const server = new URL(scope.serverUrl);
  if (server.protocol !== 'https:' || server.username || server.password || server.search || server.hash ||
      !/^@[^\s:]+:[^\s]+$/.test(scope.userId) || !/^@[^\s:]+:[^\s]+$/.test(scope.peerUserId) ||
      !/^![^\s]+$/.test(scope.roomId) || !scope.deviceId.trim()) invalid();
}
function sameScope(a: VoiceDraftScope, b: VoiceDraftScope) {
  return a.userId === b.userId && a.serverUrl === b.serverUrl && a.deviceId === b.deviceId && a.roomId === b.roomId && a.peerUserId === b.peerUserId;
}
function bound(record: DraftRecord, scope: VoiceDraftScope, id?: string) {
  validateScope(scope);
  if (!sameScope(record.scope, scope)) throw new AudioProbeError('На Tecno есть черновик другой сессии или комнаты. Он не будет открыт или отправлен. Для удаления выйди из аккаунта.');
  if (id && record.id !== id) throw new AudioProbeError('Черновик изменился. Открой экран заново, прежде чем продолжать.');
}
function parse(text: string | null): DraftRecord | null {
  if (text === null) return null;
  try {
    if (text.length > 4096) invalid();
    const value = JSON.parse(text) as DraftRecord;
    if (!value || value.version !== 1 || !/^[a-f0-9]{32}$/.test(value.id) || !/^[a-f0-9]{64}$/.test(value.key) ||
        !['draft', 'sending'].includes(value.state) || !Number.isSafeInteger(value.createdAt) || value.createdAt <= 0 ||
        !Number.isInteger(value.byteLength) || value.byteLength < 32 || value.byteLength > VOICE_MAX_BYTES ||
        !Array.isArray(value.waveform) || value.waveform.length > 32) invalid();
    validateScope(value.scope);
    validateVoiceDraft({ uri: 'file:///checked.m4a', durationMs: value.durationMs, waveform: value.waveform });
    return value;
  } catch { return invalid(); }
}
function aad(record: DraftRecord) {
  // Sending state changes independently; all immutable audio metadata is authenticated.
  const s = record.scope;
  return JSON.stringify([record.version, record.id, s.userId, s.serverUrl, s.deviceId, s.roomId, s.peerUserId,
    record.createdAt, record.byteLength, record.durationMs, record.waveform]);
}
function info(record: DraftRecord): SavedVoiceDraft { return { id: record.id, state: record.state, createdAt: record.createdAt }; }

// One queue for disk/key changes, including logout and remount. A rejected
// operation cannot poison the queue or delete the previous protected record.
export class VoiceDraftStore {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private ports: DraftStorePorts) {}
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(work); this.tail = next.catch(() => {}); return next;
  }
  save(scope: VoiceDraftScope, draft: VoiceDraft): Promise<RestoredVoiceDraft> {
    // Capture mutable UI input before joining the queue.
    const snapshot = { ...draft, waveform: [...draft.waveform] }, context = { ...scope };
    return this.serial(async () => {
      validateScope(context); validateVoiceDraft(snapshot);
      if (await this.ports.readSecret() !== null) throw new AudioProbeError('Уже есть сохранённый черновик. Сначала отправь или удали его.');
      const bytes = await this.ports.readCapture(snapshot); validateVoiceBytes(bytes);
      const record: DraftRecord = { version: 1, id: await this.ports.randomId(), key: await this.ports.newKey(),
        scope: context, durationMs: snapshot.durationMs,
        waveform: snapshot.waveform.filter((_, i) => i % Math.max(1, Math.ceil(snapshot.waveform.length / 32)) === 0).map(x => Math.round(x * 1000) / 1000),
        byteLength: bytes.length, createdAt: Date.now(), state: 'draft' };
      const text = JSON.stringify(record); parse(text);
      if (new TextEncoder().encode(text).length > 1900) throw new AudioProbeError('Данные черновика слишком велики для защищённого хранилища. Сообщи об этом в нашем чате.');
      const encrypted = await this.ports.encrypt(bytes, record.key, aad(record));
      if (encrypted.length !== bytes.length + 28) invalid();
      await this.ports.writeCipher(record.id, encrypted);
      // Read back from disk and decrypt through the native AES implementation
      // before announcing that the draft is saved or committing its key.
      const readBack = await this.ports.readCipher(record.id, encrypted.length);
      const opened = await this.ports.decrypt(readBack, record.key, aad(record));
      if (opened.length !== bytes.length || opened.some((byte, i) => byte !== bytes[i])) invalid();
      await this.ports.cleanPreviews();
      const uri = await this.ports.writePreview(opened);
      await this.ports.writeSecret(text);
      // Leave an uncommitted ciphertext orphan after errors, since a rejected
      // secure-store call may have committed. A later read determines ownership.
      await this.ports.cleanCiphers(record.id);
      return { ...info(record), draft: { uri, durationMs: record.durationMs, waveform: [...record.waveform] } };
    });
  }
  restore(scope: VoiceDraftScope): Promise<RestoredVoiceDraft | null> {
    const context = { ...scope };
    return this.serial(async () => {
      validateScope(context);
      const record = parse(await this.ports.readSecret());
      await this.ports.cleanCiphers(record?.id);
      await this.ports.cleanPreviews();
      if (!record) return null;
      bound(record, context);
      const encrypted = await this.ports.readCipher(record.id, record.byteLength + 28);
      const bytes = await this.ports.decrypt(encrypted, record.key, aad(record));
      if (bytes.length !== record.byteLength) invalid();
      validateVoiceBytes(bytes);
      const uri = await this.ports.writePreview(bytes);
      return { ...info(record), draft: { uri, durationMs: record.durationMs, waveform: [...record.waveform] } };
    });
  }
  markSending(scope: VoiceDraftScope, id: string): Promise<SavedVoiceDraft> {
    const context = { ...scope };
    return this.serial(async () => {
      const record = parse(await this.ports.readSecret()); if (!record) invalid();
      bound(record, context, id);
      if (record.state !== 'draft') throw new AudioProbeError('Эта запись могла уже отправиться. Проверь iPad; повторная отправка отключена.');
      const sending: DraftRecord = { ...record, state: 'sending' };
      await this.ports.writeSecret(JSON.stringify(sending));
      return info(sending);
    });
  }
  clear(scope: VoiceDraftScope, id: string): Promise<void> {
    const context = { ...scope };
    return this.serial(async () => {
      const record = parse(await this.ports.readSecret());
      if (record) bound(record, context, id);
      await this.ports.eraseSecret();
      await this.ports.cleanCiphers();
    });
  }
  eraseAll(): Promise<void> {
    return this.serial(async () => {
      // Delete the key first. Failure keeps the referenced ciphertext intact.
      await this.ports.eraseSecret(); await this.ports.cleanCiphers(); await this.ports.cleanPreviews();
    });
  }
}
