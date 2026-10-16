import { Animated, Easing } from './RustAnimated';
import { useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { productStepNames } from '../content';
import { ProductText } from '../ui';
import { StepChevron } from './StepChevron';
import { StepDropdown } from './StepDropdown';
import { PanelBorder } from '../PanelBorder';
import { usePanelSize } from './usePanelSize';
import { useBackSwipeBlocked } from '../navigation/BackSwipeProvider';
import type { ReadingMenuCutout } from './reading-menu-geometry';

/** Fixed menu geometry: only translation and opacity change during opening. */
export function TaskStepSelector({ step, availableAt, testUnlockAll = false, open, onToggle, onSelect, reducedMotion, inset, maxHeight, trailing, anchor = 'bottom', menuOffset = 0, trigger, triggerSize, style, menuCutout }: {
  step: keyof typeof productStepNames; availableAt: number | null; testUnlockAll?: boolean; open: boolean;
  onToggle(): void; onSelect(step: number): void; reducedMotion: boolean; inset: number; maxHeight: number;
  trailing?: ReactNode;
  anchor?: 'top' | 'bottom'; menuOffset?: number; trigger?: ReactNode;
  triggerSize?: { width: number; height: number }; style?: StyleProp<ViewStyle>;
  menuCutout?: ReadingMenuCutout;
}) {
  const styles = useThemeStyles(createStyles);
  const {ref,size,onLayout}=usePanelSize({width:288,height:26}),width=size.width;
  const [present, setPresent] = useState(open);
  const [expansion] = useState(() => new Animated.Value(0));
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);
  const menuHeight = Math.min(maxHeight, naturalHeight ?? maxHeight);
  const [phase, setPhase] = useState({ open, shown: false });
  if (phase.open !== open) setPhase({ open, shown: false });
  const shown = open && naturalHeight !== null && (reducedMotion || phase.shown);
  const { width: deviceWidth } = useWindowDimensions();
  const shortWidth = deviceWidth >= 375 ? 136 : 106;
  const headerHeight = triggerSize?.height ?? 26;
  const pinned = anchor === 'top';
  const hiddenY = pinned ? 0 : menuHeight - headerHeight;
  if (open && !present) setPresent(true);
  useBackSwipeBlocked(open || present);
  useEffect(() => {
    if (Platform.OS === 'web') {
      let nextFrame = 0, timer: ReturnType<typeof setTimeout> | undefined;
      let frame = 0;
      if (open && naturalHeight !== null) {
        if (!reducedMotion) frame = requestAnimationFrame(() => {
          nextFrame = requestAnimationFrame(() => setPhase(previous => previous.open ? { ...previous, shown: true } : previous));
        });
      } else if (!open) {
        timer = setTimeout(() => setPresent(false), reducedMotion ? 0 : 260);
      }
      return () => { cancelAnimationFrame(frame); cancelAnimationFrame(nextFrame); clearTimeout(timer); };
    }
    if (open && naturalHeight === null) return;
    const motion = Animated.timing(expansion, { toValue: open ? 1 : 0, duration: reducedMotion ? 0 : open ? 360 : 240,
      easing: Easing.bezier(.22, .8, .2, 1), useNativeDriver: !pinned });
    motion.start(({ finished }) => { if (finished && !open) setPresent(false); });
    return () => motion.stop();
  }, [open, expansion, reducedMotion, naturalHeight, pinned]);
  return <View ref={ref} pointerEvents="box-none" style={[styles.slot, anchor === 'top' && { marginTop: 0, height: Math.max(headerHeight, menuOffset + menuHeight) }, style]} onLayout={onLayout}>
    <Animated.View pointerEvents={!pinned && open ? 'none' : 'auto'} aria-hidden={!pinned && open} accessibilityElementsHidden={!pinned && open}
      importantForAccessibility={!pinned && open ? 'no-hide-descendants' : 'auto'}
      style={[styles.compact, pinned && { top: 0, bottom: undefined }, { zIndex: 1, width: triggerSize?.width ?? shortWidth, height: headerHeight, opacity: pinned ? 1 : Platform.OS === 'web' ? shown ? 0 : 1 : expansion.interpolate({ inputRange: [0, .35, 1], outputRange: [1, 0, 0] }) },
        Platform.OS === 'web' && { transition: `opacity ${reducedMotion ? 0 : 120}ms ease-out` } as ViewStyle]}>
      {trigger ?? <><PanelBorder />
      <Pressable accessibilityRole="button" accessibilityLabel="Выбрать шаг" accessibilityState={{ expanded: false }}
        aria-expanded={false} onPress={onToggle} style={[styles.trigger, { paddingHorizontal: inset }]}>
        <View style={styles.label}><ProductText variant="label" style={styles.compactLabel}>ШАГ {step}.</ProductText></View>
        <StepChevron />
      </Pressable></>}
    </Animated.View>
    {trailing && <View pointerEvents={open ? 'none' : 'auto'} aria-hidden={open} style={[styles.trailing, { left: shortWidth + 12, opacity: open ? 0 : 1 }]}>{trailing}</View>}
    {present && <Animated.View pointerEvents={open ? 'auto' : 'none'} aria-hidden={!open} accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'} testID="task-step-menu"
      style={[styles.menu, pinned && { top: menuOffset, bottom: undefined, overflow: 'hidden' }, { width, height: pinned ? Platform.OS === 'web' ? shown ? menuHeight : 0 : expansion.interpolate({ inputRange: [0, 1], outputRange: [0, menuHeight] }) : menuHeight, opacity: Platform.OS === 'web' ? shown ? 1 : 0 : expansion,
        transform: [{ translateY: Platform.OS === 'web' ? shown ? 0 : hiddenY : expansion.interpolate({ inputRange: [0, 1], outputRange: [hiddenY, 0] }) }] },
        Platform.OS === 'web' && { transition: `opacity ${reducedMotion ? 0 : open ? 360 : 240}ms cubic-bezier(.22,.8,.2,1), ${pinned ? 'height' : 'transform'} ${reducedMotion ? 0 : open ? 360 : 240}ms cubic-bezier(.22,.8,.2,1)` } as ViewStyle]}>
      <View style={{ width, height: menuHeight, flexShrink: 0 }}>
      <StepDropdown step={step} availableAt={availableAt} testUnlockAll={testUnlockAll} reducedMotion={reducedMotion} inset={inset}
        headerless={pinned} cutout={menuCutout} frameSize={{ width, height: menuHeight }} onNaturalHeight={setNaturalHeight} onClose={onToggle} onSelect={onSelect} />
      </View>
    </Animated.View>}
  </View>;
}
const createStyles = (colors: ProductColors) => StyleSheet.create({
  slot: { height: 26, marginTop: 10, zIndex: 40, overflow: 'visible' },
  compact: { position: 'absolute', left: 0, bottom: 0, height: 26, borderWidth: 0, borderColor: colors.background === '#FAE18F' ? colors.accent : colors.border },
  trailing: { position: 'absolute', right: 0, bottom: 0, minHeight: 26 },
  menu: { position: 'absolute', left: 0, bottom: 0 },
  trigger: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { flex: 1, alignItems: 'center', minWidth: 0 },
  compactLabel: { fontSize: 8, lineHeight: 12, letterSpacing: 1.76 },
});
