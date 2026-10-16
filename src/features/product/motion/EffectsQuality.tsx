import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { PropsWithChildren } from 'react';
import { usePathname } from 'expo-router';
import { AppState, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { diagnosticsPreference, EffectsController } from './EffectsController';
import { qualityNames, qualityDensity, glassRenderDensity } from './effectQuality';
import { saveEffectsReport } from './saveEffectsReport';
import { useProduct } from '../state/ProductProvider';
import { useThemeColors } from '../ProductTheme';
import { colors as darkColors } from '../theme';
import { PanelBorder } from '../PanelBorder';
import { NativeMotionHost } from './NativeMotionHost';

const Context = createContext<EffectsController | null>(null);
export const useEffectsController = () => useContext(Context);
const noSubscription = () => () => {};
export function useEffectQualityLevel() {
  const controller = useEffectsController();
  return useSyncExternalStore(controller?.subscribe ?? noSubscription,
    () => controller?.getSnapshot().level ?? 'high', () => 'high');
}
export function useEffectsDiagnostics() { return useSyncExternalStore(diagnosticsPreference.subscribe, diagnosticsPreference.get, () => false); }

function Diagnostics({ controller }: { controller: EffectsController }) {
  const colors = useThemeColors();
  const light = colors !== darkColors;
  const themeStyle = light ? { color: colors.text } : undefined;
  const enabled = useEffectsDiagnostics();
  const [expanded, setExpanded] = useState(false);
  const [report, setReport] = useState('');
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  if (!enabled || controller.optimizing) return null;
  const cadence = snapshot.cadence;
  return <View style={[styles.panel, light && { backgroundColor: `${colors.surface}ed`, borderColor: colors.border }]}>
    <PanelBorder color={light ? colors.border : '#a49d12'} />
    <Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Свернуть диагностику эффектов' : 'Показать диагностику эффектов'} accessibilityState={{ expanded }} aria-expanded={expanded} onPress={() => setExpanded(value => !value)}>
      <Text style={[styles.text, themeStyle]}>ЭФФЕКТЫ · {qualityNames[snapshot.level]} · {cadence ? cadence.fps.toFixed(1) : '—'} FPS{snapshot.cadencePending ? ' · обновляем замер' : ''} {expanded ? '−' : '+'}</Text>
    </Pressable>
    {expanded && <>
      <Text selectable style={[styles.text, themeStyle]}>{snapshot.reason}</Text>
      <Text selectable style={[styles.text, themeStyle]}>Плотность: стекло ×{glassRenderDensity.toFixed(2)} · иллюстрации ×{qualityDensity[snapshot.level].toFixed(2)}</Text>
      <Text selectable style={[styles.text, themeStyle]}>{snapshot.cadencePending ? 'Предыдущий замер · ' : ''}{cadence ? `${cadence.calibrated ? `Оценка rAF ≈${Math.round(1000/cadence.refreshMs)} Гц` : 'Калибруем частоту rAF'} · цель ${snapshot.smooth ? snapshot.targetFps : 60} FPS · измерено ${cadence.fps.toFixed(1)} FPS · p95 ${cadence.p95.toFixed(1)} мс · пропуски ${(cadence.missedShare*100).toFixed(1)}%` : 'Новое окно измерений'}{cadence?.active === false ? ' · эффекты неподвижны' : ''}</Text>
      <Text selectable style={[styles.text, themeStyle]}>Стоимость второстепенных эффектов: {snapshot.cost}/3{cadence?.overloaded ? ' · цель не достигнута' : ''}</Text>
      {snapshot.frames.map((frame, index) => <Text key={index} selectable style={[styles.text, themeStyle]}>{frame.label}{frame.metrics ? `: ×${frame.metrics.density.toFixed(2)} · буфер ${frame.metrics.buffer.join('×')} · фон ${frame.metrics.source[0] ? frame.metrics.source.join('×') : 'нет'} · blur ${frame.metrics.blur.join('×')} · ${frame.metrics.idle ? 'пауза' : 'рендер'}` : frame.awaitingGlass ? ': получаем новые размеры' : ': декоративный эффект'}</Text>)}
      {snapshot.frames.filter(frame=>frame.metrics?.backend).map((frame,index)=><Text key={`backend-${index}`} selectable style={[styles.text, themeStyle]}>{frame.metrics!.backend}{frame.metrics!.cadence?` · эффект ${frame.metrics!.cadence.fps.toFixed(1)} FPS · p95 ${frame.metrics!.cadence.p95.toFixed(1)} мс`:''}{frame.metrics!.textures!==undefined?` · текстуры ${frame.metrics!.textures} · память текстур ≈${((frame.metrics!.textureBytes??0)/1048576).toFixed(1)} МБ`:''}{frame.metrics!.budgetExceeded?' · мягкий бюджет превышен, сохранена разрешённая плотность':''}</Text>)}
      {snapshot.frames.filter(frame => frame.backend).map((frame, index) => <Text key={`motion-${index}`} selectable style={[styles.text, themeStyle]}>{frame.backend}{frame.cadence ? ` · эффект ${frame.cadence.fps.toFixed(1)} FPS · p95 ${frame.cadence.p95.toFixed(1)} мс` : ''}</Text>)}
      <View style={styles.row}>
        {(['auto', 'balanced', 'high', 'economy'] as const).map(mode => <Pressable key={mode} accessibilityRole="button" onPress={() => controller.reference(mode === 'auto' ? null : mode)} style={[styles.button, light && { borderColor: colors.border }]}><PanelBorder color={light ? colors.border : '#777322'} />
          <Text style={[styles.text, themeStyle]}>{mode === 'auto' ? 'АВТО' : mode === 'high' ? '×2,50' : mode === 'balanced' ? '×2,00' : '×1,50'}</Text>
        </Pressable>)}
        <Pressable accessibilityRole="button" onPress={() => setReport(JSON.stringify(controller.export(), null, 2))} style={[styles.button, light && { borderColor: colors.border }]}><PanelBorder color={light ? colors.border : '#777322'} /><Text style={[styles.text, themeStyle]}>ОТЧЁТ</Text></Pressable>
        {Platform.OS === 'web' && <Pressable accessibilityRole="button" onPress={() => controller.recreateGraphics()} style={[styles.button, light && { borderColor: colors.border }]}><PanelBorder color={light ? colors.border : '#777322'} /><Text style={[styles.text, themeStyle]}>ПЕРЕСОЗДАТЬ ГРАФИКУ</Text></Pressable>}
      </View>
      {!!report && <>
        <TextInput accessibilityLabel="Отчёт о плавности эффектов" multiline editable={false} value={report} style={[styles.report, light && { color: colors.text, backgroundColor: colors.background }]} />
        <View style={styles.row}>
          {Platform.OS === 'web' && <Pressable accessibilityRole="button" onPress={() => saveEffectsReport(JSON.parse(report))} style={[styles.button, light && { borderColor: colors.border }]}><PanelBorder color={light ? colors.border : '#777322'} /><Text style={[styles.text, themeStyle]}>СКАЧАТЬ ОТЧЁТ</Text></Pressable>}
          <Pressable accessibilityRole="button" onPress={() => setReport('')} style={[styles.button, light && { borderColor: colors.border }]}><PanelBorder color={light ? colors.border : '#777322'} /><Text style={[styles.text, themeStyle]}>ЗАКРЫТЬ ОТЧЁТ</Text></Pressable>
        </View>
      </>}
      <Text style={[styles.note, light && { color: colors.muted }]}>Режимы сравнения — для проверки. В обычном режиме качество выбирается автоматически.</Text>
    </>}
  </View>;
}

export function EffectsQualityProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { settings } = useProduct();
  const [controller] = useState(() => new EffectsController());
  useEffect(() => { controller.screenChanged(pathname); }, [controller, pathname]);
  useEffect(() => { controller.preferred(settings.effectQuality ?? 'high'); }, [controller, settings.effectQuality]);
  useEffect(() => { controller.target(settings.effectTargetFps ?? 60, settings.smoothness ?? true); }, [controller,settings.effectTargetFps,settings.smoothness]);
  useEffect(() => diagnosticsPreference.subscribe(() => { if (!diagnosticsPreference.get()) controller.reference(null); }), [controller]);
  useEffect(() => {
    let frame = 0, disposed = false, foreground = AppState.currentState === 'active';
    const visible = () => foreground && (Platform.OS !== 'web' || !document.hidden);
    const tick = (at: number) => { if (disposed || !visible()) return; controller.sample(at); frame = requestAnimationFrame(tick); };
    const reset = () => { cancelAnimationFrame(frame); controller.resetWindow(); if (visible()) frame = requestAnimationFrame(tick); };
    const subscription = AppState.addEventListener('change', state => { foreground = state === 'active'; reset(); });
    if (Platform.OS === 'web') {
      document.addEventListener('visibilitychange', reset); window.addEventListener('orientationchange', reset);
      window.screen.orientation?.addEventListener('change', reset);
    }
    reset();
    return () => {
      disposed = true; cancelAnimationFrame(frame); subscription.remove();
      if (Platform.OS === 'web') { document.removeEventListener('visibilitychange', reset); window.removeEventListener('orientationchange', reset); window.screen.orientation?.removeEventListener('change', reset); }
    };
  }, [controller]);
  return <Context.Provider value={controller}><NativeMotionHost />{children}<Diagnostics controller={controller} /></Context.Provider>;
}
const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 8, right: 8, bottom: 48, maxWidth: 480, alignSelf: 'center', backgroundColor: '#070700ed', borderColor: '#a49d12', borderWidth: 0, padding: 8, gap: 5, zIndex: 200 },
  text: { color: '#e7e100', fontSize: 11, lineHeight: 15 }, note: { color: '#9a975e', fontSize: 10, lineHeight: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { minHeight: 32, justifyContent: 'center', borderWidth: 0, borderColor: '#777322', paddingHorizontal: 8 },
  report: { height: 140, color: '#ddd', fontSize: 10, backgroundColor: '#000', padding: 8, overflow: 'scroll' },
});
