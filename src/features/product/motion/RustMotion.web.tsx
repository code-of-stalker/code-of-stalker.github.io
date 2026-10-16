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

/** Target events only. The shared Rust clock writes the presentation style and
 * reports completion; React never calculates a transition's intermediate frame. */
export function RustMotion({ children, initial = shown, target = shown, duration = 460, delay = 0, curve = gentle, active = true, loop, onComplete, scaleX = false, freezeScale = false, springScale = false, height, initialHeight, scanDuration, style, ...attributes }: PropsWithChildren<{
  initial?: MotionValues; target?: MotionValues; duration?: number; delay?: number; curve?: readonly number[]; active?: boolean;
  loop?: { width: number; speed: number }; onComplete?(): void; style?: CSSProperties;
  'data-testid'?: string; 'aria-hidden'?: boolean;
  scaleX?: boolean;
  freezeScale?: boolean;
  springScale?: boolean;
  height?: number; initialHeight?: number; scanDuration?: number;
}>) {
  const systemReduced = useSystemReducedMotion();
  if (systemReduced) { duration = 0; delay = 0; if (loop) active = false; }
  // Microphone samples and scroll updates rerender their parents. Equal values
  // must not resend a transition or re-arm its completion on every update.
  const [opacity, x, y, scale, rotation, width] = target;
  const [x1, y1, x2, y2] = curve;
  const resolvedScale = freezeScale || springScale ? NaN : scale;
  const resolvedTarget = useMemo<MotionValues>(() => [opacity, x, y, resolvedScale, rotation, width], [opacity, x, y, resolvedScale, rotation, width]);
  const resolvedCurve = useMemo(() => [x1, y1, x2, y2], [x1, y1, x2, y2]);
  const root = useRef<HTMLDivElement>(null), handle = useRef<ElementTimeline | null>(null), controller = useEffectsController(), focused = useIsFocused();
  const latest = useRef({ target: resolvedTarget, duration, delay, curve: resolvedCurve, active: active && focused, loop, onComplete, springScale, scale, height, scanDuration });
  useLayoutEffect(() => { latest.current = { target: resolvedTarget, duration, delay, curve: resolvedCurve, active: active && focused, loop, onComplete, springScale, scale, height, scanDuration }; });
  const [initialValues] = useState(initial);
  const [startingHeight] = useState(initialHeight ?? height);
  const completion = useRef(false);
  const previousFocus = useRef(focused);
  useEffect(() => {
    if (!root.current || !controller) return;
    let disposed = false, detach = () => {}, unregister = () => {};
    void loadGraphics().then(module => {
      if (disposed || !root.current) return;
      const node = module.ElementTimeline.create(root.current); handle.current = node;
      node.initial(Float64Array.from(initialValues)); const value = latest.current;
      if(startingHeight!==undefined)node.initial_height(startingHeight);
      if(value.height!==undefined)node.target_height_curve(value.height,value.duration,Float64Array.from(value.curve));
      if(value.scanDuration!==undefined)node.scan_reveal(systemReduced?0:value.scanDuration,value.delay);
      node.target(Float64Array.from(value.target), value.duration, value.delay, Float64Array.from(value.curve));
      if (value.springScale) node.spring_scale(value.scale, value.duration <= 0);
      node.active(value.active); if (value.loop) node.loop(value.loop.width, value.loop.speed);
      const token = {}; unregister = controller.register(token, 'Переход · Rust', message => { if ((message as { type: string }).type === 'watcher-clock-reset') node.reset_clock(); });
      detach = controller.frameJob(at => {
        const value = latest.current; node.active(value.active); const drew = node.frame(at), moving = node.moving();
        controller.activity(token, value.active, moving);
        if (drew && !moving && !completion.current) {
          completion.current = true;
          root.current?.dispatchEvent(new Event(motionSettledEvent, { bubbles: true }));
          value.onComplete?.();
        }
      });
    }).catch(problem => { console.error('Rust transition:', problem); if (root.current) { root.current.dataset.graphicsError = String(problem); root.current.style.opacity = String(latest.current.target[0]); latest.current.onComplete?.(); } });
    return () => { disposed = true; detach(); unregister(); handle.current?.dispose(); handle.current = null; };
  }, [controller, initialValues, startingHeight, systemReduced]);
  useEffect(() => { completion.current = false; handle.current?.target(Float64Array.from(resolvedTarget), duration, delay, Float64Array.from(resolvedCurve)); }, [resolvedTarget, duration, delay, resolvedCurve]);
  useEffect(() => {
    if (springScale) { completion.current = false; handle.current?.spring_scale(scale, duration <= 0); }
  }, [springScale, scale, duration]);
  useEffect(() => { handle.current?.active(active && focused); }, [active, focused]);
  useEffect(()=>{
    if(focused&&!previousFocus.current&&scanDuration!==undefined){completion.current=false;handle.current?.scan_reveal(systemReduced?0:scanDuration,delay);}
    previousFocus.current=focused;
  },[focused,scanDuration,delay,systemReduced]);
  useEffect(()=>{if(height!==undefined){completion.current=false;handle.current?.target_height_curve(height,duration,Float64Array.from(resolvedCurve));}},[height,duration,resolvedCurve]);
  const loopWidth = loop?.width, loopSpeed = loop?.speed;
  useEffect(() => { if (loopWidth !== undefined && loopSpeed !== undefined) handle.current?.loop(loopWidth, loopSpeed); }, [loopWidth, loopSpeed]);
  return <div {...attributes} ref={root} data-rust-transition data-rust-scale-x={scaleX ? '' : undefined} style={{ ...style, height: startingHeight ?? style?.height,
    ...(scanDuration!==undefined&&!systemReduced?{maskImage:'linear-gradient(transparent,transparent)'}:{}),
    opacity: initialValues[0], transform: `translate3d(${initialValues[1]}px,${initialValues[2]}px,0) ${scaleX ? 'scaleX' : 'scale'}(${initialValues[3]})`, transition: 'none', animation: 'none' }}>{children}</div>;
}
