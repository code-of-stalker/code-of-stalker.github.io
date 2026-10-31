import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useThemeColors } from '../ProductTheme';
import { useEffectsController } from './EffectsQuality';
import { artworkBufferLayout, qualityDensity } from './effectQuality';
import { isLightPalette, paletteCode } from './graphicsPalette';
import { RustGlass } from './RustGlass.web';
import { RustVector } from './RustVector.web';
import { useCardPress } from './useCardPress';
import { observeMotionVisibility } from './motion-visibility.web';
import type { ArtController, ArtProps } from './types';

type Renderer = {
  reduced(value: boolean): void; resize(width: number, height: number): void;
  frame(at: number): void; elapsed(): number; seek(seconds: number): void;
  frame_count(): number; gpu_error(): number; suspend(): void; dispose(): void; free(): void;
  backdrop(red: number, green: number, blue: number): void; palette(code: number): void;
  cover(enabled: boolean): void; soft_edges(enabled: boolean): void;
};
type Runtime = { mount(canvas: HTMLCanvasElement, options: { light: boolean }): Promise<Renderer> };
let runtime: Promise<Runtime> | undefined;
const loadRuntime = () => runtime ??= (Function('url', 'return import(url)') as (url: string) => Promise<Runtime>)('/graphics/sphere-hero/runtime.js')
  .catch(error => { runtime = undefined; throw error; });

export type SphereHeroProps = ArtProps & {
  /** Shown instead of the scene when WebGL2 or the runtime fails; the card keeps the engine art. */
  fallback?: ReactNode;
};

/** Lifecycle, input and measured cadence only. The shared controller schedules
 * frames; Rust owns the drifting camera, the wave from the feet, the branch and
 * the bird, the crop of a home card and the colors of every theme (light themes
 * draw the light paintings). */
