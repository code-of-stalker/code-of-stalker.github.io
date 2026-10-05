import type {
  ClientLike, ClientBuilderLike, RoomLike, SyncServiceLike, TimelineLike, TaskHandleLike,
} from '@unomed/react-native-matrix-sdk';

import type { MatrixTestSession, MessageReport, RestartReport, RestartProbeStatus, ServerReport, PeerRoom, GroupRoom } from './network-types';
import { validateServerUrl } from './network-types';
import { changedTimelineItems, matchingRemoteEvent } from './remote-echo';
import { assertMegolmRoomState, inspectEncryptedEvent } from './encrypted-proof';
import { waitForEncryptionState } from './encryption-readiness';
import type { SavedSession } from './saved-session';
import type { EncryptedCheckpoint, PeerReplyCheckpoint } from './restart-probe';
import { forgetSavedSession, newSessionIdentity, readSavedSession, sessionPaths, SessionVault } from './session-storage.native';
import { NativePeerTest } from './peer-test.native';
import { NativeDiaryTest } from './diary-test.native';
import { NativeDiaryRecovery } from './diary-recovery.native';
import { NativeGroupTest } from './group-test.native';
import { readSavedEncryptedEvent } from './read-checkpoint.native';
import { NativeTrustTest } from './trust-test.native';
import type { SasData } from './trust-types';
import type { TrustDiagnostics } from './trust-diagnostics';
import type { VoiceBeforeUpload, VoiceDraft, VoiceProbeReport } from './voice-types';
import { AudioProbeError } from './audio-probe';
import { enableDiaryRecovery, inspectRecoveryReadiness } from './recovery-readiness.native';

function destroy(object: object | undefined) {
  if (object && 'uniffiDestroy' in object && typeof object.uniffiDestroy === 'function') object.uniffiDestroy();
}

async function buildClient(
  url: string, signal: AbortSignal,
  persistent?: { id: string; passphrase: string; vault: SessionVault; restore: boolean },
  forRecovery = false,
): Promise<ClientLike> {
  const server = validateServerUrl(url);
  const sdk = await import('@unomed/react-native-matrix-sdk');
  if (signal.aborted) throw new Error('Aborted');
  const builders: ClientBuilderLike[] = [];
  const stores: object[] = [];
  function keep(builder: ClientBuilderLike) { builders.push(builder); return builder; }
  try {
    let builder = keep(new sdk.ClientBuilder());
    if (persistent) {
      const paths = await sessionPaths(persistent.id, !persistent.restore);
      const store = new sdk.SqliteStoreBuilder(paths.data, paths.cache);
      stores.push(store);
      const protectedStore = store.passphrase(persistent.passphrase);
      stores.push(protectedStore);
      builder = keep(builder.sqliteStore(protectedStore));
      builder = keep(builder.setSessionDelegate(persistent.vault));
    } else builder = keep(builder.inMemoryStore());
    builder = keep(builder.homeserverUrl(server));
    builder = keep(builder.autoEnableBackups(false));
    builder = keep(builder.autoEnableCrossSigning(false));
    if (forRecovery) builder = keep(builder.backupDownloadStrategy(sdk.BackupDownloadStrategy.OneShot));
    builder = keep(builder.slidingSyncVersionBuilder(sdk.SlidingSyncVersionBuilder.DiscoverNative));
    return await builder.build({ signal });
  } finally {
    for (const builder of new Set(builders)) destroy(builder);
    for (const store of new Set(stores)) destroy(store);
  }
}

async function serverReport(client: ClientLike, signal: AbortSignal): Promise<ServerReport> {
  const details = await client.homeserverLoginDetails({ signal });
  try {
    const sdk = await import('@unomed/react-native-matrix-sdk');
    return {
      url: details.url(),
      passwordLogin: details.supportsPasswordLogin(),
      nativeSync: details.slidingSyncVersion() === sdk.SlidingSyncVersion.Native,
    };
  } finally { destroy(details); }
}

export async function checkMatrixServer(url: string, signal: AbortSignal): Promise<ServerReport> {
  const client = await buildClient(url, signal);
  try { return await serverReport(client, signal); }
  finally { destroy(client); }
}

