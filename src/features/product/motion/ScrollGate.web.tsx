import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useWideScrollInput } from './useWideScrollInput.web';
import { consumesReadingInput } from './reading-boundary-input';
import { createScrollGate } from './scroll-gate-model';
import type { ScrollGateProps } from './ScrollGate.types';
import { useSwipeNavigationAllowed } from '../navigation/BackSwipeProvider';

// A browser has one wheel stream. Keep its activity across remounted scenes,
// so the tail of a completed pull cannot become a second transition.
const wheelActivity = { current: -Infinity };

export function ScrollGate({ children, enabled, onReady, onProgress, onAdvance, onRetreat, onViewportChange, fill, allowAdvance = true, resetKey, startAtEnd = false, initialOffset = 0, guardEntryGesture = false, controllerRef, readingGesture, style, contentStyle, fadeTop = 0, fadeBottom = 0 }: ScrollGateProps) {
  const inputBlock = useRef<((event: Event) => void) | null>(null);
  const viewport = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null);
  const scrollLocked = useRef(false);
  const reading = useRef(readingGesture), readingTouch = useRef(false), lastReadingTouch = useRef(0);
  const readingWheel = useRef({ last: -Infinity, hold: false, locked: !!readingGesture?.locked });
  useLayoutEffect(() => {
    reading.current = readingGesture;
    const wheel = readingWheel.current;
    if (wheel.locked && !readingGesture?.locked) wheel.hold = true;
    wheel.locked = !!readingGesture?.locked;
    if (readingGesture?.locked && viewport.current) viewport.current.scrollTop = 0;
  }, [readingGesture]);
  const entryGuard = useRef(guardEntryGesture);
  const interacted = useRef(false), intent = useRef(1), origin = useRef(0);
  const entry = useRef({ key: resetKey, end: startAtEnd, offset: initialOffset });
  const swipeAllowed = useSwipeNavigationAllowed();
  const canRetreat = !!onRetreat;
  const callbacks = useRef({ onReady, onProgress, onAdvance, onRetreat, onViewportChange, enabled });
  useEffect(() => { callbacks.current = { onReady, onProgress, onAdvance, onRetreat, onViewportChange, enabled }; }, [onReady, onProgress, onAdvance, onRetreat, onViewportChange, enabled]);
  // eslint-disable-next-line react-hooks/refs -- Stored callbacks read current props only on user input.
  const gate = useMemo(() => createScrollGate(value => callbacks.current.onProgress(value), () => callbacks.current.onAdvance(), canRetreat ? () => callbacks.current.onRetreat?.() : undefined, wheelActivity), [canRetreat]);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const block = (event: Event) => {
      const input = reading.current;
      if (input) {
        let delta = 0, consume = readingTouch.current;
        if (event.type === 'wheel') {
          const wheel = event as WheelEvent, state = readingWheel.current;
          const fresh = wheel.timeStamp - state.last > 180;
          state.last = wheel.timeStamp;
          if (fresh) state.hold = false;
          delta = wheel.deltaY * (wheel.deltaMode === 1 ? 16 : wheel.deltaMode === 2 ? el.clientHeight : 1);
          consume ||= state.hold || consumesReadingInput(input, delta, el.scrollTop < 1);
        } else if (event.type === 'touchmove') {
          const y = (event as TouchEvent).touches[0]?.clientY ?? lastReadingTouch.current;
          delta = lastReadingTouch.current - y; lastReadingTouch.current = y;
          consume ||= consumesReadingInput(input, delta, el.scrollTop < 1);
          if (consume) readingTouch.current = true;
        } else if (event.type === 'keydown') {
          const key = (event as KeyboardEvent).key;
          delta = ['ArrowDown', 'PageDown', ' '].includes(key) ? 80 : ['ArrowUp', 'PageUp'].includes(key) ? -80 : 0;
          consume = !!delta && consumesReadingInput(input, delta, el.scrollTop < 1);
        }
        if (consume && delta) {
          event.preventDefault();
          if (callbacks.current.enabled && (event.type !== 'wheel' || !readingWheel.current.hold)) input.onDrag(delta);
          return;
        }
      }
      if (entryGuard.current && callbacks.current.enabled && !scrollLocked.current &&
        (event.type === 'keydown' || event.type === 'wheel' && event.timeStamp - wheelActivity.current > 180)) entryGuard.current = false;
      if ((scrollLocked.current || entryGuard.current) && event.cancelable) event.preventDefault();
      if (entryGuard.current && event.type === 'wheel') wheelActivity.current = event.timeStamp;
    };
    inputBlock.current = block;
    el.addEventListener('wheel', block, { passive: false });
    el.addEventListener('touchmove', block, { passive: false });
    el.addEventListener('keydown', block);
    if (controllerRef) controllerRef.current = {
      scrollTo: offset => el.scrollTo({ top: offset, behavior: 'instant' }),
      setScrollLocked: locked => {
        scrollLocked.current = locked;
        gate.block(); interacted.current = false; callbacks.current.onReady(false);
        el.style.overflowY = locked ? 'hidden' : 'auto';
        el.style.touchAction = locked ? 'none' : 'pan-y';
        el.dataset.scrollLocked = String(locked);
      },
    };
    return () => {
      inputBlock.current = null;
      if (controllerRef) controllerRef.current = null;
      el.removeEventListener('wheel', block); el.removeEventListener('touchmove', block); el.removeEventListener('keydown', block);
    };
  }, [controllerRef, gate]);
  useLayoutEffect(() => {
    if (entry.current.key !== resetKey) entry.current = { key: resetKey, end: false, offset: 0 };
    interacted.current = false; intent.current = 1; gate.reset();
    viewport.current?.style.setProperty('--scroll-fade-top', '0px');
    viewport.current?.scrollTo({ top: entry.current.end ? viewport.current.scrollHeight : entry.current.offset, behavior: 'instant' }); callbacks.current.onReady(false);
  }, [resetKey, gate]);
  // Permission changes must not turn reading momentum or a held touch into navigation.
  useEffect(() => { gate.block(); interacted.current = false; callbacks.current.onReady(false); }, [enabled, allowAdvance, gate]);
  const atEnd = () => allowAdvance && !!viewport.current && viewport.current.scrollHeight - viewport.current.clientHeight - viewport.current.scrollTop < 3;
  const atStart = () => !!viewport.current && viewport.current.scrollTop < 3;
  function check() {
    if (viewport.current) {
      if (reading.current?.locked) viewport.current.scrollTop = 0;
      // Content/font measurements can settle after mount. Keep the return edge
      // anchored until the user begins reading, then leave scrolling to them.
      if (entry.current.end) viewport.current.scrollTop = viewport.current.scrollHeight;
      else if (entry.current.offset > 0 && !reading.current?.locked) viewport.current.scrollTop = entry.current.offset;
      // The mask belongs to the viewport, so the edge stays under the fixed
      // header. Updating a CSS value avoids a React render on every scroll.
      viewport.current.style.setProperty('--scroll-fade-top', `${Math.min(fadeTop, Math.max(0, viewport.current.scrollTop))}px`);
      callbacks.current.onViewportChange?.({ offset: viewport.current.scrollTop, height: viewport.current.clientHeight });
    }
    callbacks.current.onReady((!reading.current?.locked || !!reading.current?.atRest && intent.current < 0) && !scrollLocked.current && callbacks.current.enabled && swipeAllowed() && interacted.current && (intent.current > 0 ? atEnd() : !!callbacks.current.onRetreat && atStart()));
  }
  function interact(delta: number) { if (Math.abs(delta) > 3) { entry.current.end = false; entry.current.offset = 0; interacted.current = true; intent.current = Math.sign(delta); check(); } }
  useEffect(() => {
    const el = viewport.current, body = content.current;
    if (!el || !body) return;
    const observer = new ResizeObserver(check); observer.observe(el); observer.observe(body);
    check(); return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Current callbacks are read only on resize/input.
  }, [enabled, fadeTop]);
  function inputWheel(event: WheelEvent) {
        if (reading.current && event.defaultPrevented) { gate.block(); gate.wheel(event.deltaY, false, event.timeStamp, false); return; }
        if (entryGuard.current || scrollLocked.current || !enabled || !swipeAllowed()) { gate.block(); gate.wheel(event.deltaY, false, event.timeStamp, false); interacted.current = false; check(); return; }
        // A return lands at the end. The tail of the gesture that brought us
        // here must not release that edge before content has finished sizing.
        if (entry.current.end && event.timeStamp - wheelActivity.current <= 180) { gate.wheel(event.deltaY, false, event.timeStamp, false); check(); return; }
        interact(event.deltaY); gate.wheel(event.deltaY, atEnd(), event.timeStamp, atStart());
  }
  function inputStart(event: TouchEvent) { readingTouch.current = !!reading.current?.locked && !reading.current?.atRest; lastReadingTouch.current = event.touches[0]?.clientY ?? 0; entry.current.end = false; entry.current.offset = 0; origin.current = lastReadingTouch.current; if (!readingTouch.current && !scrollLocked.current && enabled && swipeAllowed()) { entryGuard.current = false; gate.start(origin.current, atEnd(), atStart()); } else { gate.block(); interacted.current = false; check(); } }
  function inputMove(event: TouchEvent) { if (reading.current && (event.defaultPrevented || readingTouch.current)) { gate.block(); return; } if (!scrollLocked.current && enabled && swipeAllowed()) { const y = event.touches[0]?.clientY ?? origin.current; interact(origin.current - y); gate.move(y, atEnd(), atStart()); } else { gate.block(); interacted.current = false; check(); } }
  function inputEnd() { readingTouch.current = false; if (swipeAllowed()) gate.end(); else gate.block(); }
  function inputCancel() { readingTouch.current = false; gate.end(true); }
  useWideScrollInput(viewport, enabled, swipeAllowed, {
    wheel: event => { inputBlock.current?.(event); inputWheel(event); },
    start: inputStart,
    move: event => { inputBlock.current?.(event); inputMove(event); },
    end: inputEnd, cancel: inputCancel,
  });
  return <View style={[{ flex: 1, minHeight: 0 }, style]}>
    <div ref={viewport} tabIndex={enabled ? 0 : -1} aria-label="Содержимое задания. Прокрутите до конца для перехода"
      data-reading-locked={readingGesture ? String(readingGesture.locked) : undefined}
      style={{ height: '100%', minHeight: 0, overflowY: readingGesture?.locked ? 'hidden' : 'auto', overflowX: 'hidden', overflowAnchor: 'none', overscrollBehavior: 'contain', touchAction: readingGesture?.locked ? 'pan-x pinch-zoom' : 'pan-y', scrollbarWidth: 'none', outline: 'none',
        ...(fadeTop > 0 || fadeBottom > 0 ? { maskImage: `linear-gradient(to bottom, transparent, #000 var(--scroll-fade-top, 0px), #000 calc(100% - ${fadeBottom}px), transparent)`,
          WebkitMaskImage: `linear-gradient(to bottom, transparent, #000 var(--scroll-fade-top, 0px), #000 calc(100% - ${fadeBottom}px), transparent)`, maskMode: 'alpha', maskRepeat: 'no-repeat', maskSize: '100% 100%' } : {}) }}
      onScroll={check}
      onWheel={event => inputWheel(event.nativeEvent)}
      onTouchStart={event => inputStart(event.nativeEvent)}
      onTouchMove={event => inputMove(event.nativeEvent)}
      onTouchEnd={inputEnd}
      onTouchCancel={inputCancel}
      onKeyDown={event => {
        if (reading.current && event.defaultPrevented) { gate.block(); return; }
        const delta = ['ArrowDown', 'PageDown', ' '].includes(event.key) ? 80 : ['ArrowUp', 'PageUp'].includes(event.key) ? -80 : 0;
        if (scrollLocked.current || !enabled || !swipeAllowed()) { gate.block(); interacted.current = false; check(); return; }
        if (delta && (delta > 0 ? atEnd() : canRetreat && atStart())) { event.preventDefault(); interact(delta); gate.wheel(delta, atEnd(), event.timeStamp, atStart()); }
      }}>
      {/* Entering content translates inside its layout box, without creating a phantom scroll tail. */}
      <div ref={content} style={{ overflow: 'clip', ...(fill ? { minHeight: '100%', display: 'flex', flexDirection: 'column' } as const : {}) }}><View style={StyleSheet.flatten([fill && { flex: 1 }, contentStyle])}>{children}{fadeBottom > 0 && <View pointerEvents="none" style={{ height: fadeBottom, flexShrink: 0 }} />}</View></div>
    </div>
  </View>;
}
