import { useMemo } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { DiaryIcon } from '../diary/DiaryIcons';
import { iconSource } from '../icon-source';
import { Appear } from '../motion/Appear';
import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { fonts } from '../theme';
import { ProductText } from '../ui';
import { menuIcons } from './menu';

/** Above the input while a message is being changed: what is changed, and ✕ to stop. */
export function EditBar({ quote, disabled = false, onCancel }: { quote: string; disabled?: boolean; onCancel(): void }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const pencil = useMemo(() => iconSource(menuIcons.edit, colors.accent, 18), [colors.accent]);
  return <Appear>
    <View testID="message-edit-bar" style={styles.bar}>
      <Image pointerEvents="none" source={pencil} style={styles.icon} contentFit="contain" />
      <View style={styles.copy}>
        <ProductText maxFontSize={10} style={styles.label}>РЕДАКТИРОВАНИЕ</ProductText>
        <ProductText numberOfLines={1} style={styles.quote}>{quote.replace(/\s+/g, ' ')}</ProductText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Отменить редактирование" disabled={disabled} onPress={onCancel} style={styles.close}><DiaryIcon name="close" size={16} /></Pressable>
    </View>
  </Appear>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingLeft: 10, borderLeftWidth: .75, borderLeftColor: colors.accent },
  icon: { width: 18, height: 18, flexShrink: 0 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 8, lineHeight: 12, color: colors.accent, letterSpacing: .8 },
  quote: { fontFamily: fonts.title, fontWeight: '400', fontSize: 13, lineHeight: 18, color: colors.muted },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
