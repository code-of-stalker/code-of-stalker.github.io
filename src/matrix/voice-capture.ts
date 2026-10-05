import { AudioProbeError } from './audio-probe';
import { validateVoiceDraft, voiceWaveform, VOICE_LIMIT_SECONDS } from './voice-types';
import type { VoiceDraft } from './voice-types';

export type CaptureState = { phase: 'idle' | 'preparing' | 'recording' | 'stopping' | 'ready' | 'error'; durationMs: number; draft: VoiceDraft | null; error: string };
export const emptyCapture: CaptureState = { phase: 'idle', durationMs: 0, draft: null, error: '' };
type RecorderPort = {
  readonly uri: string | null;
  prepareToRecordAsync(): Promise<void>;
  record(options: { forDuration: number }): void;
  stop(): Promise<void>;
  getStatus(): { isRecording: boolean; canRecord: boolean; durationMillis: number; metering?: number };
};
type CapturePorts = {
  recorder: RecorderPort;
  permission(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  mode(recording: boolean): Promise<void>;
  foreground(): boolean;
  discard(uri: string | undefined): void;
  changed(state: CaptureState): void;
};

// Serializes permission/prepare/stop so cancel cannot be followed by a late
// microphone start. Recorder ownership itself stays with useAudioRecorder.
export class VoiceCapture {
  private state: CaptureState = { ...emptyCapture };
  private job: Promise<void> | undefined;
  private cancelled = false;
  private disposed = false;
  private prepared = false;
  private uri: string | undefined;
  private started = 0;
  private samples: number[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private ports: CapturePorts) {}

  restoreDraft(draft: VoiceDraft): boolean {
    if (this.disposed || this.job || this.state.phase !== 'idle') return false;
    validateVoiceDraft(draft);
    this.cancelled = false;
    this.uri = draft.uri;
    this.publish({ phase: 'ready', draft: { ...draft, waveform: [...draft.waveform] }, durationMs: draft.durationMs, error: '' });
    return true;
  }

  replaceReadyDraft(draft: VoiceDraft): boolean {
    if (this.disposed || this.job || this.state.phase !== 'ready') return false;
    validateVoiceDraft(draft);
    const previous = this.state.draft?.uri;
    this.uri = draft.uri;
    this.publish({ draft: { ...draft, waveform: [...draft.waveform] }, durationMs: draft.durationMs });
    if (previous !== draft.uri) this.ports.discard(previous);
    return true;
  }

  private publish(patch: Partial<CaptureState>) {
    this.state = { ...this.state, ...patch };
    if (!this.disposed) this.ports.changed(this.state);
  }
  private active() { return !this.cancelled && !this.disposed && this.ports.foreground(); }
  private clearTimer() { clearInterval(this.timer); this.timer = undefined; }
  private track(work: Promise<void>): Promise<void> {
    const tracked = work.finally(() => { if (this.job === tracked) this.job = undefined; });
    this.job = tracked;
    return tracked;
  }

  start(): Promise<void> {
    if (this.disposed || this.job || this.state.phase === 'recording') return this.job ?? Promise.resolve();
    this.cancelled = false;
    this.ports.discard(this.state.draft?.uri);
    this.uri = undefined; this.samples = [];
    this.publish({ ...emptyCapture, phase: 'preparing' });
    return this.track(this.prepare());
  }

  private async prepare() {
    try {
      const permission = await this.ports.permission();
      if (!permission.granted) throw new AudioProbeError(permission.canAskAgain
        ? 'Для записи нужен доступ к микрофону. Разреши его при следующем нажатии.'
        : 'Разреши микрофон в настройках приложения на Tecno, затем вернись и нажми запись.');
      if (!this.active()) { this.publish({ phase: 'idle' }); return; }
      await this.ports.mode(true);
      if (!this.active()) { await this.ports.mode(false); this.publish({ phase: 'idle' }); return; }
      this.prepared = true;
      await this.ports.recorder.prepareToRecordAsync();
      this.uri = this.ports.recorder.uri ?? undefined;
      if (!this.active()) { await this.finish(false); return; }
      this.ports.recorder.record({ forDuration: VOICE_LIMIT_SECONDS });
      this.started = Date.now();
      this.publish({ phase: 'recording' });
      this.timer = setInterval(() => this.poll(), 200);
    } catch (error) {
      await this.cleanup();
      this.publish({ phase: this.cancelled ? 'idle' : 'error', error: this.cancelled ? ''
        : error instanceof AudioProbeError ? error.message : 'Не удалось начать запись. Проверь разрешение микрофона и попробуй снова.' });
    }
  }

  private poll() {
    if (this.state.phase !== 'recording') return;
    try {
      if (!this.ports.foreground()) { void this.cancel(); return; }
      const status = this.ports.recorder.getStatus();
      if (typeof status.metering === 'number' && this.samples.length < 120) this.samples.push(status.metering);
      this.publish({ durationMs: Math.round(status.durationMillis || Math.min(Date.now() - this.started, VOICE_LIMIT_SECONDS * 1000)) });
      if (!status.isRecording || this.state.durationMs >= VOICE_LIMIT_SECONDS * 1000) void this.stop();
    } catch { void this.cancel(); }
  }

  nativeFinished(hasError: boolean, uri: string | null) {
    if (this.state.phase !== 'recording') return;
    if (uri) this.uri = uri;
    if (hasError) { void this.cancel('Запись прервалась. Запиши короткую фразу ещё раз.'); }
    else void this.stop();
  }

  stop(): Promise<void> {
    if (this.job) return this.job;
    if (this.state.phase !== 'recording') return Promise.resolve();
    return this.track(this.finish(true));
  }

  private async finish(keep: boolean) {
    this.clearTimer();
    this.publish({ phase: 'stopping' });
    let durationMs = this.state.durationMs;
    try {
      const status = this.ports.recorder.getStatus();
      durationMs = Math.round(status.durationMillis || Math.min(Date.now() - this.started, VOICE_LIMIT_SECONDS * 1000));
      if (status.isRecording || status.canRecord) await this.ports.recorder.stop();
      this.prepared = false;
      this.uri ??= this.ports.recorder.uri ?? undefined;
      await this.ports.mode(false);
      if (!keep || !this.active()) { this.ports.discard(this.uri); this.publish({ ...emptyCapture }); return; }
      const draft = { uri: this.uri ?? '', durationMs, waveform: voiceWaveform(this.samples) };
      validateVoiceDraft(draft);
      this.publish({ phase: 'ready', draft, durationMs, error: '' });
    } catch (error) {
      await this.cleanup();
      this.publish({ phase: 'error', draft: null, error: error instanceof AudioProbeError ? error.message : 'Не удалось завершить запись. Запиши фразу ещё раз.' });
    }
  }

  private async cleanup() {
    this.clearTimer();
    if (this.prepared) { try { await this.ports.recorder.stop(); } catch {} }
    this.prepared = false;
    try { await this.ports.mode(false); } catch {}
    this.ports.discard(this.uri);
  }

  cancel(message = ''): Promise<void> {
    this.cancelled = true;
    this.clearTimer();
    const pending = this.job;
    this.publish({ phase: 'stopping' });
    return this.track((async () => {
      await pending;
      await this.cleanup();
      this.ports.discard(this.state.draft?.uri);
      this.publish({ ...emptyCapture, ...(message ? { phase: 'error', error: message } as const : {}) });
    })());
  }

  dispose() { this.disposed = true; return this.cancel(); }
}
