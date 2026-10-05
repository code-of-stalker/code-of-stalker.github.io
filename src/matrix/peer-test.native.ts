import type { AudioCheckpoint, IncomingVoiceReport } from './audio-checkpoint';
import { appendAudioHistory, SessionPersistenceError } from './saved-session';
import type { ClientLike, RoomLike, SyncServiceLike, TaskHandleLike } from '@unomed/react-native-matrix-sdk';
import type { PeerExchangeReport, PeerRoom, PeerRestartProbe, PeerRestartReport } from './network-types';
import { validateServerUrl } from './network-types';
import type { SessionVault } from './session-storage.native';
import { assertTwoJoinedUsers, peerChallenge, validatePeerUserId } from './peer-probe';
import { changedTimelineItems, matchingRemoteEvent } from './remote-echo';
import { assertMegolmRoomState, inspectEncryptedEvent } from './encrypted-proof';
import { waitForEncryptionState } from './encryption-readiness';
import type { PeerReplyCheckpoint } from './restart-probe';
import { readSavedEncryptedEvent } from './read-checkpoint.native';
import { AudioProbeError, audioProbeErrorText } from './audio-probe';
import type { AudioProbeReport } from './audio-probe';
import type { VoiceBeforeUpload, VoiceDraft } from './voice-types';
import { incomingAudioBoundary, incomingAudioPage, incomingAudioErrorText } from './incoming-audio-probe';
import { missedAudioCandidates } from './missed-audio-probe';
import { ReceiverCleanupError } from './automatic-voice-receiver';
import { readMatrixJson } from './matrix-read';
import type { VoicePlaybackCacheLike } from './voice-playback-cache';

function destroy(object: object) {
  if ('uniffiDestroy' in object && typeof object.uniffiDestroy === 'function') object.uniffiDestroy();
}

type PeerContext = { sync: SyncServiceLike; signal: AbortSignal; keep: <T extends object>(object: T) => T };

// Uses the existing saved client and crypto store, never a second account's
// tokens or a second SQLite client. The other participant runs Element X.
export class NativePeerTest {
  private audioHistory: AudioCheckpoint[];
  private ownAudioHistory: AudioCheckpoint[];
  private audioCheckpoint: AudioCheckpoint | null;
  private audioFromPreviousClient: boolean;
  // Keep the first live cursor across pauses even before the first voice is
  // saved. Once a checkpoint exists, catch-up covers restarts and reconnects.
  private audioCursor: (PeerRoom & { cursor: string; excludedEventId: string }) | null = null;
  private currentRoom: PeerRoom | null;
  private replyCheckpoint: PeerReplyCheckpoint | null;
  private replyFromPreviousClient: boolean;
  constructor(private client: ClientLike, private nativeSync: boolean, private vault: SessionVault,
    saved: PeerRoom | null, savedReply: PeerReplyCheckpoint | null = null, savedAudio: AudioCheckpoint | null = null,
    savedHistory: readonly AudioCheckpoint[] = [], savedOwnHistory: readonly AudioCheckpoint[] = [],
    private playbackCache?: VoicePlaybackCacheLike) {
    this.audioHistory = savedAudio ? appendAudioHistory(savedHistory, savedAudio) : savedHistory.map((item) => ({ ...item }));
    this.ownAudioHistory = savedOwnHistory.map(item => ({ ...item }));
    this.audioCheckpoint = savedAudio ? { ...savedAudio } : null;
    this.audioFromPreviousClient = savedAudio !== null;
    this.currentRoom = saved ? { ...saved } : null;
    this.replyCheckpoint = savedReply ? { ...savedReply } : null;
    this.replyFromPreviousClient = savedReply !== null;
  }

  get room(): PeerRoom | null { return this.currentRoom ? { ...this.currentRoom } : null; }

  get audioRecords() {
    return this.audioHistory.map(({ eventId, createdAt, durationMs }) => ({ eventId, receivedAt: createdAt, durationMs }));
  }

  get ownAudioRecords() {
    return this.ownAudioHistory.map(({ eventId, createdAt, durationMs }) => ({ eventId, receivedAt: createdAt, durationMs }));
  }

