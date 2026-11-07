import { router } from 'expo-router';
import { IntensiveFlow } from '../../features/intensive/ui/IntensiveFlow';
import { useProduct } from '../../features/product/state/ProductProvider';
import { ScreenTransition } from '../../features/product/ui';

export default function Intensive() {
  const { settings } = useProduct();
  return <ScreenTransition reducedMotion={settings.reducedMotion}>
    <IntensiveFlow onExit={() => router.dismissTo('/levels')} />
  </ScreenTransition>;
}
