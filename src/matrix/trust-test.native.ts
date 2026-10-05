import type { ClientLike, EncryptionLike, SessionVerificationControllerLike, SyncServiceLike, TaskHandleLike, UserIdentityLike } from '@unomed/react-native-matrix-sdk';
import type { PeerRoom } from './network-types';
import type { SessionVault } from './session-storage.native';
import type { IdentityTrust, SasData, TrustReport, TrustStatus } from './trust-types';
import { sasData } from './sas-data';
import { TrustDiagnosticsTracker } from './trust-diagnostics';
import type { TrustDiagnostics, TrustTraceEvent } from './trust-diagnostics';
import { trustConfirmed } from './trust-status';

function destroy(object: object | undefined) {
  if (object && 'uniffiDestroy' in object && typeof object.uniffiDestroy === 'function') object.uniffiDestroy();
}

type ActiveVerification = {
  controller: SessionVerificationControllerLike;
  signal: AbortSignal;
  data: SasData | null;
  responded: boolean;
  humanConfirmed: boolean;
  approved: boolean;
  finished: boolean;
  mismatched: boolean;
  response: Promise<void> | null;
  complete: () => void;
  fail: (error: Error) => void;
  onStage: (stage: string) => void;
  counterpart: 'Компьютер' | 'iPad';
  diagnostics: TrustDiagnosticsTracker;
};

type KeepHandle = <H extends object>(handle: H) => H;

// All trust flags are read from the existing SDK crypto store. Nothing is reset,
// pinned or marked trusted in JS; each SAS confirmation is a user's decision.
export class NativeTrustTest {
  private active: ActiveVerification | null = null;
  private running = false;

  constructor(private client: ClientLike, private nativeSync: boolean, private vault: SessionVault,
    private peerRoom: () => PeerRoom | null,
    private statusWait = { timeoutMs: 75_000, intervalMs: 1_000 }) {}

  private async withSync<T>(signal: AbortSignal,
    task: (signal: AbortSignal, sync: SyncServiceLike, keep: KeepHandle) => Promise<T>,
    record: (event: TrustTraceEvent) => void = () => {}): Promise<T> {
    if (this.running) throw new Error('Другая проверка доверия ещё выполняется.');
    if (signal.aborted) throw new Error('Aborted');
    if (!this.nativeSync) throw new Error('Для подтверждения устройств нужен native sliding sync.');
    this.running = true;
    const abort = new AbortController();
    const cancel = () => abort.abort();
    signal.addEventListener('abort', cancel);
    if (signal.aborted) cancel();
    let sync: SyncServiceLike | undefined;
    let listener: TaskHandleLike | undefined;
    let failure: Error | undefined;
    let completed = false;
    const handles: object[] = [];
    const keep: KeepHandle = (handle) => { handles.push(handle); return handle; };
    try {
      const sdk = await import('@unomed/react-native-matrix-sdk');
      const builder = this.client.syncService(); handles.push(builder);
      const limited = builder.withRoomListTimelineLimit(20); handles.push(limited);
      sync = await limited.finish({ signal: abort.signal }); handles.push(sync);
      listener = sync.state({ onUpdate(state) {
        if (state === sdk.SyncServiceState.Running) record('sync_running');
        else if (state === sdk.SyncServiceState.Idle) record('sync_idle');
        else if (state === sdk.SyncServiceState.Offline) record('sync_offline');
        else if (state === sdk.SyncServiceState.Error) record('sync_error');
        else if (state === sdk.SyncServiceState.Terminated) record('sync_terminated');
        if ([sdk.SyncServiceState.Error, sdk.SyncServiceState.Offline, sdk.SyncServiceState.Terminated].includes(state)) {
          failure = new Error('Связь с Matrix прервалась. Доверие не подтверждено.'); abort.abort();
        }
      } }); handles.push(listener);
      await sync.start({ signal: abort.signal });
      const result = await task(abort.signal, sync, keep);
      if (abort.signal.aborted) throw new Error('Aborted');
      completed = true;
      return result;
    } catch (error) { throw failure ?? error; }
    finally {
      listener?.cancel();
      const cleanup = new AbortController();
      const timer = setTimeout(() => cleanup.abort(), 10_000);
      try {
        if (sync) record('sync_stop_started');
        await sync?.stop({ signal: cleanup.signal });
        if (sync) record('sync_stopped');
      }
      catch {
        if (completed) throw new Error('SDK не смог остановить получение событий после проверки. Перезапустите приложение.');
      } finally {
        signal.removeEventListener('abort', cancel);
        clearTimeout(timer);
        for (const handle of new Set(handles.reverse())) destroy(handle);
        this.running = false;
        if (completed && abort.signal.aborted) throw failure ?? new Error('Aborted');
      }
    }
  }

