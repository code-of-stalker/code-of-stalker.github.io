import type { ClientLike, RoomLike, SyncServiceLike } from '@unomed/react-native-matrix-sdk';
import type { AudioProbeReport } from './audio-probe';
import { AudioProbeError } from './audio-probe';
import { assertGroupMembers, groupParticipants } from './group-boundary';
import { assertMegolmRoomState } from './encrypted-proof';
import { waitForEncryptionState } from './encryption-readiness';
import { readMatrixJson } from './matrix-read';
import { validateServerUrl } from './network-types';
import type { GroupRoom } from './network-types';
import type { SessionVault } from './session-storage.native';
import type { VoiceProbeReport } from './voice-types';

function destroy(value: object | undefined) {
  if (value && 'uniffiDestroy' in value && typeof value.uniffiDestroy === 'function') value.uniffiDestroy();
}

export class NativeGroupTest {
  private current: GroupRoom | null;
  constructor(private client: ClientLike, private nativeSync: boolean, private vault: SessionVault, saved: GroupRoom | null) {
    this.current = saved ? { ...saved } : null;
  }

  get room() { return this.current ? { ...this.current } : null; }

  clearIfPeerChanged(ipadUserId: string) {
    if (this.current?.ipadUserId !== ipadUserId) this.current = null;
  }

  private async server(roomId: string, path: string, signal: AbortSignal) {
    const auth = this.client.session();
    return readMatrixJson(`${validateServerUrl(auth.homeserverUrl)}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/${path}`,
      auth.accessToken, signal);
  }