  private savedAudioContext(eventId: string) {
    const own = this.ownAudioHistory.find(item => item.eventId === eventId);
    const incoming = this.audioHistory.find(item => item.eventId === eventId);
    if (own && incoming) throw new AudioProbeError('Сохранённые данные отправителя не совпали.');
    const checkpoint = own ?? incoming;
    if (!checkpoint) throw new AudioProbeError('Этой записи больше нет в списке последних голосовых.');
    const target = this.currentRoom;
    if (!target || checkpoint.roomId !== target.roomId ||
        checkpoint.senderUserId !== (own ? this.client.userId() : target.peerUserId)) throw new AudioProbeError('Комната или аккаунт отправителя изменились.');
    const session = this.client.session();
    if (session.deviceId !== checkpoint.deviceId) throw new AudioProbeError('Устройство Matrix изменилось. Сохранённая запись не открыта.');
    const context = { userId: this.client.userId(), serverUrl: session.homeserverUrl, deviceId: session.deviceId, ...target };
    return { checkpoint, context, target };
  }

  async readCachedAudio(eventId: string, signal: AbortSignal, onStage: (text: string) => void) {
    const { checkpoint, context } = this.savedAudioContext(eventId);
    if (signal.aborted) throw new AudioProbeError('Открытие записи отменено.');
    let playbackUri: string | undefined, delivered = false;
    try {
      onStage('Проверяем сохранённую копию на Tecno');
      const cache = this.playbackCache ?? (await import('./voice-playback-storage.native')).voicePlaybackStorage;
      const local = await cache.get(context, checkpoint, signal);
      playbackUri = local?.playbackUri;
      if (signal.aborted) throw new AudioProbeError('Открытие записи отменено.');
      if (local) onStage('Открыта сохранённая копия с Tecno · интернет не нужен');
      delivered = true; return local;
    } catch {
      if (signal.aborted) throw new AudioProbeError('Открытие записи отменено.');
      return null;
    } finally {
      if (!delivered && playbackUri) (await import('./incoming-audio-files.native')).discardIncomingAudio(playbackUri);
    }
  }

  async readAudio(eventId: string, signal: AbortSignal, onStage: (text: string) => void) {
    const { checkpoint, context, target } = this.savedAudioContext(eventId);
    const checkActive = () => { if (signal.aborted) throw new AudioProbeError('Открытие записи отменено.'); };
    let cache: VoicePlaybackCacheLike | undefined, playbackUri: string | undefined, delivered = false;
    try {
      checkActive();
      const local = await this.readCachedAudio(eventId, signal, onStage);
      if (local) { playbackUri = local.playbackUri; checkActive(); delivered = true; return local; }
      try { cache = this.playbackCache ?? (await import('./voice-playback-storage.native')).voicePlaybackStorage; }
      catch { checkActive(); }
      checkActive();
      const { readSavedAudio } = await import('./read-audio-checkpoint.native');
      const result = await readSavedAudio(this.client, checkpoint,
        (path, activeSignal) => this.serverJson(checkpoint.roomId, path, activeSignal), signal, onStage, () => this.vault.flush());
      playbackUri = result.playbackUri;
      let offlineCopy: 'saved' | 'unavailable' = 'unavailable';
      if (cache) {
        try {
          onStage('Сохраняем зашифрованную копию для прослушивания без интернета');
          await cache.save(context, checkpoint, result.encryption, result.playbackUri,
            [...this.audioHistory, ...this.ownAudioHistory].map(item => item.eventId), signal);
          offlineCopy = 'saved';
        } catch { checkActive(); /* The verified server audio is still playable. */ }
      }
      checkActive(); delivered = true;
      return { ...result, ...target, playbackSource: 'server' as const, offlineCopy };
    } catch (error) { throw new AudioProbeError(incomingAudioErrorText(error)); }
    finally {
      if (!delivered && playbackUri) (await import('./incoming-audio-files.native')).discardIncomingAudio(playbackUri);
    }
  }

  get restartProbe(): PeerRestartProbe | null {
    if (!this.replyCheckpoint) return null;
    const { roomId, eventId, deviceId, senderUserId, createdAt } = this.replyCheckpoint;
    return { roomId, eventId, deviceId, senderUserId, createdAt, requiresRestart: !this.replyFromPreviousClient };
  }

