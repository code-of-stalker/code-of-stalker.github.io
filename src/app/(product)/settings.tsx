import { router } from 'expo-router';
import { useState } from 'react';
import { forgetIntensiveHere, hasDevice } from '../../features/intensive/session';
import { SettingsScreen } from '../../features/product/screens/SettingsScreen';
import { useProduct } from '../../features/product/state/ProductProvider';
import { STEP_WAIT_MS } from '../../features/product/state/model';
import { ProductText, ScreenTransition } from '../../features/product/ui';

export default function Settings() {
  const { settings, updateSettings, updateProgress, error, resetProduct, resetting } = useProduct();
  const [intensiveHere] = useState(hasDevice);
  async function openStep(step: 2 | 3 | 4 | 5 | 6 | 7) {
    if (!settings.testUnlockAll) return;
    try {
      await updateProgress({ selectedLevel: 'basic', step, practiceStage: 0 });
      router.push({ pathname: '/practice', params: { from: 'settings' } });
    } catch { /* The provider reports persistence errors below. */ }
  }
  return <ScreenTransition reducedMotion={settings.reducedMotion}>
    <SettingsScreen settings={settings} onChange={patch => { void updateSettings(patch).catch(() => {}); }}
      onBack={() => router.dismissTo('/home')} resetting={resetting} intensiveHere={intensiveHere}
      onPreviewCooldown={() => router.push({ pathname: '/practice', params: { preview: 'cooldown', deadline: String(Date.now() + STEP_WAIT_MS) } })}
      onOpenSecondStep={() => { void openStep(2); }}
      onOpenThirdStep={() => { void openStep(3); }}
      onOpenFourthStep={() => { void openStep(4); }}
      onOpenFifthStep={() => { void openStep(5); }}
      onOpenSixthStep={() => { void openStep(6); }}
      onOpenSeventhStep={() => { void openStep(7); }}
      // The reset also takes the Intensive account off this device (Art 2026-11-22).
      onReset={async () => { await resetProduct(); forgetIntensiveHere(); router.dismissAll(); router.replace('/launch'); }} />
    {error ? <ProductText accessibilityRole="alert" style={{ backgroundColor: '#000', padding: 16 }}>{error}</ProductText> : null}
  </ScreenTransition>;
}
