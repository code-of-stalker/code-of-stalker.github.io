import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import type { CSSProperties, PropsWithChildren } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useProductSpacing } from '../layout';
import { RustMotion, shown } from './RustMotion.web';
import { useThemeColors } from '../ProductTheme';
import { useBackSwipeBlocked } from '../navigation/BackSwipeProvider';
import { useVisibleViewport } from './useVisibleViewport';


/** The browser composites one fixed sheet; React never moves it frame by frame. */
export function BottomSheet({ children, open, onClose, onDismiss, bottomInset = 0, reducedMotion = false }: PropsWithChildren<{
  open: boolean; onClose(): void; onDismiss?(): void; bottomInset?: number; reducedMotion?: boolean;
}>) {
  const colors = useThemeColors();
  const focused = useIsFocused();
  const { gutter } = useProductSpacing();
  const viewport = useVisibleViewport();
  const [present, setPresent] = useState(open);
  const dismiss = useRef(onDismiss);
  const backdropPressed = useRef(false);
  useEffect(() => { backdropPressed.current = false; }, [open, focused]);
  useLayoutEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  if (open && focused && !present) setPresent(true);
  if (!focused && present) setPresent(false);
  useEffect(() => { if (focused) return () => dismiss.current?.(); }, [focused]);
  useBackSwipeBlocked(open || present);
  const [height, setHeight] = useState(600);
  const duration = reducedMotion ? 0 : open ? 460 : 280;
  return <Modal visible={focused && (open || present)} transparent animationType="none" onRequestClose={onClose}>
    <View testID="bottom-sheet-viewport" style={[styles.root, { position: 'absolute', left: 0, right: 0, top: viewport.top,
      height: viewport.height || '100%', padding: gutter, paddingBottom: gutter + (viewport.height ? 0 : bottomInset) }]}>
      <RustMotion aria-hidden initial={[0, 0, 0, 1, 0, 100]} target={[open ? 1 : 0, 0, 0, 1, 0, 100]} duration={duration}
        curve={[0, 0, .58, 1]} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: colors.background === '#000000' ? '#000000b8' : colors.overlay }} />
      <button type="button" aria-label="Закрыть окно" style={{ position: 'absolute', inset: 0, border: 0, padding: 0, background: 'transparent' }}
        onPointerDown={() => { backdropPressed.current = true; }}
        onPointerCancel={() => { backdropPressed.current = false; }}
        onClick={event => {
          // A sheet opened during a held pointer can receive the originating
          // gesture's click. Only a press that began on this backdrop closes it.
          const close = event.detail === 0 || backdropPressed.current;
          backdropPressed.current = false;
          if (close) onClose();
        }} />
      <RustMotion initial={[1, 0, height + gutter, 1, 0, 100]} target={open ? shown : [1, 0, height + gutter, 1, 0, 100]} duration={duration}
        onComplete={() => { if (!open && present) { setPresent(false); dismiss.current?.(); } }} aria-hidden={!open}
        style={{ position: 'relative', display: 'flex', flexDirection: 'column',
          width: '100%', maxHeight: '100%', flexShrink: 0, pointerEvents: open ? 'auto' : 'none',
          willChange: open || present ? 'transform' : undefined } as CSSProperties}>
        <View onLayout={event => setHeight(event.nativeEvent.layout.height)} style={{ minHeight: 0, flexShrink: 1 }}>{children}</View>
      </RustMotion>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({ root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', overflow: 'hidden' } });
