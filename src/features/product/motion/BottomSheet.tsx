import { Animated, Easing } from './RustAnimated';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useIsFocused } from 'expo-router';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useProductSpacing } from '../layout';
import { useThemeColors } from '../ProductTheme';
import { useBackSwipeBlocked } from '../navigation/BackSwipeProvider';

/** Keep the sheet mounted until its closing movement finishes. */
export function BottomSheet({ children, open, onClose, onDismiss, bottomInset = 0, reducedMotion = false }: PropsWithChildren<{
  open: boolean; onClose(): void; onDismiss?(): void; bottomInset?: number; reducedMotion?: boolean;
}>) {
  const colors = useThemeColors();
  const focused = useIsFocused();
  const { height } = useWindowDimensions(), { gutter } = useProductSpacing();
  const [present, setPresent] = useState(open);
  const [position] = useState(() => new Animated.Value(0));
  const dismiss = useRef(onDismiss);
  useLayoutEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  if (open && focused && !present) setPresent(true);
  if (!focused && present) setPresent(false);
  useEffect(() => { if (focused) return () => dismiss.current?.(); }, [focused]);
  useBackSwipeBlocked(open || present);
  useEffect(() => {
    const motion = Animated.timing(position, { toValue: open ? 1 : 0,
      duration: reducedMotion ? 0 : open ? 460 : 280, easing: Easing.bezier(.22, .8, .2, 1), useNativeDriver: true });
    motion.start(({ finished }) => { if (finished && !open && present) { setPresent(false); dismiss.current?.(); } });
    return () => motion.stop();
  }, [open, position, reducedMotion, present]);
  return <Modal visible={focused && (open || present)} transparent animationType="none" onRequestClose={onClose}>
    <View style={[styles.root, { padding: gutter, paddingBottom: gutter + bottomInset }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shade, { opacity: position, backgroundColor: colors.background === '#000000' ? '#000000b8' : colors.overlay }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Закрыть окно" style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[styles.content, {
        transform: [{ translateY: position.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }],
      }]}>{children}</Animated.View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  shade: { backgroundColor: '#000000b8' },
  content: { width: '100%', maxHeight: '88%' },
});
