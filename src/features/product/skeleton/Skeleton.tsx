import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemeColors } from '../ProductTheme';
import { skeletonTone, type SkeletonBlockProps, type SkeletonHostProps } from './skeleton.types';

/** Matches the Rust field's APPEAR_DELAY_MS: a quick load shows nothing. */
const appearDelay = 120;

/** Native screens have no Rust clock outside the artwork's web view, so the
 * skeleton is still: it appears after the delay and leaves with the content. */
export function SkeletonHost({ ready, label, style, testID, children }: SkeletonHostProps) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setShown(true), appearDelay);
    return () => clearTimeout(timer);
  }, [ready]);
  if (ready || !shown) return null;
  return <View testID={testID} pointerEvents="none" accessible={!!label} accessibilityLabel={label} accessibilityRole={label ? 'progressbar' : undefined}
    importantForAccessibility={label ? 'yes' : 'no-hide-descendants'} style={[StyleSheet.absoluteFill, styles.host, style]}>{children}</View>;
}

export function SkeletonBlock({ style }: SkeletonBlockProps) {
  const tone = skeletonTone(useThemeColors());
  return <View style={[{ backgroundColor: tone.fill }, style]} />;
}

const styles = StyleSheet.create({ host: { overflow: 'hidden' } });
