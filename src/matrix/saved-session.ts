import type { AudioCheckpoint } from './audio-checkpoint';
import type { ClientSessionDelegate, Session } from '@unomed/react-native-matrix-sdk';
import type { EncryptedCheckpoint, PeerReplyCheckpoint } from './restart-probe';
import type { GroupRoom, PeerRoom } from './network-types';

export type SavedSession = {
  version: 1;
  id: string;
  passphrase: string;
  session: Session;
  roomIds: Partial<Record<'plaintext' | 'encrypted', string>>;
  encryptedCheckpoint?: EncryptedCheckpoint;
  peerRoom?: PeerRoom;
  peerReplyCheckpoint?: PeerReplyCheckpoint;
  peerAudioCheckpoint?: AudioCheckpoint;
  peerAudioHistory?: AudioCheckpoint[];
  ownAudioHistory?: AudioCheckpoint[];
  diaryRoomId?: string;
  diaryAudioHistory?: AudioCheckpoint[];
  diaryShare?: { sourceEventId: string; peerEventId: string };
  groupRoom?: GroupRoom;
};

export const AUDIO_HISTORY_LIMIT = 5;

export function appendAudioHistory(history: readonly AudioCheckpoint[], checkpoint: AudioCheckpoint): AudioCheckpoint[] {
  const previous = history.find((item) => item.eventId === checkpoint.eventId);
  if (previous) {
    if (previous.roomId !== checkpoint.roomId || previous.senderUserId !== checkpoint.senderUserId ||
        previous.deviceId !== checkpoint.deviceId || previous.audioSha256 !== checkpoint.audioSha256 ||
        previous.byteLength !== checkpoint.byteLength || previous.durationMs !== checkpoint.durationMs) {
      throw new SessionPersistenceError('format');
    }
    return history.map((item) => ({ ...item }));
  }
  return [checkpoint, ...history].slice(0, AUDIO_HISTORY_LIMIT).map((item) => ({ ...item }));
}

export class SessionPersistenceError extends Error {
  constructor(kind: 'format' | 'secure-store' | 'write', code?: string) {
    const messages = {
      format: 'Не удалось сохранить обновлённую сессию: неподдерживаемый формат данных комнаты или тестового сообщения. Сохранённый вход и ключи не удалены.',
      'secure-store': 'Защищённое хранилище телефона отклонило сохранение сессии. Сохранённый вход и ключи не удалены.',
      write: 'Не удалось сохранить обновлённую сессию. Сохранённый вход и ключи не удалены. Повторите проверку.',
    };
    // Native messages can contain credentials. Show only known, fixed error codes.
    const safeCode = ['ERR_WRITE', 'ERR_ENCRYPT', 'ERR_KEY_STORE', 'ERR_AUTHENTICATION'].includes(code ?? '') ? code : undefined;
    super(messages[kind] + (safeCode ? ` Код: ${safeCode}.` : ''));
    this.name = 'SessionPersistenceError';
  }
}

function persistenceError(error: unknown): SessionPersistenceError {
  return error instanceof SessionPersistenceError ? error : new SessionPersistenceError('write');
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validRoomId(value: unknown): value is string {
  return typeof value === 'string' && /^!\S{1,254}$/.test(value) && !value.includes('\0');
}

// Persist only the identity and digest of generated test text, never its body.
function parseEncryptedCheckpoint(value: unknown, roomId: string | undefined, deviceId: string): EncryptedCheckpoint {
  if (!object(value) || typeof value.roomId !== 'string' || value.roomId !== roomId ||
      typeof value.eventId !== 'string' || !/^\$\S{1,254}$/.test(value.eventId) ||
      value.deviceId !== deviceId || typeof value.bodySha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.bodySha256) ||
      typeof value.createdAt !== 'number' || !Number.isSafeInteger(value.createdAt) || value.createdAt <= 0) {
    throw new Error('Некорректная запись тестового сообщения.');
  }
  return { roomId: value.roomId, eventId: value.eventId, deviceId, bodySha256: value.bodySha256, createdAt: value.createdAt };
}