export async function loginMatrix(
  url: string, username: string, password: string, signal: AbortSignal,
  forRecovery = false,
): Promise<MatrixTestSession> {
  if (!username.trim() || !password) throw new Error('Введите имя пользователя и пароль на телефоне.');
  const identity = await newSessionIdentity();
  const vault = new SessionVault(identity);
  let client: ClientLike | undefined;
  let loggedIn = false;
  try {
    client = await buildClient(url, signal, { ...identity, vault, restore: false }, forRecovery);
    const report = await serverReport(client, signal);
    if (!report.passwordLogin) throw new Error('Этот сервер не поддерживает вход по паролю. Для этого этапа нужен тестовый аккаунт с паролем.');
    await client.login(username.trim(), password, 'Matrix diagnostic · test', undefined, { signal });
    loggedIn = true;
    vault.saveSessionInKeychain(client.session());
    await vault.flush();
    if (signal.aborted) throw new Error('Aborted');
    return new NativeTestSession(client, report.nativeSync, vault);
  } catch (error) {
    vault.stop();
    // Do not leave a new server device active if saving the login failed.
    if (client && loggedIn) {
      const cleanup = new AbortController();
      const timer = setTimeout(() => cleanup.abort(), 10_000);
      try { await client.logout({ signal: cleanup.signal }); } catch { /* Keep the original failure. */ }
      finally { clearTimeout(timer); }
    }
    destroy(client);
    try { await vault.erase(); } catch { /* Keep the original failure. */ }
    throw error;
  }
}

// Check startup routing without creating a second native client or opening SQLite.
export async function hasSavedMatrixSession(): Promise<boolean> {
  return (await readSavedSession()) !== null;
}

export async function savedMatrixSessionHasDiary(): Promise<boolean> {
  const saved = await readSavedSession();
  return !!saved?.diaryRoomId || !!saved?.diaryAudioHistory?.length;
}

export async function restoreMatrixSession(signal: AbortSignal, forRecovery = false): Promise<MatrixTestSession | null> {
  const saved = await readSavedSession();
  if (!saved) return null;
  (await import('./incoming-audio-files.native')).cleanIncomingAudioPreviews();
  const vault = new SessionVault(saved, saved);
  let client: ClientLike | undefined;
  try {
    client = await buildClient(saved.session.homeserverUrl, signal, { ...saved, vault, restore: true }, forRecovery);
    await client.restoreSession(saved.session, { signal });
    vault.saveSessionInKeychain(client.session());
    await vault.flush();
    if (signal.aborted) throw new Error('Aborted');
    return new NativeTestSession(client, saved.session.slidingSyncVersion === 1, vault, saved.roomIds, saved.encryptedCheckpoint ?? null,
      saved.peerRoom ?? null, saved.peerReplyCheckpoint ?? null, saved.peerAudioCheckpoint ?? null, saved.peerAudioHistory ?? [], saved.ownAudioHistory ?? [],
      saved.diaryRoomId ?? null, saved.diaryAudioHistory ?? [], saved.diaryShare?.sourceEventId ?? null, saved.groupRoom ?? null);
  } catch (error) {
    vault.stop();
    destroy(client);
    // Transient network errors must not destroy the saved keys or credentials.
    throw error;
  }
}

export async function forgetMatrixSession(): Promise<void> { await forgetSavedSession(); }

class NativeTestSession implements MatrixTestSession {
  readonly userId: string;
  readonly serverUrl: string;
  readonly deviceId: string;
  private roomIds: Partial<Record<'plaintext' | 'encrypted', string>> = {};
  private disposed = false;
  private checkpointFromPreviousClient: boolean;
  private peerTest: NativePeerTest;
  private diaryTest: NativeDiaryTest;
  private diaryRecovery: NativeDiaryRecovery;
  private groupTest: NativeGroupTest;
  private trustTest: NativeTrustTest;

