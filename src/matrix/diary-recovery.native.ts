import type { ClientLike, RoomLike, SyncServiceLike } from '@unomed/react-native-matrix-sdk';
import { AudioProbeError } from './audio-probe';
import { assertDiaryOwnerOnly } from './diary-access';
import { discoverDiaryRoom } from './diary-recovery-discovery';
import { restoreDiaryKeys } from './diary-recovery-keys';
import { assertMegolmRoomState } from './encrypted-proof';
import { waitForEncryptionState } from './encryption-readiness';
import { readMatrixJson } from './matrix-read';
import { validateServerUrl } from './network-types';
import { readIncomingAudioEvent } from './missed-audio.native';
import type { IncomingVoiceReport } from './audio-checkpoint';

function destroy(handle: object | undefined) {
  if (handle && 'uniffiDestroy' in handle && typeof handle.uniffiDestroy === 'function') handle.uniffiDestroy();
}

export class NativeDiaryRecovery {
  constructor(private client: ClientLike, private nativeSync: boolean) {}

  private read(path: string, signal: AbortSignal) {
    const session = this.client.session();
    return readMatrixJson(`${validateServerUrl(session.homeserverUrl)}/_matrix/client/v3/${path}`,
      session.accessToken, signal);
  }

  private async checkedRoom(roomId: string, room: RoomLike, signal: AbortSignal) {
    const sdk = await import('@unomed/react-native-matrix-sdk');
    assertDiaryOwnerOnly(await this.read(`rooms/${encodeURIComponent(roomId)}/members`, signal), this.client.userId());
    assertMegolmRoomState(await this.read(`rooms/${encodeURIComponent(roomId)}/state/m.room.encryption/`, signal));
    await waitForEncryptionState(active => room.latestEncryptionState({ signal: active }), sdk.EncryptionState.Encrypted, signal);
  }

  private async withSync<T>(signal: AbortSignal, onStage: (stage: string) => void,
    task: (sync: SyncServiceLike, active: AbortSignal, keep: <H extends object>(handle: H) => H) => Promise<T>): Promise<T> {
    if (!this.nativeSync) throw new AudioProbeError('Сервер не поддерживает получение старых событий дневника.');
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    const handles: object[] = [];
    const keep = <H extends object>(handle: H): H => { handles.push(handle); return handle; };
    let sync: SyncServiceLike | undefined;
    let failure: Error | undefined;
    try {
      onStage('Подключаем новую установку к личной комнате');
      const builder = keep(this.client.syncService());
      const limited = keep(builder.withRoomListTimelineLimit(20));
      sync = keep(await limited.finish({ signal: controller.signal }));
      const sdk = await import('@unomed/react-native-matrix-sdk');
      keep(sync.state({ onUpdate(state) {
        if (state === sdk.SyncServiceState.Error || state === sdk.SyncServiceState.Offline || state === sdk.SyncServiceState.Terminated) {
          failure = new AudioProbeError('Связь с сервером прервалась. Вход новой установки сохранён.');
          controller.abort();
        }
      } }));
      await sync.start({ signal: controller.signal });
      return await task(sync, controller.signal, keep);
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

  async recoverOneRecord(code: string, signal: AbortSignal, onStage: (stage: string) => void): Promise<IncomingVoiceReport> {
    await restoreDiaryKeys(this.client, code, signal, onStage);
    onStage('Находим дневник без данных прежней установки');
    const roomId = await discoverDiaryRoom((path, active) => this.read(path, active), this.client.userId(), signal, onStage);
    return this.withSync(signal, onStage, async (sync, active, keep) => {
      const list = keep(sync.roomListService());
      await list.subscribeToRooms([roomId], { signal: active });
      const room = keep(await this.client.awaitRoomRemoteEcho(roomId, { signal: active }));
      await this.checkedRoom(roomId, room, active);
      const timeline = keep(await room.timeline({ signal: active }));
      await timeline.fetchMembers({ signal: active });
      const seen = new Set<string>();
      let cursor: string | undefined;
      for (let pageNumber = 0; pageNumber < 3; pageNumber++) {
        onStage('Ищем прежнюю запись в дневнике');
        const page = await this.read(`rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=20${cursor ? `&from=${encodeURIComponent(cursor)}` : ''}`, active);
        if (!page || typeof page !== 'object' || !('chunk' in page) || !Array.isArray(page.chunk) ||
            page.chunk.length > 20 || (cursor !== undefined && (!('start' in page) || page.start !== cursor)) ||
            ('end' in page && page.end !== undefined && typeof page.end !== 'string')) {
          throw new AudioProbeError('Сервер не подтвердил историю личного дневника.');
        }
        for (const item of page.chunk) {
          if (!item || typeof item !== 'object' || !('event_id' in item) || typeof item.event_id !== 'string' ||
              !/^\$[^\s\0]{1,254}$/.test(item.event_id) || !('sender' in item) || typeof item.sender !== 'string') {
            throw new AudioProbeError('В истории личного дневника обнаружено некорректное событие.');
          }
          if (seen.has(item.event_id)) throw new AudioProbeError('Сервер повторил событие дневника. Чтение остановлено.');
          seen.add(item.event_id);
          if (item.sender !== this.client.userId() || !('type' in item) || item.type !== 'm.room.encrypted') continue;
          const result = await readIncomingAudioEvent(this.client, room, { roomId, peerUserId: this.client.userId() },
            item.event_id, (path, requestSignal) => this.read(`rooms/${encodeURIComponent(roomId)}/${path}`, requestSignal),
            active, stage => onStage(stage.replaceAll('iPad', 'резервной копии')),
            async () => this.checkedRoom(roomId, room, active));
          if (result) return result;
        }
        const next = 'end' in page && typeof page.end === 'string' ? page.end : undefined;
        if (!next || next === cursor) break;
        cursor = next;
      }
      throw new AudioProbeError('Среди последних 60 событий личного дневника не найдена аудиозапись.');
    });
  }
}
