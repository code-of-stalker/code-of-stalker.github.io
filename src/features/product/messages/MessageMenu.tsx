import { useMemo } from 'react';
import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { iconSource } from '../icon-source';
import { PanelBorder } from '../PanelBorder';
import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { ProductText } from '../ui';
import { MENU_ROW, menuIcons, placeMenu } from './menu';
import type { MenuItem, MenuRect, MenuSide } from './menu';

/** Native keeps the system fade; the web build plays the menu in Rust. */
export function MessageMenu({ open, anchor, side, items, onClose }: { open: boolean; anchor: MenuRect | null; side: MenuSide; items: MenuItem[]; onClose(): void }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const screen = useWindowDimensions();
  const place = anchor ? placeMenu(anchor, side, items.length, screen) : null;
  return <Modal visible={open && !!place} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable accessibilityRole="button" accessibilityLabel="Закрыть меню" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: .55 }]} />
    {place ? <View accessibilityRole="menu" style={[styles.panel, { left: place.left, top: place.top, width: place.width }]}>
      <PanelBorder color={colors.accent} />
      {items.map(item => <Row key={item.key} item={item} />)}
    </View> : null}
  </Modal>;
}

function Row({ item }: { item: MenuItem }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const source = useMemo(() => iconSource(menuIcons[item.icon], item.tone === 'error' ? colors.error : colors.accent, 18), [colors.accent, colors.error, item.icon, item.tone]);
  return <Pressable role="menuitem" onPress={item.onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.subtle }]}>
    <Image pointerEvents="none" source={source} style={styles.icon} contentFit="contain" />
    <ProductText variant="title" color={item.tone === 'error' ? colors.error : colors.text} style={styles.label}>{item.label}</ProductText>
  </Pressable>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  panel: { position: 'absolute', backgroundColor: colors.surface, paddingVertical: 6 },
  row: { height: MENU_ROW, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  icon: { width: 18, height: 18, flexShrink: 0 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
});