  private async withSync<T>(signal: AbortSignal, onStage: (stage: string) => void,
    task: (sync: SyncServiceLike, active: AbortSignal, keep: <H extends object>(handle: H) => H) => Promise<T>): Promise<T> {
    if (!this.nativeSync) throw new AudioProbeError('Сервер не поддерживает получение событий для групповой проверки.');
    if (signal.aborted) throw new AudioProbeError('Проверка остановлена.');
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
      onStage('Подключаем групповую комнату и обмен ключами');
      const builder = keep(this.client.syncService());
      const limited = keep(builder.withRoomListTimelineLimit(20));
      sync = keep(await limited.finish({ signal: controller.signal }));
      keep(sync.state({ onUpdate(state) {
        if (state === sdk.SyncServiceState.Error || state === sdk.SyncServiceState.Offline || state === sdk.SyncServiceState.Terminated) {
          failure = new AudioProbeError('Связь с Matrix-сервером прервалась. Групповая проверка остановлена.');
          controller.abort();
        }
      } }));
      await sync.start({ signal: controller.signal });
      if (controller.signal.aborted) throw new AudioProbeError('Подключение остановлено.');
      const result = await task(sync, controller.signal, keep);
      if (controller.signal.aborted) throw new AudioProbeError('Проверка остановлена.');
      return result;
    } catch (error) { throw failure ?? error; }
    finally {
      signal.removeEventListener('abort', cancel);
      for (const handle of handles) if ('cancel' in handle && typeof handle.cancel === 'function') {
        try { handle.cancel(); } catch { /* stop below still runs */ }
      }
      const cleanup = new AbortController();
      const deadline = setTimeout(() => cleanup.abort(), 10_000);
      try { await sync?.stop({ signal: cleanup.signal }); }
      finally { clearTimeout(deadline); for (const handle of new Set(handles.reverse())) destroy(handle); }
    }
  }

  private async openRoom(sync: SyncServiceLike, roomId: string, signal: AbortSignal, keep: <H extends object>(handle: H) => H) {
    const list = keep(sync.roomListService());
    await list.subscribeToRooms([roomId], { signal });
    return keep(await this.client.awaitRoomRemoteEcho(roomId, { signal }));
  }

  private async checkedRoom(room: RoomLike, target: GroupRoom, signal: AbortSignal) {
    const sdk = await import('@unomed/react-native-matrix-sdk');
    assertGroupMembers(await this.server(target.roomId, 'members', signal), this.client.userId(), target);
    assertMegolmRoomState(await this.server(target.roomId, 'state/m.room.encryption/', signal));
    await waitForEncryptionState(active => room.latestEncryptionState({ signal: active }), sdk.EncryptionState.Encrypted, signal);
  }

  async prepare(ipadUserId: string, computerValue: string, signal: AbortSignal, onStage: (stage: string) => void) {
    const peers = groupParticipants(this.client.userId(), ipadUserId, computerValue);
    if (this.current) {
      if (this.current.ipadUserId !== peers.ipadUserId || this.current.computerUserId !== peers.computerUserId) {
        throw new AudioProbeError('Групповая комната уже создана для других аккаунтов. Не меняй участников существующего теста.');
      }
      this.vault.saveGroupRoom(this.current);
      await this.vault.flush();
      return this.room!;
    }
    return this.withSync(signal, onStage, async (sync, active, keep) => {
      const sdk = await import('@unomed/react-native-matrix-sdk');
      onStage('Создаём закрытую зашифрованную комнату и приглашаем iPad и Компьютер');
      const roomId = await this.client.createRoom({ name: 'Watcher · тестовая группа',
        topic: 'Три тестовых аккаунта: Tecno, iPad, Компьютер.', isEncrypted: true, isDirect: false, isSpace: false,
        visibility: new sdk.RoomVisibility.Private(), preset: sdk.RoomPreset.PrivateChat,
        invite: [peers.ipadUserId, peers.computerUserId] }, { signal: active });
      this.current = { roomId, ...peers };
      this.vault.saveGroupRoom(this.current);
      await this.vault.flush();
      const room = await this.openRoom(sync, roomId, active, keep);
      assertMegolmRoomState(await this.server(roomId, 'state/m.room.encryption/', active));
      await waitForEncryptionState(sig => room.latestEncryptionState({ signal: sig }), sdk.EncryptionState.Encrypted, active);
      return this.room!;
    });
  }

  async sendAudio(signal: AbortSignal, onStage: (stage: string) => void): Promise<AudioProbeReport> {
    const target = this.room;
    if (!target) throw new AudioProbeError('Сначала создай групповую комнату.');
    return this.withSync(signal, onStage, async (sync, active, keep) => {
      const room = await this.openRoom(sync, target.roomId, active, keep);
      onStage('Проверяем ровно трёх участников и шифрование');
      await this.checkedRoom(room, target, active);
      const timeline = keep(await room.timeline({ signal: active }));
      await timeline.fetchMembers({ signal: active });
      const { sendAndCheckAudio } = await import('./audio-test.native');
      return sendAndCheckAudio(this.client, timeline, { roomId: target.roomId, peerUserId: target.ipadUserId },
        eventId => this.server(target.roomId, `event/${encodeURIComponent(eventId)}`, active), active, onStage);
    });
  }

  async readLatestAudio(sender: 'ipad' | 'computer', signal: AbortSignal, onStage: (stage: string) => void): Promise<VoiceProbeReport> {
    const target = this.room;
    if (!target) throw new AudioProbeError('Сначала создай групповую комнату.');
    const senderUserId = sender === 'ipad' ? target.ipadUserId : target.computerUserId;
    const label = sender === 'ipad' ? 'iPad' : 'Компьютер';
    return this.withSync(signal, onStage, async (sync, active, keep) => {
      const room = await this.openRoom(sync, target.roomId, active, keep);
      onStage('Проверяем ровно трёх участников и шифрование');
      await this.checkedRoom(room, target, active);
      const timeline = keep(await room.timeline({ signal: active }));
      await timeline.fetchMembers({ signal: active });
      const { readIncomingAudioEvent } = await import('./missed-audio.native');
      let cursor: string | undefined;
      for (let pageIndex = 0; pageIndex < 3; pageIndex++) {
        const response = await this.server(target.roomId,
          `messages?dir=b&limit=20${cursor ? `&from=${encodeURIComponent(cursor)}` : ''}`, active);
        if (!response || typeof response !== 'object' || !('chunk' in response) || !Array.isArray(response.chunk) ||
            response.chunk.length > 20 || !('start' in response) || typeof response.start !== 'string' ||
            (cursor !== undefined && response.start !== cursor) ||
            ('end' in response && response.end !== undefined && typeof response.end !== 'string')) {
          throw new AudioProbeError('Сервер не вернул корректный список сообщений группы.');
        }
        onStage(`Ищем последнее аудио от ${label}`);
        for (const item of response.chunk) {
          if (!item || typeof item !== 'object' || !('event_id' in item) || typeof item.event_id !== 'string' ||
              !('sender' in item) || typeof item.sender !== 'string' || !('type' in item) || typeof item.type !== 'string') {
            throw new AudioProbeError('В группе найдено сообщение с некорректными данными.');
          }
          if (item.sender !== senderUserId || !/^\$[^\s\0]{1,254}$/.test(item.event_id) ||
              (item.type !== 'm.room.encrypted' && item.type !== 'm.room.message')) continue;
          const found = await readIncomingAudioEvent(this.client, room, { roomId: target.roomId, peerUserId: senderUserId },
            item.event_id, (path, sig) => this.server(target.roomId, path, sig), active,
            stage => onStage(sender === 'computer' ? stage.replaceAll('iPad', 'Компьютера') : stage),
            async () => { await this.checkedRoom(room, target, active); });
          if (found) return found;
        }
        const next = 'end' in response && typeof response.end === 'string' ? response.end : undefined;
        if (!next || next === cursor) break;
        cursor = next;
      }
      throw new AudioProbeError(`Не нашли аудиосообщение от ${label} среди последних 60 событий группы.`);
    });
  }
}
