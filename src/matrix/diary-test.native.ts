import type { ClientLike, RoomLike, SyncServiceLike } from '@unomed/react-native-matrix-sdk';
import type { AudioCheckpoint } from './audio-checkpoint';
import type { AudioProbeReport } from './audio-probe';
import { AudioProbeError } from './audio-probe';
import { assertDiaryOwnerOnly, selectDiaryRecord } from './diary-access';
import { assertMegolmRoomState } from './encrypted-proof';
import { waitForEncryptionState } from './encryption-readiness';
import { readMatrixJson } from './matrix-read';
import { validateServerUrl } from './network-types';
import type { NativePeerTest } from './peer-test.native';
import type { SessionVault } from './session-storage.native';
import { appendAudioHistory } from './saved-session';
import type { VoiceBeforeUpload, VoiceDraft, VoiceProbeReport } from './voice-types';

function destroy(value: object | undefined) {
  if (value && 'uniffiDestroy' in value && typeof value.uniffiDestroy === 'function') value.uniffiDestroy();
}

export class NativeDiaryTest {
  private roomId: string | null;
  private history: AudioCheckpoint[];
  private sharedEventId: string | null;
  constructor(private client: ClientLike, private nativeSync: boolean, private vault: SessionVault,
    private peerTest: NativePeerTest, roomId: string | null, history: readonly AudioCheckpoint[], sharedEventId: string | null = null) {
    this.roomId = roomId;
    this.history = history.map(item => ({ ...item }));
    this.sharedEventId = sharedEventId;
  }

  get room() { return this.roomId; }
  get shared() { return this.sharedEventId; }
  get records() { return [...this.history].reverse().map(item => ({ eventId: item.eventId, receivedAt: item.createdAt, durationMs: item.durationMs })); }

  private async server(roomId: string, path: string, signal: AbortSignal) {
    const session = this.client.session();
    return readMatrixJson(`${validateServerUrl(session.homeserverUrl)}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/${path}`,
      session.accessToken, signal);
  }

  private async checkRoom(roomId: string, room: RoomLike, signal: AbortSignal) {
    const sdk = await import('@unomed/react-native-matrix-sdk');
    assertDiaryOwnerOnly(await this.server(roomId, 'members', signal), this.client.userId());
    assertMegolmRoomState(await this.server(roomId, 'state/m.room.encryption/', signal));
    await waitForEncryptionState(active => room.latestEncryptionState({ signal: active }), sdk.EncryptionState.Encrypted, signal);
  }

  private async checkOwnTrust(signal: AbortSignal) {
    const sdk = await import('@unomed/react-native-matrix-sdk');
    const encryption = this.client.encryption();
    let identity: Awaited<ReturnType<typeof encryption.userIdentity>> | undefined;
    try {
      await encryption.waitForE2eeInitializationTasks({ signal });
      identity = await encryption.userIdentity(this.client.userId(), true, { signal });
      if (!identity?.isVerified() || identity.hasVerificationViolation() ||
          encryption.verificationState() !== sdk.VerificationState.Verified) {
        throw new AudioProbeError('Сначала подтверди Tecno через Компьютер. Ключи дневника пока не проверены.');
      }
    } finally { destroy(identity ?? undefined); destroy(encryption); }
  }