// Store only identifiers and a digest, never a decrypted file or attachment key.
export function parseAudioCheckpoint(value: unknown, room: PeerRoom | undefined, deviceId: string): AudioCheckpoint {
  const v = value as Partial<AudioCheckpoint> | null;
  if (!v || !room || v.roomId !== room.roomId || v.senderUserId !== room.peerUserId || v.deviceId !== deviceId ||
      typeof v.eventId !== 'string' || !/^\$[^\s\0]{1,254}$/.test(v.eventId) ||
      typeof v.audioSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(v.audioSha256) ||
      typeof v.byteLength !== 'number' || !Number.isSafeInteger(v.byteLength) || v.byteLength < 32 || v.byteLength > 2 * 1024 * 1024 ||
      typeof v.durationMs !== 'number' || !Number.isFinite(v.durationMs) || v.durationMs <= 0 || v.durationMs > 60000 ||
      typeof v.createdAt !== 'number' || !Number.isSafeInteger(v.createdAt) || v.createdAt <= 0) {
    throw new Error('Не удалось прочитать сохранённую запись голосового.');
  }
  return { roomId: room.roomId, senderUserId: room.peerUserId, deviceId, eventId: v.eventId,
    audioSha256: v.audioSha256, byteLength: v.byteLength, durationMs: v.durationMs, createdAt: v.createdAt };
}

function parseAudioHistory(value: unknown, room: PeerRoom | undefined, deviceId: string): AudioCheckpoint[] {
  let entries: unknown = value;
  if (object(value)) {
    // Compact on disk: repeated identity fields are stored once, still bound
    // to this session and peer room. Arrays remain accepted for in-memory writes.
    if (value.version !== 1 || !room || !Array.isArray(value.scope) || value.scope.length !== 3 ||
        value.scope[0] !== room.roomId || value.scope[1] !== room.peerUserId || value.scope[2] !== deviceId ||
        !Array.isArray(value.entries) || value.entries.length > AUDIO_HISTORY_LIMIT) throw new Error();
    entries = value.entries.map((row: unknown) => {
      if (!Array.isArray(row) || row.length !== 5) throw new Error();
      return { roomId: room.roomId, senderUserId: room.peerUserId, deviceId,
        eventId: row[0], audioSha256: row[1], byteLength: row[2], durationMs: row[3], createdAt: row[4] };
    });
  }
  if (!Array.isArray(entries) || entries.length > AUDIO_HISTORY_LIMIT) throw new Error();
  const result = entries.map((item) => parseAudioCheckpoint(item, room, deviceId));
  if (new Set(result.map((item) => item.eventId)).size !== result.length) throw new Error();
  return result;
}

function encodeAudioHistory(history: AudioCheckpoint[]) {
  return { version: 1, scope: history.length ? [history[0].roomId, history[0].senderUserId, history[0].deviceId] : [],
    entries: history.map((item) => [item.eventId, item.audioSha256, item.byteLength, item.durationMs, item.createdAt]) };
}

