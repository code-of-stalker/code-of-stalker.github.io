import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { productStepNames } from '../content';
import { ProductText } from '../ui';
import { StepChevron } from './StepChevron';
import { StepDropdown } from './StepDropdown';
import { RustMotion, shown } from './RustMotion.web';
import { PanelBorder } from '../PanelBorder';
import { usePanelSize } from './usePanelSize';
import { useBackSwipeBlocked } from '../navigation/BackSwipeProvider';
import type { ReadingMenuCutout } from './reading-menu-geometry';

export function TaskStepSelector({ step, availableAt, testUnlockAll = false, open, onToggle, onSelect, reducedMotion, inset, maxHeight, trailing, anchor = 'bottom', menuOffset = 0, trigger, triggerSize, style, menuCutout }: {
  step: keyof typeof productStepNames; availableAt: number | null; testUnlockAll?: boolean; open: boolean;
  onToggle(): void; onSelect(step: number): void; reducedMotion: boolean; inset: number; maxHeight: number;
  trailing?: ReactNode;
  anchor?: 'top' | 'bottom'; menuOffset?: number; trigger?: ReactNode;
  triggerSize?: { width: number; height: number }; style?: StyleProp<ViewStyle>;
  menuCutout?: ReadingMenuCutout;
}) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const {ref,size,onLayout}=usePanelSize({width:288,height:26}),width=size.width;
  const [present, setPresent] = useState(open);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);
  const menuHeight = Math.min(maxHeight, naturalHeight ?? maxHeight);
  const ready = open && naturalHeight !== null;
  const { width: deviceWidth } = useWindowDimensions(), shortWidth = deviceWidth >= 375 ? 136 : 106;
  const pinned = anchor === 'top';
  const headerHeight = triggerSize?.height ?? 26, below: readonly [number, number, number, number, number, number] = [0, 0, pinned ? 0 : menuHeight - headerHeight, 1, 0, 100];
  if (open && !present) setPresent(true);
  useBackSwipeBlocked(open || present);
  return <View ref={ref} pointerEvents="box-none" style={[styles.slot, anchor === 'top' && { marginTop: 0, height: Math.max(headerHeight, menuOffset + menuHeight) }, style]} onLayout={onLayout}>
    <RustMotion initial={shown} target={[!pinned && ready ? 0 : 1, 0, 0, 1, 0, 100]} duration={reducedMotion ? 0 : 120} curve={[0, 0, .58, 1]} aria-hidden={!pinned && open}
      style={{ position: 'absolute', left: 0, ...(pinned ? { top: 0 } : { bottom: 0 }), zIndex: 1, height: headerHeight, width: triggerSize?.width ?? shortWidth, pointerEvents: !pinned && open ? 'none' : 'auto', display: 'flex' }}>
      {trigger ?? <><PanelBorder color={colors.background === '#FAE18F' ? colors.accent : colors.border} />
      <Pressable accessibilityRole="button" accessibilityLabel="Выбрать шаг" accessibilityState={{ expanded: false }} onPress={onToggle} style={[styles.trigger, { paddingHorizontal: inset }]}>
        <View style={styles.label}><ProductText variant="label" style={styles.compactLabel}>ШАГ {step}.</ProductText></View><StepChevron />
      </Pressable></>}
    </RustMotion>
    {trailing && <RustMotion initial={shown} target={[open ? 0 : 1, 0, 0, 1, 0, 100]} duration={reducedMotion ? 0 : 120} curve={[0, 0, .58, 1]} aria-hidden={open}
      style={{ position: 'absolute', left: shortWidth + 12, right: 0, bottom: 0, minHeight: 26, pointerEvents: open ? 'none' : 'auto' }}>{trailing}</RustMotion>}
    {present && <RustMotion initial={below} target={ready ? shown : below} duration={reducedMotion ? 0 : open ? 360 : 240}
      initialHeight={pinned ? 0 : undefined} height={pinned ? ready ? menuHeight : 0 : undefined}
      onComplete={() => { if (!open) setPresent(false); }} aria-hidden={!open} data-testid="task-step-menu"
      style={{ position: 'absolute', left: 0, ...(pinned ? { top: menuOffset, overflow: 'hidden' } : { bottom: 0 }), width, height: menuHeight, pointerEvents: ready ? 'auto' : 'none', display: 'flex', flexDirection: 'column' }}>
      <View style={{ width, height: menuHeight, flexShrink: 0 }}>
        <StepDropdown step={step} availableAt={availableAt} testUnlockAll={testUnlockAll} reducedMotion={reducedMotion} inset={inset} headerless={pinned} cutout={menuCutout} frameSize={{ width, height: menuHeight }} onNaturalHeight={setNaturalHeight} onClose={onToggle} onSelect={onSelect} />
      </View>
    </RustMotion>}
  </View>;
}
const createStyles = (colors: ProductColors) => StyleSheet.create({
  slot: { height: 26, marginTop: 10, zIndex: 40, overflow: 'visible' },
  trigger: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { flex: 1, alignItems: 'center', minWidth: 0 }, compactLabel: { fontSize: 8, lineHeight: 12, letterSpacing: 1.76 },
});
