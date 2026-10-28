import { useLayoutEffect, useState, type RefObject } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { productStepNames } from '../content';
import { useStepPanelSpacing } from '../layout';
import { Reveal } from './Reveal';
import { StepDropdown } from './StepDropdown';

/** The unopened reader's menu uses the space above its title, outside the
 * article's clip and scanner mask. Measurements stay in window coordinates. */
export function ReadingStepMenu({ anchorRef, anchorTop, anchorHeight, reservedTop = 0, allowBelow = false, step, availableAt, testUnlockAll, inset, reducedMotion, onClose, onSelect }: {
  anchorRef: RefObject<View | null>; anchorTop: number; anchorHeight: number; reservedTop?: number; allowBelow?: boolean;
  step: keyof typeof productStepNames; availableAt: number | null; testUnlockAll?: boolean;
  inset: number; reducedMotion: boolean; onClose(): void; onSelect(step: number): void;
}) {
  const viewport = useWindowDimensions(), safe = useSafeAreaInsets();
  const { gap } = useStepPanelSpacing();
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number } | null>(null);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    let current = true;
    const measured = (x: number, y: number, width: number) => {
      if (current && width > 0) setAnchor({ x, y: y + anchorTop, width });
    };
    if (Platform.OS === 'web' && anchorRef.current) {
      // RN Web rounds measureInWindow; retain the fractional panel edges.
      const bounds = (anchorRef.current as unknown as HTMLElement).getBoundingClientRect();
      measured(bounds.left, bounds.top, bounds.width);
    } else anchorRef.current?.measureInWindow(measured);
    return () => { current = false; };
  }, [anchorRef, anchorTop, viewport.width, viewport.height]);
  if (!anchor) return null;
  const topEdge = Math.max(safe.top + 12, anchor.y - anchorTop + reservedTop);
  const aboveRoom = Math.max(1, anchor.y - gap - topEdge);
  const belowTop = anchor.y + anchorHeight + gap;
  const belowRoom = Math.max(1, viewport.height - safe.bottom - 12 - belowTop);
  // Stay above the unscrolled hero even on a short phone: the list scrolls.
  // Only a partly expanded reader may switch to the larger lower space.
  const above = !allowBelow || aboveRoom >= Math.min(naturalHeight ?? 240, 240) || aboveRoom >= belowRoom;
  const height = Math.min(naturalHeight ?? viewport.height, above ? aboveRoom : belowRoom);
  const ready = naturalHeight !== null;
  return <Modal transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
    <View style={styles.screen}>
      <Pressable accessibilityRole="button" accessibilityLabel="Закрыть выбор шага" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View testID={above ? 'reading-step-menu-above' : 'reading-step-menu-below'} pointerEvents={ready ? 'auto' : 'none'}
        style={{ position: 'absolute', left: anchor.x, top: above ? anchor.y - gap - height : belowTop, width: anchor.width, height, opacity: ready ? 1 : 0 }}>
        <Reveal reducedMotion={reducedMotion} style={styles.screen}>
          <StepDropdown step={step} availableAt={availableAt} testUnlockAll={testUnlockAll} headerless
            frameSize={{ width: anchor.width, height }} onNaturalHeight={setNaturalHeight}
            reducedMotion={reducedMotion} inset={inset} onClose={onClose} onSelect={onSelect} />
        </Reveal>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