  get audioRestartProbe(): PeerRestartProbe | null {
    if (!this.audioCheckpoint) return null;
    const { roomId, eventId, deviceId, senderUserId, createdAt } = this.audioCheckpoint;
    return { roomId, eventId, deviceId, senderUserId, createdAt, requiresRestart: !this.audioFromPreviousClient };
  }

  async readAudioAfterRestart(signal: AbortSignal, onStage: (text: string) => void) {
    const checkpoint = this.audioCheckpoint;
    if (!checkpoint) throw new AudioProbeError('Сначала получи новое голосовое с iPad, чтобы запомнить его.');
    if (!this.audioFromPreviousClient) throw new AudioProbeError('Полностью останови приложение на Tecno и открой снова.');
    if (checkpoint.roomId !== this.currentRoom?.roomId || checkpoint.senderUserId !== this.currentRoom.peerUserId ||
        checkpoint.senderUserId === this.client.userId()) throw new AudioProbeError('Комната или аккаунт iPad изменились.');
    try {
      const { readSavedAudio } = await import('./read-audio-checkpoint.native');
      return await readSavedAudio(this.client, checkpoint,
        (path, activeSignal) => this.serverJson(checkpoint.roomId, path, activeSignal), signal, onStage, () => this.vault.flush());
    } catch (error) { throw new AudioProbeError(incomingAudioErrorText(error)); }
  }

  async readReplyAfterRestart(signal: AbortSignal, onStage: (text: string) => void): Promise<PeerRestartReport> {
    const checkpoint = this.replyCheckpoint;
    if (!checkpoint) throw new Error('Сначала повторите обмен с iPad, чтобы запомнить его ответ.');
    if (!this.replyFromPreviousClient) throw new Error('Ответ получен в текущем запуске. Полностью остановите приложение на Tecno и откройте снова.');
    if (checkpoint.roomId !== this.currentRoom?.roomId || checkpoint.senderUserId !== this.currentRoom.peerUserId ||
        checkpoint.senderUserId === this.client.userId()) {
      throw new Error('Второй аккаунт или комната изменились. Проверка прежнего ответа не пройдена.');
    }
    const result = await readSavedEncryptedEvent(this.client, checkpoint, checkpoint.senderUserId, signal, onStage, () => this.vault.flush());
    return { ...result, senderUserId: checkpoint.senderUserId };
  }

  private async serverJson(roomId: string, path: string, signal: AbortSignal): Promise<unknown> {
    const auth = this.client.session();
    return readMatrixJson(`${validateServerUrl(auth.homeserverUrl)}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/${path}`,
      auth.accessToken, signal);
  }

  private async withSync<T>(signal: AbortSignal, onStage: (text: string) => void, task: (context: PeerContext) => Promise<T>, strictCleanup = false): Promise<T> {
    if (!this.nativeSync) throw new Error('Для проверки обмена сервер должен поддерживать native sliding sync.');
    if (signal.aborted) throw new Error('Aborted');
    const sdk = await import('@unomed/react-native-matrix-sdk');
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal.addEventListener('abort', cancel);
    if (signal.aborted) cancel();
    const handles: object[] = [];
    const listeners: TaskHandleLike[] = [];
    const keep = <H extends object>(object: H): H => { handles.push(object); return object; };
    let sync: SyncServiceLike | undefined;
    let syncFailure: Error | undefined;
    let completed = false;
    try {
      onStage('Подключаем получение сообщений и обмен ключами');
      const builder = keep(this.client.syncService());
      const limited = keep(builder.withRoomListTimelineLimit(20));
      sync = keep(await limited.finish({ signal: controller.signal }));
      const listener = keep(sync.state({
        onUpdate(state) {
          if (state === sdk.SyncServiceState.Error || state === sdk.SyncServiceState.Offline || state === sdk.SyncServiceState.Terminated) {
            syncFailure = new Error('Связь с Matrix-сервером прервалась. Проверка обмена не завершена.');
            controller.abort();
          }
        },
      }));
      listeners.push(listener);
      await sync.start({ signal: controller.signal });
      if (controller.signal.aborted) throw new Error('Aborted');
      const result = await task({ sync, signal: controller.signal, keep });
      if (controller.signal.aborted) throw new Error('Aborted');
      completed = true;
      return result;
    } catch (error) { throw syncFailure ?? error; }
    finally {
      signal.removeEventListener('abort', cancel);
      let cleanupFailed = false;
      for (const listener of listeners) { try { listener.cancel(); } catch { cleanupFailed = true; } }
      const cleanup = new AbortController();
      const deadline = setTimeout(() => cleanup.abort(), 10_000);
      try { await sync?.stop({ signal: cleanup.signal }); }
      catch { cleanupFailed = true; }
      finally {
        clearTimeout(deadline);
        for (const handle of new Set(handles.reverse())) { try { destroy(handle); } catch { cleanupFailed = true; } }
      }
      if (cleanupFailed && strictCleanup) throw new ReceiverCleanupError();
      if (cleanupFailed && completed) throw new Error('Сообщения проверены, но SDK не смог остановить получение событий. Перезапустите приложение перед следующим тестом.');
    }
  }

