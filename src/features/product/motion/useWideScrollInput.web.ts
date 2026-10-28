import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { softScrollBy } from './softScrollDriver.web';

type Input = {
  wheel(event: WheelEvent): void;
  start(event: TouchEvent): void;
  move(event: TouchEvent): void;
  end(): void;
  cancel(): void;
};
/** Side gutters feed the active reader's existing input model, preserving its
 * expansion, overscroll, modal and recording guards. This owns input only. */
export function useWideScrollInput(ref: RefObject<HTMLDivElement | null>, enabled: boolean, allowed: () => boolean, input: Input) {
  const latest = useRef({ enabled, allowed, input });
  useLayoutEffect(() => { latest.current = { enabled, allowed, input }; });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let touch: { x: number; y: number; lastY: number; vertical: boolean } | null = null;
    const usable = () => latest.current.enabled && latest.current.allowed() && !el.closest('[aria-hidden="true"]') && el.getBoundingClientRect().height > 0;
    const outside = (target: EventTarget | null, x: number) => {
      const screen = el.closest('[data-testid="product-screen"]'), workspace = screen?.querySelector('[data-testid="product-workspace"]');
      if (!(target instanceof Node) || !screen?.contains(target) || !workspace) return false;
      const box = workspace.getBoundingClientRect();
      return x < box.left || x > box.right;
    };
    const wheel = (event: WheelEvent) => {
      if (!usable() || event.defaultPrevented || event.ctrlKey || !outside(event.target, event.clientX)) return;
      latest.current.input.wheel(event);
      if (!event.defaultPrevented && !softScrollBy(el, event.deltaY, event.deltaMode)) el.scrollTop += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1);
      event.preventDefault();
    };
    const start = (event: TouchEvent) => {
      const point = event.touches[0];
      if (!usable() || event.touches.length !== 1 || !point || !outside(event.target, point.clientX)) return;
      touch = { x: point.clientX, y: point.clientY, lastY: point.clientY, vertical: false };
      latest.current.input.start(event);
    };
    const move = (event: TouchEvent) => {
      if (!touch) return;
      if (!usable() || event.touches.length !== 1 || event.defaultPrevented) { latest.current.input.cancel(); touch = null; return; }
      const point = event.touches[0], dy = point.clientY - touch.y, dx = point.clientX - touch.x;
      if (!touch.vertical) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { latest.current.input.cancel(); touch = null; return; }
        if (Math.abs(dy) < 6) return;
        touch.vertical = true;
      }
      latest.current.input.move(event);
      if (!event.defaultPrevented) el.scrollTop += touch.lastY - point.clientY;
      touch.lastY = point.clientY;
      event.preventDefault();
    };
    const end = () => { if (touch) latest.current.input.end(); touch = null; };
    const cancel = () => { if (touch) latest.current.input.cancel(); touch = null; };
    document.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', cancel);
    return () => {
      document.removeEventListener('wheel', wheel); document.removeEventListener('touchstart', start);
      document.removeEventListener('touchmove', move); document.removeEventListener('touchend', end); document.removeEventListener('touchcancel', cancel);
    };
  }, [ref]);
}
