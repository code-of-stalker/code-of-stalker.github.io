import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { intensiveAvailable } from '../../features/intensive/config';
import { hasDevice } from '../../features/intensive/session';
import { HomeScreen } from '../../features/product/screens/HomeScreen';
import { useProduct } from '../../features/product/state/ProductProvider';
import { furthestStep } from '../../features/product/state/model';
import { ScreenTransition } from '../../features/product/ui';

export default function Home() {
  const { progress, settings } = useProduct();
  const levelLabel = progress.selectedLevel === 'guidance' || progress.selectedLevel === 'intensive' ? 'ИНТЕНСИВ' : 'БАЗОВЫЙ УРОВЕНЬ';
  // The card shows how far the person got, not the step they last went back to reread.
  const step = furthestStep(progress, settings.testUnlockAll);
  // A device that joined the Intensive shows the Intensive on the card; checked on each visit.
  const [intensive, setIntensive] = useState(() => intensiveAvailable() && hasDevice());
  useFocusEffect(useCallback(() => { setIntensive(intensiveAvailable() && hasDevice()); }, []));
  return <ScreenTransition reducedMotion={settings.reducedMotion}><HomeScreen started={!!progress.selectedLevel} intensive={intensive}
    levelLabel={levelLabel} step={step} stepLabel={`ШАГ ${step}`} reducedMotion={settings.reducedMotion}
    // Art 2026-11-22: the card always opens the level choice first.
    onArchitecture={() => router.push('/levels')}
    onDiary={() => router.push('/diary')} onSettings={() => router.push('/settings')} /></ScreenTransition>;
}
