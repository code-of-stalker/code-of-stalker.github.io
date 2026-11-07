import { router } from 'expo-router';
import { IntensiveFlow } from '../../features/intensive/ui/IntensiveFlow';
import { useProduct } from '../../features/product/state/ProductProvider';
import { ScreenTransition } from '../../features/product/ui';

/** The main admin's page for the Intensive; no menu links here, the address is shared by hand. */
export default function Admin() {
  const { settings } = useProduct();
  return <ScreenTransition reducedMotion={settings.reducedMotion}>
    <IntensiveFlow mode="console" onExit={() => { if (router.canGoBack()) router.back(); else router.replace('/levels'); }} />
  </ScreenTransition>;
}