// Project known fields only. Neither a password nor arbitrary SDK data is saved.
export function parseSavedSession(text: string): SavedSession {
  try {
    const value: unknown = JSON.parse(text);
    if (!object(value) || value.version !== 1 || typeof value.id !== 'string' ||
        !/^[a-f0-9]{32}$/.test(value.id) || typeof value.passphrase !== 'string' ||
        !/^[a-f0-9]{64}$/.test(value.passphrase) || !object(value.session) || !object(value.roomIds)) throw new Error();
    const s = value.session;
    for (const field of ['accessToken', 'userId', 'deviceId', 'homeserverUrl']) {
      if (typeof s[field] !== 'string' || !s[field]) throw new Error();
    }
    const url = new URL(s.homeserverUrl as string);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        (s.slidingSyncVersion !== 0 && s.slidingSyncVersion !== 1) ||
        (s.refreshToken !== undefined && typeof s.refreshToken !== 'string') || s.oauthData !== undefined) throw new Error();
    const roomIds: SavedSession['roomIds'] = {};
    for (const mode of ['plaintext', 'encrypted'] as const) {
      const id = value.roomIds[mode];
      if (id !== undefined) {
        // Matrix v12 room IDs have no domain. Treat both formats as opaque IDs.
        if (!validRoomId(id)) throw new Error();
        roomIds[mode] = id;
      }
    }
    let peerRoom: PeerRoom | undefined;
    if (value.peerRoom !== undefined) {
      const peer = value.peerRoom;
      if (!object(peer) || !validRoomId(peer.roomId) || typeof peer.peerUserId !== 'string' ||
          peer.peerUserId.length > 255 || !/^@[^\s:\0]+:[^\s\0]+$/.test(peer.peerUserId) ||
          peer.peerUserId === s.userId || Object.values(roomIds).includes(peer.roomId)) throw new Error();
      peerRoom = { roomId: peer.roomId, peerUserId: peer.peerUserId };
    }
    let peerReplyCheckpoint: PeerReplyCheckpoint | undefined;
    if (value.peerReplyCheckpoint !== undefined) {
      const reply = value.peerReplyCheckpoint;
      if (!peerRoom || !object(reply) || reply.senderUserId !== peerRoom.peerUserId) throw new Error();
      peerReplyCheckpoint = {
        ...parseEncryptedCheckpoint(reply, peerRoom.roomId, s.deviceId as string), senderUserId: peerRoom.peerUserId,
      };
    }
    const peerAudioCheckpoint = value.peerAudioCheckpoint !== undefined
      ? parseAudioCheckpoint(value.peerAudioCheckpoint, peerRoom, s.deviceId as string) : undefined;
    const peerAudioHistory = value.peerAudioHistory !== undefined
      ? parseAudioHistory(value.peerAudioHistory, peerRoom, s.deviceId as string) : undefined;
    const ownAudioHistory = value.ownAudioHistory !== undefined
      ? parseAudioHistory(value.ownAudioHistory, peerRoom ? { roomId: peerRoom.roomId, peerUserId: s.userId as string } : undefined, s.deviceId as string) : undefined;
    if (ownAudioHistory?.some(item => item.eventId === peerAudioCheckpoint?.eventId || peerAudioHistory?.some(peer => peer.eventId === item.eventId))) throw new Error();
    const diaryRoomId = value.diaryRoomId;
    if (diaryRoomId !== undefined && (!validRoomId(diaryRoomId) || Object.values(roomIds).includes(diaryRoomId) || diaryRoomId === peerRoom?.roomId)) throw new Error();
    const diaryAudioHistory = value.diaryAudioHistory !== undefined
      ? parseAudioHistory(value.diaryAudioHistory, diaryRoomId ? { roomId: diaryRoomId, peerUserId: s.userId as string } : undefined,
        s.deviceId as string) : undefined;
    if (diaryAudioHistory && diaryAudioHistory.length > 2) throw new Error();
    let diaryShare: SavedSession['diaryShare'];
    if (value.diaryShare !== undefined) {
      const share = value.diaryShare;
      if (!object(share) || !peerRoom || !diaryAudioHistory?.some(item => item.eventId === share.sourceEventId) ||
          typeof share.peerEventId !== 'string' || !/^\$[^\s\0]{1,254}$/.test(share.peerEventId)) throw new Error();
      diaryShare = { sourceEventId: share.sourceEventId as string, peerEventId: share.peerEventId };
    }
    let groupRoom: GroupRoom | undefined;
    if (value.groupRoom !== undefined) {
      const group = value.groupRoom;
      if (!object(group) || !validRoomId(group.roomId) || group.roomId === peerRoom?.roomId ||
          group.roomId === diaryRoomId || Object.values(roomIds).includes(group.roomId) ||
          typeof group.ipadUserId !== 'string' || group.ipadUserId !== peerRoom?.peerUserId ||
          typeof group.computerUserId !== 'string' || group.computerUserId === s.userId ||
          group.computerUserId === group.ipadUserId || group.computerUserId.length > 255 ||
          !/^@[^\s:\0]+:[^\s\0]+$/.test(group.computerUserId)) throw new Error();
      groupRoom = { roomId: group.roomId, ipadUserId: group.ipadUserId, computerUserId: group.computerUserId };
    }
    return {
      version: 1, id: value.id, passphrase: value.passphrase, roomIds,
      ...(value.encryptedCheckpoint !== undefined ? {
        encryptedCheckpoint: parseEncryptedCheckpoint(value.encryptedCheckpoint, roomIds.encrypted, s.deviceId as string),
      } : {}),
      ...(peerRoom ? { peerRoom } : {}),
      ...(peerAudioCheckpoint ? { peerAudioCheckpoint } : {}),
      ...(peerReplyCheckpoint ? { peerReplyCheckpoint } : {}),
      ...(peerAudioHistory ? { peerAudioHistory } : {}),
      ...(ownAudioHistory ? { ownAudioHistory } : {}),
      ...(diaryRoomId ? { diaryRoomId } : {}),
      ...(diaryAudioHistory ? { diaryAudioHistory } : {}),
      ...(diaryShare ? { diaryShare } : {}),
      ...(groupRoom ? { groupRoom } : {}),
      session: {
        accessToken: s.accessToken as string, userId: s.userId as string, deviceId: s.deviceId as string,
        homeserverUrl: s.homeserverUrl as string, refreshToken: s.refreshToken as string | undefined,
        slidingSyncVersion: s.slidingSyncVersion,
      },
    };
  } catch {
    throw new Error('Сохранённый вход повреждён или имеет неподдерживаемый формат. Его можно забыть и войти заново.');
  }
}