  constructor(
    private client: ClientLike, private nativeSync: boolean, private vault: SessionVault,
    roomIds: SavedSession['roomIds'] = {},
    private checkpoint: EncryptedCheckpoint | null = null,
    peerRoom: PeerRoom | null = null,
    peerReply: PeerReplyCheckpoint | null = null,
    peerAudio: SavedSession['peerAudioCheckpoint'] | null = null,
    peerAudioHistory: NonNullable<SavedSession['peerAudioHistory']> = [],
    ownAudioHistory: NonNullable<SavedSession['ownAudioHistory']> = [],
    diaryRoomId: string | null = null,
    diaryAudioHistory: NonNullable<SavedSession['diaryAudioHistory']> = [],
    diarySharedEventId: string | null = null,
    groupRoom: GroupRoom | null = null,
  ) {
    this.userId = client.userId();
    const session = client.session();
    this.serverUrl = session.homeserverUrl;
    this.deviceId = session.deviceId;
    this.roomIds = { ...roomIds };
    this.checkpointFromPreviousClient = checkpoint !== null;
    this.peerTest = new NativePeerTest(client, nativeSync, vault, peerRoom, peerReply, peerAudio, peerAudioHistory, ownAudioHistory);
    this.diaryTest = new NativeDiaryTest(client, nativeSync, vault, this.peerTest, diaryRoomId, diaryAudioHistory, diarySharedEventId);
    this.diaryRecovery = new NativeDiaryRecovery(client, nativeSync);
    this.groupTest = new NativeGroupTest(client, nativeSync, vault, groupRoom);
    this.trustTest = new NativeTrustTest(client, nativeSync, vault, () => this.peerTest.room);
  }

  async inspectTrust(signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new Error('Сессия уже закрыта. Откройте приложение снова.');
    return this.trustTest.inspect(signal, onStage);
  }

  async verifyTrust(target: 'own' | 'peer', signal: AbortSignal, onStage: (stage: string) => void,
    onSas: (data: SasData | null) => void, onDiagnostics?: (report: TrustDiagnostics) => void) {
    if (this.disposed) throw new Error('Сессия уже закрыта. Откройте приложение снова.');
    return this.trustTest.verify(target, signal, onStage, onSas, onDiagnostics);
  }

  async respondToVerification(matches: boolean) {
    if (this.disposed) throw new Error('Сессия уже закрыта. Откройте приложение снова.');
    return this.trustTest.respond(matches);
  }

  get peerRoom(): PeerRoom | null { return this.peerTest.room; }
  get peerAudioRestartProbe() { return this.peerTest.audioRestartProbe; }
  get peerAudioHistory() { return this.peerTest.audioRecords; }
  get ownAudioHistory() { return this.peerTest.ownAudioRecords; }
  get diaryRoomId() { return this.diaryTest.room; }
  get diaryAudioHistory() { return this.diaryTest.records; }
  get diarySharedEventId() { return this.diaryTest.shared; }
  get groupRoom() { return this.groupTest.room; }

  async recoverOneDiaryRecord(code: string, signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    if (this.diaryTest.room || this.diaryTest.records.length) {
      throw new AudioProbeError('Эта установка уже содержит дневник. Для проверки используй отдельный чистый APK.');
    }
    return this.diaryRecovery.recoverOneRecord(code, signal, onStage);
  }

  async inspectRecoveryReadiness(signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    return inspectRecoveryReadiness(this.client, signal, onStage);
  }
  async enableDiaryRecovery(code: string, signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    if (!this.diaryTest.room || this.diaryTest.records.length !== 2) {
      throw new AudioProbeError('Сначала проверь две сохранённые записи дневника.');
    }
    return enableDiaryRecovery(this.client, code, signal, onStage);
  }
  readonly diaryBoundaryVersion = 1 as const;

  async prepareGroupRoom(computerUserId: string, signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    const peer = this.peerTest.room;
    if (!peer) throw new AudioProbeError('Сначала нужна проверенная комната с iPad.');
    return this.groupTest.prepare(peer.peerUserId, computerUserId, signal, onStage);
  }

  async sendGroupAudio(signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    return this.groupTest.sendAudio(signal, onStage);
  }

  async readGroupAudio(sender: 'ipad' | 'computer', signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    return this.groupTest.readLatestAudio(sender, signal, onStage);
  }

  async prepareDiary(signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    return this.diaryTest.prepare(signal, onStage);
  }

  async saveDiaryVoice(draft: VoiceDraft, signal: AbortSignal, onStage: (stage: string) => void, beforeUpload: VoiceBeforeUpload) {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    return this.diaryTest.saveVoice(draft, signal, onStage, beforeUpload);
  }

  async readDiaryVoice(eventId: string, signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    return this.diaryTest.readVoice(eventId, signal, onStage);
  }

  async shareDiaryVoice(eventId: string, signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    return this.diaryTest.shareVoice(eventId, signal, onStage);
  }

  async readPeerAudio(eventId: string, signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    return this.peerTest.readAudio(eventId, signal, onStage);
  }