  private async openRoom(roomId: string, context: PeerContext): Promise<RoomLike> {
    const { sync, signal, keep } = context;
    const list = keep(sync.roomListService());
    await list.subscribeToRooms([roomId], { signal });
    return keep(await this.client.awaitRoomRemoteEcho(roomId, { signal }));
  }

  private async checkedAudioTimeline(target: PeerRoom, context: PeerContext, onStage: (text: string) => void) {
    const sdk = await import('@unomed/react-native-matrix-sdk');
    const opts = { signal: context.signal };
    onStage('Проверяем участников и шифрование нашей комнаты с iPad');
    const members = await this.serverJson(target.roomId, 'joined_members', context.signal);
    try { assertTwoJoinedUsers(members, this.client.userId(), target.peerUserId); }
    catch { throw new AudioProbeError('В тестовой комнате должны быть только аккаунты Tecno и iPad, оба принявшие приглашение.'); }
    const room = await this.openRoom(target.roomId, context);
    const roomState = await this.serverJson(target.roomId, 'state/m.room.encryption/', context.signal);
    try { assertMegolmRoomState(roomState); }
    catch { throw new AudioProbeError('Сервер не подтвердил шифрование комнаты. Проверка аудио остановлена.'); }
    await waitForEncryptionState((activeSignal) => room.latestEncryptionState({ signal: activeSignal }), sdk.EncryptionState.Encrypted, context.signal);
    const timeline = context.keep(await room.timeline(opts));
    await timeline.fetchMembers(opts);
    await this.checkAudioTrust(target, context.signal, onStage);
    return timeline;
  }

  private async checkAudioTrust(target: PeerRoom, signal: AbortSignal, onStage: (text: string) => void) {
    const sdk = await import('@unomed/react-native-matrix-sdk');
    const handles: object[] = [];
    try {
      onStage('Проверяем сохранённое доверие Tecno и аккаунта iPad');
      const encryption = this.client.encryption(); handles.push(encryption);
      await encryption.waitForE2eeInitializationTasks({ signal });
      for (const userId of [this.client.userId(), target.peerUserId]) {
        const identity = await encryption.userIdentity(userId, true, { signal });
        if (identity) handles.push(identity);
        if (!identity?.isVerified() || identity.hasVerificationViolation()) {
          throw new AudioProbeError('Доверие к ключам пока не подтверждено. Нажми «Проверить статус доверия», затем вернись к аудиофайлу.');
        }
      }
      if (encryption.verificationState() !== sdk.VerificationState.Verified) {
        throw new AudioProbeError('SDK пока не подтвердил сессию Tecno. Сначала проверь статус доверия.');
      }
      if (signal.aborted) throw new AudioProbeError('Проверка доверия остановлена.');
    } finally {
      let cleanupFailed = false;
      for (const handle of handles.reverse()) { try { destroy(handle); } catch { cleanupFailed = true; } }
      if (cleanupFailed) throw new AudioProbeError('SDK не завершил проверку доверия. Перезапусти приложение.');
    }
  }

  async receiveAudio(signal: AbortSignal, onStage: (text: string) => void): Promise<IncomingVoiceReport> {
    const result = await this.receiveAudioInternal(signal, onStage, false);
    if (!result) throw new AudioProbeError('Новое голосовое не получено.');
    return result;
  }

  async receiveMissedAudio(signal: AbortSignal, onStage: (text: string) => void) {
    return this.receiveAudioInternal(signal, onStage, true);
  }

