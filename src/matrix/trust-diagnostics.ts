import type { IdentityTrust, TrustStatus } from './trust-types';

export type TrustTraceEvent =
  | 'started' | 'sync_idle' | 'sync_running' | 'sync_offline' | 'sync_error' | 'sync_terminated'
  | 'room_subscribed' | 'timeline_ready' | 'request_sent' | 'request_accepted'
  | 'sas_requested' | 'sas_started' | 'sas_displayed' | 'incoming_ignored' | 'sas_waiting_peer'
  | 'approval_started' | 'approval_returned' | 'approval_failed' | 'mismatch'
  | 'sdk_done' | 'sdk_cancelled' | 'sdk_failed' | 'aborted' | 'sync_stopped'
  | 'cleanup_started' | 'approval_wait' | 'cancel_started' | 'cancel_returned' | 'sync_stop_started' | 'wait_stopped'
  | 'trust_waiting' | 'trust_confirmed' | 'trust_pending';

export type ConnectionSample = {
  state: 'answered' | 'timeout' | 'error';
  elapsedMs: number;
  atMs: number;
};

type IdentityState = 'verified' | 'unverified' | 'missing' | 'changed';
type TrustSnapshot = {
  atMs: number;
  device: TrustStatus['deviceState'];
  own: IdentityState;
  peer: IdentityState | null;
};

export type TrustDiagnostics = {
  version: 'D5';
  target: 'own' | 'peer';
  outcome: 'running' | 'success' | 'pending' | 'failed' | 'interrupted';
  connection: ConnectionSample | null;
  trust: TrustSnapshot | null;
  events: { event: TrustTraceEvent; atMs: number }[];
};

// This journal accepts fixed event names and projected trust flags only. No SDK payload, profile, token,
// user/room ID, key, emoji or arbitrary error text is stored or published.
export class TrustDiagnosticsTracker {
  private started = Date.now();
  private closed = false;
  private polling = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private probeAbort: AbortController | undefined;
  private report: TrustDiagnostics;

  constructor(target: 'own' | 'peer', private probe: (signal: AbortSignal) => Promise<void>,
    private publish: (report: TrustDiagnostics) => void = () => {},
    private timing = { timeoutMs: 12_000, intervalMs: 30_000 }) {
    this.report = { version: 'D5', target, outcome: 'running', connection: null, trust: null, events: [] };
    this.record('started');
  }

  private emit() {
    this.publish({ ...this.report, connection: this.report.connection && { ...this.report.connection },
      trust: this.report.trust && { ...this.report.trust },
      events: this.report.events.map((item) => ({ ...item })) });
  }

  record(event: TrustTraceEvent) {
    if (this.closed) return;
    this.report.events.push({ event, atMs: Date.now() - this.started });
    if (this.report.events.length > 40) this.report.events.shift();
    this.emit();
  }

  recordTrust(status: TrustStatus) {
    if (this.closed) return;
    const identity = (value: IdentityTrust): IdentityState => value.violation ? 'changed'
      : !value.present ? 'missing' : value.verified ? 'verified' : 'unverified';
    this.report.trust = { atMs: Date.now() - this.started, device: status.deviceState,
      own: identity(status.ownIdentity), peer: status.peerIdentity ? identity(status.peerIdentity) : null };
    this.emit();
  }

  startConnectionChecks() {
    if (this.closed || this.polling) return;
    this.polling = true;
    void this.checkConnection();
  }

  private async checkConnection() {
    if (this.closed || !this.polling) return;
    const abort = new AbortController();
    this.probeAbort = abort;
    const started = Date.now();
    let timedOut = false;
    let cancel: () => void = () => {};
    const stopped = new Promise<null>((resolve) => {
      cancel = () => resolve(null);
      abort.signal.addEventListener('abort', cancel, { once: true });
    });
    const deadline = setTimeout(() => { timedOut = true; abort.abort(); }, this.timing.timeoutMs);
    // A stalled native future must not hold the diagnostic UI indefinitely.
    // Both branches are handled even if a native result arrives after abort.
    const result = await Promise.race([
      Promise.resolve().then(() => abort.signal.aborted ? null : this.probe(abort.signal))
        .then(() => 'answered' as const, () => 'error' as const),
      stopped,
    ]);
    clearTimeout(deadline);
    abort.signal.removeEventListener('abort', cancel);
    if (this.closed || !this.polling) return;
    this.report.connection = { state: timedOut ? 'timeout' : result ?? 'error',
      elapsedMs: Date.now() - started, atMs: started - this.started };
    this.emit();
    this.timer = setTimeout(() => void this.checkConnection(), this.timing.intervalMs);
  }

