import type { AudioMessageContent, EventItemOrigin, EventTimelineItem } from '@unomed/react-native-matrix-sdk';
import type { EncryptionProof, PeerRoom } from './network-types';

export type AudioProbeReport = PeerRoom & {
  eventId: string;
  filename: string;
  byteLength: number;
  durationMs: number;
  encryption: EncryptionProof;
  elapsedMs: number;
  playbackUri?: string;
};

// Only these app-authored messages may reach the UI. Native media errors can
// contain the encrypted MediaSource descriptor, including its secret key.
export class AudioProbeError extends Error {}

export function audioProbeErrorText(error: unknown): string {
  return error instanceof AudioProbeError ? error.message
    : 'SDK не смог завершить проверку аудиофайла. Проверь связь и последний этап выше. Файл мог уже отправиться; сначала посмотри комнату на iPad.';
}

export function makeTestAudio(nonce: string) {
  if (!/^[a-f0-9]{32}$/.test(nonce)) throw new AudioProbeError('Не удалось создать имя тестового звука.');
  const sampleRate = 16_000, durationMs = 1_000, samples = sampleRate;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
  };
  ascii(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); ascii(8, 'WAVE');
  ascii(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    const time = i / sampleRate;
    const start = time < 0.5 ? 0.1 : 0.55;
    const phase = time - start;
    const envelope = phase >= 0 && phase < 0.3 ? Math.min(1, phase / 0.015, (0.3 - phase) / 0.015) : 0;
    const sample = Math.sin(2 * Math.PI * (time < 0.5 ? 440 : 660) * phase) * envelope * 0.2;
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }
  return { bytes, filename: `matrix-audio-${nonce}.wav`, durationMs, mimetype: 'audio/wav' };
}

export function matchingRemoteAudio(event: EventTimelineItem | undefined, filename: string,
  sender: string, origin: EventItemOrigin): { eventId: string; audio: AudioMessageContent } | undefined {
  if (!event?.isRemote || event.origin !== origin || event.sender !== sender || event.eventOrTransactionId.tag !== 'EventId') return;
  if (event.content.tag !== 'MsgLike') return;
  const kind = event.content.inner.content.kind;
  if (kind.tag !== 'Message' || kind.inner.content.msgType.tag !== 'Audio') return;
  const audio = kind.inner.content.msgType.inner.content;
  if (audio.filename !== filename) return;
  return { eventId: event.eventOrTransactionId.inner.eventId, audio };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AudioProbeError('SDK вернул неожиданные данные шифрования файла.');
  return value as Record<string, unknown>;
}

function base64Bytes(value: unknown, length: number, urlSafe = false): Uint8Array {
  const failure = () => new AudioProbeError('В описании шифрования файла неверный формат ключа, IV или контрольной суммы.');
  if (typeof value !== 'string' || !(urlSafe ? /^[\w-]+={0,2}$/ : /^[A-Za-z0-9+/]+={0,2}$/).test(value)) throw failure();
  const raw = value.replace(/=+$/, '');
  if (raw.length !== Math.ceil(length * 8 / 6) || (value.includes('=') && value.length % 4 !== 0)) throw failure();
  const alphabet = urlSafe ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const result = new Uint8Array(length);
  let accumulator = 0, bits = 0, offset = 0;
  for (const character of raw) {
    accumulator = (accumulator << 6) | alphabet.indexOf(character); bits += 6;
    if (bits >= 8) { bits -= 8; result[offset++] = (accumulator >> bits) & 255; }
    accumulator &= (1 << bits) - 1;
  }
  if (offset !== length || accumulator !== 0) throw failure();
  return result;
}

// MediaSource serializes as Ruma's externally tagged {file: EncryptedFile}.
// Project only the public URL and ciphertext checksum; never return key or IV.
export function inspectEncryptedAudioSource(json: string): { url: string; ciphertextSha256: Uint8Array } {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new AudioProbeError('Не удалось прочитать описание шифрования файла.'); }
  const source = record(parsed);
  if ('url' in source || !('file' in source)) throw new AudioProbeError('Вложение не содержит зашифрованного файла. Проверка не пройдена.');
  const file = record(source.file), key = record(file.key), hashes = record(file.hashes);
  if (file.v !== 'v2' || typeof file.url !== 'string' || !/^mxc:\/\/[^/\s?#]+\/[^/\s?#]+$/.test(file.url) ||
      key.kty !== 'oct' || key.alg !== 'A256CTR' || key.ext !== true || !Array.isArray(key.key_ops) ||
      !key.key_ops.includes('encrypt') || !key.key_ops.includes('decrypt')) {
    throw new AudioProbeError('Описание файла не соответствует ожидаемому шифрованию Matrix v2.');
  }
  base64Bytes(key.k, 32, true); base64Bytes(file.iv, 16);
  return { url: file.url, ciphertextSha256: base64Bytes(hashes.sha256, 32) };
}

export function equalBytes(first: Uint8Array, second: Uint8Array): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}