  private async rememberAudio(result: IncomingVoiceReport, target: PeerRoom, signal: AbortSignal, onStage: (text: string) => void) {
    if (signal.aborted) throw new AudioProbeError('Ожидание голосового отменено.');
    onStage('Сохраняем запись в истории голосовых');
    const nextCheckpoint: AudioCheckpoint = { roomId: target.roomId, eventId: result.eventId,
      senderUserId: target.peerUserId, deviceId: this.client.session().deviceId, createdAt: Date.now(),
      audioSha256: result.audioSha256, byteLength: result.byteLength, durationMs: result.durationMs };
    try {
      const history = appendAudioHistory(this.audioHistory, nextCheckpoint);
      this.vault.savePeerAudioCheckpoint(nextCheckpoint); await this.vault.flush();
      this.audioCheckpoint = nextCheckpoint;
      this.audioHistory = history;
      this.audioFromPreviousClient = false;
    } catch (error) { throw new AudioProbeError(error instanceof SessionPersistenceError ? error.message : 'Не удалось запомнить голосовое. Вход и ключи сохранены.'); }
    if (signal.aborted) throw new AudioProbeError('Приём остановлен. Запись запомнена для следующего запуска.');
  }

  async watchAudio(signal: AbortSignal, onStage: (text: string) => void, onReceived: () => void): Promise<void> {
    const target = this.room;
    if (!target) throw new AudioProbeError('Сначала подготовь комнату с аккаунтом iPad.');
    const checkpoint = this.audioCheckpoint;
    if (checkpoint && (checkpoint.roomId !== target.roomId || checkpoint.senderUserId !== target.peerUserId ||
        checkpoint.deviceId !== this.client.session().deviceId)) throw new AudioProbeError('Комната или устройство изменились. Проверь сохранённый вход.');
    try {
      await this.withSync(signal, onStage, async (context) => {
        await this.checkedAudioTimeline(target, context, onStage);
        const room = this.client.getRoom(target.roomId);
        if (!room) throw new AudioProbeError('SDK не нашёл комнату с iPad.');
        context.keep(room);
        const { readIncomingAudioEvent } = await import('./missed-audio.native');
        const { discardIncomingAudio } = await import('./incoming-audio-files.native');
        const readServer = (path: string, activeSignal: AbortSignal) => this.serverJson(target.roomId, path, activeSignal);
        const checkActive = () => { if (context.signal.aborted) throw new AudioProbeError('Автоприём остановлен.'); };
        checkActive();
        // Establish the forward boundary BEFORE catch-up, so messages arriving
        // between catch-up and live reception cannot fall into a gap.
        if (checkpoint || this.audioCursor?.roomId !== target.roomId || this.audioCursor.peerUserId !== target.peerUserId) {
          this.audioCursor = { ...target, ...incomingAudioBoundary(await readServer('messages?dir=b&limit=1', context.signal)) };
        }
        const boundary = this.audioCursor;
        if (!boundary) throw new AudioProbeError('Не удалось подготовить автоприём.');
        const processed = new Set(this.audioHistory.map((item) => item.eventId));
        const consume = async (eventId: string) => {
          checkActive();
          if (processed.has(eventId)) return;
          const result = await readIncomingAudioEvent(this.client, room, target, eventId, readServer, context.signal, onStage, async () => {
            // A long-lived receiver must recheck trust and membership for each
            // voice, rather than retaining a snapshot from the initial sync.
            const members = await readServer('joined_members', context.signal);
            try { assertTwoJoinedUsers(members, this.client.userId(), target.peerUserId); }
            catch { throw new AudioProbeError('Участники тестовой комнаты изменились. Проверь комнату с iPad.'); }
            await this.checkAudioTrust(target, context.signal, onStage);
          });
          if (result) {
            try { await this.rememberAudio(result, target, context.signal, onStage); }
            finally { discardIncomingAudio(result.playbackUri); }
            checkActive();
            // UI receives metadata only. A new voice never replaces or pauses
            // the file the user is currently listening to.
            onReceived();
          }
          processed.add(eventId);
          if (processed.size > 100) processed.delete(processed.values().next().value!);
        };
        if (checkpoint) {
          onStage('Автоприём: проверяем пропущенные голосовые');
          const missed = await missedAudioCandidates(checkpoint.eventId, target.peerUserId, readServer, context.signal);
          for (const eventId of missed) await consume(eventId);
        }
        while (true) {
          checkActive();
          onStage('Автоприём включён · новые голосовые появятся в истории');
          const value = await readServer(`messages?dir=f&limit=20&from=${encodeURIComponent(boundary.cursor)}`, context.signal);
          checkActive();
          const page = incomingAudioPage(value, boundary.cursor, boundary.excludedEventId, target.peerUserId);
          for (const eventId of page.eventIds) await consume(eventId);
          checkActive();
          const progressed = page.cursor !== boundary.cursor;
          // Advance only after the WHOLE page has been processed and saved.
          // A cancelled download leaves this page available on the next run.
          boundary.cursor = page.cursor;
          if (!progressed || !(value as { chunk: unknown[] }).chunk.length) {
            await new Promise<void>((resolve) => {
              const done = () => { clearTimeout(timer); context.signal.removeEventListener('abort', done); resolve(); };
              const timer = setTimeout(done, 5000);
              context.signal.addEventListener('abort', done, { once: true });
              if (context.signal.aborted) done();
            });
          }
        }
      }, true);
    } catch (error) {
      if (error instanceof ReceiverCleanupError) throw error;
      throw new AudioProbeError(incomingAudioErrorText(error));
    }
  }

