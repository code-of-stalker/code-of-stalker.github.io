import { router, useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { ObservationScreen } from './screens/ObservationScreen';
import type { ObservationNavigation } from './screens/ObservationScreen';
import { useProduct } from './state/ProductProvider';

export function ObservationFlow({ embedded = false, active = true, effectsActive = true, startAtEnd = false, onBack, onAnswered, onNavigationReady, onQuestionHeight }: {
  embedded?: boolean; active?: boolean; onBack?: () => void; onNavigationReady?: (actions: ObservationNavigation | null) => void;
  onQuestionHeight?: (height: number) => void;
  effectsActive?: boolean;
  startAtEnd?: boolean;
  onAnswered?: () => void;
}) {
  const { progress, completeFirstStep, updateProgress } = useProduct();
  const focused = useIsFocused();
  useEffect(() => {
    if (!embedded && active && focused && (progress.step === 1 || progress.step === 2)) void updateProgress({ practiceStage: progress.step === 2 ? 3 : 4 }).catch(() => {});
  }, [embedded, active, focused, progress.step, updateProgress]);
  async function done() {
    try {
      if (progress.step === 2) {
        await updateProgress({ practiceStage: 4 });
        if (onAnswered) onAnswered(); else router.dismissTo('/practice');
        return;
      }
      await completeFirstStep();
      await updateProgress({ step: 2, questionIndex: 0, practiceStage: 0 });
      if (!embedded) router.dismissTo('/practice');
    } catch { /* The provider reports persistence errors beside the recorder. */ }
  }
  async function returnToTask() {
    try { await updateProgress({ practiceStage: progress.step === 2 ? 2 : 3 }); router.dismissTo('/practice'); }
    catch { /* The provider reports persistence errors. */ }
  }
  return <ObservationScreen embedded={embedded} active={active} effectsActive={effectsActive} startAtEnd={startAtEnd} onNavigationReady={onNavigationReady} onQuestionHeight={onQuestionHeight} questionIndex={Math.min(3, progress.questionIndex)}
    onQuestionChange={questionIndex => { void updateProgress({ questionIndex, practiceStage: progress.step === 2 ? 3 : 4 }).catch(() => {}); }}
    onDone={() => { void done(); }} onBack={onBack ?? (() => { void returnToTask(); })}
    onClose={() => router.dismissTo('/levels')} />;
}