export interface SessionStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  erase(): Promise<void>;
}

// One queue also covers reads and deletion: a delayed token update must not
// recreate credentials after logout, or race a subsequent restore.
export class SerializedSessionStorage {
  private tail: Promise<unknown> = Promise.resolve();
  private storage: SessionStorage;
  constructor(storage: SessionStorage) { this.storage = storage; }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task);
    this.tail = next.catch(() => {});
    return next;
  }
  read() { return this.enqueue(() => this.storage.read()); }
  write(record: SavedSession) {
    let text: string;
    try {
      const projected = parseSavedSession(JSON.stringify(record));
      text = JSON.stringify({ ...projected, ...(projected.peerAudioHistory ? {
        peerAudioHistory: projected.peerAudioHistory.length ? encodeAudioHistory(projected.peerAudioHistory) : [],
      } : {}), ...(projected.ownAudioHistory ? {
        ownAudioHistory: projected.ownAudioHistory.length ? encodeAudioHistory(projected.ownAudioHistory) : [],
      } : {}), ...(projected.diaryAudioHistory ? {
        diaryAudioHistory: projected.diaryAudioHistory.length ? encodeAudioHistory(projected.diaryAudioHistory) : [],
      } : {}) });
    }
    catch { throw new SessionPersistenceError('format'); }
    return this.enqueue(() => this.storage.write(text));
  }
  erase() { return this.enqueue(() => this.storage.erase()); }
}

// The native adapter supplies SecureStore and directory cleanup. Keeping the
// delegate here lets regression tests exercise the actual SDK save/flush flow.
export class SessionVaultCore implements ClientSessionDelegate {
  private stopped = false;
  private pending: Promise<void> = Promise.resolve();
  private revision = 0;
  private failure: SessionPersistenceError | null = null;
  private record: SavedSession | null;
  private identity: { id: string; passphrase: string };
  private storage: SerializedSessionStorage;
  private removeFiles: () => Promise<void>;