  private async receiveAudioInternal(signal: AbortSignal, onStage: (text: string) => void, missed: boolean) {
    const target = this.room;
    if (!target) throw new AudioProbeError('Сначала подготовь тестовую комнату с аккаунтом iPad во вкладке «Диагностика».');
    const checkpoint = this.audioCheckpoint;
    if (missed && (!checkpoint || checkpoint.roomId !== target.roomId || checkpoint.senderUserId !== target.peerUserId ||
        checkpoint.deviceId !== this.client.session().deviceId)) {
      throw new AudioProbeError('Сначала получи одно голосовое с iPad обычной кнопкой, чтобы сохранить начало проверки.');
    }
    let playbackUri: string | undefined;
    let delivered = false;
    try {
      const result = await this.withSync(signal, onStage, async (context) => {
        const timeline = await this.checkedAudioTimeline(target, context, onStage);
        if (missed && checkpoint) {
          const room = this.client.getRoom(target.roomId);
          if (!room) throw new AudioProbeError('SDK не нашёл комнату с iPad.');
          context.keep(room);
          const { receiveMissedAudio } = await import('./missed-audio.native');
          const result = await receiveMissedAudio(this.client, room, target, checkpoint.eventId,
            (path, activeSignal) => this.serverJson(target.roomId, path, activeSignal), context.signal, onStage);
          playbackUri = result?.playbackUri;
          return result;
        }
        const { receiveAndCheckAudio } = await import('./incoming-audio.native');
        const result = await receiveAndCheckAudio(this.client, timeline, target,
          (path, activeSignal) => this.serverJson(target.roomId, path, activeSignal), context.signal, onStage);
        playbackUri = result.playbackUri;
        return result;
      });
      if (signal.aborted) throw new AudioProbeError('Ожидание голосового отменено.');
      if (!result) return null;
      await this.rememberAudio(result, target, signal, onStage);
      delivered = true;
      return result;
    } catch (error) { throw new AudioProbeError(incomingAudioErrorText(error)); }
    finally { if (!delivered && playbackUri) (await import('./incoming-audio-files.native')).discardIncomingAudio(playbackUri); }
  }

