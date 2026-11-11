import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { iconSource } from '../icon-source';
import { RustMotion, shown } from '../motion/RustMotion.web';
import type { MotionValues } from '../motion/RustMotion.web';
import { uiCurve, uiDuration, useUiReduced } from '../motion/uiMotion';
import { PanelBorder } from '../PanelBorder';
import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { ProductText } from '../ui';
import { MENU_ROW, menuIcons, placeMenu } from './menu';
import type { MenuItem, MenuRect, MenuSide } from './menu';

/** The dim never hides the page: Telegram's soft veil, not a sheet's dark backdrop. */
const DIM = .55;

/** The menu keeps its last place and items while it fades away. */
export function MessageMenu({ open, anchor, side, items, onClose }: { open: boolean; anchor: MenuRect | null; side: MenuSide; items: MenuItem[]; onClose(): void }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const screen = useWindowDimensions();
  const reduced = useUiReduced();
  const [present, setPresent] = useState(open);
  const [kept, setKept] = useState({ anchor, side, items });
  if (open && !present) setPresent(true);
  if (open && (kept.anchor !== anchor || kept.items !== items || kept.side !== side)) setKept({ anchor, side, items });
  if (!open && reduced && present) setPresent(false);
  const place = kept.anchor ? placeMenu(kept.anchor, kept.side, kept.items.length, screen) : null;
  // It grows out of the message: from its top edge when below it, from its bottom when above.
  const away = useMemo<MotionValues>(() => [0, 0, place?.from === 'top' ? -6 : 6, .94, 0, 100], [place?.from]);
  if (!present || !place) return null;
  const duration = reduced ? 0 : uiDuration;
  // The veil leaves a window over the message itself, so it stays bright as in Telegram.
  const hole = kept.anchor!, r = (n: number) => Math.round(n * 10) / 10;
  const veil = `path(evenodd, 'M0 0H${screen.width}V${screen.height}H0Z M${r(hole.x)} ${r(hole.y)}h${r(hole.width)}v${r(hole.height)}h${-r(hole.width)}Z')`;
  return <Modal visible transparent animationType="none" onRequestClose={onClose}>
    <Pressable accessibilityRole="button" accessibilityLabel="Закрыть меню" onPress={onClose} style={StyleSheet.absoluteFill} />
    <RustMotion initial={[0, 0, 0, 1, 0, 100]} target={open ? [DIM, 0, 0, 1, 0, 100] : [0, 0, 0, 1, 0, 100]} duration={duration} curve={uiCurve}
      onComplete={() => { if (!open) setPresent(false); }} style={{ position: 'absolute', inset: 0, background: colors.background, clipPath: veil, pointerEvents: 'none' }} />
    <RustMotion initial={away} target={open ? shown : away} duration={duration} curve={uiCurve}
      style={{ position: 'absolute', left: place.left, top: place.top, width: place.width, transformOrigin: `${kept.side === 'end' ? 'right' : 'left'} ${place.from}`, pointerEvents: open ? 'auto' : 'none' }}>
      <View accessibilityRole="menu" style={styles.panel}>
        <PanelBorder color={colors.accent} />
        {kept.items.map(item => <MenuRow key={item.key} item={item} />)}
      </View>
    </RustMotion>
  </Modal>;
}

function MenuRow({ item }: { item: MenuItem }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const ink = item.tone === 'error' ? colors.error : colors.text;
  const source = useMemo(() => iconSource(menuIcons[item.icon], item.tone === 'error' ? colors.error : colors.accent, 18), [colors.accent, colors.error, item.icon, item.tone]);
  return <Pressable role="menuitem" onPress={item.onPress} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.row, (pressed || hovered) && { backgroundColor: colors.subtle }]}>
    <Image pointerEvents="none" source={source} style={styles.icon} contentFit="contain" />
    <ProductText variant="title" color={ink} style={styles.label}>{item.label}</ProductText>
  </Pressable>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  panel: { backgroundColor: colors.surface, paddingVertical: 6 },
  row: { height: MENU_ROW, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  icon: { width: 18, height: 18, flexShrink: 0 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
});
