import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useThemeColors } from '../ProductTheme';
import { useEffectsController } from './EffectsQuality';
import { artworkBufferLayout, qualityDensity } from './effectQuality';
import { paletteCode } from './graphicsPalette';
import { RustVector } from './RustVector.web';
import { observeMotionVisibility } from './motion-visibility.web';
import type { ArtProps } from './types';

type Renderer = {
  reduced(value: boolean): void; resize(width: number, height: number): void;
  frame(at: number): void; elapsed(): number; seek(seconds: number): void;
  frame_count(): number; gpu_error(): number; suspend(): void; dispose(): void; free(): void;
  backdrop(red: number, green: number, blue: number): void; palette(code: number): void;
};
type Runtime = { mount(canvas: HTMLCanvasElement): Promise<Renderer> };
let runtime: Promise<Runtime> | undefined;
const loadRuntime = () => runtime ??= (Function('url', 'return import(url)') as (url: string) => Promise<Runtime>)('/graphics/tuning-questions/runtime.js')
  .catch(error => { runtime = undefined; throw error; });

/** Lifecycle, input and measured cadence only. The shared controller schedules
 * frames; Rust owns the camera and its focus, the spoken line, the questions'
 * card, the scan and the colors of every theme (one set of inputs serves light
 * and dark pages alike). */
export function TuningQuestions(props: ArtProps) {
  const controller = useEffectsController(), focused = useIsFocused(), colors = useThemeColors();
  const outputRef = useRef<HTMLCanvasElement>(null), sync = useRef<() => void>(() => {});
  const latest = useRef({ props, focused, background: colors.background, palette: paletteCode(colors) });
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  useLayoutEffect(() => { latest.current = { props, focused, background: colors.background, palette: paletteCode(colors) }; sync.current(); });
  useEffect(() => {
    const output = outputRef.current;
    if (!output || !controller) return;
    const id = {};
    let renderer: Renderer | undefined, disposed = false, visible = false, lost = false, loading = false;
    let removeJob: (() => void) | undefined, reduced: boolean | undefined, elapsed = 0;
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
        buffer: [output.width, output.height], source: [1536, 1024], blur: [output.width / 4, output.height / 4], draws: renderer.frame_count(),
        sourceUpdates: 1, blurUpdates: 4, contourUpdates: 0, idle: !removeJob, cadence,
        backend: 'Rust · tuning questions WebGL2', textures: 6,
        textureBytes: (1340 * 2120 + 1536 * 1920) * 4 * 4 / 3 + output.width * output.height * 4 * (2 + 1 / 8 + 1 / 64) });
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
        void loadRuntime().then(module => disposed ? undefined : module.mount(output)).then(value => {
          loading = false;
          if (!value) return;
          if (disposed) { value.dispose(); value.free(); return; }
          renderer = value; renderer.seek(elapsed); resize(); update(); report();
          setReady(true); output.dataset.ready = 'true'; latest.current.props.onReady?.();
        }).catch(error => {
          loading = false;
          if (!disposed) { lost = true; setFailed(true); output.dataset.graphicsError = String(error); latest.current.props.onReady?.(); console.error('Tuning questions scene:', error); }
        });
      }
    };
    const recover = () => {
      if (disposed || lost) return;
      stop(); elapsed = renderer?.elapsed() ?? elapsed; renderer?.dispose(); renderer?.free(); renderer = undefined;
      reduced = undefined; setReady(false); update();
    };
    const unregister = controller.register(id, 'Вопросы настройки · 06/15', message => {
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
  }, [controller]);
  return <View style={[{ width: props.width ?? '100%', height: props.height }, props.style]}>
    <div role="img" aria-label="Человек вслух говорит вывод, и он повисает над головой звуковой волной с точкой. Затем вопросы: откуда пришёл этот вывод? — свет идёт по волне назад к губам, потом прицелы по очереди смотрят на разные точки тела; что явилось стартовой точкой — ощущение, образ, мысль? — по телу проходит волна, рядом с головой появляется картинка, потом короткая фраза, ни одно не выбрано; есть ли факт, или это интерпретация? — фокус переходит с волны на человека и обратно; что я чувствую телом, пока думаю это? — спокойный скан проходит по всему телу. Ответ человек находит сам"
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ width: '100%', maxWidth: props.height * 1.5, aspectRatio: '3 / 2', position: 'relative' }}>
        {/* Without WebGL2 the page keeps the product engine's vector study. */}
        {failed ? <RustVector {...props} webScene={undefined} /> : null}
        <canvas ref={outputRef} data-graphics="rust-tuning-questions" aria-hidden
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', visibility: ready && !failed ? 'visible' : 'hidden' }} />
      </div>
    </div>
  </View>;
}
