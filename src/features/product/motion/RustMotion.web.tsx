import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren, CSSProperties } from 'react';
import { useIsFocused } from 'expo-router';
import { useEffectsController } from './EffectsQuality';
import { loadGraphics } from './rustEngine.web';
import type { ElementTimeline } from './rustEngine.web';
import { useSystemReducedMotion } from './useSystemReducedMotion.web';
import { motionSettledEvent } from './motion-visibility.web';

export type MotionValues = readonly [opacity: number, x: number, y: number, scale: number, rotation: number, width: number];
export const shown: MotionValues = [1, 0, 0, 1, 0, 100];
export const hidden: MotionValues = [0, 0, 0, 1, 0, 100];
export const gentle = [.22, .8, .2, 1] as const;
/** Extra wait past a transition's own length before its completion is forced. */
export const completionSafetyMs = 1200;

/** Target events only. The shared Rust clock writes the presentation style and
 * reports completion; React never calculates a transition's intermediate frame. */
export function RustMotion({ children, initial = shown, target = shown, duration = 460, delay = 0, curve = gentle, active = true, loop, onComplete, scaleX = false, freezeScale = false, springScale = false, height, initialHeight, scanDuration, breathe, style, ...attributes }: PropsWithChildren<{
  initial?: MotionValues; target?: MotionValues; duration?: number; delay?: number; curve?: readonly number[]; active?: boolean;
  loop?: { width: number; speed: number }; onComplete?(): void; style?: CSSProperties;
  'data-testid'?: string; 'aria-hidden'?: boolean;
  scaleX?: boolean;
  freezeScale?: boolean;
  springScale?: boolean;
  height?: number; initialHeight?: number; scanDuration?: number;
  /** Waiting pulse of the opacity: period in ms and lowest factor. */
  breathe?: { period: number; low: number };
}>) {
  const systemReduced = useSystemReducedMotion();
  if (systemReduced) { duration = 0; delay = 0; if (loop) active = false; }
  const breath = systemReduced ? undefined : breathe;
  // Microphone samples and scroll updates rerender their parents. Equal values
  // must not resend a transition or re-arm its completion on every update.
  const [opacity, x, y, scale, rotation, width] = target;
  const [x1, y1, x2, y2] = curve;
  const resolvedScale = freezeScale || springScale ? NaN : scale;
  const resolvedTarget = useMemo<MotionValues>(() => [opacity, x, y, resolvedScale, rotation, width], [opacity, x, y, resolvedScale, rotation, width]);
  const resolvedCurve = useMemo(() => [x1, y1, x2, y2], [x1, y1, x2, y2]);
  const root = useRef<HTMLDivElement>(null), handle = useRef<ElementTimeline | null>(null), controller = useEffectsController(), focused = useIsFocused();
  const latest = useRef({ target: resolvedTarget, duration, delay, curve: resolvedCurve, active: active && focused, loop, onComplete, springScale, scale, height, scanDuration, breath });
  useLayoutEffect(() => { latest.current = { target: resolvedTarget, duration, delay, curve: resolvedCurve, active: active && focused, loop, onComplete, springScale, scale, height, scanDuration, breath }; });
  const [initialValues] = useState(initial);
  const [startingHeight] = useState(initialHeight ?? height);
  const completion = useRef(false);
  const previousFocus = useRef(focused);
  const engine = useRef<'loading' | 'ready' | 'failed'>('loading'), safety = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const settleQueued = useRef(false), shownScale = useRef(initialValues[3]);
  // Closing sheets, dialogs and menus unmount on completion. Without the engine (old GPU, failed
  // download, crash) or with a stalled frame loop, completion must still arrive: an absent engine
  // jumps straight to the end values, and every transition keeps a timeout safety net.
  const [settling] = useState(() => {
    const finish = () => {
      clearTimeout(safety.current); safety.current = undefined;
      if (completion.current) return;
      completion.current = true;
      root.current?.dispatchEvent(new Event(motionSettledEvent, { bubbles: true }));
      latest.current.onComplete?.();
    };
    /** Writes the end values the engine would paint last; no intermediate frame is computed here. */
    const withoutEngine = () => {
      const element = root.current, value = latest.current;
      if (element) {
        const [opacity, x, y, scale, rotation] = value.target;
        shownScale.current = value.springScale ? value.scale : Number.isNaN(scale) ? shownScale.current : scale;
        element.style.opacity = String(opacity);
        element.style.transform = `translate3d(${x}px,${y}px,0) ${element.hasAttribute('data-rust-scale-x') ? 'scaleX' : 'scale'}(${shownScale.current}) rotate(${rotation}deg)`;
        if (value.height !== undefined) element.style.height = `${value.height}px`;
        // The scan's starting mask hides everything; without the engine nothing would lift it.
        if (value.scanDuration !== undefined) { element.style.maskImage = 'none'; element.style.webkitMaskImage = 'none'; }
      }
      finish();
    };
    const arm = () => {
      clearTimeout(safety.current); safety.current = undefined;
      if (engine.current === 'failed') {
        // Height and target can change in one commit; settle once after both.
        if (!settleQueued.current) { settleQueued.current = true; queueMicrotask(() => { settleQueued.current = false; if (!completion.current) withoutEngine(); }); }
        return;
      }
      const value = latest.current;
      if (!value.onComplete || value.loop) return;
      const wait = value.delay + Math.max(value.duration, value.scanDuration ?? 0) + completionSafetyMs;
      safety.current = setTimeout(() => { safety.current = undefined; if (!completion.current) withoutEngine(); }, wait);
    };
    return { finish, withoutEngine, arm };
  });
  useEffect(() => () => clearTimeout(safety.current), []);
  useEffect(() => {
    if (!root.current || !controller) { engine.current = 'failed'; settling.arm(); return; }
    let disposed = false, detach = () => {}, unregister = () => {};
    void loadGraphics().then(module => {
      if (disposed || !root.current) return;
      engine.current = 'ready';
      const node = module.ElementTimeline.create(root.current); handle.current = node;
      // The safety net may have shown the end state while the engine was still downloading:
      // continue from there instead of replaying the transition.
      const value = latest.current, early = completion.current;
      node.initial(Float64Array.from(early ? [value.target[0], value.target[1], value.target[2], shownScale.current, value.target[4], value.target[5]] : initialValues));
      if (early && value.height !== undefined) node.initial_height(value.height);
      else if(startingHeight!==undefined)node.initial_height(startingHeight);
      if(value.height!==undefined)node.target_height_curve(value.height,early?0:value.duration,Float64Array.from(value.curve));
      if(value.scanDuration!==undefined)node.scan_reveal(systemReduced||early?0:value.scanDuration,early?0:value.delay);
      node.target(Float64Array.from(value.target), early ? 0 : value.duration, early ? 0 : value.delay, Float64Array.from(value.curve));
      if (value.springScale) node.spring_scale(value.scale, value.duration <= 0);
      node.active(value.active); if (value.loop) node.loop(value.loop.width, value.loop.speed);
      if (value.breath) node.breathe(value.breath.period, value.breath.low);
      const token = {}; unregister = controller.register(token, 'Переход · Rust', message => { if ((message as { type: string }).type === 'watcher-clock-reset') node.reset_clock(); });
      detach = controller.frameJob(at => {
        const value = latest.current; node.active(value.active); const drew = node.frame(at), moving = node.moving();
        controller.activity(token, value.active, moving);
        if (drew && !moving && !completion.current) settling.finish();
      });
    }).catch(problem => {
      if (disposed) return;
      console.error('Rust transition:', problem); engine.current = 'failed';
      if (root.current) root.current.dataset.graphicsError = String(problem);
      settling.withoutEngine();
    });
    return () => { disposed = true; detach(); unregister(); handle.current?.dispose(); handle.current = null; };
  }, [controller, initialValues, startingHeight, systemReduced, settling]);
  useEffect(() => { completion.current = false; handle.current?.target(Float64Array.from(resolvedTarget), duration, delay, Float64Array.from(resolvedCurve)); settling.arm(); }, [resolvedTarget, duration, delay, resolvedCurve, settling]);
  useEffect(() => {
    if (springScale) { completion.current = false; handle.current?.spring_scale(scale, duration <= 0); settling.arm(); }
  }, [springScale, scale, duration, settling]);
  useEffect(() => { handle.current?.active(active && focused); }, [active, focused]);
  useEffect(()=>{
    if(focused&&!previousFocus.current&&scanDuration!==undefined){completion.current=false;handle.current?.scan_reveal(systemReduced?0:scanDuration,delay);settling.arm();}
    previousFocus.current=focused;
  },[focused,scanDuration,delay,systemReduced,settling]);
  useEffect(()=>{if(height!==undefined){completion.current=false;handle.current?.target_height_curve(height,duration,Float64Array.from(resolvedCurve));settling.arm();}},[height,duration,resolvedCurve,settling]);
  const breathPeriod = breath?.period ?? 0, breathLow = breath?.low ?? 1;
  useEffect(() => { handle.current?.breathe(breathPeriod, breathLow); }, [breathPeriod, breathLow]);
  const loopWidth = loop?.width, loopSpeed = loop?.speed;
  useEffect(() => { if (loopWidth !== undefined && loopSpeed !== undefined) handle.current?.loop(loopWidth, loopSpeed); }, [loopWidth, loopSpeed]);
  return <div {...attributes} ref={root} data-rust-transition data-rust-scale-x={scaleX ? '' : undefined} style={{ ...style, height: startingHeight ?? style?.height,
    ...(scanDuration!==undefined&&!systemReduced?{maskImage:'linear-gradient(transparent,transparent)'}:{}),
    opacity: initialValues[0], transform: `translate3d(${initialValues[1]}px,${initialValues[2]}px,0) ${scaleX ? 'scaleX' : 'scale'}(${initialValues[3]})`, transition: 'none', animation: 'none' }}>{children}</div>;
}
