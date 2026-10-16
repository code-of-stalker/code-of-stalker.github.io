import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { RecordingGestureProps } from './RecordingGesture.types';
import { RustMotion, shown } from './RustMotion.web';

/** A captured pointer keeps the hold alive outside the orb, including slide-up. */
export function RecordingGesture({ children, height, disabled, label, onBegin, onMove, onBeginPoint, onMovePoint, onEnd, onCancel, onActivate }: RecordingGestureProps) {
  const pointer = useRef<number | null>(null);
  const [pressed, contact] = useState(false);
  return <View style={{ width: '100%', height }}>
    <RustMotion data-recording-artwork initial={shown} target={[1, 0, 0, pressed ? .985 : 1, 0, 100]} duration={140}
      style={{ height: '100%', width: '100%', transformOrigin: '50% 50%' }}>{children}</RustMotion>
    <button type="button" data-recording-gesture aria-label={label} disabled={disabled}
      style={{ position: 'absolute', inset: 0, border: 0, padding: 0, background: 'transparent', color: 'inherit', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', cursor: 'pointer' }}
      onContextMenu={event => event.preventDefault()}
      onTouchStart={event => event.stopPropagation()} onTouchMove={event => event.stopPropagation()}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0 || pointer.current !== null) return;
        event.preventDefault(); event.stopPropagation(); pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        contact(true);
        if (onBeginPoint) onBeginPoint(event.clientX, event.clientY);
        else onBegin(event.clientY, event.currentTarget.getBoundingClientRect().width / 288);
      }}
      onPointerMove={event => { if (pointer.current === event.pointerId) { event.stopPropagation(); if (onMovePoint) onMovePoint(event.clientX, event.clientY); else onMove(event.clientY); } }}
      onPointerUp={event => {
        if (pointer.current !== event.pointerId) return;
        event.stopPropagation(); if (onMovePoint) onMovePoint(event.clientX, event.clientY); else onMove(event.clientY); pointer.current = null; contact(false); onEnd();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { if (pointer.current !== null) { pointer.current = null; contact(false); onCancel(); } }}
      onLostPointerCapture={() => { if (pointer.current !== null) { pointer.current = null; contact(false); onCancel(); } }}
      onClick={event => { if (event.detail === 0) onActivate(); }} />
  </View>;
}
