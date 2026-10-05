import { AudioProbeError } from './audio-probe';
import type { AudioCheckpoint } from './audio-checkpoint';
import type { EncryptionProof } from './network-types';
import { validateServerUrl } from './network-types';
import type { VoiceDraftScope } from './voice-draft-store';
import type { VoiceProbeReport } from './voice-types';
import { INCOMING_AUDIO_MAX_BYTES, INCOMING_AUDIO_MAX_MS, validateIncomingAudioBytes } from './incoming-audio-probe';

export const VOICE_CACHE_SLOTS = 10;
type CacheRecord = {
  version: 1; id: string; key: string; scope: VoiceDraftScope; checkpoint: AudioCheckpoint;
  extension: 'ogg' | 'm4a'; encryption: EncryptionProof; savedAt: number;
};
export type VoicePlaybackCacheLike = Pick<VoicePlaybackCache, 'get' | 'save'>;
export type VoiceCachePorts = {
  readSecret(slot: number): Promise<string | null>;
  writeSecret(slot: number, text: string): Promise<void>;
  eraseSecret(slot: number): Promise<void>;
  randomId(): Promise<string>;
  newKey(): Promise<string>;
  readPlayback(uri: string): Promise<{ bytes: Uint8Array; extension: 'ogg' | 'm4a' }>;
  digest(bytes: Uint8Array): Promise<string>;
  encrypt(bytes: Uint8Array, key: string, aad: string): Promise<Uint8Array>;
  decrypt(bytes: Uint8Array, key: string, aad: string): Promise<Uint8Array>;
  writeCipher(id: string, bytes: Uint8Array): Promise<void>;
  readCipher(id: string, size: number): Promise<Uint8Array>;
  cleanCiphers(keepIds: readonly string[]): Promise<void>;
  writePreview(bytes: Uint8Array, extension: 'ogg' | 'm4a'): Promise<string>;
  discardPreview(uri: string): void;
};

function invalid(): never { throw new AudioProbeError('Сохранённая копия записи недоступна. Открой её при включённом интернете.'); }
function active(signal: AbortSignal) {
  if (signal.aborted) throw new AudioProbeError('Открытие сохранённой записи отменено.');
}
function scope(value: VoiceDraftScope): VoiceDraftScope {
  if (!value || [value.userId, value.peerUserId, value.deviceId, value.roomId, value.serverUrl]
    .some(item => typeof item !== 'string' || !item || item.length > 256) ||
    !/^@[^\s:]+:[^\s]+$/.test(value.userId) || !/^@[^\s:]+:[^\s]+$/.test(value.peerUserId) ||
    !/^![^\s]+$/.test(value.roomId) || !value.deviceId.trim() || value.userId === value.peerUserId) invalid();
  return { userId: value.userId, peerUserId: value.peerUserId, deviceId: value.deviceId,
    roomId: value.roomId, serverUrl: validateServerUrl(value.serverUrl) };
}
function checkpoint(value: AudioCheckpoint, context: VoiceDraftScope): AudioCheckpoint {
  if (!value || value.roomId !== context.roomId || value.deviceId !== context.deviceId ||
    ![context.userId, context.peerUserId].includes(value.senderUserId) ||
    typeof value.eventId !== 'string' || !/^\$[^\s]{1,255}$/.test(value.eventId) ||
    !/^[a-f0-9]{64}$/.test(value.audioSha256) || !Number.isInteger(value.byteLength) ||
    value.byteLength < 32 || value.byteLength > INCOMING_AUDIO_MAX_BYTES ||
    !Number.isFinite(value.durationMs) || value.durationMs <= 0 || value.durationMs > INCOMING_AUDIO_MAX_MS ||
    !Number.isSafeInteger(value.createdAt) || value.createdAt <= 0) invalid();
  return { roomId: value.roomId, eventId: value.eventId, deviceId: value.deviceId, senderUserId: value.senderUserId,
    audioSha256: value.audioSha256, byteLength: value.byteLength, durationMs: value.durationMs, createdAt: value.createdAt };
}
function encryption(value: EncryptionProof): EncryptionProof {
  if (!value || value.eventType !== 'm.room.encrypted' || value.algorithm !== 'm.megolm.v1.aes-sha2' ||
    !Number.isSafeInteger(value.ciphertextLength) || value.ciphertextLength <= 0) invalid();
  return { eventType: value.eventType, algorithm: value.algorithm, ciphertextLength: value.ciphertextLength };
}
function parse(text: string | null): CacheRecord | null {
  if (text === null) return null;
  try {
    if (text.length > 2048 || new TextEncoder().encode(text).length > 2048) return null;
    const value = JSON.parse(text) as CacheRecord;
    if (value.version !== 1 || !/^[a-f0-9]{32}$/.test(value.id) || !/^[a-f0-9]{64}$/.test(value.key) ||
      !['ogg', 'm4a'].includes(value.extension) || !Number.isSafeInteger(value.savedAt) || value.savedAt <= 0) return null;
    const context = scope(value.scope);
    return { version: 1, id: value.id, key: value.key, scope: context, checkpoint: checkpoint(value.checkpoint, context),
      extension: value.extension, encryption: encryption(value.encryption), savedAt: value.savedAt };
  } catch { return null; }
}
function aad(record: CacheRecord): string {
  return JSON.stringify(['matrix-voice-playback', record.version, record.id, record.scope, record.checkpoint,
    record.extension, record.encryption, record.savedAt]);
}
function same(a: object, b: object) { return JSON.stringify(a) === JSON.stringify(b); }