export function SphereHero(props: SphereHeroProps) {
  const controller = useEffectsController(), focused = useIsFocused(), colors = useThemeColors();
  // On a home card the scene covers the card's shape; on a page it melts into it.
  const card = props.presentation === 'card';
  const glass = useRef<ArtController | null>(null), origin = useRef<{ x: number; y: number } | null>(null);
  const press = useCardPress(props.onPress, card, !!props.reducedMotion, focused && props.active !== false);
  const outputRef = useRef<HTMLCanvasElement>(null), sync = useRef<() => void>(() => {});
  const latest = useRef({ props, focused, background: colors.background, palette: paletteCode(colors) });
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  useLayoutEffect(() => { latest.current = { props, focused, background: colors.background, palette: paletteCode(colors) }; sync.current(); });
  useEffect(() => {
    const output = outputRef.current;
    if (!output || !controller) return;
    const id = {};
    let renderer: Renderer | undefined, disposed = false, visible = false, lost = false, loading = false;
    let removeJob: (() => void) | undefined, reduced: boolean | undefined, elapsed = 0, light = false;
    let previousPaint = 0, lastReport = 0;
    let intervals: number[] = [];
    const playing = () => !disposed && !lost && visible && !document.hidden && latest.current.focused && latest.current.props.active !== false;
    const report = () => {
      if (!renderer) return;
      const rect = output.getBoundingClientRect();
      const snapshot = controller.getSnapshot();
      const sorted = [...intervals].sort((a, b) => a - b);
      const cadence = sorted.length ? {
        fps: 1000 / (intervals.reduce((sum, value) => sum + value, 0) / intervals.length),
        p95: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * .95) - 1)], samples: sorted.length,
      } : undefined;
      controller.report(id, { level: snapshot.level, surface: 'artwork', density: output.width / Math.max(1, rect.width),
        buffer: [output.width, output.height], source: [1536, 1024], blur: [0, 0], draws: renderer.frame_count(),
        sourceUpdates: 4, blurUpdates: 0, contourUpdates: 0, idle: !removeJob, cadence,
        backend: 'Rust · sphere hero WebGL2', textures: 4,
        textureBytes: 1536 * 1024 * 4 * 4 * 4 / 3 + output.width * output.height * 4 });
      output.dataset.elapsed = renderer.elapsed().toFixed(3);
      output.dataset.frames = String(renderer.frame_count());
      output.dataset.density = (output.width / Math.max(1, rect.width)).toFixed(3);
      output.dataset.buffer = `${output.width}×${output.height}`;
      output.dataset.gpuError = String(renderer.gpu_error());
      if (cadence) output.dataset.fps = cadence.fps.toFixed(1);
    };
    const resize = () => {
      if (!renderer || lost) return;
      const rect = output.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const buffer = artworkBufferLayout(rect.width, rect.height, qualityDensity[controller.policy.level]);
      if (output.width !== buffer.width || output.height !== buffer.height) renderer.resize(buffer.width, buffer.height);
      report();
    };
    const stop = () => {
      removeJob?.(); removeJob = undefined;
      renderer?.suspend(); previousPaint = 0; intervals = [];
      output.dataset.running = 'false';
    };
    const tick = (at: number) => {
      if (!renderer || !playing() || latest.current.props.reducedMotion) { stop(); return; }
      renderer.frame(at);
      if (previousPaint) { intervals.push(at - previousPaint); if (intervals.length > 240) intervals.shift(); }
      previousPaint = at;
      if (at - lastReport >= 1000) { lastReport = at; report(); }
    };
    const update = () => {
      if (disposed) return;
      const active = playing(), running = active && !latest.current.props.reducedMotion && !!renderer;
      controller.activity(id, active && !!renderer, running);
      // Light and dark themes draw different paintings: swap the renderer.
      if (renderer && light !== isLightPalette(latest.current.palette)) { recover(); return; }
      if (renderer) {
        const background = latest.current.background;
        renderer.palette(latest.current.palette);
        renderer.backdrop(...[1, 3, 5].map(start => parseInt(background.slice(start, start + 2), 16) / 255) as [number, number, number]);
        const nextReduced = !!latest.current.props.reducedMotion;
        if (nextReduced !== reduced) { renderer.reduced(nextReduced); reduced = nextReduced; }
        if (running && !removeJob) { renderer.suspend(); removeJob = controller.frameJob(tick); output.dataset.running = 'true'; report(); }
        else if (!running && removeJob) { stop(); report(); }
      } else if (active && !loading) {
        loading = true;
        const wanted = isLightPalette(latest.current.palette);
        void loadRuntime().then(module => disposed ? undefined : module.mount(output, { light: wanted })).then(value => {
          loading = false;
          if (!value) return;
          if (disposed || wanted !== isLightPalette(latest.current.palette)) { value.dispose(); value.free(); update(); return; }
          light = wanted;
          renderer = value; renderer.cover(card); renderer.soft_edges(!card);
          renderer.seek(elapsed); resize(); update(); report();
          setReady(true); output.dataset.ready = 'true'; latest.current.props.onReady?.();
        }).catch(error => {
          loading = false;
          if (!disposed) { lost = true; setFailed(true); output.dataset.graphicsError = String(error); latest.current.props.onReady?.(); console.error('Sphere hero scene:', error); }
        });
      }
    };
    const recover = () => {
      if (disposed || lost) return;
      stop(); elapsed = renderer?.elapsed() ?? elapsed; renderer?.dispose(); renderer?.free(); renderer = undefined;
      reduced = undefined; setReady(false); update();
    };
    const unregister = controller.register(id, card ? 'Главная · Скан в глубине' : 'Скан в глубине · Шаг 5', message => {
      const type = (message as { type?: string }).type;
      if (type === 'watcher-quality') resize();
      if (type === 'watcher-quality-report') report();
      if (type === 'watcher-clock-reset') { renderer?.suspend(); previousPaint = 0; intervals = []; }
      if (type === 'watcher-graphics-recover') recover();
    });
    sync.current = update;
    const size = new ResizeObserver(resize); size.observe(output);
    const unobserve = observeMotionVisibility(output, value => { visible = value; update(); });
    const contextLost = (event: Event) => {
      event.preventDefault(); lost = true; elapsed = renderer?.elapsed() ?? elapsed; stop();
      controller.activity(id, false, false); setReady(false); output.dataset.ready = 'false';
    };
    const contextRestored = () => { lost = false; recover(); };
    output.addEventListener('webglcontextlost', contextLost); output.addEventListener('webglcontextrestored', contextRestored);
    document.addEventListener('visibilitychange', update);
    return () => {
      disposed = true; stop(); unregister(); size.disconnect(); unobserve(); sync.current = () => {};
      document.removeEventListener('visibilitychange', update);
      output.removeEventListener('webglcontextlost', contextLost); output.removeEventListener('webglcontextrestored', contextRestored);
      renderer?.dispose(); renderer?.free();
    };
  }, [controller, card]);
  const contact = (target: HTMLElement, x: number, y: number, pressed: boolean) => {
    const rect = target.getBoundingClientRect();
    glass.current?.interact({ type: 'watcher-art-interaction', action: pressed ? 'glass-move' : 'glass-release', x: (x - rect.x) / rect.width, y: (y - rect.y) / rect.height });
  };
  const release = (event: PointerEvent<HTMLButtonElement>) => { origin.current = null; contact(event.currentTarget, event.clientX, event.clientY, false); };
  const fallback = props.fallback ?? <RustVector {...props} webScene={undefined} />;
  if (card) return <View style={[{ width: props.width ?? '100%', height: props.height }, props.style]}>
    {failed ? fallback : <>
      {/* The card's glass drives its reveal and answers a touch; the scene
          is opaque, so it lies beneath and the scene is the card's face. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}><RustGlass {...props} kind="glass" controllerRef={glass} onPress={undefined} onReady={undefined} /></View>
      <canvas ref={outputRef} data-graphics="rust-sphere-hero" aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', visibility: ready ? 'visible' : 'hidden', pointerEvents: 'none' }} />
      {props.onPress ? <button type="button" aria-label={props.accessibilityLabel} disabled={props.active === false || !focused}
        style={{ position: 'absolute', inset: 0, background: 'transparent', border: 0, cursor: 'pointer', touchAction: 'pan-y' }}
        onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; origin.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); contact(event.currentTarget, event.clientX, event.clientY, true); }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) contact(event.currentTarget, event.clientX, event.clientY, true); }}
        onPointerUp={event => {
          const start = origin.current, rect = event.currentTarget.getBoundingClientRect();
          const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
          if (start && inside && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 12) press();
          release(event);
        }}
        onPointerCancel={release} onLostPointerCapture={release}
        onClick={event => { if (event.detail === 0) press(); }} /> : null}
    </>}
  </View>;
  return <View testID="step-five-hero" style={[{ width: props.width ?? '100%', height: props.height }, props.style]}>
    {failed ? fallback : <div role="img" aria-label="Светящийся человек стоит спиной к нам внутри сферы из точек и орбит, вокруг ветка дерева, птица, лес, река и горы. Камера чуть покачивается. Раз в десять секунд от его стоп выходит волна света: кольцом по полу, вверх по лесу и реке, по ветке; птица отвечает пением, и свет обходит сферу до макушки"
      style={{ width: '100%', height: '100%', position: 'relative', pointerEvents: 'none' }}>
      <canvas ref={outputRef} data-graphics="rust-sphere-hero" aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', visibility: ready ? 'visible' : 'hidden' }} />
    </div>}
  </View>;
}
