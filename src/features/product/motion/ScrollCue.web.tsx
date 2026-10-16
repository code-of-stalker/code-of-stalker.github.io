import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { ProductText } from '../ui';
import { RustMotion, hidden } from './RustMotion.web';
export function ScrollCue({ visible, progress, reducedMotion, label, style }: { visible: boolean; progress: number; reducedMotion: boolean; label: string; style?: StyleProp<ViewStyle> }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  return <View testID="scroll-transition-progress" pointerEvents="none" style={[styles.cue, style]} aria-hidden={!visible} accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.abs(progress) * 100) }}>
    <RustMotion initial={hidden} target={[visible ? 1 : 0, 0, 0, 1, 0, 100]} duration={reducedMotion ? 0 : 320} curve={[.645, .045, .355, 1]} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: '100%' }}>
      <ProductText variant="label" style={styles.text}>{label}</ProductText>
      <View style={styles.track}><RustMotion scaleX springScale initial={[1, 0, 0, .03, 0, 100]} target={[1, 0, 0, Math.max(.03, Math.min(1, Math.abs(progress))), 0, 100]}
        duration={reducedMotion ? 0 : 240} curve={[.215, .61, .355, 1]} style={{ height: 2, width: '100%', background: colors.accent, transformOrigin: 'left center' }} /></View>
    </RustMotion>
  </View>;
}
const createStyles = (colors: ProductColors) => StyleSheet.create({ cue: { position: 'absolute', left: 44, right: 44, bottom: 6 }, text: { fontSize: 6, lineHeight: 8, letterSpacing: 2, color: colors.muted, textAlign: 'center' }, track: { width: '100%', height: 2, backgroundColor: `${colors.accent}24`, overflow: 'hidden' } });
