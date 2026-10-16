import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motionCommand, nextMotionId, subscribeReading } from './nativeMotionBridge';
export function useReadingMotion(values: number[], onFrame: (values: number[]) => void) {
  const [id] = useState(nextMotionId), [layout, setLayout] = useState<number[]>(), callback = useRef(onFrame);
  useLayoutEffect(() => { callback.current = onFrame; });
  const key = values.join('|');
  useEffect(() => subscribeReading(id, next => { setLayout(next); callback.current(next); }), [id]);
  useEffect(() => {
    motionCommand('register_reading', id, key.split('|').map(Number));
  }, [id, key]);
  const observe = useCallback((offset: number) => motionCommand('observe_reading', id, offset, performance.now()), [id]);
  const drag = useCallback((delta: number) => motionCommand('drag_reading', id, delta, performance.now()), [id]);
  return { layout, observe, drag };
}
