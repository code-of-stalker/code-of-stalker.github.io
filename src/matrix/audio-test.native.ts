import type { ClientLike, MediaSourceLike, SendAttachmentJoinHandleLike, TaskHandleLike, TimelineLike } from '@unomed/react-native-matrix-sdk';
import type { PeerRoom } from './network-types';
import { AudioProbeError, equalBytes, inspectEncryptedAudioSource, makeTestAudio, matchingRemoteAudio } from './audio-probe';
import type { AudioProbeReport } from './audio-probe';
import { changedTimelineItems } from './remote-echo';
import { inspectEncryptedEvent } from './encrypted-proof';
import type { PreparedVoice, VoiceBeforeUpload } from './voice-types';

function destroy(handle: object | undefined) {
  if (handle && 'uniffiDestroy' in handle && typeof handle.uniffiDestroy === 'function') handle.uniffiDestroy();
}

// The caller owns room membership/encryption checks and the running sync.
export async function sendAndCheckAudio(client: ClientLike, timeline: TimelineLike, target: PeerRoom,
  readServerEvent: (eventId: string) => Promise<unknown>, signal: AbortSignal, onStage: (text: string) => void,
  voice?: PreparedVoice, beforeUpload?: VoiceBeforeUpload): Promise<AudioProbeReport> {
  const started = Date.now();
  const sdk = await import('@unomed/react-native-matrix-sdk');
  const crypto = await import('expo-crypto');
  const { File, Paths } = await import('expo-file-system');
  const checkActive = () => { if (signal.aborted) throw new AudioProbeError('Проверка аудиофайла остановлена. Файл мог уже отправиться; посмотри комнату на iPad.'); };
  checkActive();
  const nonce = Array.from(await crypto.getRandomBytesAsync(16), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const test = voice ?? makeTestAudio(nonce);
  const ownUserId = client.userId();
  let resolveEcho: (value: NonNullable<ReturnType<typeof matchingRemoteAudio>>) => void = () => {};
  let rejectEcho: (error: Error) => void = () => {};
  const remoteEcho = new Promise<NonNullable<ReturnType<typeof matchingRemoteAudio>>>((resolve, reject) => { resolveEcho = resolve; rejectEcho = reject; });
  void remoteEcho.catch(() => {});
  let listener: TaskHandleLike | undefined, upload: SendAttachmentJoinHandleLike | undefined;
  let queueListener: TaskHandleLike | undefined;
  let selectedSource: MediaSourceLike | undefined, rawSource: MediaSourceLike | undefined;
  let observerFailure: Error | undefined;
  let finished = false;
  let playbackUri: string | undefined;
  const cancel = () => {
    rejectEcho(new AudioProbeError('Проверка аудиофайла остановлена.'));
    // This aborts enqueueing only. Already queued/sent events cannot be recalled
    // by SendAttachmentJoinHandle.cancel(), so the UI never promises that.
    try { upload?.cancel(); } catch { /* Cleanup failure must not escape an abort event handler. */ }
  };
  signal.addEventListener('abort', cancel, { once: true });
  const readMedia = async (source: MediaSourceLike, mime: string): Promise<Uint8Array<ArrayBuffer>> => {
    checkActive();
    const tempDir = decodeURIComponent(Paths.cache.uri.replace(/^file:\/\//, ''));
    // useCache=false forces a server download even for our own just-sent file.
    // Rust 0.18.0 ignores tempDir when filename is None. A trusted filename
    // with an extension selects its TempDir::new_in(cache) branch on Android.
    const handle = await client.getMediaFile(source, test.filename, mime, false, tempDir, { signal });
    try {
      checkActive();
      const path = handle.path();
      const file = new File(`file://${path.split('/').map(encodeURIComponent).join('/')}`);
      if (!file.exists || file.size !== test.bytes.length) throw new AudioProbeError('Размер файла с сервера отличается от тестового. Проверка не пройдена.');
      const bytes = await file.bytes();
      checkActive();
      if (bytes.length !== test.bytes.length) throw new AudioProbeError('Прочитан неполный тестовый файл.');
      return bytes;
    } finally { destroy(handle); } // Native MediaFileHandle removes its temporary file on drop.
  };
  try {
    checkActive();
    queueListener = client.subscribeToSendQueueStatus({
      onError(roomId) {
        if (roomId !== target.roomId || signal.aborted || selectedSource) return;
        observerFailure = new AudioProbeError('SDK остановил очередь отправки этой комнаты. Аудиофайл не подтверждён. Проверь связь; сначала посмотри, появился ли файл на iPad.');
        rejectEcho(observerFailure);
      },
    });
    listener = await timeline.addListener({
      onUpdate(diffs) {
        if (signal.aborted || selectedSource) return;
        try {
          for (const item of changedTimelineItems(diffs)) {
            const found = matchingRemoteAudio(item.asEvent(), test.filename, ownUserId, sdk.EventItemOrigin.Sync);
            if (found) { selectedSource = found.audio.source; resolveEcho(found); break; }
          }
        } catch {
          observerFailure = new AudioProbeError('SDK не смог прочитать аудиосообщение с сервера.');
          rejectEcho(observerFailure);
        }
      },
    }, { signal });
    checkActive();
    const params = { source: new sdk.UploadSource.Data({ bytes: test.bytes.buffer, filename: test.filename }) };
    const info = { mimetype: test.mimetype, size: BigInt(test.bytes.length), duration: test.durationMs };
    // Room/trust/sync/listener setup can take time or be interrupted by Reload.
    // Persist the uncertain-send marker only here, before the first audio write.
    if (voice && !beforeUpload) throw new AudioProbeError('Обнови экран через Reload перед отправкой голоса. Черновик не отправлен.');
    onStage(voice ? 'Подготавливаем передачу голоса SDK. Отправка записи ещё не началась' : 'SDK шифрует и загружает тестовый звук: два коротких сигнала');
    checkActive();
    if (beforeUpload) await beforeUpload(signal);
    checkActive();
    // Element X iOS routes the voice marker to an OGG-only loader. Our recorder
    // produces AAC/M4A, so send it as ordinary m.audio for the general player.
    // Keep the real audio/mp4 MIME; relabelling these bytes as OGG would be invalid.
    upload = timeline.sendAudio(params, info);
    if (voice) onStage('Запись передана SDK. Ждём загрузки и сообщения с сервера');
    await upload.join({ signal });
    checkActive();
    onStage('Ждём аудиосообщение с сервера. Загрузка в очередь ещё не означает доставку');
    const { eventId, audio } = await remoteEcho;
    checkActive();
    if (observerFailure) throw observerFailure;
    if (audio.info?.size !== BigInt(test.bytes.length) || audio.info.mimetype !== test.mimetype || audio.info.duration !== test.durationMs) {
      throw new AudioProbeError('Полученное аудиосообщение не соответствует параметрам теста.');
    }
    if (voice && audio.voice != null) {
      throw new AudioProbeError('Запись M4A ошибочно помечена как специальное голосовое. Element X на iPad не сможет открыть её этим плеером.');
    }
    onStage('Проверяем шифрование сообщения и вложенного файла');
    let encryption: AudioProbeReport['encryption'];
    try { encryption = inspectEncryptedEvent(await readServerEvent(eventId), { roomId: target.roomId, eventId, sender: ownUserId, body: test.filename }); }
    catch { throw new AudioProbeError('Сервер не подтвердил зашифрованное событие тестового аудиофайла.'); }
    const descriptor = inspectEncryptedAudioSource(audio.source.toJson());
    if (audio.source.url() !== descriptor.url) throw new AudioProbeError('Адрес файла не совпал с описанием шифрования.');
    rawSource = sdk.MediaSource.fromUrl(descriptor.url);
    onStage('Скачиваем файл с сервера и проверяем контрольную сумму шифротекста');
    const ciphertext = await readMedia(rawSource, 'application/octet-stream');
    const cipherHash = new Uint8Array(await crypto.digest(crypto.CryptoDigestAlgorithm.SHA256, ciphertext));
    if (!equalBytes(cipherHash, descriptor.ciphertextSha256) || equalBytes(ciphertext, test.bytes)) {
      throw new AudioProbeError('Файл с сервера не прошёл проверку шифротекста.');
    }
    onStage('SDK заново скачивает и расшифровывает звук. Сравниваем все байты с исходным файлом');
    const plaintext = await readMedia(audio.source, test.mimetype);
    if (!equalBytes(plaintext, test.bytes)) throw new AudioProbeError('Расшифрованный звук отличается от исходного тестового файла.');
    checkActive();
    if (voice) {
      const { retainVerifiedVoice } = await import('./voice-files.native');
      checkActive();
      playbackUri = retainVerifiedVoice(plaintext, test.filename);
    }
    checkActive();
    finished = true;
    return { ...target, eventId, filename: test.filename, byteLength: plaintext.length, durationMs: test.durationMs, encryption, elapsedMs: Date.now() - started,
      ...(playbackUri ? { playbackUri } : {}) };
  } finally {
    if (!finished && playbackUri) (await import('./voice-files.native')).discardVoiceFile(playbackUri);
    signal.removeEventListener('abort', cancel);
    try { if (!finished) upload?.cancel(); }
    finally {
      try { listener?.cancel(); }
      finally {
        try { queueListener?.cancel(); }
        finally { destroy(listener); destroy(queueListener); destroy(upload); destroy(rawSource); destroy(selectedSource); }
      }
    }
  }
}
