import type { ClientLike, MediaSourceLike, RoomLike, TimelineEventLike, TimelineLike } from '@unomed/react-native-matrix-sdk';
import type { AudioCheckpoint } from './audio-checkpoint';
import { checkpointAudio } from './audio-checkpoint';
import { AudioProbeError } from './audio-probe';
import { downloadCheckedIncomingAudio } from './incoming-audio-download.native';
import { discardIncomingAudio } from './incoming-audio-files.native';

// No sync or key import: fetch the exact event again, using the existing crypto
// store. Clear only room event cache so cached plaintext cannot prove success.
export async function readSavedAudio(client: ClientLike, checkpoint: AudioCheckpoint,
  readServer: (path: string, signal: AbortSignal) => Promise<unknown>, signal: AbortSignal,
  onStage: (text: string) => void, flush: () => Promise<void>) {
  const checkActive = () => { if (signal.aborted) throw new AudioProbeError('Чтение прежнего голосового отменено. Вход и ключи сохранены.'); };
  checkActive();
  if (client.session().deviceId !== checkpoint.deviceId) throw new AudioProbeError('Устройство Matrix изменилось. Сохранение ключей не подтверждено.');
  let room: RoomLike | undefined, timeline: TimelineLike | undefined, event: TimelineEventLike | undefined;
  let source: MediaSourceLike | undefined, playbackUri: string | undefined;
  let delivered = false;
  try {
    onStage(checkpoint.senderUserId === client.userId() ? 'Открываем твою отправленную запись' : 'Открываем прежнее голосовое с iPad');
    room = client.getRoom(checkpoint.roomId);
    if (!room) throw new AudioProbeError('SDK не нашёл сохранённую комнату с iPad.');
    timeline = await room.timeline({ signal });
    checkActive();
    await room.clearEventCacheStorage({ signal });
    checkActive();
    onStage('Загружаем прежнее сообщение и расшифровываем сохранёнными ключами');
    event = await room.loadOrFetchEvent(checkpoint.eventId, { signal });
    checkActive();
    const audio = checkpointAudio(event, checkpoint);
    source = audio.source;
    const result = await downloadCheckedIncomingAudio(client,
      { roomId: checkpoint.roomId, peerUserId: checkpoint.senderUserId }, checkpoint.eventId, audio, readServer, signal, onStage, checkpoint);
    playbackUri = result.playbackUri;
    await flush();
    checkActive();
    delivered = true;
    return result;
  } finally {
    let cleanupFailed = false;
    for (const handle of [source, event, timeline, room]) {
      try {
        if (handle && 'uniffiDestroy' in handle && typeof handle.uniffiDestroy === 'function') handle.uniffiDestroy();
      } catch { cleanupFailed = true; }
    }
    if (!delivered || cleanupFailed) discardIncomingAudio(playbackUri);
    if (cleanupFailed) throw new AudioProbeError('SDK не завершил очистку чтения. Перезапусти приложение. Вход и ключи сохранены.');
  }
}
