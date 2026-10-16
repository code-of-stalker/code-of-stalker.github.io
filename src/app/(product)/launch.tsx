import { Redirect } from 'expo-router';
import { useProduct } from '../../features/product/state/ProductProvider';

export default function Launch() {
  const { settings, progress } = useProduct();
  if (settings.startAt === 'diary') return <Redirect href="/diary" />;
  if (settings.startAt === 'architecture') return <Redirect href={progress.selectedLevel ? '/practice' : '/levels'} />;
  return <Redirect href="/home" />;
}
