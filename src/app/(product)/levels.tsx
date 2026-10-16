import { router } from 'expo-router';
import { useState } from 'react';
import { MotionModal } from '../../features/product/motion/MotionModal';
import { LevelsScreen } from '../../features/product/screens/LevelsScreen';
import type { ProductLevel } from '../../features/product/state/model';
import { useProduct } from '../../features/product/state/ProductProvider';
import { ProductButton, ProductScreen, ProductText, ScreenTransition } from '../../features/product/ui';

export default function Levels() {
  const { progress, settings, updateProgress, error } = useProduct();
  const [selected, setSelected] = useState<ProductLevel | null>(progress.selectedLevel ?? 'basic');
  const [preview, setPreview] = useState<{ level: Exclude<ProductLevel, 'basic'>; visible: boolean } | null>(null);
  const closePreview = () => setPreview(current => current && { ...current, visible: false });
  async function start(level: ProductLevel) {
    if (level !== 'basic') { setPreview({ level, visible: true }); return; }
    try { await updateProgress({ selectedLevel: level }); router.push('/practice'); } catch { /* Error is rendered below. */ }
  }
  return <ScreenTransition reducedMotion={settings.reducedMotion}>
    <LevelsScreen selectedLevel={selected} onSelect={setSelected} onStart={level => { void start(level); }}
      onBack={() => router.dismissTo('/home')} onDiary={() => router.push('/diary')} reducedMotion={settings.reducedMotion} effectsActive={!preview?.visible} />
    {error ? <ProductText accessibilityRole="alert" style={{ padding: 16 }}>{error}</ProductText> : null}
    <MotionModal visible={preview?.visible ?? false} onRequestClose={closePreview} animationType="fade">
      <ProductScreen>
        <ProductText variant="title">{preview?.level === 'intensive' ? 'ИНТЕНСИВ' : 'ВОДИТЕЛЬСТВО ОТ ПРОВОДНИКА'}</ProductText>
        <ProductText style={{ marginVertical: 24 }}>Этот уровень пока готовится. Сейчас доступен базовый путь наблюдения.</ProductText>
        <ProductButton label="ВЕРНУТЬСЯ К УРОВНЯМ" onPress={closePreview} />
      </ProductScreen>
    </MotionModal>
  </ScreenTransition>;
}
