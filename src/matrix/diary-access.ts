import { AudioProbeError } from './audio-probe';
import type { AudioCheckpoint } from './audio-checkpoint';

// A private diary room is never an invitation target. Any unexpected member
// state, including a former member, invalidates this small access probe.
export function assertDiaryOwnerOnly(value: unknown, ownerUserId: string): void {
  if (!value || typeof value !== 'object' || !('chunk' in value) || !Array.isArray(value.chunk)) {
    throw new AudioProbeError('Не удалось проверить участников личного дневника. Запись не отправлена.');
  }
  const members = value.chunk as unknown[];
  if (members.length !== 1 || members.some(item => !item || typeof item !== 'object' ||
      !('type' in item) || item.type !== 'm.room.member' || !('state_key' in item) || item.state_key !== ownerUserId ||
      !('content' in item) || !item.content || typeof item.content !== 'object' ||
      !('membership' in item.content) || item.content.membership !== 'join')) {
    throw new AudioProbeError('У личного дневника есть посторонний участник или приглашение. Передача записи остановлена.');
  }
}

export function selectDiaryRecord(history: readonly AudioCheckpoint[], roomId: string, ownerUserId: string, eventId: string): AudioCheckpoint {
  const record = history.find(item => item.eventId === eventId);
  if (!record || record.roomId !== roomId || record.senderUserId !== ownerUserId) {
    throw new AudioProbeError('Эта запись не принадлежит личному дневнику. Передача остановлена.');
  }
  return { ...record };
}