  constructor(identity: { id: string; passphrase: string }, saved: SavedSession | null,
    storage: SerializedSessionStorage, removeFiles: () => Promise<void>) {
    this.identity = identity;
    this.record = saved;
    this.storage = storage;
    this.removeFiles = removeFiles;
  }

  retrieveSessionFromKeychain(userId: string): Session {
    if (!this.record || this.record.session.userId !== userId || this.stopped) throw new Error('Сохранённая сессия недоступна.');
    return this.record.session;
  }

  saveSessionInKeychain(session: Session) {
    if (this.stopped) return;
    this.record = {
      version: 1, ...this.identity, session, roomIds: { ...this.record?.roomIds },
      ...(this.record?.encryptedCheckpoint ? { encryptedCheckpoint: this.record.encryptedCheckpoint } : {}),
      ...(this.record?.peerRoom ? { peerRoom: this.record.peerRoom } : {}),
      ...(this.record?.peerAudioCheckpoint ? { peerAudioCheckpoint: this.record.peerAudioCheckpoint } : {}),
      ...(this.record?.peerAudioHistory ? { peerAudioHistory: this.record.peerAudioHistory } : {}),
      ...(this.record?.ownAudioHistory ? { ownAudioHistory: this.record.ownAudioHistory } : {}),
      ...(this.record?.peerReplyCheckpoint ? { peerReplyCheckpoint: this.record.peerReplyCheckpoint } : {}),
      ...(this.record?.diaryRoomId ? { diaryRoomId: this.record.diaryRoomId } : {}),
      ...(this.record?.diaryAudioHistory ? { diaryAudioHistory: this.record.diaryAudioHistory } : {}),
      ...(this.record?.diaryShare ? { diaryShare: this.record.diaryShare } : {}),
      ...(this.record?.groupRoom ? { groupRoom: this.record.groupRoom } : {}),
    };
    this.persist();
  }

  saveRoomIds(roomIds: SavedSession['roomIds']) {
    if (!this.record || this.stopped) throw new Error('Сессия уже закрыта.');
    this.record = { ...this.record, roomIds: { ...roomIds } };
    this.persist();
  }

  saveEncryptedCheckpoint(encryptedCheckpoint: EncryptedCheckpoint) {
    if (!this.record || this.stopped) throw new Error('Сессия уже закрыта.');
    this.record = { ...this.record, encryptedCheckpoint };
    this.persist();
  }

  savePeerRoom(peerRoom: PeerRoom) {
    if (!this.record || this.stopped) throw new Error('Сессия уже закрыта.');
    const changed = this.record.peerRoom?.roomId !== peerRoom.roomId || this.record.peerRoom.peerUserId !== peerRoom.peerUserId;
    this.record = { ...this.record, peerRoom: { ...peerRoom } };
    if (changed) delete this.record.peerAudioHistory;
    if (changed) delete this.record.ownAudioHistory;
    if (changed) delete this.record.diaryShare;
    if (this.record.groupRoom?.ipadUserId !== peerRoom.peerUserId) delete this.record.groupRoom;
    if (this.record.peerReplyCheckpoint && (this.record.peerReplyCheckpoint.roomId !== peerRoom.roomId ||
        this.record.peerReplyCheckpoint.senderUserId !== peerRoom.peerUserId)) delete this.record.peerReplyCheckpoint;
    if (this.record.peerAudioCheckpoint && (this.record.peerAudioCheckpoint.roomId !== peerRoom.roomId ||
        this.record.peerAudioCheckpoint.senderUserId !== peerRoom.peerUserId)) delete this.record.peerAudioCheckpoint;
    this.persist();
  }