// Small independent SecureStore entries avoid putting audio or a growing index
// into the login record. All file/key changes, reads and logout share one queue.
export class VoicePlaybackCache {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private ports: VoiceCachePorts) {}
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work); this.tail = result.catch(() => {}); return result;
  }
  private records() { return Promise.all(Array.from({ length: VOICE_CACHE_SLOTS }, (_, slot) => this.ports.readSecret(slot).then(parse))); }

  get(value: VoiceDraftScope, expected: AudioCheckpoint, signal: AbortSignal): Promise<VoiceProbeReport | null> {
    const context = scope(value), saved = checkpoint(expected, context);
    return this.serial(async () => {
      active(signal);
      const records = await this.records(); active(signal);
      const matches = records.filter(item => item && same(item.scope, context) && item.checkpoint.eventId === saved.eventId);
      if (!matches.length) return null;
      if (matches.length !== 1 || !same(matches[0]!.checkpoint, saved)) return null;
      const record = matches[0]!;
      let bytes: Uint8Array;
      try {
        const sealed = await this.ports.readCipher(record.id, saved.byteLength + 28);
        active(signal);
        bytes = await this.ports.decrypt(sealed, record.key, aad(record));
        active(signal);
        validateIncomingAudioBytes(bytes, record.extension);
        if (bytes.length !== saved.byteLength || await this.ports.digest(bytes) !== saved.audioSha256) return null;
      } catch { active(signal); return null; }
      active(signal);
      const uri = await this.ports.writePreview(bytes, record.extension);
      if (signal.aborted) { this.ports.discardPreview(uri); active(signal); }
      return { roomId: context.roomId, peerUserId: context.peerUserId, eventId: saved.eventId,
        filename: `saved-voice.${record.extension}`, byteLength: saved.byteLength, durationMs: saved.durationMs,
        encryption: { ...record.encryption }, elapsedMs: 0, playbackUri: uri,
        playbackSource: 'tecno', offlineCopy: 'saved' };
    });
  }

  save(value: VoiceDraftScope, expected: AudioCheckpoint, proof: EncryptionProof, uri: string,
    eligibleIds: readonly string[], signal: AbortSignal): Promise<void> {
    const context = scope(value), saved = checkpoint(expected, context), verified = encryption(proof), eligible = [...eligibleIds];
    return this.serial(async () => {
      active(signal);
      if (!eligible.includes(saved.eventId) || new Set(eligible).size !== eligible.length || eligible.length > VOICE_CACHE_SLOTS) invalid();
      const records = await this.records(); active(signal);
      const matches = records.map((item, slot) => item && same(item.scope, context) && item.checkpoint.eventId === saved.eventId ? slot : -1).filter(slot => slot >= 0);
      const reusable = records.findIndex(item => !item || !same(item.scope, context) || !eligible.includes(item.checkpoint.eventId));
      const oldest = records.reduce((old, item, slot) => (item?.savedAt ?? Infinity) < (records[old]?.savedAt ?? Infinity) ? slot : old, 0);
      const slot = matches[0] ?? (reusable >= 0 ? reusable : oldest);
      const audio = await this.ports.readPlayback(uri); active(signal);
      validateIncomingAudioBytes(audio.bytes, audio.extension);
      if (audio.bytes.length !== saved.byteLength || await this.ports.digest(audio.bytes) !== saved.audioSha256) invalid();
      const record: CacheRecord = { version: 1, id: await this.ports.randomId(), key: await this.ports.newKey(), scope: context,
        checkpoint: saved, extension: audio.extension, encryption: verified, savedAt: Date.now() };
      if (!parse(JSON.stringify(record))) invalid();
      active(signal);
      const sealed = await this.ports.encrypt(audio.bytes, record.key, aad(record));
      if (sealed.length !== audio.bytes.length + 28) invalid();
      await this.ports.writeCipher(record.id, sealed); active(signal);
      const restored = await this.ports.decrypt(await this.ports.readCipher(record.id, sealed.length), record.key, aad(record));
      if (restored.length !== saved.byteLength || await this.ports.digest(restored) !== saved.audioSha256) invalid();
      active(signal);
      // Commit the key last. A rejected write can still have committed: leave
      // ciphertexts intact until the next successful read of all key slots.
      await this.ports.writeSecret(slot, JSON.stringify(record));
      records[slot] = record;
      for (let other = 0; other < records.length; other++) {
        const item = records[other];
        if (other !== slot && item && (!same(item.scope, context) || !eligible.includes(item.checkpoint.eventId) || matches.includes(other))) {
          await this.ports.eraseSecret(other); records[other] = null;
        }
      }
      await this.ports.cleanCiphers(records.filter(item => item !== null).map(item => item.id));
    });
  }

  eraseAll(): Promise<void> {
    return this.serial(async () => {
      for (let slot = 0; slot < VOICE_CACHE_SLOTS; slot++) await this.ports.eraseSecret(slot);
      await this.ports.cleanCiphers([]);
    });
  }
}
