import type { ClientLike, RoomLike, TimelineEventLike, TimelineLike } from '@unomed/react-native-matrix-sdk';
import type { EncryptedCheckpoint } from './restart-probe';
import { assertCheckpointDigest, checkpointMessageBody } from './restart-probe';
import type { RestartReport } from './network-types';
import { validateServerUrl } from './network-types';
import { inspectEncryptedEvent } from './encrypted-proof';

function destroy(object: object | undefined) {
  if (object && 'uniffiDestroy' in object && typeof object.uniffiDestroy === 'function') object.uniffiDestroy();
}

// Called only for a checkpoint from a previous client. No sync, room creation,
// message send, key import or backup download is started by this reader.
export async function readSavedEncryptedEvent(
  client: ClientLike, checkpoint: EncryptedCheckpoint, senderUserId: string,
  signal: AbortSignal, onStage: (stage: string) => void, flush: () => Promise<void>,
): Promise<RestartReport> {
  if (signal.aborted) throw new Error('Aborted');
  const deviceId = client.session().deviceId;
  if (deviceId !== checkpoint.deviceId) throw new Error('Устройство Matrix изменилось. Проверка сохранённых ключей не пройдена.');
  const started = Date.now();
  let room: RoomLike | undefined;
  let event: TimelineEventLike | undefined;
  let cacheTimeline: TimelineLike | undefined;
  try {
    onStage('Открываем сохранённую зашифрованную тестовую комнату');
    room = client.getRoom(checkpoint.roomId);
    if (!room) throw new Error('SDK не нашёл сохранённую тестовую комнату. Проверка сохранения ключей не завершена.');
    onStage('Проверяем прежнее зашифрованное событие на сервере');
    const auth = client.session();
    const response = await fetch(
      `${validateServerUrl(auth.homeserverUrl)}/_matrix/client/v3/rooms/${encodeURIComponent(checkpoint.roomId)}/event/${encodeURIComponent(checkpoint.eventId)}`,
      { headers: { Authorization: `Bearer ${auth.accessToken}` }, signal },
    );
    if (!response.ok) throw new Error(`Не удалось прочитать прежнее событие на сервере (HTTP ${response.status}). Проверка не завершена.`);
    const wireEvent: unknown = await response.json();
    if (signal.aborted) throw new Error('Aborted');
    const identity = { roomId: checkpoint.roomId, eventId: checkpoint.eventId, sender: senderUserId };
    inspectEncryptedEvent(wireEvent, identity);
    // Subscribe the restored client's event cache, then clear only this test
    // room's events. With sync stopped, cached plaintext cannot repopulate it.
    cacheTimeline = await room.timeline({ signal });
    onStage('Загружаем прежнее сообщение заново и расшифровываем сохранёнными ключами');
    await room.clearEventCacheStorage({ signal });
    if (signal.aborted) throw new Error('Aborted');
    event = await room.loadOrFetchEvent(checkpoint.eventId, { signal });
    if (signal.aborted) throw new Error('Aborted');
    const body = checkpointMessageBody(event, checkpoint, senderUserId, deviceId);
    const crypto = await import('expo-crypto');
    const digest = await crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256, body);
    if (signal.aborted) throw new Error('Aborted');
    assertCheckpointDigest(digest, checkpoint);
    const encryption = inspectEncryptedEvent(wireEvent, { ...identity, body });
    await flush();
    if (signal.aborted) throw new Error('Aborted');
    return { roomId: checkpoint.roomId, eventId: checkpoint.eventId, deviceId, body, encryption, elapsedMs: Date.now() - started };
  } finally {
    destroy(event); destroy(cacheTimeline); destroy(room);
  }
}