  async readCachedPeerAudio(eventId: string, signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    return this.peerTest.readCachedAudio(eventId, signal, onStage);
  }

  async readPeerAudioAfterRestart(signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    return this.peerTest.readAudioAfterRestart(signal, onStage);
  }

  get peerRestartProbe() { return this.peerTest.restartProbe; }

  async readPeerReplyAfterRestart(signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new Error('Сессия уже закрыта. Откройте приложение снова.');
    return this.peerTest.readReplyAfterRestart(signal, onStage);
  }

  async preparePeerRoom(peerUserId: string, signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new Error('Сессия уже закрыта. Откройте приложение снова.');
    const room = await this.peerTest.prepare(peerUserId, signal, onStage);
    this.groupTest.clearIfPeerChanged(room.peerUserId);
    return room;
  }

  async exchangeWithPeer(signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new Error('Сессия уже закрыта. Откройте приложение снова.');
    return this.peerTest.exchange(signal, onStage);
  }

  async sendEncryptedAudioToPeer(signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new Error('Сессия уже закрыта. Откройте приложение снова.');
    return this.peerTest.sendAudio(signal, onStage);
  }

  readonly voiceUploadBoundaryVersion = 3 as const;
  readonly voicePlaybackCacheVersion = 1 as const;
  async sendVoiceMessageToPeer(draft: VoiceDraft, signal: AbortSignal, onStage: (stage: string) => void, beforeUpload: VoiceBeforeUpload): Promise<VoiceProbeReport> {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    if (typeof beforeUpload !== 'function') throw new AudioProbeError('Обнови экран через Reload перед отправкой голоса. Черновик не отправлен.');
    const result = await this.peerTest.sendAudio(signal, onStage, draft, beforeUpload);
    if (!result.playbackUri) throw new AudioProbeError('Не удалось подготовить расшифрованную запись для прослушивания.');
    return { ...result, playbackUri: result.playbackUri };
  }

  async receiveMissedVoiceFromPeer(signal: AbortSignal, onStage: (stage: string) => void) {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    return this.peerTest.receiveMissedAudio(signal, onStage);
  }

  async receiveVoiceMessageFromPeer(signal: AbortSignal, onStage: (stage: string) => void): Promise<VoiceProbeReport> {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    return this.peerTest.receiveAudio(signal, onStage);
  }

  async watchVoiceMessagesFromPeer(signal: AbortSignal, onStage: (stage: string) => void, onReceived: () => void) {
    if (this.disposed) throw new AudioProbeError('Сессия закрыта. Открой приложение снова.');
    return this.peerTest.watchAudio(signal, onStage, onReceived);
  }

  get restartProbe(): RestartProbeStatus | null {
    if (!this.checkpoint) return null;
    const { roomId, eventId, deviceId, createdAt } = this.checkpoint;
    return { roomId, eventId, deviceId, createdAt, requiresRestart: !this.checkpointFromPreviousClient };
  }

  async readEncryptedMessageAfterRestart(signal: AbortSignal, onStage: (stage: string) => void): Promise<RestartReport> {
    if (this.disposed) throw new Error('Сессия уже закрыта. Откройте приложение снова.');
    const checkpoint = this.checkpoint;
    if (!checkpoint) throw new Error('Сначала выполните проверку шифрования, чтобы сохранить тестовое сообщение.');
    if (!this.checkpointFromPreviousClient) throw new Error('Тестовое сообщение создано в текущей сессии. Сначала полностью остановите приложение и откройте снова.');
    if (checkpoint.deviceId !== this.deviceId || checkpoint.roomId !== this.roomIds.encrypted) {
      throw new Error('Устройство или тестовая комната изменились. Проверка сохранения ключей не пройдена.');
    }
    return readSavedEncryptedEvent(this.client, checkpoint, this.userId, signal, onStage, () => this.vault.flush());
  }

  async sendTestMessage(signal: AbortSignal, onStage: (stage: string) => void): Promise<MessageReport> {
    return this.sendProbe('plaintext', signal, onStage);
  }

  async sendEncryptedTestMessage(signal: AbortSignal, onStage: (stage: string) => void): Promise<MessageReport> {
    return this.sendProbe('encrypted', signal, onStage);
  }

