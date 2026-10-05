import type { AudioMessageContent, EventItemOrigin, EventTimelineItem } from '@unomed/react-native-matrix-sdk';
import { AudioProbeError } from './audio-probe';

// Keep a distinct basename from incoming-audio.native.ts: Metro prefers the
// native implementation for extensionless imports on both Android and iOS.

export const INCOMING_AUDIO_MAX_BYTES = 2 * 1024 * 1024;
export const INCOMING_AUDIO_MAX_MS = 60_000;

export function incomingAudioErrorText(error: unknown): string {
  // Native errors can include the attachment key. Never forward them to UI.
  return error instanceof AudioProbeError ? error.message
    : 'Не удалось получить и расшифровать голосовое с iPad. Проверь связь и последний этап выше.';
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AudioProbeError('Сервер вернул неожиданный ответ при ожидании голосового.');
  }
  return value as Record<string, unknown>;
}

// /messages start tokens need not support pagination. The end token from a
// backwards page is supported; skip that page's last event when going forward.
// This establishes freshness without depending on the phone's clock or cache.
export function incomingAudioBoundary(value: unknown): { cursor: string; excludedEventId: string } {
  const page = record(value);
  if (!Array.isArray(page.chunk) || page.chunk.length !== 1 || typeof page.end !== 'string' || !page.end) {
    throw new AudioProbeError('Не удалось определить начало новой проверки. Сначала проверь обмен текстом с iPad.');
  }
  const event = record(page.chunk[0]);
  if (typeof event.event_id !== 'string' || !event.event_id.startsWith('$')) {
    throw new AudioProbeError('Не удалось определить последнее событие комнаты.');
  }
  return { cursor: page.end, excludedEventId: event.event_id };
}

export function incomingAudioPage(value: unknown, cursor: string, excludedEventId: string, peerUserId: string) {
  const page = record(value);
  if (page.start !== cursor || !Array.isArray(page.chunk) || page.chunk.length > 20 ||
      (page.end !== undefined && (typeof page.end !== 'string' || !page.end))) {
    throw new AudioProbeError('Сервер не подтвердил порядок новых сообщений. Проверка остановлена.');
  }
  const eventIds: string[] = [];
  for (const item of page.chunk) {
    const event = record(item);
    if (typeof event.event_id !== 'string' || !event.event_id.startsWith('$')) {
      throw new AudioProbeError('В новых сообщениях отсутствует идентификатор события.');
    }
    if (event.event_id !== excludedEventId && event.sender === peerUserId &&
        (event.type === 'm.room.encrypted' || event.type === 'm.room.message')) eventIds.push(event.event_id);
  }
  return { cursor: typeof page.end === 'string' ? page.end : cursor, eventIds };
}

export function incomingRemoteAudio(event: EventTimelineItem | undefined, peerUserId: string, origin: EventItemOrigin) {
  if (!event?.isRemote || event.origin !== origin || event.sender !== peerUserId ||
      event.eventOrTransactionId.tag !== 'EventId' || event.content.tag !== 'MsgLike') return;
  const kind = event.content.inner.content.kind;
  if (kind.tag !== 'Message' || kind.inner.content.isEdited || kind.inner.content.msgType.tag !== 'Audio') return;
  return { eventId: event.eventOrTransactionId.inner.eventId, audio: kind.inner.content.msgType.inner.content };
}

export function incomingAudioInfo(audio: AudioMessageContent) {
  const size = audio.info?.size;
  const durationMs = audio.audio?.duration ?? audio.info?.duration;
  const mime = audio.info?.mimetype?.split(';', 1)[0].trim().toLowerCase();
  if (typeof size !== 'bigint' || size < 32n || size > BigInt(INCOMING_AUDIO_MAX_BYTES)) {
    throw new AudioProbeError('Для проверки нужна короткая запись с указанным размером до 2 МБ. Запиши на iPad фразу до 15 секунд.');
  }
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs <= 0 || durationMs > INCOMING_AUDIO_MAX_MS) {
    throw new AudioProbeError('Длительность записи не подходит для проверки. Отправь новое голосовое до 15 секунд.');
  }
  if (mime !== 'audio/ogg' && mime !== 'audio/mp4' && mime !== 'audio/x-m4a') {
    throw new AudioProbeError('Формат этого аудио пока не поддерживается. Запиши голосовое микрофоном в Element X на iPad.');
  }
  return { byteLength: Number(size), durationMs, mimetype: mime === 'audio/ogg' ? 'audio/ogg' : 'audio/mp4',
    extension: mime === 'audio/ogg' ? 'ogg' as const : 'm4a' as const };
}

export function validateIncomingAudioBytes(bytes: Uint8Array, extension: 'ogg' | 'm4a') {
  const ascii = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  const opusOffset = 27 + (bytes[26] ?? 0);
  const valid = extension === 'ogg'
    ? ascii(0, 4) === 'OggS' && bytes[4] === 0 && bytes[26] > 0 && bytes[27] >= 19 &&
      bytes.length >= opusOffset + 19 && ascii(opusOffset, 8) === 'OpusHead'
    : ascii(4, 4) === 'ftyp';
  if (bytes.length < 32 || bytes.length > INCOMING_AUDIO_MAX_BYTES || !valid) {
    throw new AudioProbeError('Расшифрованный файл не соответствует ожидаемой записи OGG/Opus или M4A.');
  }
}

export function isIncomingAudioUri(uri: string, cacheUri: string): boolean {
  try {
    const file = new URL(uri), cache = new URL(cacheUri);
    const root = decodeURIComponent(cache.pathname).replace(/\/+$/, '') + '/matrix-incoming-audio/';
    const path = decodeURIComponent(file.pathname);
    return file.protocol === 'file:' && !file.host && !file.search && !file.hash && path.startsWith(root) &&
      /^ipad-voice-[a-f0-9]{32}\.(ogg|m4a)$/.test(path.slice(root.length));
  } catch { return false; }
}
