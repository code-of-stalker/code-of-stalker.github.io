import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { PracticeIntroScreen } from '../../features/product/screens/PracticeIntroScreen';
import { ObservationFlow } from '../../features/product/ObservationFlow';
import { useProduct } from '../../features/product/state/ProductProvider';
import { canOpenFourthStep, resumePracticeStage, STEP_WAIT_MS } from '../../features/product/state/model';
import { ProductText, ScreenTransition } from '../../features/product/ui';

export default function Practice() {
  const { progress, settings, updateProgress, completeSecondStep, error } = useProduct();
  const { preview, deadline, from, entry } = useLocalSearchParams<{ preview?: string; deadline?: string; from?: string; entry?: string }>();
  const [returnToEnd, setReturnToEnd] = useState(entry === 'end');
  useEffect(() => { if (entry === 'end') router.setParams({ entry: undefined }); }, [entry]);
  const previewing = preview === 'cooldown';
  const [fallbackDeadline] = useState(() => Date.now() + STEP_WAIT_MS);
  const requestedDeadline = Number(deadline);
  const previewDeadline = Number.isSafeInteger(requestedDeadline) && requestedDeadline > 0 ? requestedDeadline : fallbackDeadline;
  function returnToOrigin() {
    if (from === 'diary') { if (router.canGoBack()) router.back(); else router.dismissTo('/diary'); }
    else router.dismissTo(previewing || from === 'settings' ? '/settings' : '/levels');
  }
  async function questions(step = 1) {
    if (previewing) return;
    try { await updateProgress({ step, questionIndex: Math.min(3, progress.questionIndex), practiceStage: step === 2 ? 3 : 4 }); router.push('/observation'); } catch {}
  }
  async function previousStep() {
    setReturnToEnd(true);
    try {
      await updateProgress({ step: !previewing && progress.step >= 3 ? progress.step - 1 : 1, questionIndex: 3, practiceStage: progress.step === 4 ? 0 : 4 });
      if (previewing) router.replace({ pathname: '/practice', params: { entry: 'end' } });
    } catch { /* The provider reports persistence errors. */ }
  }
  return <ScreenTransition reducedMotion={settings.reducedMotion}>
    <PracticeIntroScreen key={previewing ? `cooldown-preview-${previewDeadline}` : 'practice'}
      step={previewing ? 2 : progress.step} availableAt={previewing ? previewDeadline : progress.availableAt}
      showQuestions={!previewing && progress.step === 1 && returnToEnd}
      initialStage={previewing ? 0 : resumePracticeStage(progress)}
      startAtEnd={!previewing && returnToEnd}
      onStageChange={previewing ? undefined : practiceStage => { void updateProgress({ practiceStage }).catch(() => {}); }}
      testUnlockAll={!previewing && settings.testUnlockAll} reducedMotion={settings.reducedMotion}
      onBack={returnToOrigin} onClose={returnToOrigin}
      onLevels={() => router.dismissTo('/levels')}
      onDiary={() => router.push('/diary')}
      onPreviousStep={() => { void previousStep(); }}
      onQuestions={step => { void questions(step); }} onSelectStep={step => {
        setReturnToEnd(false);
        if (previewing) { if (step === 1) void updateProgress({ step: 1 }).then(() => router.replace('/practice')).catch(() => {}); return; }
        if (step === 1 || step === 2 && (progress.availableAt !== null || settings.testUnlockAll) || step === 3 && (progress.secondStepCompletedAt || settings.testUnlockAll) || step === 4 && canOpenFourthStep(progress, settings.testUnlockAll)) void updateProgress({ step }).catch(() => {});
      }}
      onCompleteSecondStep={completeSecondStep}
      renderQuestions={previewing ? undefined : (active, onBack, registerNavigation, onQuestionHeight, effectsActive, onAnswered) => <ObservationFlow embedded active={active} onAnswered={onAnswered} effectsActive={effectsActive} startAtEnd={returnToEnd} onBack={() => { setReturnToEnd(false); onBack(); }} onNavigationReady={registerNavigation} onQuestionHeight={onQuestionHeight} />} />
    {error ? <ProductText accessibilityRole="alert" style={{ padding: 16 }}>{error}</ProductText> : null}
  </ScreenTransition>;
}
