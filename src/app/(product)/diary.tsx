import { router } from 'expo-router';
import { DiaryScreen } from '../../features/product/screens/DiaryScreen';
import { useProduct } from '../../features/product/state/ProductProvider';
import { ScreenTransition } from '../../features/product/ui';

export default function Diary() {
  const { settings, progress, updateProgress } = useProduct();
  return <ScreenTransition reducedMotion={settings.reducedMotion}><DiaryScreen onBack={() => router.dismissTo('/home')}
    onArchitecture={() => router.navigate(progress.selectedLevel ? '/practice' : '/levels')}
    onStep={async record => {
      await updateProgress({ selectedLevel: record.level, step: record.step, questionIndex: Math.min(3, record.questionIndex), practiceStage: record.step === 1 ? 4 : 0 });
      router.push({ pathname: '/practice', params: { from: 'diary' } });
    }} /></ScreenTransition>;
}
