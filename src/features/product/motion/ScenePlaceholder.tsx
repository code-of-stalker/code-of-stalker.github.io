import { StyleSheet, View } from 'react-native';
import { useThemeColors } from '../ProductTheme';
import { ProductText } from '../ui';
import type { ScenePlaceholderInfo } from './readingPages';

const corner = 14;
/** Holds a planned scene's exact size until its Rust scene exists. No fill, so light themes keep
 * the page color; four viewfinder corners and the scene's working name mark the place. */
export function ScenePlaceholder({ scene, width, height }: { scene: ScenePlaceholderInfo; width: number; height: number }) {
  const colors = useThemeColors(), line = { borderColor: colors.border };
  return <View testID="scene-placeholder" accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden
    pointerEvents="none" style={[styles.frame, { width, height }]}>
    <View style={[styles.corner, line, { top: 0, left: 0, borderTopWidth: 1, borderLeftWidth: 1 }]} />
    <View style={[styles.corner, line, { top: 0, right: 0, borderTopWidth: 1, borderRightWidth: 1 }]} />
    <View style={[styles.corner, line, { bottom: 0, left: 0, borderBottomWidth: 1, borderLeftWidth: 1 }]} />
    <View style={[styles.corner, line, { bottom: 0, right: 0, borderBottomWidth: 1, borderRightWidth: 1 }]} />
    <ProductText variant="label" color={colors.faint} style={styles.kicker}>ЗДЕСЬ БУДЕТ СЦЕНА</ProductText>
    <ProductText variant="title" color={colors.muted} style={styles.name}>{scene.name}</ProductText>
    <ProductText color={colors.faint} style={styles.manner}>{scene.manner}</ProductText>
  </View>;
}
const styles = StyleSheet.create({
  frame: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  corner: { position: 'absolute', width: corner, height: corner },
  kicker: { fontSize: 8, lineHeight: 12, letterSpacing: 3, marginBottom: 10 },
  name: { fontSize: 16, lineHeight: 22, letterSpacing: 1.6, textTransform: 'uppercase', textAlign: 'center' },
  manner: { marginTop: 6, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
