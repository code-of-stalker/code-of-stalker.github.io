import { router } from 'expo-router';
import { useState } from 'react';
import { intensiveAvailable } from '../../features/intensive/config';
import { hasDevice } from '../../features/intensive/session';
import { MotionModal } from '../../features/product/motion/MotionModal';
import { LevelsScreen } from '../../features/product/screens/LevelsScreen';
import { enterStep, furthestStep, type ProductLevel } from '../../features/product/state/model';
import { useProduct } from '../../features/product/state/ProductProvider';
import { ProductButton, ProductScreen, ProductText, ScreenTransition } from '../../features/product/ui';

export default function Levels() {
  const { progress, settings, updateProgress, error } = useProduct();
  const [preview, setPreview] = useState<{ level: Exclude<ProductLevel, 'basic'>; visible: boolean } | null>(null);
  // «ВЫ ЗДЕСЬ»: a device that joined the Intensive is there; otherwise the level chosen in progress.
  const [joined] = useState(() => intensiveAvailable() && hasDevice());
  const current = joined || progress.selectedLevel === 'intensive' || progress.selectedLevel === 'guidance' ? 'guidance' : progress.selectedLevel ? 'basic' : null;
  // Art 2026-11-22: a level the person already walks says «ПРОДОЛЖИТЬ».
  const continued = [...(progress.selectedLevel === 'basic' ? ['basic' as const] : []), ...(joined ? ['guidance' as const] : [])];
  const closePreview = () => setPreview(current => current && { ...current, visible: false });
  async function start(level: ProductLevel) {
    // The «ИНТЕНСИВ» plate keeps the old guidance id (its art and frame).
    if ((level === 'guidance' || level === 'intensive') && intensiveAvailable()) { router.push('/intensive'); return; }
    if (level !== 'basic') { setPreview({ level, visible: true }); return; }
    // Continuing the base level enters the furthest step reached, not the one last reread.
    const step = progress.selectedLevel === 'basic' ? furthestStep(progress, settings.testUnlockAll) : progress.step;
    try {
      await updateProgress({ selectedLevel: level, ...(step !== progress.step ? enterStep(step, settings.testUnlockAll) : {}) });
      router.push('/practice');
    } catch { /* Error is rendered below. */ }
  }
  return <ScreenTransition reducedMotion={settings.reducedMotion}>
    <LevelsScreen selectedLevel={current ?? 'basic'} currentLevel={current} continued={continued} onStart={level => { void start(level); }}
      onBack={() => router.dismissTo('/home')} onDiary={() => router.push('/diary')} reducedMotion={settings.reducedMotion} effectsActive={!preview?.visible} />
    {error ? <ProductText accessibilityRole="alert" style={{ padding: 16 }}>{error}</ProductText> : null}
    <MotionModal visible={preview?.visible ?? false} onRequestClose={closePreview} animationType="fade">
      <ProductScreen>
        <ProductText variant="title">ИНТЕНСИВ</ProductText>
        <ProductText style={{ marginVertical: 24 }}>Этот уровень пока готовится. Сейчас доступен базовый путь наблюдения.</ProductText>
        <ProductButton label="ВЕРНУТЬСЯ К УРОВНЯМ" onPress={closePreview} />
      </ProductScreen>
    </MotionModal>
  </ScreenTransition>;
}
