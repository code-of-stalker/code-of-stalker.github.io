import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useEffectsController } from '../motion/EffectsQuality';
import { ProductButton, ProductScreen, ProductText } from '../ui';
import { useThemeColors } from '../ProductTheme';
import { DeviceOptimizationRun, type DeviceOptimizationProfile } from './deviceOptimization';
import { OptimizationScene } from './OptimizationScene';
import { OptimizationMascot } from './OptimizationMascot';

export function DeviceOptimizationScreen({ onFinish, saving, error, onRetry, onContinue }: {
  onFinish(profile: DeviceOptimizationProfile): void; saving: boolean; error: string; onRetry(): void; onContinue(): void;
}) {
  const controller = useEffectsController(), colors = useThemeColors();
  const { width, height } = useWindowDimensions(), compact = height < 650;
  const [run] = useState(() => new DeviceOptimizationRun()), [view, setView] = useState(run.view);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const sceneReady = useRef(false), delivered = useRef(false);
  const markReady = useCallback(() => { sceneReady.current = true; }, []);
  useEffect(() => {
    if (!controller) { onFinish(run.cancel()); return; }
    const previous = controller.getSnapshot();
    let frame = 0, disposed = false, published = -Infinity, key = '', active = AppState.currentState === 'active', focused = true;
    const visible = () => active && focused && (Platform.OS !== 'web' || !document.hidden);
    const tick = (at: number) => {
      if (disposed || !visible() || delivered.current) return;
      const next = run.tick(at, controller.getSnapshot(), sceneReady.current);
      const nextKey = `${next.phase}:${next.candidate.quality}:${next.candidate.targetFps}`;
      const changed = nextKey !== key;
      if (changed) { key = nextKey; if (!next.result) controller.probe(next.candidate.quality, next.candidate.targetFps); }
      if (next.result) {
        delivered.current = true; setView(next); controller.finishOptimization(next.result.quality, next.result.targetFps, next.result.smoothness); onFinish(next.result); return;
      }
      if (changed || at - published >= 500) { setView(next); published = at; }
      frame = requestAnimationFrame(tick);
    };
    const reset = () => {
      cancelAnimationFrame(frame); run.pause(); controller.resetWindow(); setForeground(visible());
      if (visible() && !delivered.current) frame = requestAnimationFrame(tick);
    };
    const subscription = AppState.addEventListener('change', state => { active = state === 'active'; reset(); });
    const blur = Platform.OS === 'android' ? AppState.addEventListener('blur', () => { focused = false; reset(); }) : null;
    const focus = Platform.OS === 'android' ? AppState.addEventListener('focus', () => { focused = true; reset(); }) : null;
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', reset);
    reset();
    return () => {
      disposed = true; cancelAnimationFrame(frame); subscription.remove(); blur?.remove(); focus?.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', reset);
      if (!delivered.current && controller.optimizing) controller.finishOptimization(controller.policy.preferred, previous.targetFps, previous.smooth);
    };
  }, [controller, onFinish, run]);
  useEffect(() => { run.restartWindow(); controller?.resetWindow(); }, [controller, run, width, height]);
  function keepDefaults() {
    if (delivered.current) return;
    delivered.current = true; const profile = run.cancel(); setView(run.view);
    controller?.finishOptimization(profile.quality, profile.targetFps, profile.smoothness); onFinish(profile);
  }
  return <View testID="device-optimization" style={[styles.root, { backgroundColor: colors.background }]}>
    {view.scene && !saving && !error && <OptimizationScene active={foreground} onReady={markReady} />}
    <View testID="device-optimization-cover" style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
      <ProductScreen scroll={false} contentStyle={styles.content}>
        <View testID={`device-optimization-${view.phase}`} style={styles.copy}>
          <OptimizationMascot active={foreground && !error} compact={compact} />
          <ProductText variant="title" style={[styles.title, compact && { fontSize: 20, lineHeight: 26 }]}>{error ? 'НАСТРОЙКА ГОТОВА' : saving ? 'ПОЧТИ ГОТОВО' : 'НАСТРАИВАЕМ\nПРИЛОЖЕНИЕ'}</ProductText>
          <ProductText style={[styles.body, { color: colors.text }]}>{error || 'Пожалуйста, подожди.\nОптимизируем приложение\nпод твоё устройство.'}</ProductText>
          <ProductText variant="label" style={[styles.note, { color: colors.muted }]}>{saving ? 'СОХРАНЯЕМ НАСТРОЙКИ' : error ? 'Настройки действуют в этом запуске' : 'Обычно это занимает 30–45 секунд'}</ProductText>
          {error ? <><ProductButton label="ПОВТОРИТЬ СОХРАНЕНИЕ" kind="ghost" onPress={onRetry} /><ProductButton label="ПРОДОЛЖИТЬ" kind="ghost" onPress={onContinue} /></>
            : <><ProductButton label={'ОСТАВИТЬ НАСТРОЙКИ\nПО УМОЛЧАНИЮ'} kind="outline" onPress={keepDefaults} disabled={saving || !!view.result} style={styles.defaultsButton} />
              <ProductText variant="label" style={[styles.defaultsNote, { color: colors.muted }]}>{'Сбалансированное качество.\nРежим плавности выключен.'}</ProductText></>}
        </View>
      </ProductScreen>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 }, content: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  copy: { width: '100%', maxWidth: 380, alignItems: 'center', paddingHorizontal: 8 },
  title: { textAlign: 'center', fontSize: 24, lineHeight: 32, marginBottom: 18 },
  body: { textAlign: 'center', fontSize: 12, lineHeight: 22 }, note: { textAlign: 'center', fontSize: 8, lineHeight: 18, marginTop: 20, marginBottom: 24 },
  defaultsButton: { minWidth: 220, maxWidth: '100%', alignSelf: 'center', paddingHorizontal: 24 },
  defaultsNote: { textAlign: 'center', fontSize: 8, lineHeight: 16, marginTop: 10 },
});