  async sendAudio(signal: AbortSignal, onStage: (text: string) => void, draft?: VoiceDraft, beforeUpload?: VoiceBeforeUpload): Promise<AudioProbeReport> {
    const target = this.room;
    if (!target) throw new AudioProbeError('Сначала подготовь тестовую комнату с аккаунтом iPad во вкладке «Диагностика».');
    let playbackUri: string | undefined;
    let delivered = false;
    try {
      const voice = draft ? await (await import('./voice-files.native')).prepareVoice(draft, signal) : undefined;
      let audioSha256: string | undefined;
      if (voice) {
        const crypto = await import('expo-crypto');
        audioSha256 = Array.from(new Uint8Array(await crypto.digest(crypto.CryptoDigestAlgorithm.SHA256, voice.bytes)),
          byte => byte.toString(16).padStart(2, '0')).join('');
      }
      const result = await this.withSync(signal, onStage, async (context) => {
        const timeline = await this.checkedAudioTimeline(target, context, onStage);
        const { sendAndCheckAudio } = await import('./audio-test.native');
        const result = await sendAndCheckAudio(this.client, timeline, target,
          (eventId) => this.serverJson(target.roomId, `event/${encodeURIComponent(eventId)}`, context.signal), context.signal, onStage, voice, beforeUpload);
        playbackUri = result.playbackUri;
        if (voice && audioSha256) {
          if (context.signal.aborted) throw new AudioProbeError('Ожидание отменено. Запись могла уже отправиться.');
          onStage('Запись проверена на сервере. Сохраняем её в истории отправленных');
          const checkpoint: AudioCheckpoint = { roomId: target.roomId, eventId: result.eventId,
            senderUserId: this.client.userId(), deviceId: this.client.session().deviceId,
            audioSha256, byteLength: result.byteLength, durationMs: result.durationMs, createdAt: Date.now() };
          try {
            const history = appendAudioHistory(this.ownAudioHistory, checkpoint);
            this.vault.saveOwnAudioCheckpoint(checkpoint);
            await this.vault.flush();
            this.ownAudioHistory = history;
          } catch {
            throw new AudioProbeError('Запись отправлена и проверена на сервере, но её не удалось сохранить в истории. Проверь iPad. Повторно эту запись не отправляй.');
          }
        }
        return result;
      });
      if (signal.aborted) throw new AudioProbeError('Ожидание отменено. Сообщение могло уже отправиться.');
      delivered = true;
      return result;
    } catch (error) { throw new AudioProbeError(audioProbeErrorText(error)); }
    finally { if (!delivered && playbackUri) (await import('./voice-files.native')).discardVoiceFile(playbackUri); }
  }

  async prepare(peerValue: string, signal: AbortSignal, onStage: (text: string) => void): Promise<PeerRoom> {
    const peerUserId = validatePeerUserId(peerValue, this.client.userId());
    if (signal.aborted) throw new Error('Aborted');
    if (this.currentRoom?.peerUserId === peerUserId) {
      // Retry a failed metadata save without making duplicate rooms/invites.
      this.vault.savePeerRoom(this.currentRoom);
      await this.vault.flush();
      return { ...this.currentRoom };
    }
    return this.withSync(signal, onStage, async (context) => {
      const sdk = await import('@unomed/react-native-matrix-sdk');
      onStage('Создаём закрытую зашифрованную комнату и приглашаем аккаунт iPad');
      const roomId = await this.client.createRoom({
        name: 'Matrix · проверка двух аккаунтов',
        topic: 'Только тестовые сообщения. Проверка обмена между Tecno и iPad.',
        isEncrypted: true, isDirect: true, isSpace: false,
        visibility: new sdk.RoomVisibility.Private(), preset: sdk.RoomPreset.PrivateChat, invite: [peerUserId],
      }, { signal: context.signal });
      this.currentRoom = { roomId, peerUserId };
      this.audioCheckpoint = null;
      this.audioHistory = [];
      this.ownAudioHistory = [];
      this.audioFromPreviousClient = false;
      this.replyCheckpoint = null;
      this.replyFromPreviousClient = false;
      this.vault.savePeerRoom(this.currentRoom);
      await this.vault.flush();
      onStage('Проверяем шифрование созданной комнаты');
      await this.openRoom(roomId, context);
      assertMegolmRoomState(await this.serverJson(roomId, 'state/m.room.encryption/', context.signal));
      if (context.signal.aborted) throw new Error('Aborted');
      return { ...this.currentRoom };
    });
  }

