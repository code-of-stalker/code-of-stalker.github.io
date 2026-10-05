import type { AudioMessageContent, ClientLike, MediaSourceLike } from '@unomed/react-native-matrix-sdk';
import type { PeerRoom } from './network-types';
import type { VoiceProbeReport } from './voice-types';
import type { AudioCheckpoint, IncomingVoiceReport } from './audio-checkpoint';
import { AudioProbeError, equalBytes, inspectEncryptedAudioSource } from './audio-probe';
import { incomingAudioInfo } from './incoming-audio-probe';
import { inspectEncryptedEvent } from './encrypted-proof';
import { discardIncomingAudio, retainIncomingAudio } from './incoming-audio-files.native';

function destroy(handle: object | undefined) {
  if (handle && 'uniffiDestroy' in handle && typeof handle.uniffiDestroy === 'function') handle.uniffiDestroy();
}

// Owns downloads and temporary files. The caller owns audio.source.
export async function downloadCheckedIncomingAudio(client: ClientLike, target: PeerRoom, eventId: string, audio: AudioMessageContent,
  readServer: (path: string, signal: AbortSignal) => Promise<unknown>, signal: AbortSignal,
  onStage: (text: string) => void, expected?: AudioCheckpoint): Promise<IncomingVoiceReport> {
  const started = Date.now();
  const sdk = await import('@unomed/react-native-matrix-sdk');
  const crypto = await import('expo-crypto');
  const { File, Paths } = await import('expo-file-system');
  const checkActive = () => { if (signal.aborted) throw new AudioProbeError('Чтение голосового остановлено. Вход и ключи сохранены.'); };
  let rawSource: MediaSourceLike | undefined;
  let playbackUri: string | undefined;
  let delivered = false;
  try {
    checkActive();
    const info = incomingAudioInfo(audio);
    const own = target.peerUserId === client.userId();
    onStage(own ? 'Твоя запись загружена. Проверяем шифрование сообщения и файла' : 'Голосовое с iPad получено. Проверяем шифрование сообщения и файла');
    let encryption: VoiceProbeReport['encryption'];
    try { encryption = inspectEncryptedEvent(await readServer(`event/${encodeURIComponent(eventId)}`, signal),
      { roomId: target.roomId, eventId, sender: target.peerUserId }); }
    catch { throw new AudioProbeError('Сервер не подтвердил шифрование входящего аудиосообщения.'); }
    checkActive();
    const descriptor = inspectEncryptedAudioSource(audio.source.toJson());
    if (descriptor.url !== audio.source.url()) throw new AudioProbeError('Адрес входящего файла не совпал с описанием шифрования.');
    const nonce = Array.from(await crypto.getRandomBytesAsync(16), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const filename = `ipad-voice-${nonce}.${info.extension}`;
    const readMedia = async (source: MediaSourceLike, mime: string) => {
      checkActive();
      // A locally generated filename selects Rust's writable tempDir branch.
      // Never use a filename supplied by the other client as a local path.
      const handle = await client.getMediaFile(source, filename, mime, false,
        decodeURIComponent(Paths.cache.uri.replace(/^file:\/\//, '')), { signal });
      try {
        checkActive();
        const path = handle.path();
        const file = new File(`file://${path.split('/').map(encodeURIComponent).join('/')}`);
        if (!file.exists || file.size !== info.byteLength) throw new AudioProbeError('Размер записи с сервера не совпал с описанием.');
        const bytes = await file.bytes();
        checkActive();
        if (bytes.length !== info.byteLength) throw new AudioProbeError('Запись скачана не полностью.');
        return bytes;
      } finally { destroy(handle); }
    };
    rawSource = sdk.MediaSource.fromUrl(descriptor.url);
    onStage('Скачиваем запись и проверяем контрольную сумму зашифрованного файла');
    const ciphertext = await readMedia(rawSource, 'application/octet-stream');
    const hash = new Uint8Array(await crypto.digest(crypto.CryptoDigestAlgorithm.SHA256, ciphertext));
    checkActive();
    if (!equalBytes(hash, descriptor.ciphertextSha256)) throw new AudioProbeError('Контрольная сумма входящего файла не совпала.');
    onStage(own ? 'Нативный SDK расшифровывает твою запись' : 'Нативный SDK расшифровывает голосовое с iPad');
    const plaintext = await readMedia(audio.source, info.mimetype);
    if (equalBytes(plaintext, ciphertext)) throw new AudioProbeError('SDK не подтвердил расшифровку вложения.');
    checkActive();
    const audioSha256 = Array.from(new Uint8Array(await crypto.digest(crypto.CryptoDigestAlgorithm.SHA256, plaintext)),
      (byte) => byte.toString(16).padStart(2, '0')).join('');
    checkActive();
    if (expected && (expected.audioSha256 !== audioSha256 || expected.byteLength !== plaintext.length || expected.durationMs !== info.durationMs)) {
      throw new AudioProbeError('Прежняя запись не совпала с сохранённой контрольной суммой или длительностью.');
    }
    playbackUri = retainIncomingAudio(plaintext, filename, info.extension);
    checkActive();
    delivered = true;
    return { ...target, eventId, filename, durationMs: info.durationMs, byteLength: plaintext.length,
      encryption, playbackUri, audioSha256, elapsedMs: Date.now() - started };
  } finally {
    try { destroy(rawSource); }
    catch { delivered = false; throw new AudioProbeError('SDK не завершил очистку загрузки голосового.'); }
    finally { if (!delivered) discardIncomingAudio(playbackUri); }
  }
}
