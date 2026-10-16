import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { PropsWithChildren } from 'react';
import { Platform, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { router, useIsFocused } from 'expo-router';
import { BackSwipe } from './back-swipe';
import { BackSwipeFeedback } from './BackSwipeFeedback';
import type { BackSwipeFeedbackHandle } from './BackSwipeFeedback.types';
import { useProduct } from '../state/ProductProvider';
import { useWebUpdateBlock } from '../updates/webUpdateSafety';

type Registration = { action(): void; priority: number };
type Registry = { register(key: object, entry: Registration): () => void; block(key: object): () => void; allowsSwipe(): boolean };
const Context = createContext<Registry | null>(null);
const allowSwipe = () => true;

export function BackSwipeProvider({ children }: PropsWithChildren) {
  const entries = useRef(new Map<object, Registration>()), gesture = useRef(new BackSwipe());
  const blockers = useRef(new Set<object>());
  const feedback = useRef<BackSwipeFeedbackHandle | null>(null);
  const { settings } = useProduct();
  const registry = useMemo<Registry>(() => ({ register(key, entry) {
    entries.current.set(key, entry); return () => { entries.current.delete(key); gesture.current.cancel(); };
  }, block(key) {
    blockers.current.add(key); gesture.current.cancel(); feedback.current?.finish(false);
    return () => { blockers.current.delete(key); };
  }, allowsSwipe() { return blockers.current.size === 0; } }), []);
  const back = () => {
    if (blockers.current.size) return;
    let chosen: Registration | undefined;
    for (const entry of entries.current.values()) if (!chosen || entry.priority >= chosen.priority) chosen = entry;
    if (chosen) chosen.action(); else if (router.canGoBack()) router.back();
  };
  const latestBack = useRef(back); useLayoutEffect(() => { latestBack.current = back; });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const start = (event: TouchEvent) => {
      const p = event.touches[0], target = event.target as Element | null;
      if (blockers.current.size) { cancel(); return; }
      if (!entries.current.size && !router.canGoBack()) return;
      // Ordinary buttons may yield to a horizontal drag. Recording, seeking and
      // editable fields keep their own gesture; the left content edge is usable.
      if (event.touches.length !== 1 || !p || target?.closest('input,textarea,select,[contenteditable="true"],[role="slider"],[data-recording-gesture],[data-back-swipe-ignore]')) { gesture.current.cancel(); return; }
      gesture.current.begin(p.clientX, p.clientY, event.timeStamp, innerWidth);
    };
    let claimed = false, suppressClickUntil = 0;
    const move = (event: TouchEvent) => {
      if (blockers.current.size) { cancel(); return; }
      if (event.touches.length !== 1) { cancel(); return; }
      const p = event.touches[0], sample = gesture.current.move(p.clientX, p.clientY);
      if (!sample) { feedback.current?.finish(false); return; }
      if (sample.claimed) {
        claimed=true;suppressClickUntil=Date.now()+600;
        if(event.cancelable)event.preventDefault();event.stopPropagation();
        feedback.current?.move(sample.distance,sample.progress,sample.y);
      }
    };
    const end = (event: TouchEvent) => {
      if (blockers.current.size) { cancel(); return; }
      const p = event.changedTouches[0], commit = !!p && gesture.current.finish(p.clientX, p.clientY, event.timeStamp);
      if(claimed){if(event.cancelable)event.preventDefault();event.stopPropagation();suppressClickUntil=Date.now()+350;}
      feedback.current?.finish(commit, () => latestBack.current());claimed=false;
    };
    const cancel = () => { gesture.current.cancel(); feedback.current?.finish(false); claimed=false; };
    const click = (event: MouseEvent) => {if(Date.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();}};
    document.addEventListener('touchstart', start, { capture: true, passive: true });
    document.addEventListener('touchmove', move, { capture: true, passive: false });
    document.addEventListener('touchend', end, { capture: true, passive: false });
    document.addEventListener('touchcancel', cancel, true);
    document.addEventListener('click', click, true);
    return () => { document.removeEventListener('touchstart', start, true); document.removeEventListener('touchmove', move, true); document.removeEventListener('touchend', end, true); document.removeEventListener('touchcancel', cancel, true); document.removeEventListener('click',click,true); };
  }, []);
  const beginNative = (event: GestureResponderEvent) => {
    if (Platform.OS === 'web') return;
    if (blockers.current.size) { gesture.current.cancel(); feedback.current?.finish(false); return; }
    const { pageX, pageY, touches } = event.nativeEvent;
    if (touches.length !== 1) { gesture.current.cancel(); return; }
    gesture.current.begin(pageX, pageY, event.timeStamp);
  };
  return <Context.Provider value={registry}><View style={{ flex: 1 }} onTouchStart={beginNative}
    onTouchMove={event => { if (Platform.OS !== 'web') { if(blockers.current.size){gesture.current.cancel();feedback.current?.finish(false);return;}const sample=gesture.current.move(event.nativeEvent.pageX,event.nativeEvent.pageY);if(sample?.claimed)feedback.current?.move(sample.distance,sample.progress,sample.y);else if(!sample)feedback.current?.finish(false); } }}
    onTouchEnd={event => { if (Platform.OS !== 'web') { if(blockers.current.size){gesture.current.cancel();feedback.current?.finish(false);return;}feedback.current?.finish(gesture.current.finish(event.nativeEvent.pageX,event.nativeEvent.pageY,event.timeStamp),()=>latestBack.current()); } }}
    onTouchCancel={() => { if(Platform.OS!=='web'){gesture.current.cancel();feedback.current?.finish(false);} }}><BackSwipeFeedback feedbackRef={feedback} reducedMotion={settings.reducedMotion}>{children}</BackSwipeFeedback></View></Context.Provider>;
}

/** Same back action as the screen button, including internal stages. */
export function useBackSwipe(action: () => void, enabled = true, priority = 0) {
  const focused = useIsFocused(), registry = useContext(Context), latest = useRef(action), key = useRef({});
  useLayoutEffect(() => { latest.current = action; });
  useEffect(() => {
    if (!registry || !focused || !enabled) return;
    return registry.register(key.current, { action: () => latest.current(), priority });
  }, [registry, focused, enabled, priority]);
}

/** A visible overlay owns interaction until its closing animation is finished.
 * Independent blockers let nested windows close without enabling the page below. */
export function useBackSwipeBlocked(blocked: boolean) {
  const focused = useIsFocused(), registry = useContext(Context), key = useRef({});
  useWebUpdateBlock(focused && blocked);
  useLayoutEffect(() => {
    if (!registry || !focused || !blocked) return;
    return registry.block(key.current);
  }, [registry, focused, blocked]);
}

/** Read on input, so forward/back scroll pulls share the overlay's lifetime. */
export function useSwipeNavigationAllowed() {
  const registry = useContext(Context);
  return registry?.allowsSwipe ?? allowSwipe;
}
