import type { AudioMessageContent, TimelineEventLike } from '@unomed/react-native-matrix-sdk';
import { AudioProbeError } from './audio-probe';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AudioProbeError('Сервер вернул неожиданный список сообщений.');
  return value as Record<string, unknown>;
}

// Walk backwards to an already received event. Never substitute timestamps or
// the first available page for the anchor; that would replay old audio as new.
export async function missedAudioCandidates(anchor: string, peer: string,
  readServer: (path: string, signal: AbortSignal) => Promise<unknown>, signal: AbortSignal): Promise<string[]> {
  let cursor: string | undefined;
  const cursors = new Set<string>(), seen = new Set<string>(), candidates: string[] = [];
  for (let pageNumber = 0; pageNumber < 5; pageNumber++) {
    if (signal.aborted) throw new AudioProbeError('Поиск пропущенных голосовых отменён.');
    const page = record(await readServer(`messages?dir=b&limit=20${cursor ? `&from=${encodeURIComponent(cursor)}` : ''}`, signal));
    if (signal.aborted) throw new AudioProbeError('Поиск пропущенных голосовых отменён.');
    if (!Array.isArray(page.chunk) || page.chunk.length > 20 || (cursor !== undefined && page.start !== cursor) ||
        (page.end !== undefined && (typeof page.end !== 'string' || !page.end))) {
      throw new AudioProbeError('Сервер не подтвердил порядок пропущенных сообщений.');
    }
    for (const value of page.chunk) {
      const item = record(value);
      if (typeof item.event_id !== 'string' || !/^\$[^\s\0]{1,254}$/.test(item.event_id)) {
        throw new AudioProbeError('В списке сообщений отсутствует корректный идентификатор.');
      }
      if (item.event_id === anchor) return candidates.reverse();
      if (seen.has(item.event_id)) throw new AudioProbeError('Сервер повторил сообщения при поиске. Попробуй ещё раз.');
      seen.add(item.event_id);
      if (item.sender === peer && (item.type === 'm.room.encrypted' || item.type === 'm.room.message')) candidates.push(item.event_id);
    }
    if (typeof page.end !== 'string' || page.end === cursor || cursors.has(page.end)) break;
    cursor = page.end; cursors.add(cursor);
  }
  throw new AudioProbeError('Не удалось найти прежнюю отметку среди последних 100 событий. Сначала получи новое голосовое обычной кнопкой, затем повтори проверку с закрытым Tecno.');
}

export function missedAudioContent(event: TimelineEventLike, eventId: string, peer: string):
  { status: 'pending' | 'skip' } | { status: 'audio'; audio: AudioMessageContent } {
  if (event.eventId() !== eventId || event.senderId() !== peer) throw new AudioProbeError('SDK вернул другое сообщение или отправителя.');
  let content: ReturnType<TimelineEventLike['content']>;
  try { content = event.content(); } catch { return { status: 'pending' }; }
  if (content.tag !== 'MessageLike') return { status: 'skip' };
  if (content.inner.content.tag === 'RoomEncrypted') return { status: 'pending' };
  if (content.inner.content.tag !== 'RoomMessage') return { status: 'skip' };
  const message = content.inner.content.inner.messageType;
  return message.tag === 'Audio' ? { status: 'audio', audio: message.inner.content } : { status: 'skip' };
}