  private async withSync<T>(signal: AbortSignal, onStage: (stage: string) => void,
    task: (sync: SyncServiceLike, active: AbortSignal, keep: <H extends object>(handle: H) => H) => Promise<T>): Promise<T> {
    if (!this.nativeSync) throw new AudioProbeError('Сервер не поддерживает получение событий для личного дневника.');
    if (signal.aborted) throw new AudioProbeError('Действие отменено.');
    const sdk = await import('@unomed/react-native-matrix-sdk');
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    const handles: object[] = [];
    const keep = <H extends object>(handle: H): H => { handles.push(handle); return handle; };
    let sync: SyncServiceLike | undefined;
    let failure: Error | undefined;
    try {
      onStage('Подключаем дневник и обмен ключами');
      const builder = keep(this.client.syncService());
      const limited = keep(builder.withRoomListTimelineLimit(20));
      sync = keep(await limited.finish({ signal: controller.signal }));
      keep(sync.state({ onUpdate(state) {
        if (state === sdk.SyncServiceState.Error || state === sdk.SyncServiceState.Offline || state === sdk.SyncServiceState.Terminated) {
          failure = new AudioProbeError('Связь с сервером прервалась. Проверь дневник перед повтором.'); controller.abort();
        }
      } }));
      await sync.start({ signal: controller.signal });
      if (controller.signal.aborted) throw new AudioProbeError('Подключение к дневнику остановлено.');
      const result = await task(sync, controller.signal, keep);
      if (controller.signal.aborted) throw new AudioProbeError('Действие дневника отменено.');
      return result;
    } catch (error) { throw failure ?? error; }
    finally {
      signal.removeEventListener('abort', cancel);
      try { for (const handle of handles) if ('cancel' in handle && typeof handle.cancel === 'function') handle.cancel(); }
      finally {
        const cleanup = new AbortController();
        const timer = setTimeout(() => cleanup.abort(), 10_000);
        try { await sync?.stop({ signal: cleanup.signal }); }
        finally { clearTimeout(timer); for (const handle of new Set(handles.reverse())) destroy(handle); }
      }
    }
  }

  private async openRoom(sync: SyncServiceLike, roomId: string, signal: AbortSignal, keep: <H extends object>(handle: H) => H) {
    const list = keep(sync.roomListService());
    await list.subscribeToRooms([roomId], { signal });
    return keep(await this.client.awaitRoomRemoteEcho(roomId, { signal }));
  }

  async prepare(signal: AbortSignal, onStage: (stage: string) => void): Promise<string> {
    return this.withSync(signal, onStage, async (sync, active, keep) => {
      const sdk = await import('@unomed/react-native-matrix-sdk');
      let roomId = this.roomId;
      if (!roomId) {
        onStage('Создаём личную зашифрованную комнату без приглашённых');
        roomId = await this.client.createRoom({ name: 'Watcher · личный тестовый дневник',
          topic: 'Тестовые записи. Других участников не приглашать.', isEncrypted: true, isDirect: false, isSpace: false,
          visibility: new sdk.RoomVisibility.Private(), preset: sdk.RoomPreset.PrivateChat, invite: [] }, { signal: active });
        this.vault.saveDiaryRoom(roomId);
        await this.vault.flush();
        this.roomId = roomId;
      }
      const room = await this.openRoom(sync, roomId, active, keep);
      onStage('Проверяем, что в дневнике только твой аккаунт и включено шифрование');
      await this.checkRoom(roomId, room, active);
      await this.vault.flush();
      return roomId;
    });
  }

