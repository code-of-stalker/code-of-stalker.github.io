import { AudioProbeError } from './audio-probe';
import { assertDiaryOwnerOnly } from './diary-access';
import { assertMegolmRoomState } from './encrypted-proof';

const diaryRoomName = 'Watcher · личный тестовый дневник';
const roomIdPattern = /^![^\s\0]{1,254}$/;

type ReadServer = (path: string, signal: AbortSignal) => Promise<unknown>;

// Reconstruct the diary locator from server-side room state. No room or event
// identifier from the old Android installation is needed on the new device.
export async function discoverDiaryRoom(read: ReadServer, ownerUserId: string, signal: AbortSignal,
  onStage: (stage: string) => void): Promise<string> {
  const joined = await read('joined_rooms', signal);
  if (!joined || typeof joined !== 'object' || !('joined_rooms' in joined) ||
      !Array.isArray(joined.joined_rooms) || joined.joined_rooms.length > 100 ||
      joined.joined_rooms.some(id => typeof id !== 'string' || !roomIdPattern.test(id)) ||
      new Set(joined.joined_rooms).size !== joined.joined_rooms.length) {
    throw new AudioProbeError('Сервер вернул некорректный список комнат. Поиск дневника остановлен.');
  }
  let found: string | undefined;
  for (const roomId of joined.joined_rooms as string[]) {
    if (signal.aborted) throw new AudioProbeError('Поиск дневника остановлен.');
    onStage('Ищем личный дневник среди комнат аккаунта');
    const state = await read(`rooms/${encodeURIComponent(roomId)}/state`, signal);
    if (!Array.isArray(state)) throw new AudioProbeError('Сервер вернул некорректное состояние комнаты.');
    const events = state as unknown[];
    const named = events.filter(item => item && typeof item === 'object' &&
      'type' in item && item.type === 'm.room.name' && 'state_key' in item && item.state_key === '');
    if (named.length !== 1) continue;
    const name = named[0];
    if (!name || typeof name !== 'object' || !('content' in name) || !name.content ||
        typeof name.content !== 'object' || !('name' in name.content) || name.content.name !== diaryRoomName) continue;
    const encryption = events.filter(item => item && typeof item === 'object' &&
      'type' in item && item.type === 'm.room.encryption' && 'state_key' in item && item.state_key === '');
    if (encryption.length !== 1 || !encryption[0] || typeof encryption[0] !== 'object' ||
        !('content' in encryption[0])) throw new AudioProbeError('Личный дневник больше не подтверждён как зашифрованная комната.');
    assertMegolmRoomState(encryption[0].content);
    assertDiaryOwnerOnly({ chunk: events.filter(item => item && typeof item === 'object' &&
      'type' in item && item.type === 'm.room.member') }, ownerUserId);
    if (found) throw new AudioProbeError('Найдено несколько личных дневников. Автоматический выбор остановлен.');
    found = roomId;
  }
  if (!found) throw new AudioProbeError('На сервере не найден личный тестовый дневник этого аккаунта.');
  return found;
}