  private async readStatus(encryption: EncryptionLike, signal: AbortSignal): Promise<TrustStatus> {
    if (signal.aborted) throw new Error('Aborted');
    await encryption.waitForE2eeInitializationTasks({ signal });
    const sdk = await import('@unomed/react-native-matrix-sdk');
    const ownUserId = this.client.userId();
    const peer = this.peerRoom();
    const identities: UserIdentityLike[] = [];
    const read = async (userId: string): Promise<IdentityTrust> => {
      const identity = await encryption.userIdentity(userId, true, { signal });
      if (identity) identities.push(identity);
      return { userId, present: !!identity, verified: identity?.isVerified() ?? false,
        violation: identity?.hasVerificationViolation() ?? false };
    };
    try {
      const ownIdentity = await read(ownUserId);
      const peerIdentity = peer ? await read(peer.peerUserId) : null;
      const hasOwnDeviceToVerify = await encryption.hasDevicesToVerifyAgainst({ signal });
      if (signal.aborted) throw new Error('Aborted');
      const state = encryption.verificationState();
      return { deviceId: this.client.session().deviceId, ownIdentity, peerIdentity, hasOwnDeviceToVerify,
        deviceState: state === sdk.VerificationState.Verified ? 'verified'
          : state === sdk.VerificationState.Unverified ? 'unverified' : 'unknown' };
    } finally { identities.forEach(destroy); }
  }

  async inspect(signal: AbortSignal, onStage: (stage: string) => void): Promise<TrustStatus> {
    return this.withSync(signal, async (activeSignal) => {
      onStage('Читаем состояние доверия из нативного SDK');
      const encryption = this.client.encryption();
      try {
        const peer = this.peerRoom();
        return await this.waitForStatus(encryption, activeSignal, peer ? 'peer' : 'own',
          peer?.peerUserId ?? this.client.userId(), onStage, false);
      }
      finally { destroy(encryption); }
    });
  }

