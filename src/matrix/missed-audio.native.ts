import type { ClientLike, MediaSourceLike, RoomLike, TimelineEventLike } from '@unomed/react-native-matrix-sdk';
import type { PeerRoom } from './network-types';
import { AudioProbeError } from './audio-probe';
import { missedAudioCandidates, missedAudioContent } from './missed-audio-probe';
import { downloadCheckedIncomingAudio } from './incoming-audio-download.native';
import { discardIncomingAudio } from './incoming-audio-files.native';

function destroy(handle: object | undefined) {
  if (handle && 'uniffiDestroy' in handle && typeof handle.uniffiDestroy === 'function') handle.uniffiDestroy();
}

function pause(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, 2000);
    signal.addEventListener('abort', done, { once: true });
    if (signal.aborted) done();
  });
}

// Caller owns live sync, the room and trust checks. Unlike the saved-key test,
// this operation allows sync to receive keys sent while Tecno was closed.
export async function receiveMissedAudio(client: ClientLike, room: RoomLike, target: PeerRoom, anchor: string,
  readServer: (path: string, signal: AbortSignal) => Promise<unknown>, signal: AbortSignal, onStage: (text: string) => void) {
  const checkActive = () => { if (signal.aborted) throw new AudioProbeError('Поиск пропущенных голосовых отменён. Вход и ключи сохранены.'); };
  checkActive();
  onStage('Ищем голосовое, отправленное после последней полученной записи');
  const candidates = await missedAudioCandidates(anchor, target.peerUserId, readServer, signal);
  // Oldest first: saving this checkpoint must not skip another missed voice.
  for (const eventId of candidates) {
    const result = await readIncomingAudioEvent(client, room, target, eventId, readServer, signal, onStage);
    if (result) return result;
  }
  return null;
}

// Both catch-up and continuous reception decrypt through the same SDK and
// attachment checks, while their caller owns sync and checkpoint persistence.
export async function readIncomingAudioEvent(client: ClientLike, room: RoomLike, target: PeerRoom, eventId: string,
  readServer: (path: string, signal: AbortSignal) => Promise<unknown>, signal: AbortSignal, onStage: (text: string) => void,
  beforeDownload?: () => Promise<void>) {
  const checkActive = () => { if (signal.aborted) throw new AudioProbeError('Приём голосового остановлен. Вход и ключи сохранены.'); };
  checkActive();
  const deadline = Date.now() + 30_000;
  while (true) {
    checkActive();
    let event: TimelineEventLike | undefined, source: MediaSourceLike | undefined, playbackUri: string | undefined;
    let delivered = false;
    let pending = false;
    try {
      event = await room.loadOrFetchEvent(eventId, { signal });
      checkActive();
      const content = missedAudioContent(event, eventId, target.peerUserId);
      pending = content.status === 'pending';
      if (content.status === 'audio') {
        source = content.audio.source;
        await beforeDownload?.();
        checkActive();
        const result = await downloadCheckedIncomingAudio(client, target, eventId, content.audio, readServer, signal, onStage);
        playbackUri = result.playbackUri;
        checkActive();
        delivered = true;
        return result;
      }
    } finally {
      let cleanupFailed = false;
      for (const handle of [source, event]) { try { destroy(handle); } catch { cleanupFailed = true; } }
      if (!delivered || cleanupFailed) discardIncomingAudio(playbackUri);
      if (cleanupFailed) throw new AudioProbeError('SDK не завершил очистку поиска. Перезапусти приложение. Вход и ключи сохранены.');
    }
    if (!pending) return null;
    if (Date.now() >= deadline) throw new AudioProbeError('SDK пока не расшифровал пропущенное сообщение. Оставь Element X на iPad открытым и повтори поиск. Прежняя отметка сохранена.');
    onStage('Сообщение найдено. Ждём ключи от iPad для расшифровки');
    await pause(signal);
  }
}