  savePeerAudioCheckpoint(peerAudioCheckpoint: AudioCheckpoint) {
    if (!this.record || this.stopped) throw new Error('Сессия уже закрыта.');
    const history = this.record.peerAudioHistory ?? (this.record.peerAudioCheckpoint ? [this.record.peerAudioCheckpoint] : []);
    this.record = { ...this.record, peerAudioCheckpoint: { ...peerAudioCheckpoint },
      peerAudioHistory: appendAudioHistory(history, peerAudioCheckpoint) };
    this.persist();
  }

  saveOwnAudioCheckpoint(checkpoint: AudioCheckpoint) {
    if (!this.record || this.stopped) throw new Error('Сессия уже закрыта.');
    this.record = { ...this.record, ownAudioHistory: appendAudioHistory(this.record.ownAudioHistory ?? [], checkpoint) };
    this.persist();
  }

  saveDiaryRoom(roomId: string) {
    if (!this.record || this.stopped) throw new Error('Сессия уже закрыта.');
    const changed = this.record.diaryRoomId !== roomId;
    this.record = { ...this.record, diaryRoomId: roomId,
      ...(changed ? { diaryAudioHistory: [] } : this.record.diaryAudioHistory ? { diaryAudioHistory: this.record.diaryAudioHistory } : {}) };
    if (changed) delete this.record.diaryShare;
    this.persist();
  }

  saveGroupRoom(groupRoom: GroupRoom) {
    if (!this.record || this.stopped || !this.record.peerRoom ||
        this.record.peerRoom.peerUserId !== groupRoom.ipadUserId) throw new SessionPersistenceError('format');
    this.record = { ...this.record, groupRoom: { ...groupRoom } };
    this.persist();
  }

  saveDiaryAudioCheckpoint(checkpoint: AudioCheckpoint) {
    if (!this.record || this.stopped || this.record.diaryRoomId !== checkpoint.roomId ||
        this.record.session.userId !== checkpoint.senderUserId || this.record.session.deviceId !== checkpoint.deviceId) {
      throw new SessionPersistenceError('format');
    }
    const entries = this.record.diaryAudioHistory ?? [];
    if (entries.length >= 2 && !entries.some(item => item.eventId === checkpoint.eventId)) {
      throw new SessionPersistenceError('format');
    }
    this.record = { ...this.record, diaryAudioHistory: appendAudioHistory(entries, checkpoint) };
    this.persist();
  }

  saveDiaryShare(sourceEventId: string, peerEventId: string) {
    if (!this.record || this.stopped || !this.record.peerRoom || this.record.diaryShare ||
        !this.record.diaryAudioHistory?.some(item => item.eventId === sourceEventId) ||
        !this.record.ownAudioHistory?.some(item => item.eventId === peerEventId)) {
      throw new SessionPersistenceError('format');
    }
    this.record = { ...this.record, diaryShare: { sourceEventId, peerEventId } };
    this.persist();
  }

  savePeerReplyCheckpoint(peerReplyCheckpoint: PeerReplyCheckpoint) {
    if (!this.record || this.stopped) throw new Error('Сессия уже закрыта.');
    this.record = { ...this.record, peerReplyCheckpoint: { ...peerReplyCheckpoint } };
    this.persist();
  }

  private persist() {
    if (!this.record) return;
    const revision = ++this.revision;
    let write: Promise<void>;
    try { write = this.storage.write(this.record); }
    catch (error) {
      // Report this validation failure after older queued saves complete so an
      // older success cannot accidentally erase the most recent failure.
      write = this.pending.then(() => { throw error; });
    }
    this.pending = write.then(
      () => { if (revision === this.revision) this.failure = null; },
      (error: unknown) => { if (revision === this.revision) this.failure = persistenceError(error); },
    );
  }

  async flush() {
    await this.pending;
    if (this.failure) throw this.failure;
  }

  stop() { this.stopped = true; }

  async erase() {
    this.stop();
    await this.storage.erase();
    await this.removeFiles();
  }
}
