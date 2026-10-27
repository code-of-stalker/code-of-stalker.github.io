import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { ProductIconButton } from '../ui';
import { ReadingDragSurface } from './ReadingDragSurface';
import type { ReadingGesture, ScrollGateController } from './ScrollGate.types';
import { useReadingMotion } from './useReadingMotion';
import { readingControlsTop, type ReadingCloseButton } from './reading-controls';
import { useProductLayout } from '../layout';

type Window = { offset: number; height: number };
export type ReadingLayout = {
  headerProgress: number;
  runway: number;
  closeButton: ReadingCloseButton;
  contentInset: number;
  contentStyle: ViewStyle;
  controllerRef: RefObject<ScrollGateController | null>;
  readingGesture?: ReadingGesture;
  onViewportChange(window: Window): void;
};

/** A minimum runway lets even short articles finish opening. The header's
 * reserved space disappears as its controls become an overlay. Counter-insets
 * keep the text column fixed while the actual frame edges move.
 */
export function ReadingExpansion({ gutter, bottomInset, inset, heroHeight, viewportHeight, reducedMotion, hero, children, onClose, onViewportChange, onExpandedChange, enabled, continued = false, paged = false, onRetreat, onRetreatProgress, onRetreatReady }: {
  gutter: number; bottomInset: number; inset: number; heroHeight: number; viewportHeight: number; reducedMotion: boolean;
  hero(active: boolean): ReactNode; children(layout: ReadingLayout): ReactNode;
  onClose(): void; onViewportChange(window: Window): void;
  onExpandedChange?(opened: boolean): void;
  enabled: boolean;
  /** Later reading chapters keep the opened shell without a second zoom runway. */
  continued?: boolean;
  paged?: boolean;
  onRetreat?(): void; onRetreatProgress?(value: number): void; onRetreatReady?(value: boolean): void;
}) {
  const controllerRef = useRef<ScrollGateController | null>(null), productIconSize = useProductLayout().icon;
  const { layout, drag, observe } = useReadingMotion([gutter, bottomInset, inset, heroHeight, viewportHeight, Number(reducedMotion), Number(continued), readingControlsTop, productIconSize.buttonHeight, productIconSize.height, Number(paged)], () => {});
  const readingDistance = layout?.[1] ?? 0;
  const lastArticleOffset = useRef(0);
  const opened = continued || layout?.[0] === 1 && layout?.[16] === 0;
  useEffect(() => { onExpandedChange?.(opened); }, [opened, onExpandedChange]);
  const track = useCallback((window: Window) => {
    if (window.height <= 0) return;
    onViewportChange(window);
    if (window.offset > 0 && window.offset !== lastArticleOffset.current) observe(readingDistance);
    lastArticleOffset.current = window.offset;
  }, [observe, onViewportChange, readingDistance]);
  if (!layout) return <View style={styles.scene} />;
  const [eased, distance, , side, bottom, contentInset, heroOpacity, heroY, panelTop, closeRight, closeTop, buttonTop, paddingTop, paddingBottom, minHeight] = layout;
  return <View testID="reading-expansion" style={[styles.scene, { marginTop: -gutter, marginHorizontal: -gutter, marginBottom: -bottomInset }]}>
    <ReadingDragSurface enabled={enabled && !continued} onDrag={drag} retreat={onRetreat ? { atRest: eased === 0 && layout[16] === 0, onRetreat, onProgress: onRetreatProgress, onReady: onRetreatReady } : undefined}>
    <View testID="reading-hero" pointerEvents="none" style={{ position: 'absolute', top: gutter, left: gutter, right: gutter, height: heroHeight,
      opacity: heroOpacity,
      transform: [{ translateY: heroY }] }}>
      {hero(eased < .998816)}
    </View>
    </ReadingDragSurface>
    <View testID="reading-panel" style={{ position: 'absolute', top: panelTop, left: side, right: side, bottom }}>
      {children({ headerProgress: eased, runway: distance, contentInset, controllerRef,
        readingGesture: continued ? undefined : { locked: eased < 1 || layout[16] === 1, atRest: !!onRetreat && eased === 0 && layout[16] === 0, onDrag: delta => { if (enabled) drag(delta); } },
        closeButton: { right: closeRight, top: closeTop, width: productIconSize.width, height: productIconSize.height },
        contentStyle: { paddingHorizontal: contentInset, paddingTop, paddingBottom, minHeight },
        onViewportChange: track })}
    </View>
    <View style={{ position: 'absolute', top: buttonTop, right: gutter, zIndex: 5 }}>
      <ProductIconButton icon="close" onPress={onClose} />
    </View>
  </View>;
}
const styles = StyleSheet.create({ scene: { flex: 1, minHeight: 0, position: 'relative' } });
