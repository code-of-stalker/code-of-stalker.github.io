import { router } from 'expo-router';
import { SettingsScreen } from '../../features/product/screens/SettingsScreen';
import { useProduct } from '../../features/product/state/ProductProvider';
import { STEP_WAIT_MS } from '../../features/product/state/model';
import { ProductText, ScreenTransition } from '../../features/product/ui';

export default function Settings() {
  const { settings, updateSettings, updateProgress, error, resetProduct, resetting } = useProduct();
  async function openStep(step: 2 | 3 | 4 | 5) {
    if (!settings.testUnlockAll) return;
    try {
      await updateProgress({ selectedLevel: 'basic', step, practiceStage: 0 });
      router.push({ pathname: '/practice', params: { from: 'settings' } });
    } catch { /* The provider reports persistence errors below. */ }
  }
  return <ScreenTransition reducedMotion={settings.reducedMotion}>
    <SettingsScreen settings={settings} onChange={patch => { void updateSettings(patch).catch(() => {}); }}
      onBack={() => router.dismissTo('/home')} resetting={resetting}
      onPreviewCooldown={() => router.push({ pathname: '/practice', params: { preview: 'cooldown', deadline: String(Date.now() + STEP_WAIT_MS) } })}
      onOpenSecondStep={() => { void openStep(2); }}
      onOpenThirdStep={() => { void openStep(3); }}
      onOpenFourthStep={() => { void openStep(4); }}
      onOpenFifthStep={() => { void openStep(5); }}
      onReset={async () => { await resetProduct(); router.dismissAll(); router.replace('/launch'); }} />
    {error ? <ProductText accessibilityRole="alert" style={{ backgroundColor: '#000', padding: 16 }}>{error}</ProductText> : null}
  </ScreenTransition>;
}
