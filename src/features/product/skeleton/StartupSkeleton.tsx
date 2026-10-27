import { usePathname } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useThemeColors } from '../ProductTheme';
import { useProduct } from '../state/ProductProvider';
import { ScreenSkeleton, skeletonScreen } from './ScreenSkeleton';
import { SkeletonHost } from './Skeleton';

/** One skeleton from the app's first frame until its screen can be drawn:
 * saved data and fonts, the device profile, then the graphics engine. It
 * covers the screen beneath it and dissolves into its reveal. */
export function StartupSkeleton({ ready }: { ready: boolean }) {
  const colors = useThemeColors(), path = usePathname(), { settings, progress } = useProduct();
  const start = settings.startAt === 'diary' ? 'diary' : settings.startAt === 'architecture' ? progress.selectedLevel ? 'practice' : 'levels' : 'home';
  return <SkeletonHost ready={ready} reducedMotion={settings.reducedMotion} label="Открываем приложение" testID="startup-skeleton"
    style={[styles.cover, { backgroundColor: colors.background }]}>
    <ScreenSkeleton screen={skeletonScreen(path, start)} />
  </SkeletonHost>;
}

const styles = StyleSheet.create({ cover: { zIndex: 100 } });
