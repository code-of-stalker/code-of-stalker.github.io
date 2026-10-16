import { useRef, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

export function ReadingDragSurface({ children, enabled, onDrag }: PropsWithChildren<{ enabled: boolean; onDrag(delta: number): void }>) {
  const lastY = useRef(0);
  return <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => enabled}
    onResponderGrant={event => { lastY.current = event.nativeEvent.pageY; }}
    onResponderMove={event => {
      const y = event.nativeEvent.pageY;
      if (enabled) onDrag(lastY.current - y);
      lastY.current = y;
    }}>
    {children}
  </View>;
}
