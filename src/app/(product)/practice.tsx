import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { PracticeIntroScreen } from '../../features/product/screens/PracticeIntroScreen';
import { ObservationFlow } from '../../features/product/ObservationFlow';
import { useProduct } from '../../features/product/state/ProductProvider';
import { canOpenFifthStep, canOpenFourthStep, canOpenSeventhStep, canOpenSixthStep, resumePracticeStage } from '../../features/product/state/model';
import { ProductText, ScreenTransition } from '../../features/product/ui';
import { stepThreePractice } from '../../features/product/stepThreePractice';

export default function Practice() {
  const { progress, settings, updateProgress, completeSecondStep, error } = useProduct();
  const { from, entry } = useLocalSearchParams<{ from?: string; entry?: string }>();
  const [returnToEnd, setReturnToEnd] = useState(entry === 'end');
  useEffect(() => { if (entry === 'end') router.setParams({ entry: undefined }); }, [entry]);
  // Back steps out to the level choice; close (Art 2026-11-22) leaves the base level for home.
  function returnToOrigin(home = false) {
    if (from === 'diary') { if (router.canGoBack()) router.back(); else router.dismissTo('/diary'); }
    else router.dismissTo(from === 'settings' ? '/settings' : home ? '/home' : '/levels');
  }
  async function questions(step = 1) {
    try { await updateProgress({ step, questionIndex: Math.min(3, progress.questionIndex), practiceStage: step === 2 ? 3 : 4 }); router.push('/observation'); } catch {}
  }
  async function previousStep() {
    setReturnToEnd(true);
    try {
      await updateProgress({
        step: progress.step >= 3 ? progress.step - 1 : 1,
        questionIndex: 3,
        practiceStage: progress.step >= 4 ? 0 : 4,
        // A backwards boundary crossing enters the end of the previous step,
        // independently of whichever Step 3 bookmark was saved before it.
        ...(progress.step === 4 ? {
          stepThreeReading: { chapter: 1 as const, page: stepThreePractice.length - 1, offset: 0, paged: true },
        } : {}),
        // Step five's first page scrolls back onto step four's last page.
        ...(progress.step === 5 ? { stepFourReading: { page: 14, offset: 0 } } : {}),
        // Step six's first page scrolls back onto step five's last page.
        ...(progress.step === 6 ? { stepFiveReading: { page: 6, offset: 0 } } : {}),
        // Step seven's first page scrolls back onto step six's last page.
        ...(progress.step === 7 ? { stepSixReading: { page: 9, offset: 0 } } : {}),
      });
    } catch { /* The provider reports persistence errors. */ }
  }
  async function nextStep() {
    if (progress.step < 3 || progress.step > 6) return;
    setReturnToEnd(false);
    try {
      // A forwards boundary crossing enters the start of the next step, like the
      // backwards one enters the end of the previous step.
      await updateProgress(progress.step === 3
        ? { step: 4, practiceStage: 0, questionIndex: 0, stepFourReading: { page: 0, offset: 0 },
          ...(!settings.testUnlockAll ? { fourthStepUnlocked: true } : {}) }
        : progress.step === 4
          ? { step: 5, practiceStage: 0, stepFiveReading: { page: 0, offset: 0 },
            ...(!settings.testUnlockAll ? { fifthStepUnlocked: true } : {}) }
          : progress.step === 5
            ? { step: 6, practiceStage: 0, stepSixReading: { page: 0, offset: 0 },
              ...(!settings.testUnlockAll ? { sixthStepUnlocked: true } : {}) }
            : { step: 7, practiceStage: 0, stepSevenReading: { page: 0, offset: 0 },
              ...(!settings.testUnlockAll ? { seventhStepUnlocked: true } : {}) });
    } catch { /* The provider reports persistence errors. */ }
  }
  return <ScreenTransition reducedMotion={settings.reducedMotion}>
    <PracticeIntroScreen key="practice"
      step={progress.step} availableAt={progress.availableAt}
      showQuestions={progress.step === 1 && returnToEnd}
      initialStage={resumePracticeStage(progress)}
      startAtEnd={returnToEnd}
      onStageChange={practiceStage => { void updateProgress({ practiceStage }).catch(() => {}); }}
      testUnlockAll={settings.testUnlockAll} reducedMotion={settings.reducedMotion}
      onBack={() => returnToOrigin()} onClose={() => returnToOrigin(true)}
      onLevels={() => router.dismissTo('/levels')}
      onDiary={() => router.push('/diary')}
      onPreviousStep={() => { void previousStep(); }}
      onNextStep={() => { void nextStep(); }}
      onQuestions={step => { void questions(step); }} onSelectStep={step => {
        setReturnToEnd(false);
        if (step === 1 || step === 2 && (progress.availableAt !== null || settings.testUnlockAll) || step === 3 && (progress.secondStepCompletedAt || settings.testUnlockAll) || step === 4 && canOpenFourthStep(progress, settings.testUnlockAll) || step === 5 && canOpenFifthStep(progress, settings.testUnlockAll) || step === 6 && canOpenSixthStep(progress, settings.testUnlockAll) || step === 7 && canOpenSeventhStep(progress, settings.testUnlockAll)) void updateProgress({ step }).catch(() => {});
      }}
      onCompleteSecondStep={completeSecondStep}
      renderQuestions={(active, onBack, registerNavigation, onQuestionHeight, effectsActive, onAnswered) => <ObservationFlow embedded active={active} onAnswered={onAnswered} effectsActive={effectsActive} startAtEnd={returnToEnd} onBack={() => { setReturnToEnd(false); onBack(); }} onNavigationReady={registerNavigation} onQuestionHeight={onQuestionHeight} />} />
    {error ? <ProductText accessibilityRole="alert" style={{ padding: 16 }}>{error}</ProductText> : null}
  </ScreenTransition>;
}