  private async waitForStatus(encryption: EncryptionLike, signal: AbortSignal,
    target: 'own' | 'peer', userId: string, onStage: (stage: string) => void,
    compared: boolean, diagnostics?: TrustDiagnosticsTracker): Promise<TrustStatus> {
    const deadline = Date.now() + this.statusWait.timeoutMs;
    let status = await this.readStatus(encryption, signal);
    diagnostics?.recordTrust(status);
    // SAS Done precedes signature upload and the next key query. The SDK sends
    // queued E2EE requests alongside its next sync (default long poll: 30 s).
    // Keep sync alive for more than two polls, not just reread the local store
    // for 10 s. userIdentity(..., true) only fetches missing identities.
    while (!trustConfirmed(status, target, userId) && Date.now() < deadline) {
      if (status.ownIdentity.violation || (target === 'peer' && status.peerIdentity?.violation)) break;
      if (signal.aborted) throw new Error('Aborted');
      const seconds = Math.max(1, Math.ceil((deadline - Date.now()) / 1000));
      onStage(`${compared ? 'Сравнение завершено. ' : ''}Ждём обновления доверия от SDK — до ${seconds} с`);
      await new Promise<void>((resolve, reject) => {
        const cancel = () => { clearTimeout(timer); reject(new Error('Aborted')); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); },
          Math.min(this.statusWait.intervalMs, Math.max(0, deadline - Date.now())));
        signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted) { signal.removeEventListener('abort', cancel); cancel(); }
      });
      status = await this.readStatus(encryption, signal);
      diagnostics?.recordTrust(status);
    }
    if (signal.aborted) throw new Error('Aborted');
    return status;
  }

  async respond(matches: boolean): Promise<void> {
    const active = this.active;
    if (!active || active.signal.aborted || !active.data || active.responded || active.finished) {
      throw new Error('Нет активного сравнения. Запустите подтверждение заново.');
    }
    active.responded = true;
    active.humanConfirmed = matches;
    active.mismatched = !matches;
    active.response = Promise.resolve().then(async () => {
      try {
        if (matches) {
          active.diagnostics.record('approval_started');
          active.diagnostics.startConnectionChecks();
          active.onStage(`Отправляем подтверждение Tecno. Другой экран: ${active.counterpart}`);
          await active.controller.approveVerification({ signal: active.signal });
          active.diagnostics.record('approval_returned');
          active.approved = true;
          if (active.finished) active.complete();
          else if (this.active === active && !active.signal.aborted) {
            active.onStage(`Вы подтвердили совпадение на Tecno. Ждём завершения обмена с ${active.counterpart === 'iPad' ? 'iPad' : 'Компьютером'}`);
          }
        } else {
          active.diagnostics.record('mismatch');
          await active.controller.declineVerification({ signal: active.signal });
          active.fail(new Error('Эмодзи или числа не совпали. Доверие не подтверждено.'));
        }
      } catch (error) {
        active.diagnostics.record('approval_failed');
        active.fail(error instanceof Error ? error : new Error('SDK не смог обработать сравнение. Доверие не подтверждено.'));
        throw error;
      }
    });
    return active.response;
  }

  async verify(target: 'own' | 'peer', signal: AbortSignal, onStage: (stage: string) => void,
    onSas: (data: SasData | null) => void,
    onDiagnostics?: (report: TrustDiagnostics) => void): Promise<TrustReport> {
    const started = Date.now();
    const peer = this.peerRoom();
    if (target === 'peer' && !peer) throw new Error('Сначала создайте комнату с аккаунтом iPad во вкладке «Диагностика».');
    const ownUserId = this.client.userId();
    const deviceId = this.client.session().deviceId;
    const userId = target === 'own' ? ownUserId : peer!.peerUserId;
    const diagnostics = new TrustDiagnosticsTracker(target, async (probeSignal) => {
      // getProfile calls Account.fetch_user_profile_of on the server, using
      // the same native HTTP client. The response and error payload are discarded.
      await this.client.getProfile(ownUserId, { signal: probeSignal });
    }, onDiagnostics);
    const stopWaiting = () => { diagnostics.stopConnectionChecks(); diagnostics.record('wait_stopped'); };
    signal.addEventListener('abort', stopWaiting, { once: true });
    if (signal.aborted) stopWaiting();
    try {
      const result = await this.withSync<TrustReport>(signal, async (activeSignal, sync, keep) => {
        const encryption = this.client.encryption();
        let controller: SessionVerificationControllerLike | undefined;
        let active: ActiveVerification | undefined;
        let cancelled: (() => void) | undefined;
        let success = false;
        try {
          onStage('Проверяем, готова ли сессия к подтверждению');
          const before = await this.readStatus(encryption, activeSignal);
          diagnostics.recordTrust(before);
          if (!before.ownIdentity.present) throw new Error('У первого аккаунта пока нет ключей подтверждения. Войдите в этот же аккаунт в Element на компьютере и завершите первичную настройку шифрования. Затем повторите проверку.');
          if (before.ownIdentity.violation || (target === 'peer' && before.peerIdentity?.violation)) {
            throw new Error('Ранее подтверждённые ключи аккаунта изменились. Доверие не подтверждено; автоматического принятия новых ключей нет.');
          }
          if (target === 'own' && !before.hasOwnDeviceToVerify) {
            throw new Error('Нет другой подтверждённой сессии первого аккаунта. Войдите в тот же аккаунт в Element на компьютере и оставьте его открытым.');
          }
          if (target === 'peer') {
            if (before.deviceState !== 'verified' || !before.ownIdentity.verified) {
              throw new Error('Сначала подтвердите сессию Tecno через Element на Компьютере. После этого можно подтвердить iPad.');
            }
            if (!before.peerIdentity?.present || before.peerIdentity.userId !== userId) throw new Error('У аккаунта iPad SDK не нашёл ключей подтверждения. Откройте Element X на iPad и завершите настройку шифрования.');
            if (before.peerIdentity.verified) {
              await this.vault.flush();
              success = true;
              return { outcome: 'verified' as const, target, userId, sasCompared: false, status: before, elapsedMs: Date.now() - started };
            }
          }
          let subscribePeerRoom: (() => Promise<void>) | undefined;
          if (target === 'peer') {
            onStage('Подключаем события комнаты с iPad');
            const roomList = keep(sync.roomListService());
            const subscribed = new Set<string>();
            subscribePeerRoom = async () => {
              if (activeSignal.aborted) throw new Error('Aborted');
              // Rust requestUserVerification picks get_dm_room(), which need not
              // be our saved message-test room. It can also create a new DM.
              const room = keep(this.client.getDmRoom(userId) ??
                await this.client.awaitRoomRemoteEcho(peer!.roomId, { signal: activeSignal }));
              if (subscribed.has(room.id())) return;
              subscribed.add(room.id());
              await roomList.subscribeToRooms([...subscribed], { signal: activeSignal });
              diagnostics.record('room_subscribed');
              // Keep the live timeline/decryption retries alive until SAS ends.
              // Own-device SAS uses to-device events; peer SAS uses room events.
              const timeline = keep(await room.timeline({ signal: activeSignal }));
              await timeline.fetchMembers({ signal: activeSignal });
              diagnostics.record('timeline_ready');
            };
            await subscribePeerRoom();
          }
          controller = await this.client.getSessionVerificationController({ signal: activeSignal });
          const verification = controller;
          let resolve: () => void = () => {};
          let reject: (error: Error) => void = () => {};
          const done = new Promise<void>((ok, no) => { resolve = ok; reject = no; });
          void done.catch(() => {});
          active = { controller, signal: activeSignal, data: null, responded: false, humanConfirmed: false, approved: false,
            finished: false, mismatched: false, response: null, complete: resolve, fail: reject, onStage,
            counterpart: target === 'peer' ? 'iPad' : 'Компьютер', diagnostics };
          const current = active;
          this.active = current;
          const live = () => this.active === current && !activeSignal.aborted;
          let sasStarted = false;
          let readyHandled = false;
          cancelled = () => { diagnostics.stopConnectionChecks(); diagnostics.record('aborted'); current.fail(new Error('Aborted')); };
          activeSignal.addEventListener('abort', cancelled);
          controller.setDelegate({
            // Only our outgoing request is used. Unsolicited requests are not
            // acknowledged, accepted, or allowed to replace the selected user.
            didReceiveVerificationRequest() { if (live()) diagnostics.record('incoming_ignored'); },
            didAcceptVerificationRequest() {
              if (live()) diagnostics.record('request_accepted');
              if (!live() || sasStarted || readyHandled) return;
              readyHandled = true;
              if (target === 'peer') {
                // We sent this user-verification request. Element X, as its
                // recipient, starts SAS after accepting it. The Rust controller
                // accepts that incoming flow through its Transitioned listener.
                // Starting SAS here as well can race the recipient's start and
                // replace the controller's active SAS while its RPC is in flight.
                diagnostics.record('sas_waiting_peer');
                onStage('iPad принял запрос. Ждём начала сравнения в Element X');
                return;
              }
              // Leave the native ready callback before starting SAS. The other
              // client may start it in the meantime, in which case do not repeat.
              void Promise.resolve().then(async () => {
                if (live() && !sasStarted) {
                  diagnostics.record('sas_requested');
                  await verification.startSasVerification({ signal: activeSignal });
                }
              }).catch(current.fail);
            },
            didStartSasVerification() {
              if (!live()) return;
              sasStarted = true;
              diagnostics.record('sas_started');
              onStage('Готовим эмодзи для сравнения на двух экранах');
            },
            didReceiveVerificationData(data) {
              try {
                if (!live() || current.responded) return;
                current.data = sasData(data, userId);
                diagnostics.record('sas_displayed');
                onSas(current.data);
                onStage('Сравните все эмодзи или числа в том же порядке на обоих экранах');
              } catch (error) { current.fail(error instanceof Error ? error : new Error('SDK не смог прочитать данные сравнения.')); }
              finally { if (data.tag === 'Emojis') data.inner.emojis.forEach(destroy); }
            },
            didFail() { if (live()) { diagnostics.record('sdk_failed'); current.fail(new Error('Нативный SDK не завершил подтверждение. Доверие не подтверждено.')); } },
            didCancel() { if (live()) { diagnostics.record('sdk_cancelled'); current.fail(new Error(current.mismatched
              ? 'Эмодзи или числа не совпали. Доверие не подтверждено.' : 'SDK сообщил об отмене сравнения. Это может быть отмена, тайм-аут или ошибка протокола; точный код SDK не передаёт. Доверие не подтверждено.')); } },
            didFinish() {
              if (!live()) return;
              current.finished = true;
              diagnostics.record('sdk_done');
              if (!current.humanConfirmed) current.fail(new Error('SDK завершил обмен без вашего сравнения. Проверка доверия не пройдена.'));
              else if (current.approved) current.complete();
            },
          });
          if (activeSignal.aborted) throw new Error('Aborted');
          onStage(target === 'own'
            ? 'На Компьютере примите в Element запрос подтверждения Tecno и выберите сравнение эмодзи'
            : 'На iPad примите в Element X запрос подтверждения и выберите сравнение эмодзи');
          if (target === 'own') await controller.requestDeviceVerification({ signal: activeSignal });
          else {
            await controller.requestUserVerification(userId, { signal: activeSignal });
            // Discover a DM created by the SDK as part of the request, too.
            await subscribePeerRoom!();
          }
          diagnostics.record('request_sent');
          await done;
          onSas(null);
          onStage('Сравнение завершено. Проверяем результат доверия в SDK');
          diagnostics.record('trust_waiting');
          const status = await this.waitForStatus(encryption, activeSignal, target, userId, onStage, true, diagnostics);
          if (status.deviceId !== deviceId) throw new Error('Устройство Matrix изменилось во время сравнения. Проверка доверия не пройдена.');
          if (status.ownIdentity.violation || (target === 'peer' && status.peerIdentity?.violation)) {
            throw new Error('После сравнения SDK сообщил об изменении ранее подтверждённых ключей. Доверие не подтверждено.');
          }
          const outcome = trustConfirmed(status, target, userId) ? 'verified' : 'pending';
          diagnostics.record(outcome === 'verified' ? 'trust_confirmed' : 'trust_pending');
          await this.vault.flush();
          if (activeSignal.aborted) throw new Error('Aborted');
          success = true;
          return { outcome, target, userId, sasCompared: true, status, elapsedMs: Date.now() - started };
        } finally {
          diagnostics.stopConnectionChecks();
          diagnostics.record('cleanup_started');
          if (active) {
            this.active = null;
            if (cancelled) activeSignal.removeEventListener('abort', cancelled);
            if (active.response) {
              diagnostics.record('approval_wait');
              await active.response.catch(() => {});
            }
          }
          // Rust holds a delegate read lock while invoking callbacks. Leave
          // that callback's JS turn before the synchronous setDelegate write.
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          controller?.setDelegate(undefined);
          // A completed SAS flow cannot be undone. Pending trust is a separate
          // result; do not send cancellation after a valid native completion.
          if (controller && !success && !(active?.finished && active.approved)) {
            const cleanup = new AbortController();
            const timer = setTimeout(() => cleanup.abort(), 10_000);
            try {
              diagnostics.record('cancel_started');
              await controller.cancelVerification({ signal: cleanup.signal });
              diagnostics.record('cancel_returned');
            } catch { /* Keep the original failure. */ }
            finally { clearTimeout(timer); }
          }
          onSas(null);
          destroy(controller); destroy(encryption);
        }
      }, (event) => diagnostics.record(event));
      diagnostics.finish(result.outcome === 'verified' ? 'success' : 'pending');
      return result;
    } catch (error) {
      diagnostics.finish(signal.aborted ? 'interrupted' : 'failed');
      throw error;
    } finally {
      signal.removeEventListener('abort', stopWaiting);
    }
  }

}
