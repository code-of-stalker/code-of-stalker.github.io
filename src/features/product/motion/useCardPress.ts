import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/** Let the existing touch animation paint before a card leaves the screen. */
export function useCardPress(onPress: (() => void) | undefined, card: boolean, reduced: boolean, active: boolean) {
  const latest = useRef({ onPress, card, reduced, active });
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useLayoutEffect(() => { latest.current = { onPress, card, reduced, active }; });
  const cancel = useCallback(() => { clearTimeout(pending.current); pending.current = undefined; }, []);
  useEffect(() => { if (!active) cancel(); return cancel; }, [active, cancel]);
  return useCallback(() => {
    const current = latest.current;
    if (!current.active || !current.onPress || pending.current !== undefined) return;
    if (!current.card || current.reduced) { current.onPress(); return; }
    pending.current = setTimeout(() => {
      pending.current = undefined;
      if (latest.current.active) latest.current.onPress?.();
    }, 180);
  }, []);
}
