import { AudioProbeError } from './audio-probe';
import { draftErrorText } from './voice-draft-store';
import type { RestoredVoiceDraft, SavedVoiceDraft, VoiceDraftScope } from './voice-draft-store';
import type { VoiceDraft } from './voice-types';
import { VoiceConnectionError } from './voice-send-connection';

export type DraftUiState = { phase: 'loading' | 'checking' | 'saving' | 'deleting' | 'ready' | 'empty' | 'error'; saved: SavedVoiceDraft | null; error: string };
export const initialDraftUi: DraftUiState = { phase: 'loading', saved: null, error: '' };
type Store = {
  save(scope: VoiceDraftScope, draft: VoiceDraft): Promise<RestoredVoiceDraft>;
  restore(scope: VoiceDraftScope): Promise<RestoredVoiceDraft | null>;
  markSending(scope: VoiceDraftScope, id: string): Promise<SavedVoiceDraft>;
  clear(scope: VoiceDraftScope, id: string): Promise<void>;
  eraseAll(): Promise<void>;
};

// Owns one screen's local operations. Disposal waits for an already-started
// save without publishing into a replacement screen or deleting the source early.
export class VoiceDraftController {
  private state: DraftUiState = { ...initialDraftUi };
  private job: Promise<unknown> | null = null;
  private alive = true;
  constructor(private store: Store, private scope: VoiceDraftScope, private ports: {
    changed(state: DraftUiState): void;
    restored(draft: VoiceDraft, replace: boolean): boolean;
    discard(uri: string): void;
  }) {}
  get busy() { return !!this.job || ['loading', 'checking', 'saving', 'deleting'].includes(this.state.phase); }
  private publish(patch: Partial<DraftUiState>) {
    this.state = { ...this.state, ...patch };
    if (this.alive) this.ports.changed(this.state);
  }
  private track<T>(work: () => Promise<T>): Promise<T> {
    // Start after job ownership is established, including synchronous mock ports.
    const promise = Promise.resolve().then(work).finally(() => { if (this.job === promise) this.job = null; });
    this.job = promise; return promise;
  }
  restore(): Promise<boolean> {
    if (!this.alive || this.job) return Promise.resolve(false);
    this.publish({ phase: 'loading', error: '' });
    return this.track(async () => {
      try {
        const restored = await this.store.restore(this.scope);
        if (!this.alive) { if (restored) this.ports.discard(restored.draft.uri); return false; }
        if (restored && !this.ports.restored(restored.draft, false)) {
          this.ports.discard(restored.draft.uri); throw new AudioProbeError('Не удалось открыть черновик. Повтори открытие, не начиная новую запись.');
        }
        this.publish({ phase: restored ? 'ready' : 'empty', saved: restored, error: '' });
        return true;
      } catch (error) { this.publish({ phase: 'error', error: draftErrorText(error) }); return false; }
    });
  }
  save(draft: VoiceDraft): Promise<boolean> {
    if (!this.alive || this.busy || this.state.saved) return Promise.resolve(false);
    this.publish({ phase: 'saving', error: '' });
    return this.track(async () => {
      try {
        const saved = await this.store.save(this.scope, draft);
        if (!this.alive) { this.ports.discard(saved.draft.uri); return true; }
        this.publish({ saved, phase: 'saving' });
        if (!this.ports.restored(saved.draft, true)) {
          this.ports.discard(saved.draft.uri);
          throw new AudioProbeError('Черновик сохранён, но предпрослушивание не открылось. Выполни Reload, чтобы открыть его снова.');
        }
        this.publish({ phase: 'ready', saved, error: '' }); return true;
      }
      catch (error) { this.publish({ phase: 'error', error: draftErrorText(error) }); return false; }
    });
  }
  beforeSend(checkConnection?: () => Promise<void>): Promise<void> {
    const saved = this.state.saved;
    if (!this.alive || this.busy || !saved || saved.state !== 'draft') {
      return Promise.reject(new AudioProbeError('Сначала дождись сохранения черновика. Если отправка уже начиналась, проверь запись на iPad.'));
    }
    this.publish({ phase: 'checking', error: '' });
    return this.track(async () => {
      try {
        if (checkConnection) await checkConnection();
        if (!this.alive) throw new VoiceConnectionError('Проверка связи остановлена. Черновик сохранён на Tecno.');
        // Preparing the SDK is read-only for this draft. Reload in that interval
        // must leave it retryable; the upload guard commits the marker later.
        this.publish({ phase: 'ready' });
      }
      catch (error) { this.publish({ phase: 'error', error: draftErrorText(error) }); throw error; }
    });
  }
  get sendingStarted() { return this.state.saved?.state === 'sending'; }
  beforeUpload(signal: AbortSignal, checkConnection: () => Promise<void>): Promise<void> {
    const saved = this.state.saved;
    const active = () => {
      if (!this.alive || signal.aborted) throw new VoiceConnectionError('Подготовка отправки остановлена. Черновик сохранён на Tecno.');
    };
    if (!this.alive || this.busy || !saved || saved.state !== 'draft') {
      return Promise.reject(new AudioProbeError('Черновик недоступен для новой отправки. Проверь запись на iPad.'));
    }
    this.publish({ phase: 'checking', error: '' });
    return this.track(async () => {
      try {
        active(); await checkConnection(); active();
        this.publish({ phase: 'saving' });
        const marked = await this.store.markSending(this.scope, saved.id);
        this.publish({ phase: 'ready', saved: marked });
        active();
      }
      catch (error) { this.publish({ phase: 'error', error: draftErrorText(error) }); throw error; }
    });
  }
  sent(): Promise<boolean> {
    const saved = this.state.saved;
    if (!saved || this.job) return Promise.resolve(false);
    this.publish({ phase: 'deleting', error: '' });
    return this.track(async () => {
      try { await this.store.clear(this.scope, saved.id); this.publish({ phase: 'empty', saved: null, error: '' }); return true; }
      catch { this.publish({ phase: 'error', error: 'Запись отправлена, но локальный черновик пока не удалён. Нажми «Удалить черновик»; повторная отправка отключена.' }); return false; }
    });
  }
  remove(): Promise<boolean> {
    if (!this.alive || this.busy) return Promise.resolve(false);
    const saved = this.state.saved;
    this.publish({ phase: 'deleting', error: '' });
    return this.track(async () => {
      try {
        if (saved) await this.store.clear(this.scope, saved.id); else await this.store.eraseAll();
        this.publish({ phase: 'empty', saved: null, error: '' }); return true;
      } catch (error) { this.publish({ phase: 'error', error: draftErrorText(error) }); return false; }
    });
  }
  dispose(): Promise<void> { this.alive = false; return (this.job ?? Promise.resolve()).then(() => {}, () => {}); }
}
