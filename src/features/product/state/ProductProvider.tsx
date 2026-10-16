import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { emptyProduct } from './model';
import type { DiaryCategory, Observation, ObservationDraft, ObservationMeta, ProductProgress, ProductSettings, ProductSnapshot } from './model';
import { productStorage } from './storage';
import type { BackupData } from './backup-model';
import { enableAutomaticStorageProtection } from './automatic-storage-protection';
import { blockWebUpdate, useWebUpdateBlock } from '../updates/webUpdateSafety';
import { deviceProfileStore } from '../optimization/deviceProfileStore';

export type ProductContextValue = ProductSnapshot & {
  ready: boolean;
  resetting: boolean;
  sessionRevision: number;
  error: string;
  resetProduct(): Promise<void>;
  updateSettings(patch: Partial<ProductSettings>): Promise<void>;
  updateProgress(patch: Partial<ProductProgress>): Promise<void>;
  completeFirstStep(): Promise<void>;
  completeSecondStep(): Promise<void>;
  saveObservation(draft: ObservationDraft, metadata?: ObservationMeta): Promise<Observation>;
  deleteObservation(id: string): Promise<void>;
  saveDiaryText(text: string, category: DiaryCategory, format?: import('../diary/text-format').DiaryTextRun[]): Promise<void>;
  saveDiaryVoice(draft: ObservationDraft, category: DiaryCategory): Promise<void>;
  setListenLater(id: string, marked: boolean): Promise<void>;
  loadPlayback(id: string): Promise<string>;
  discardPlayback(uri: string): void;
  retryLoad(): Promise<void>;
  createBackup(): Promise<BackupData>;
  restoreBackup(data: BackupData): Promise<void>;
};
const ProductContext = createContext<ProductContextValue | null>(null);
export function ProductProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState(emptyProduct);
  const progress = useMemo(() => !snapshot.settings.testUnlockAll && snapshot.progress.step === 2 && snapshot.progress.availableAt === null
    ? { ...snapshot.progress, step: 1, questionIndex: 0, practiceStage: 0 as const } : snapshot.progress, [snapshot.progress, snapshot.settings.testUnlockAll]);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => { if (ready) return enableAutomaticStorageProtection(); }, [ready]);
  const [resetting, setResetting] = useState(false), [sessionRevision, setSessionRevision] = useState(0);
  useWebUpdateBlock(!ready || resetting);
  const generation = useRef(0), resetInFlight = useRef<Promise<void> | null>(null);
  const alive = useRef(true), activePreviews = useRef(new Set<string>());
  const reportError = useCallback((problem: unknown) => {
    if (alive.current) setError(problem instanceof Error ? problem.message : 'Не удалось сохранить локальные данные.');
  }, []);
  const retryLoad = useCallback(async () => {
    try { const state = await productStorage.read(); if (alive.current) { setSnapshot(state); setReady(true); setError(''); } }
    catch (problem) { reportError(problem); }
  }, [reportError]);
  const discardPlayback = useCallback((uri: string) => {
    activePreviews.current.delete(uri); productStorage.discardPlayback(uri);
  }, []);
  useEffect(() => {
    alive.current = true;
    void productStorage.read().then(state => {
      if (alive.current) { setSnapshot(state); setReady(true); setError(''); }
    }).catch(reportError);
    const previews = activePreviews.current;
    const clean = () => { for (const uri of previews) productStorage.discardPlayback(uri); previews.clear(); };
    const subscription = AppState.addEventListener('change', state => { if (state === 'background') clean(); });
    return () => { alive.current = false; subscription.remove(); clean(); };
  }, [reportError]);
  const apply = useCallback(async (work: () => Promise<ProductSnapshot>) => {
    if (resetInFlight.current) throw new Error('Сбрасываем данные. Подожди завершения.');
    const revision = generation.current;
    const release = blockWebUpdate();
    try { const next = await work(); if (alive.current && revision === generation.current) { setSnapshot(next); setError(''); } }
    catch (problem) { reportError(problem); throw problem; }
    finally { release(); }
  }, [reportError]);
  const updateSettings = useCallback((patch: Partial<ProductSettings>) => apply(() => productStorage.updateSettings(patch)), [apply]);
  const updateProgress = useCallback((patch: Partial<ProductProgress>) => apply(() => productStorage.updateProgress(patch)), [apply]);
  const completeFirstStep = useCallback(() => apply(() => productStorage.completeFirstStep()), [apply]);
  const completeSecondStep = useCallback(() => apply(() => productStorage.completeSecondStep()), [apply]);
  const resetProduct = useCallback(() => {
    if (resetInFlight.current) return resetInFlight.current;
    generation.current += 1;
    setResetting(true);
    const release = blockWebUpdate();
    // Remove the device result before remounting the optimization gate.
    const reset = deviceProfileStore.clear().then(() => productStorage.reset()).then(next => {
      activePreviews.current.clear();
      if (alive.current) { setSnapshot(next); setReady(true); setError(''); setSessionRevision(value => value + 1); }
    }).catch(problem => { reportError(problem); throw problem; }).finally(() => {
      resetInFlight.current = null;
      if (alive.current) setResetting(false);
      release();
    });
    resetInFlight.current = reset;
    return reset;
  }, [reportError]);
  const saveObservation = useCallback(async (draft: ObservationDraft, metadata?: ObservationMeta) => {
    if (resetInFlight.current) throw new Error('Сбрасываем данные. Подожди завершения.');
    const revision = generation.current;
    const meta = metadata ?? { level: progress.selectedLevel ?? 'basic', step: progress.step, questionIndex: progress.questionIndex };
    const release = blockWebUpdate();
    try {
      const result = await productStorage.save(draft, meta);
      if (alive.current && revision === generation.current) { setSnapshot(result.snapshot); setError(''); }
      return result.observation;
    } catch (problem) { reportError(problem); throw problem; }
    finally { release(); }
  }, [reportError, progress]);
  const deleteObservation = useCallback((id: string) => apply(() => productStorage.delete(id)), [apply]);
  const saveDiaryText = useCallback((text: string, category: DiaryCategory, format?: import('../diary/text-format').DiaryTextRun[]) => apply(async () => (await productStorage.saveDiaryText(text, category, format)).snapshot), [apply]);
  const saveDiaryVoice = useCallback((draft: ObservationDraft, category: DiaryCategory) => apply(async () => (await productStorage.saveDiaryVoice(draft, category)).snapshot), [apply]);
  const setListenLater = useCallback((id: string, marked: boolean) => apply(() => productStorage.setListenLater(id, marked)), [apply]);
  const createBackup = useCallback(async () => {
    if (resetInFlight.current) throw new Error('Подожди завершения сброса данных.');
    const release = blockWebUpdate();
    try { return await productStorage.createBackup(); }
    finally { release(); }
  }, []);
  const restoreBackup = useCallback((data: BackupData) => apply(() => productStorage.restoreBackup(data)), [apply]);
  const loadPlayback = useCallback(async (id: string) => {
    if (resetInFlight.current) throw new Error('Сбрасываем данные. Подожди завершения.');
    const revision = generation.current;
    try {
      const uri = await productStorage.loadPlayback(id);
      if (!alive.current || revision !== generation.current) { productStorage.discardPlayback(uri); throw new Error('Прослушивание закрыто.'); }
      activePreviews.current.add(uri); return uri;
    } catch (problem) { reportError(problem); throw problem; }
  }, [reportError]);
  // Withdrawn switches remain readable in old snapshots. Test screen previews
  // now belong to a route, rather than overriding the user's earned progress.
  return <ProductContext.Provider value={{ ...snapshot, progress, settings: { ...snapshot.settings, reducedMotion: false }, ready, resetting, sessionRevision, error, resetProduct, updateSettings, updateProgress, completeFirstStep, completeSecondStep, saveObservation,
    deleteObservation, saveDiaryText, saveDiaryVoice, setListenLater, loadPlayback, discardPlayback, retryLoad, createBackup, restoreBackup }}>{children}</ProductContext.Provider>;
}
export function useProduct() {
  const value = useContext(ProductContext);
  if (!value) throw new Error('ProductProvider должен находиться над экраном приложения.');
  return value;
}
