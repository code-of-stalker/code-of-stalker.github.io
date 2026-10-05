import { AudioProbeError } from './audio-probe';
import type { GroupRoom } from './network-types';

export function groupParticipants(ownUserId: string, ipadUserId: string, computerValue: string) {
  const computerUserId = computerValue.trim();
  if (computerUserId.length > 255 || !/^@[^\s:\0]+:[^\s\0]+$/.test(computerUserId)) {
    throw new AudioProbeError('Введи полный адрес третьего Matrix-аккаунта на Компьютере, например @имя:matrix.org.');
  }
  if (computerUserId === ownUserId) throw new AudioProbeError('На Компьютере нужен отдельный аккаунт, а не аккаунт Tecno.');
  if (computerUserId === ipadUserId) {
    throw new AudioProbeError('На Компьютере нужен третий отдельный аккаунт, отличный от аккаунта iPad.');
  }
  return { ipadUserId, computerUserId };
}

export function assertGroupMembers(value: unknown, ownUserId: string, room: GroupRoom) {
  if (!value || typeof value !== 'object' || !('chunk' in value) || !Array.isArray(value.chunk)) {
    throw new AudioProbeError('Не удалось проверить участников групповой комнаты. Аудио не отправлено.');
  }
  const expected = new Set([ownUserId, room.ipadUserId, room.computerUserId]);
  if (expected.size !== 3) throw new AudioProbeError('Для теста нужны три отдельных Matrix-аккаунта.');
  const joined = new Set<string>();
  for (const item of value.chunk) {
    if (!item || typeof item !== 'object' || !('type' in item) || item.type !== 'm.room.member' ||
        !('state_key' in item) || typeof item.state_key !== 'string' ||
        !('content' in item) || !item.content || typeof item.content !== 'object' ||
        !('membership' in item.content) || typeof item.content.membership !== 'string') {
      throw new AudioProbeError('Список участников комнаты имеет неожиданный формат. Аудио не отправлено.');
    }
    if (!expected.has(item.state_key)) {
      throw new AudioProbeError(item.content.membership === 'invite'
        ? 'В групповой комнате есть постороннее приглашение. Аудио не отправлено.'
        : 'В групповой комнате указан посторонний аккаунт. Аудио не отправлено.');
    }
    if (item.content.membership === 'join') {
      joined.add(item.state_key);
    }
  }
  if (joined.size !== 3) throw new AudioProbeError('Ожидаем, пока iPad и Компьютер примут приглашения в групповую комнату.');
}
