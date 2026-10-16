import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useThemeColors, useThemeStyles } from './ProductTheme';
import { colors as darkColors, fonts, type ProductColors } from './theme';
import { ProductText } from './ui';
import { panelAsset } from './panelAssets';
import { PanelBorder } from './PanelBorder';
import { PanelArtwork } from './motion/PanelArtwork';
import { voiceIconPaths } from './audio/voice-icons';
import { iconSource, notebookPath } from './icon-source';

const paths = {
  play: 'M7 4v16l13-8z',
  trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  waveform: 'M3 10v4m3-7v10m3-13v16m3-11v6m3-12v18m3-14v10m3-7v4',
  lips: voiceIconPaths.lips,
  close: 'm6 6 12 12M18 6 6 18',
  chevron: 'm5 9 7 7 7-7',
  arrow: 'M3 12h18m-7-7 7 7-7 7',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M4 10h16v11H4zM12 14v3',
};
export function ObservationIcon({ name, size = 16, muted = false }: { name: keyof typeof paths; size?: number; muted?: boolean }) {
  const colors = useThemeColors(), color = muted ? colors.muted : colors.accent;
  const source = useMemo(() => iconSource(paths[name], color, size, name === 'lips' ? '104 91 32 32' : '0 0 24 24', false, name === 'lips' ? 'round' : 'butt'), [color, name, size]);
  return <Image pointerEvents="none" source={source} style={{ width: size, height: size, flexShrink: 0 }} contentFit="contain" />;
}

/** The cooldown uses the exact Figma contour and note glyph; the saved answer
 * uses the reference's rectangular outline and lips. Both keep a native hit target. */
export function ObservationActionButton({ label, icon, onPress, disabled = false, style }: {
  label: string; icon: 'note' | 'lips'; onPress(): void; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors(), styles = useThemeStyles(createStyles);
  const filled = icon === 'note' && colors !== darkColors;
  const ink = filled ? colors.onAccent : colors.accent;
  const frame = useMemo(() => panelAsset('action', colors, filled), [colors, filled]);
  const note = useMemo(() => iconSource(notebookPath, ink, 16), [ink]);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[styles.action, icon === 'lips' && styles.rectangular, disabled && { opacity: .4 }, style]}>
    {icon === 'note' && <PanelArtwork source={frame} />}
    {icon === 'lips' && <PanelBorder />}
    <View style={styles.actionContent}>
      {icon === 'note' ? <Image pointerEvents="none" source={note} style={styles.note} contentFit="contain" /> : <ObservationIcon name="lips" size={14} />}
      <ProductText variant="title" color={ink} numberOfLines={1} maxFontSize={16} style={styles.actionLabel}>{label}</ProductText>
    </View>
  </Pressable>;
}
const createStyles = (colors: ProductColors) => StyleSheet.create({
  action: { minHeight: 42, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  rectangular: { borderWidth: 0, borderColor: colors.background === '#FAE18F' ? colors.accent : colors.border, backgroundColor: colors.surface },
  actionContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionLabel: { fontFamily: fonts.title, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  note: { width: 16, height: 16 },
});