  private async sendProbe(
    mode: 'plaintext' | 'encrypted', signal: AbortSignal, onStage: (stage: string) => void,
  ): Promise<MessageReport> {
    if (this.disposed) throw new Error('Сессия уже закрыта. Войдите снова.');
    if (!this.nativeSync) throw new Error('Сервер не объявляет native sliding sync, который нужен для этой проверки получения сообщений.');
    const started = Date.now();
    const encrypted = mode === 'encrypted';
    const body = `Matrix SDK ${encrypted ? 'encrypted' : 'plain'} test · ${started} · ${Math.random().toString(36).slice(2, 10)}`;
    const thisSender = this.userId;
    const sdk = await import('@unomed/react-native-matrix-sdk');
    let sync: SyncServiceLike | undefined;
    let room: RoomLike | undefined;
    let timeline: TimelineLike | undefined;
    let listener: TaskHandleLike | undefined;
    let stateListener: TaskHandleLike | undefined;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal.addEventListener('abort', cancel);
    if (signal.aborted) cancel();
    const opts = { signal: controller.signal };
    const handles: object[] = [];
    let resolveEcho: (id: string) => void = () => {};
    let rejectEcho: (error: Error) => void = () => {};
    let observerFailure: Error | undefined;
    const echo = new Promise<string>((resolve, reject) => { resolveEcho = resolve; rejectEcho = reject; });
    // The observer may fail before sendRaw completes. Attach a rejection handler
    // immediately; the original promise is still awaited below.
    void echo.catch(() => {});
    const rejectOnAbort = () => rejectEcho(new Error('Aborted'));
    controller.signal.addEventListener('abort', rejectOnAbort);
    if (controller.signal.aborted) rejectOnAbort();
    function failObserver(error: Error) {
      observerFailure = error;
      rejectEcho(error);
      controller.abort();
    }
    try {
      onStage('Запускаем получение событий с сервера');
      const builder = this.client.syncService();
      handles.push(builder);
      const limited = builder.withRoomListTimelineLimit(20);
      handles.push(limited);
      sync = await limited.finish(opts);
      stateListener = sync.state({
        onUpdate(state) {
          if (state === sdk.SyncServiceState.Error || state === sdk.SyncServiceState.Offline || state === sdk.SyncServiceState.Terminated) {
            failObserver(new Error('Получение событий остановилось. Проверьте связь с Matrix-сервером.'));
          }
        },
      });
      await sync.start(opts);
      let roomId = this.roomIds[mode];
      if (!roomId) {
        onStage(encrypted ? 'Создаём отдельную закрытую комнату с шифрованием' : 'Создаём закрытую комнату только для тестового аккаунта');
        roomId = await this.client.createRoom({
          name: encrypted ? 'Matrix SDK · проверка шифрования' : 'Matrix SDK · техническая проверка',
          topic: encrypted ? 'Только тестовые сообщения. Проверка шифрования в одной сессии.' : 'Только тестовые сообщения. Шифрование не проверяется.',
          isEncrypted: encrypted,
          isDirect: false,
          visibility: new sdk.RoomVisibility.Private(),
          preset: sdk.RoomPreset.PrivateChat,
          invite: [],
          isSpace: false,
        }, opts);
        this.roomIds[mode] = roomId;
        this.vault.saveRoomIds(this.roomIds);
        await this.vault.flush();
      }
      const roomList = sync.roomListService();
      handles.push(roomList);
      // Explicit subscription keeps this probe independent of which rooms are
      // currently inside the room list's visible range.
      await roomList.subscribeToRooms([roomId], opts);
      onStage('Ждём появления тестовой комнаты с сервера');
      room = await this.client.awaitRoomRemoteEcho(roomId, opts);
      onStage('Проверяем настройку шифрования комнаты на сервере');
      // isEncrypted() collapses both unknown state and read errors to false in
      // this SDK. Check server state first, then wait for the native tri-state API.
      const roomAuth = this.client.session();
      const roomBaseUrl = validateServerUrl(roomAuth.homeserverUrl);
      const stateResponse = await fetch(
        `${roomBaseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.encryption/`,
        { headers: { Authorization: `Bearer ${roomAuth.accessToken}` }, signal: controller.signal },
      );
      const stateContent: unknown = await stateResponse.json();
      if (controller.signal.aborted) throw new Error('Aborted');
      const missingEncryption = stateResponse.status === 404 &&
        typeof stateContent === 'object' && stateContent !== null &&
        'errcode' in stateContent && stateContent.errcode === 'M_NOT_FOUND';
      if (encrypted) {
        if (missingEncryption) {
          throw new Error('Сервер не вернул настройку шифрования для созданной тестовой комнаты. Сообщение не отправлено.');
        }
        if (!stateResponse.ok) throw new Error(`Не удалось проверить настройку шифрования на сервере (HTTP ${stateResponse.status}). Сообщение не отправлено.`);
        assertMegolmRoomState(stateContent);
      } else if (!missingEncryption) {
        throw new Error(stateResponse.ok
          ? 'Сервер включил шифрование в комнате обычного теста. Используйте проверку шифрования. Сообщение не отправлено.'
          : `Не удалось проверить настройку комнаты на сервере (HTTP ${stateResponse.status}). Сообщение не отправлено.`);
      }
      onStage('Ждём получения настройки шифрования нативным SDK');
      const activeRoom = room;
      await waitForEncryptionState(
        (signal) => activeRoom.latestEncryptionState({ signal }),
        encrypted ? sdk.EncryptionState.Encrypted : sdk.EncryptionState.NotEncrypted,
        controller.signal,
      );
      timeline = await room.timeline(opts);
      listener = await timeline.addListener({
        onUpdate(diffs) {
          try {
            for (const item of changedTimelineItems(diffs)) {
              const id = matchingRemoteEvent(item.asEvent(), body, thisSender, sdk.EventItemOrigin.Sync);
              if (id) { resolveEcho(id); break; }
            }
          } catch {
            failObserver(new Error('SDK не смог прочитать полученное событие тестового сообщения.'));
          }
        },
      }, opts);
      onStage(encrypted ? 'SDK шифрует и отправляет тестовое сообщение' : 'Отправляем одно тестовое сообщение');
      await room.sendRaw('m.room.message', JSON.stringify({ msgtype: 'm.text', body }), opts);
      onStage(encrypted ? 'Ждём сообщение с сервера и его расшифровку SDK' : 'Ждём это сообщение обратно с сервера');
      const eventId = await echo;
      if (encrypted) {
        onStage('Проверяем, что сервер хранит зашифрованное событие');
        // The native SDK has already sent, received and decrypted the probe.
        // This separate read-only HTTP request verifies the wire representation;
        // it is not a replacement for the native SDK's encryption or sync.
        const auth = this.client.session();
        const baseUrl = validateServerUrl(auth.homeserverUrl);
        const response = await fetch(
          `${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/event/${encodeURIComponent(eventId)}`,
          { headers: { Authorization: `Bearer ${auth.accessToken}` }, signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`Сообщение получено SDK, но серверный шифротекст не удалось проверить (HTTP ${response.status}). Проверка шифрования не завершена.`);
        }
        const wireEvent: unknown = await response.json();
        if (controller.signal.aborted) throw new Error('Aborted');
        const proof = inspectEncryptedEvent(wireEvent, { eventId, roomId, sender: thisSender, body });
        const crypto = await import('expo-crypto');
        const bodySha256 = await crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256, body);
        if (controller.signal.aborted) throw new Error('Aborted');
        const checkpoint = { roomId, eventId, deviceId: this.deviceId, bodySha256, createdAt: started };
        this.vault.saveEncryptedCheckpoint(checkpoint);
        await this.vault.flush();
        this.checkpoint = checkpoint;
        this.checkpointFromPreviousClient = false;
        return { mode, encryption: proof, roomId, eventId, body, elapsedMs: Date.now() - started };
      }
      await this.vault.flush();
      return { mode, roomId, eventId, body, elapsedMs: Date.now() - started };
    } catch (error) {
      throw observerFailure ?? error;
    } finally {
      signal.removeEventListener('abort', cancel);
      controller.signal.removeEventListener('abort', rejectOnAbort);
      listener?.cancel();
      stateListener?.cancel();
      // Cleanup uses its own deadline: a cancelled test must still stop sync.
      const cleanup = new AbortController();
      const timer = setTimeout(() => cleanup.abort(), 10_000);
      try { await sync?.stop({ signal: cleanup.signal }); }
      finally {
        clearTimeout(timer);
        for (const object of new Set([listener, stateListener, timeline, room, sync, ...handles])) destroy(object);
      }
    }
  }

  async logout(signal: AbortSignal) {
    if (!this.disposed) await this.client.logout({ signal });
    this.dispose();
    await this.vault.erase();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.vault.stop();
    destroy(this.client);
  }
}
