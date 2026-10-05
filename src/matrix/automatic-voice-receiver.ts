import { AudioProbeError } from './audio-probe';

export class ReceiverCleanupError extends AudioProbeError {
  constructor() { super('SDK не подтвердил остановку получения событий. Полностью останови приложение на Tecno и открой снова. Вход и ключи сохранены.'); }
}

type ReceiverOptions = {
  receive(signal: AbortSignal): Promise<void>;
  starting(): void;
  failed(error: unknown, retryMs: number): void;
};

// One owner of the long-running receiver. Pausing waits for real native
// cleanup, so a foreground action never starts a second sync on this client.
export class AutomaticVoiceReceiver {
  private enabled = false;
  private running: { controller: AbortController; settled: Promise<void> } | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private failures = 0;
  private blocked: ReceiverCleanupError | null = null;

  constructor(private options: ReceiverOptions) {}

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      clearTimeout(this.timer); this.timer = undefined;
      this.running?.controller.abort();
    } else this.schedule(50);
  }

  pause(): Promise<void> {
    this.setEnabled(false);
    return (this.running?.settled ?? Promise.resolve()).then(() => { if (this.blocked) throw this.blocked; });
  }

  restart() {
    this.failures = 0;
    clearTimeout(this.timer); this.timer = undefined;
    this.running?.controller.abort();
    if (this.enabled) this.schedule(50);
  }

  private schedule(delay: number) {
    if (!this.enabled || this.blocked || this.running || this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.enabled || this.running) return;
      const controller = new AbortController();
      const entry = { controller, settled: Promise.resolve() };
      this.running = entry;
      entry.settled = Promise.resolve().then(() => this.run(entry));
    }, delay);
  }

  private async run(entry: NonNullable<AutomaticVoiceReceiver['running']>) {
    let retryMs = 50;
    try {
      this.options.starting();
      await this.options.receive(entry.controller.signal);
      // A receiver should remain alive until cancelled. Avoid a tight loop if
      // an implementation ends unexpectedly.
      if (!entry.controller.signal.aborted) throw new Error('Receiver ended');
    } catch (error) {
      if (error instanceof ReceiverCleanupError) {
        this.blocked = error;
        this.options.failed(error, 0);
      } else if (!entry.controller.signal.aborted && this.enabled) {
        retryMs = Math.min(60_000, 15_000 * 2 ** Math.min(this.failures++, 2));
        this.options.failed(error, retryMs);
      }
    } finally {
      if (this.running === entry) this.running = null;
      this.schedule(retryMs);
    }
  }
}
