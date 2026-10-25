import { useEffect, useLayoutEffect, useMemo, useRef, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { createReadingBoundaryInput, type ReadingRetreat } from './reading-boundary-input';
import { useSwipeNavigationAllowed } from '../navigation/BackSwipeProvider';

export function ReadingDragSurface({ children, enabled, onDrag, retreat }: PropsWithChildren<{ enabled: boolean; onDrag(delta: number): void; retreat?: ReadingRetreat }>) {
  const allowed = useSwipeNavigationAllowed(), latest = useRef({ enabled, onDrag, retreat, allowed });
  useLayoutEffect(() => { latest.current = { enabled, onDrag, retreat, allowed }; });
  // eslint-disable-next-line react-hooks/refs -- The model reads props only on input.
  const input = useMemo(() => createReadingBoundaryInput(() => ({ ...latest.current, enabled: latest.current.enabled && latest.current.allowed() })), []);
  useEffect(() => { if (!enabled) input.block(); }, [enabled, input]);
  return <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => enabled && allowed()}
    onResponderGrant={event => input.start(event.nativeEvent.pageY)}
    onResponderMove={event => input.move(event.nativeEvent.pageY)}
    onResponderRelease={() => input.end()} onResponderTerminate={() => input.end(true)}>
    {children}
  </View>;
}
