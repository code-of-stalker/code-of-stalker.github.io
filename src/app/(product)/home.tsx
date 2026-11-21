import { router } from 'expo-router';
import { HomeScreen } from '../../features/product/screens/HomeScreen';
import { useProduct } from '../../features/product/state/ProductProvider';
import { enterStep, furthestStep } from '../../features/product/state/model';
import { ScreenTransition } from '../../features/product/ui';

export default function Home() {
  const { progress, settings, updateProgress } = useProduct();
  const levelLabel = progress.selectedLevel === 'guidance' || progress.selectedLevel === 'intensive' ? 'ИНТЕНСИВ' : 'БАЗОВЫЙ УРОВЕНЬ';
  // The card shows how far the person got, not the step they last went back to reread,
  // and continues there.
  const step = furthestStep(progress, settings.testUnlockAll);
  function openArchitecture() {
    if (!progress.selectedLevel) { router.push('/levels'); return; }
    if (step === progress.step) { router.push('/practice'); return; }
    void updateProgress(enterStep(step, settings.testUnlockAll)).then(() => router.push('/practice'), () => {});
  }
  return <ScreenTransition reducedMotion={settings.reducedMotion}><HomeScreen started={!!progress.selectedLevel}
    levelLabel={levelLabel} step={step} stepLabel={`ШАГ ${step}`} reducedMotion={settings.reducedMotion}
    onArchitecture={openArchitecture}
    onDiary={() => router.push('/diary')} onSettings={() => router.push('/settings')} /></ScreenTransition>;
}