  async exchange(signal: AbortSignal, onStage: (text: string) => void): Promise<PeerExchangeReport> {
    const target = this.room;
    if (!target) throw new Error('Сначала введите адрес аккаунта iPad и создайте тестовую комнату.');
    const started = Date.now();
    return this.withSync(signal, onStage, async (context) => {
      const sdk = await import('@unomed/react-native-matrix-sdk');
      const opts = { signal: context.signal };
      const ownUserId = this.client.userId();
      onStage('Проверяем, что iPad принял приглашение');
      assertTwoJoinedUsers(await this.serverJson(target.roomId, 'joined_members', context.signal), ownUserId, target.peerUserId);
      const room = await this.openRoom(target.roomId, context);
      assertMegolmRoomState(await this.serverJson(target.roomId, 'state/m.room.encryption/', context.signal));
      await waitForEncryptionState((activeSignal) => room.latestEncryptionState({ signal: activeSignal }), sdk.EncryptionState.Encrypted, context.signal);
      const timeline = context.keep(await room.timeline(opts));
      // Fetch full membership before the SDK selects recipient devices.
      await timeline.fetchMembers(opts);
      const crypto = await import('expo-crypto');
      const bytes = await crypto.getRandomBytesAsync(16);
      const nonce = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      const { requestBody, replyBody } = peerChallenge(nonce);
      let resolveSent: (id: string) => void = () => {};
      let resolveReply: (id: string) => void = () => {};
      let rejectSent: (error: Error) => void = () => {};
      let rejectReply: (error: Error) => void = () => {};
      const sent = new Promise<string>((resolve, reject) => { resolveSent = resolve; rejectSent = reject; });
      const reply = new Promise<string>((resolve, reject) => { resolveReply = resolve; rejectReply = reject; });
      void sent.catch(() => {});
      void reply.catch(() => {});
      let observerFailure: Error | undefined;
      const cancel = () => { rejectSent(new Error('Aborted')); rejectReply(new Error('Aborted')); };
      context.signal.addEventListener('abort', cancel);
      let listener: TaskHandleLike | undefined;
      try {
        if (context.signal.aborted) throw new Error('Aborted');
        listener = context.keep(await timeline.addListener({
          onUpdate(diffs) {
            try {
              for (const item of changedTimelineItems(diffs)) {
                const event = item.asEvent();
                const own = matchingRemoteEvent(event, requestBody, ownUserId, sdk.EventItemOrigin.Sync);
                const other = matchingRemoteEvent(event, replyBody, target.peerUserId, sdk.EventItemOrigin.Sync);
                if (own) resolveSent(own);
                if (other) resolveReply(other);
              }
            } catch {
              observerFailure = new Error('SDK не смог прочитать сообщение при проверке обмена.');
              rejectSent(observerFailure); rejectReply(observerFailure);
            }
          },
        }, opts));
        onStage('Отправляем один зашифрованный запрос на iPad');
        if (context.signal.aborted) throw new Error('Aborted');
        await room.sendRaw('m.room.message', JSON.stringify({ msgtype: 'm.text', body: requestBody }), opts);
        const sentEventId = await sent;
        const outgoingEncryption = inspectEncryptedEvent(
          await this.serverJson(target.roomId, `event/${encodeURIComponent(sentEventId)}`, context.signal),
          { roomId: target.roomId, eventId: sentEventId, sender: ownUserId, body: requestBody },
        );
        onStage('На iPad откройте сообщение в Element X. Скопируйте строку «Matrix ответ …» и отправьте её отдельным сообщением. Ожидаем до 5 минут');
        const replyEventId = await reply;
        const incomingEncryption = inspectEncryptedEvent(
          await this.serverJson(target.roomId, `event/${encodeURIComponent(replyEventId)}`, context.signal),
          { roomId: target.roomId, eventId: replyEventId, sender: target.peerUserId, body: replyBody },
        );
        const bodySha256 = await crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256, replyBody);
        if (context.signal.aborted) throw new Error('Aborted');
        const checkpoint: PeerReplyCheckpoint = {
          roomId: target.roomId, eventId: replyEventId, senderUserId: target.peerUserId,
          deviceId: this.client.session().deviceId, bodySha256, createdAt: started,
        };
        this.vault.savePeerReplyCheckpoint(checkpoint);
        await this.vault.flush();
        if (observerFailure) throw observerFailure;
        if (context.signal.aborted) throw new Error('Aborted');
        this.replyCheckpoint = checkpoint;
        this.replyFromPreviousClient = false;
        return { ...target, sentEventId, replyEventId, requestBody, replyBody, outgoingEncryption, incomingEncryption, elapsedMs: Date.now() - started };
      } catch (error) { throw observerFailure ?? error; }
      finally {
        context.signal.removeEventListener('abort', cancel);
        listener?.cancel();
      }
    });
  }
}
