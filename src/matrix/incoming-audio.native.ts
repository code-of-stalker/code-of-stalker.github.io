import type { ClientLike, MediaSourceLike, TaskHandleLike, TimelineLike } from '@unomed/react-native-matrix-sdk';
import type { PeerRoom } from './network-types';
import type { IncomingVoiceReport } from './audio-checkpoint';
import { downloadCheckedIncomingAudio } from './incoming-audio-download.native';
import { AudioProbeError } from './audio-probe';
import { incomingAudioBoundary, incomingAudioPage, incomingRemoteAudio } from './incoming-audio-probe';
import { changedTimelineItems } from './remote-echo';
import { discardIncomingAudio } from './incoming-audio-files.native';

function destroy(handle: object | undefined) {
  if (handle && 'uniffiDestroy' in handle && typeof handle.uniffiDestroy === 'function') handle.uniffiDestroy();
}

function delay(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, 2000);
    signal.addEventListener('abort', done, { once: true });
    if (signal.aborted) done();
  });
}

// Caller owns the running native sync, room and trust checks. REST establishes
// which events are new; only the native SDK supplies decrypted audio content.
export async function receiveAndCheckAudio(client: ClientLike, timeline: TimelineLike, target: PeerRoom,
  readServer: (path: string, signal: AbortSignal) => Promise<unknown>, signal: AbortSignal,
  onStage: (text: string) => void): Promise<IncomingVoiceReport> {
  const started = Date.now();
  const sdk = await import('@unomed/react-native-matrix-sdk');
  const checkActive = () => { if (signal.aborted) throw new AudioProbeError('Приём голосового остановлен. Вход и ключи сохранены.'); };
  checkActive();
  onStage('Готовим приём нового голосового с iPad');
  const boundary = incomingAudioBoundary(await readServer('messages?dir=b&limit=1', signal));
  checkActive();
  const eligible = new Set<string>();
  type Candidate = NonNullable<ReturnType<typeof incomingRemoteAudio>>;
  const candidates = new Map<string, Candidate>();
  const sources = new Set<MediaSourceLike>();
  let resolveAudio: (value: Candidate) => void = () => {};
  let rejectAudio: (error: unknown) => void = () => {};
  const received = new Promise<Candidate>((resolve, reject) => { resolveAudio = resolve; rejectAudio = reject; });
  void received.catch(() => {});
  let listener: TaskHandleLike | undefined;
  let polling: Promise<void> | undefined;
  let selected = false, delivered = false;
  let playbackUri: string | undefined;
  const pollController = new AbortController();
  const cancel = () => { pollController.abort(); rejectAudio(new AudioProbeError('Ожидание голосового отменено.')); };
  signal.addEventListener('abort', cancel, { once: true });
  const select = () => {
    if (selected || signal.aborted) return;
    for (const eventId of eligible) {
      const candidate = candidates.get(eventId);
      if (candidate) { selected = true; resolveAudio(candidate); return; }
    }
  };
  async function poll() {
    let cursor = boundary.cursor;
    while (!pollController.signal.aborted && !selected) {
      const page = incomingAudioPage(await readServer(`messages?dir=f&limit=20&from=${encodeURIComponent(cursor)}`, pollController.signal),
        cursor, boundary.excludedEventId, target.peerUserId);
      if (pollController.signal.aborted) return;
      cursor = page.cursor;
      for (const id of page.eventIds) eligible.add(id);
      if (eligible.size > 100) throw new AudioProbeError('Во время проверки пришло слишком много сообщений. Начни приём заново и отправь одно короткое голосовое.');
      select();
      if (!selected) await delay(pollController.signal);
    }
  }
  try {
    checkActive();
    listener = await timeline.addListener({ onUpdate(diffs) {
      if (signal.aborted || selected) return;
      try {
        for (const item of changedTimelineItems(diffs)) {
          const candidate = incomingRemoteAudio(item.asEvent(), target.peerUserId, sdk.EventItemOrigin.Sync);
          if (!candidate) continue;
          const previous = candidates.get(candidate.eventId);
          if (previous && previous.audio.source !== candidate.audio.source) {
            sources.delete(previous.audio.source); destroy(previous.audio.source);
          }
          candidates.set(candidate.eventId, candidate); sources.add(candidate.audio.source);
          if (candidates.size > 100) throw new AudioProbeError('Слишком много аудиосообщений для одного теста. Начни проверку заново.');
        }
        select();
      } catch { rejectAudio(new AudioProbeError('SDK не смог прочитать входящее голосовое.')); }
    } }, { signal });
    checkActive();
    onStage('Ждём новое голосовое с iPad. В Element X запиши фразу до 15 секунд и отправь в нашу комнату');
    checkActive();
    polling = poll().catch((error: unknown) => { if (!selected && !signal.aborted) rejectAudio(error); });
    const { eventId, audio } = await received;
    pollController.abort();
    await polling;
    checkActive();
    const result = await downloadCheckedIncomingAudio(client, target, eventId, audio, readServer, signal, onStage);
    playbackUri = result.playbackUri;
    checkActive();
    delivered = true;
    return { ...result, elapsedMs: Date.now() - started };
  } finally {
    signal.removeEventListener('abort', cancel);
    pollController.abort();
    await polling;
    let cleanupFailed = false;
    try { listener?.cancel(); } catch { cleanupFailed = true; }
    for (const handle of [listener, ...sources]) {
      try { destroy(handle); } catch { cleanupFailed = true; }
    }
    if (!delivered || cleanupFailed) discardIncomingAudio(playbackUri);
    if (cleanupFailed) throw new AudioProbeError('SDK не завершил очистку проверки. Перезапусти приложение перед следующим приёмом. Вход и ключи сохранены.');
  }
}