  async saveVoice(draft: VoiceDraft, signal: AbortSignal, onStage: (stage: string) => void,
    beforeUpload: VoiceBeforeUpload): Promise<VoiceProbeReport> {
    const roomId = this.roomId;
    if (!roomId) throw new AudioProbeError('Сначала создай личный тестовый дневник. Черновик сохранён на Tecno.');
    if (this.history.length >= 2) throw new AudioProbeError('Для проверки уже сохранены две записи. Черновик не отправлен.');
    const { prepareVoice, discardVoiceFile } = await import('./voice-files.native');
    const voice = await prepareVoice(draft, signal);
    const crypto = await import('expo-crypto');
    const audioSha256 = Array.from(new Uint8Array(await crypto.digest(crypto.CryptoDigestAlgorithm.SHA256, voice.bytes)),
      byte => byte.toString(16).padStart(2, '0')).join('');
    let playbackUri: string | undefined, delivered = false;
    try {
      const result = await this.withSync(signal, onStage, async (sync, active, keep) => {
        const room = await this.openRoom(sync, roomId, active, keep);
        await this.checkRoom(roomId, room, active);
        await this.checkOwnTrust(active);
        const timeline = keep(await room.timeline({ signal: active }));
        await timeline.fetchMembers({ signal: active });
        const { sendAndCheckAudio } = await import('./audio-test.native');
        const sent = await sendAndCheckAudio(this.client, timeline, { roomId, peerUserId: this.client.userId() },
          eventId => this.server(roomId, `event/${encodeURIComponent(eventId)}`, active), active, onStage, voice, beforeUpload);
        if (!sent.playbackUri) throw new AudioProbeError('SDK не подготовил запись дневника для прослушивания.');
        playbackUri = sent.playbackUri;
        const checkpoint: AudioCheckpoint = { roomId, eventId: sent.eventId, senderUserId: this.client.userId(),
          deviceId: this.client.session().deviceId, audioSha256, byteLength: sent.byteLength,
          durationMs: sent.durationMs, createdAt: Date.now() };
        this.vault.saveDiaryAudioCheckpoint(checkpoint);
        await this.vault.flush();
        this.history = appendAudioHistory(this.history, checkpoint);
        return { ...sent, playbackUri: sent.playbackUri };
      });
      delivered = true;
      return result;
    } catch (error) {
      throw error instanceof AudioProbeError ? error : new AudioProbeError('Запись могла попасть в личный дневник, но проверка не завершилась. Проверь дневник на Компьютере перед повтором.');
    } finally { if (!delivered) discardVoiceFile(playbackUri); }
  }

  async readVoice(eventId: string, signal: AbortSignal, onStage: (stage: string) => void): Promise<VoiceProbeReport> {
    const roomId = this.roomId;
    if (!roomId) throw new AudioProbeError('Личный дневник ещё не создан.');
    const record = selectDiaryRecord(this.history, roomId, this.client.userId(), eventId);
    let playbackUri: string | undefined;
    try {
      return await this.withSync(signal, onStage, async (sync, active, keep) => {
        const room = await this.openRoom(sync, roomId, active, keep);
        await this.checkRoom(roomId, room, active);
        const { readSavedAudio } = await import('./read-audio-checkpoint.native');
        const result = await readSavedAudio(this.client, record,
          (path, requestSignal) => this.server(roomId, path, requestSignal), active, onStage, () => this.vault.flush());
        playbackUri = result.playbackUri;
        return result;
      });
    } catch (error) {
      if (playbackUri) (await import('./incoming-audio-files.native')).discardIncomingAudio(playbackUri);
      throw error;
    }
  }

  async shareVoice(eventId: string, signal: AbortSignal, onStage: (stage: string) => void): Promise<AudioProbeReport> {
    const roomId = this.roomId;
    if (!roomId || !this.peerTest.room) throw new AudioProbeError('Сначала подготовь комнату с iPad. Личная запись не передана.');
    if (this.sharedEventId) throw new AudioProbeError('Для проверки уже передана одна личная запись. Другую запись оставь только в дневнике.');
    selectDiaryRecord(this.history, roomId, this.client.userId(), eventId);
    assertDiaryOwnerOnly(await this.server(roomId, 'members', signal), this.client.userId());
    const { discardIncomingAudio } = await import('./incoming-audio-files.native');
    const original = await this.readVoice(eventId, signal, onStage);
    try {
      onStage('Передаём только выбранную запись в отдельную комнату с iPad');
      const shared = await this.peerTest.sendAudio(signal, onStage,
        { uri: original.playbackUri, durationMs: original.durationMs, waveform: [] }, async () => {});
      try {
        this.vault.saveDiaryShare(eventId, shared.eventId);
        await this.vault.flush();
        this.sharedEventId = eventId;
      } catch {
        (await import('./voice-files.native')).discardVoiceFile(shared.playbackUri);
        throw new AudioProbeError('Запись могла прийти на iPad, но отметка о передаче не сохранилась. Проверь iPad перед повтором.');
      }
      return shared;
    } finally { discardIncomingAudio(original.playbackUri); }
  }
}
