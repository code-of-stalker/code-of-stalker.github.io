import { router } from 'expo-router';
import { HomeScreen } from '../../features/product/screens/HomeScreen';
import { useProduct } from '../../features/product/state/ProductProvider';
import { ScreenTransition } from '../../features/product/ui';

export default function Home() {
  const { progress, settings } = useProduct();
  const levelLabel = progress.selectedLevel === 'guidance' ? 'ВОДИТЕЛЬСТВО' : progress.selectedLevel === 'intensive' ? 'ИНТЕНСИВ' : 'БАЗОВЫЙ УРОВЕНЬ';
  return <ScreenTransition reducedMotion={settings.reducedMotion}><HomeScreen started={!!progress.selectedLevel}
    levelLabel={levelLabel} step={progress.step} stepLabel={`ШАГ ${progress.step}`} reducedMotion={settings.reducedMotion}
    onArchitecture={() => router.push(progress.selectedLevel ? '/practice' : '/levels')}
    onDiary={() => router.push('/diary')} onSettings={() => router.push('/settings')} /></ScreenTransition>;
}
