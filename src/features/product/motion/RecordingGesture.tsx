import { useEffect, useMemo, useRef } from 'react';
import { PanResponder, View } from 'react-native';
import type { RecordingGestureProps } from './RecordingGesture.types';

export function RecordingGesture(props: RecordingGestureProps) {
  const latest = useRef(props), width = useRef(288);
  useEffect(() => { latest.current = props; }, [props]);
  // eslint-disable-next-line react-hooks/refs -- PanResponder invokes these callbacks on input only.
  const gesture = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !latest.current.disabled,
    onPanResponderGrant: event => { if (latest.current.onBeginPoint) latest.current.onBeginPoint(event.nativeEvent.pageX, event.nativeEvent.pageY); else latest.current.onBegin(event.nativeEvent.pageY, width.current / 288); },
    onPanResponderMove: event => { if (latest.current.onMovePoint) latest.current.onMovePoint(event.nativeEvent.pageX, event.nativeEvent.pageY); else latest.current.onMove(event.nativeEvent.pageY); },
    onPanResponderRelease: event => { latest.current.onMovePoint?.(event.nativeEvent.pageX, event.nativeEvent.pageY); latest.current.onEnd(); },
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: () => latest.current.onCancel(),
  }), []);
  return <View style={{ width: '100%', height: props.height }} onLayout={event => { width.current = event.nativeEvent.layout.width; }}>
    {props.children}
    <View {...gesture.panHandlers} style={{ position: 'absolute', inset: 0 }} accessible accessibilityRole="button" accessibilityLabel={props.label}
      accessibilityState={{ disabled: props.disabled }} accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'activate' && !props.disabled) props.onActivate(); }} />
  </View>;
}
