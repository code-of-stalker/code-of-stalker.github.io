import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useThemeColors } from '../ProductTheme';
import { useProduct } from '../state/ProductProvider';
import { deviceProfileStore } from './deviceProfileStore';
import { DeviceOptimizationScreen } from './DeviceOptimizationScreen';
import type { DeviceOptimizationProfile } from './deviceOptimization';
import { useWebUpdateBlock } from '../updates/webUpdateSafety';

export function DeviceOptimizationGate({ children }: PropsWithChildren) {
  const { updateSettings, settings } = useProduct(), colors = useThemeColors();
  const [mode, setMode] = useState<'loading' | 'run' | 'ready'>('loading');
  useWebUpdateBlock(mode !== 'ready');
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const profile = useRef<DeviceOptimizationProfile | null>(null), busy = useRef(false), alive = useRef(true);
  const initialQuality = useRef(settings.effectQuality);
  useEffect(() => {
    alive.current = true;
    void deviceProfileStore.read().then(async saved => {
      if (!alive.current) return;
      if (saved && initialQuality.current === undefined) await updateSettings({ effectQuality: saved.quality, effectTargetFps: saved.targetFps, smoothness: saved.smoothness });
      if (alive.current) setMode(saved ? 'ready' : 'run');
    }).catch(() => { if (alive.current) setMode('run'); });
    return () => { alive.current = false; };
  }, [updateSettings]);
  const finish = useCallback(async (result: DeviceOptimizationProfile) => {
    if (busy.current) return;
    busy.current = true; profile.current = result; setSaving(true); setError('');
    try {
      await updateSettings({ effectQuality: result.quality, effectTargetFps: result.targetFps, smoothness: result.smoothness });
      await deviceProfileStore.write(result);
      if (alive.current) setMode('ready');
    } catch { if (alive.current) setError('Не удалось сохранить настройку на устройстве. Можно попробовать ещё раз или продолжить.'); }
    finally { busy.current = false; if (alive.current) setSaving(false); }
  }, [updateSettings]);
  const deliver = useCallback((result: DeviceOptimizationProfile) => { void finish(result); }, [finish]);
  if (mode === 'loading') return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.accent} accessibilityLabel="Открываем приложение" /></View>;
  if (mode === 'run') return <DeviceOptimizationScreen onFinish={deliver} saving={saving} error={error}
    onRetry={() => { if (profile.current) void finish(profile.current); }} onContinue={() => setMode('ready')} />;
  return children;
}