  finish(outcome: TrustDiagnostics['outcome']) {
    if (this.closed) return;
    this.closed = true;
    this.stopConnectionChecks();
    this.report.outcome = outcome;
    this.emit();
  }

  stopConnectionChecks() {
    this.polling = false;
    clearTimeout(this.timer);
    this.probeAbort?.abort();
  }
}

export function connectionSummary(report: TrustDiagnostics): string {
  const sample = report.connection;
  if (!sample) return 'Связь Tecno с Matrix: проверка ещё не завершилась.';
  const when = `на ${Math.round(sample.atMs / 1000)}-й секунде`;
  if (sample.state === 'answered') return `Связь Tecno с Matrix: SDK получил ответ за ${sample.elapsedMs} мс (${when}).`;
  if (sample.state === 'timeout') return `Связь Tecno с Matrix: SDK не получил ответ за ${Math.round(sample.elapsedMs / 1000)} с (${when}).`;
  return `Связь Tecno с Matrix: пробный запрос SDK завершился ошибкой (${when}).`;
}

const labels: Record<TrustTraceEvent, string> = {
  started: 'Проверка начата', sync_idle: 'Получение событий: подготовка', sync_running: 'Получение событий запущено',
  sync_offline: 'SDK сообщил об отсутствии связи', sync_error: 'Ошибка получения событий',
  sync_terminated: 'Получение событий прервалось', room_subscribed: 'Комната подключена',
  timeline_ready: 'Обработка событий комнаты готова', request_sent: 'Вызов запроса подтверждения завершился',
  request_accepted: 'Другая сторона приняла запрос', sas_requested: 'Запущено сравнение',
  sas_waiting_peer: 'Ожидаем запуска сравнения на iPad',
  sas_started: 'SDK начал сравнение', sas_displayed: 'Эмодзи получены', incoming_ignored: 'Отдельный входящий запрос пропущен',
  approval_started: 'Нажато «Всё совпало»', approval_returned: 'Вызов подтверждения SDK завершился без ошибки',
  approval_failed: 'Ошибка вызова подтверждения SDK', mismatch: 'Нажато «Не совпало»',
  sdk_done: 'SDK сообщил о завершении обмена', sdk_cancelled: 'SDK сообщил об отмене (причина не передана)',
  sdk_failed: 'SDK сообщил об ошибке обмена', aborted: 'Ожидание остановлено', sync_stopped: 'Получение событий остановлено',
  cleanup_started: 'Начата остановка проверки', approval_wait: 'Ожидаем возврата вызова сравнения перед остановкой',
  cancel_started: 'Вызвана отмена сравнения в SDK', cancel_returned: 'Вызов отмены в SDK завершился',
  sync_stop_started: 'Вызвана остановка получения событий',
  wait_stopped: 'Ожидание остановлено на Tecno',
  trust_waiting: 'Сравнение завершено; ожидаем доверия к ключам в SDK',
  trust_confirmed: 'Доверие подтверждено нативным SDK',
  trust_pending: 'Доверие пока не подтверждено; сохранены отдельные статусы',
};

export function trustSnapshotSummary(report: TrustDiagnostics): string {
  const status = report.trust;
  if (!status) return 'Состояние доверия ещё не прочитано.';
  const text = { verified: 'подтверждён', unverified: 'не подтверждён', unknown: 'неизвестно',
    missing: 'ключи не найдены', changed: 'ранее подтверждённые ключи изменились' };
  return `Статусы SDK на ${Math.round(status.atMs / 1000)}-й секунде: Tecno — ${text[status.device]}; первый аккаунт — ${text[status.own]}; iPad — ${status.peer ? text[status.peer] : 'не выбран'}.`;
}

export function formatTrustDiagnostics(report: TrustDiagnostics): string {
  return [`Диагностика ${report.version}: Tecno и ${report.target === 'peer' ? 'iPad' : 'Компьютер'}`,
    connectionSummary(report),
    trustSnapshotSummary(report),
    ...report.events.map((item) => `${Math.round(item.atMs / 1000)} с — ${labels[item.event]}`),
    'Ответ сервера проверяет только запрос с Tecno. Он не доказывает доставку финальных событий или связь iPad.',
  ].join('\n');
}
