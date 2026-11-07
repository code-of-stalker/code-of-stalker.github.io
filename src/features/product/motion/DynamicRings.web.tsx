import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useThemeColors } from '../ProductTheme';
import { useEffectsController } from './EffectsQuality';
import { artworkBufferLayout, qualityDensity } from './effectQuality';
import { paletteCode } from './graphicsPalette';
import { observeMotionVisibility } from './motion-visibility.web';
import type { ArtProps } from './types';

type Renderer = {
  reduced(value: boolean): void; resize(width: number, height: number): void;
  frame(at: number): void; elapsed(): number; seek(seconds: number): void;
  frame_count(): number; gpu_error(): number; suspend(): void; dispose(): void; free(): void;
  backdrop(red: number, green: number, blue: number): void; palette(code: number): void; chapter(code: number): void;
};
type Runtime = { mount(canvas: HTMLCanvasElement): Promise<Renderer> };
let runtime: Promise<Runtime> | undefined;
const loadRuntime = () => runtime ??= (Function('url', 'return import(url)') as (url: string) => Promise<Runtime>)('/graphics/dynamic-rings/runtime.js')
  .catch(error => { runtime = undefined; throw error; });

export type DynamicRingsProps = ArtProps & {
  /** Shown instead of the scene when WebGL2 or the runtime fails. */
  fallback?: ReactNode;
};

/** The step's story chapters: the hero above the panel and pages 01 to 03. */
const chapters = { 'dynamic-hero': 0, 'dynamic-rings': 1, 'dynamic-life': 2, 'dynamic-night': 3 } as const;
const names = { 'dynamic-hero': 'Динамическая сфера · Шаг 7', 'dynamic-rings': 'Третий уровень · Шаг 7', 'dynamic-life': 'Жизнь в сфере · Шаг 7', 'dynamic-night': 'Ночь и фонарь · Шаг 7' } as const;
const labels = {
  'dynamic-hero': 'Светящийся человек идёт внутри стеклянной сферы из трёх колец. Корона света ходит по сфере, сканер бежит по телу, сфера медленно кружится. Сначала тихо, потом под сферу попадает предмет и сканируется, потом провод тянется к сфере и распадается о стекло, и дальше всё чаще.',
  'dynamic-rings': 'Взгляд изнутри фигуры: наверху стекла загорается корона света и ходит до земли и обратно. Камера выходит за плечо, из бусин собирается сканер и ходит по телу. На полном вдохе корона и сканер сходятся во вспышке, сфера начинает кружиться, фигура идёт, предметы сканируются, провода распадаются о стекло, и всё удерживается. Потом кольца гаснут по одному.',
  'dynamic-life': 'Человек из света печатает на ноутбуке за столом внутри своей сферы, закрывает крышку, стол тает, и он встаёт. Снаружи сферы навстречу идёт другой человек; они поворачиваются друг к другу и разговаривают, слова летят светлыми кругами. Они кивают и расходятся. Позади собирается сиденье, он садится, появляется стол, он открывает ноутбук и печатает дальше. Кольца всё время горят мягко.',
  'dynamic-night': 'Ночь. Человек из света стоит в стеклянной сфере, и горит только одно кольцо: корона света без остановки проходит сферу сверху вниз и обратно. Мимо идёт прохожий с фонарём и обходит сферу кругом: свет фонаря ложится пятном на землю, тени бегут по планете, от шагов расходятся круги. Когда корона проходит сквозь прохожего, на нём загорается полоса, фонарь вспыхивает, и голова человека в сфере поворачивается вслед за светом.',
} as const;

/** Lifecycle, input and measured cadence only. The shared controller schedules
 * frames; Rust owns the walking figure, the three rings around it, the things
 * and wires that meet the glass, each chapter's camera and the colors of every
 * theme (light themes engrave the same scene). */
export function DynamicRings(props: DynamicRingsProps) {
  const controller = useEffectsController(), focused = useIsFocused(), colors = useThemeColors();
  const scene = props.webScene === 'dynamic-rings' || props.webScene === 'dynamic-life' || props.webScene === 'dynamic-night' ? props.webScene : 'dynamic-hero', chapter = chapters[scene];
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
        buffer: [output.width, output.height], source: [output.width, output.height], blur: [0, 0], draws: renderer.frame_count(),
        sourceUpdates: 1, blurUpdates: 0, contourUpdates: 0, idle: !removeJob, cadence,
        backend: 'Rust · dynamic rings WebGL2', textures: 1,
        textureBytes: output.width * output.height * (8 + 4) });
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
          renderer = value; renderer.chapter(chapter);
          renderer.seek(elapsed); resize(); update(); report();
          setReady(true); output.dataset.ready = 'true'; latest.current.props.onReady?.();
        }).catch(error => {
          loading = false;
          if (!disposed) { lost = true; setFailed(true); output.dataset.graphicsError = String(error); latest.current.props.onReady?.(); console.error('Dynamic rings scene:', error); }
        });
      }
    };
    const recover = () => {
      if (disposed || lost) return;
      stop(); elapsed = renderer?.elapsed() ?? elapsed; renderer?.dispose(); renderer?.free(); renderer = undefined;
      reduced = undefined; setReady(false); update();
    };
    const unregister = controller.register(id, names[scene], message => {
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
  }, [controller, chapter, scene]);
  return <View testID={chapter === 0 ? 'step-seven-hero' : scene} style={[{ width: props.width ?? '100%', height: props.height }, props.style]}>
    {failed ? props.fallback : <div role="img" aria-label={labels[scene]}
      style={{ width: '100%', height: '100%', position: 'relative', pointerEvents: 'none' }}>
      <canvas ref={outputRef} data-graphics="rust-dynamic-rings" aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', visibility: ready ? 'visible' : 'hidden' }} />
    </div>}
  </View>;
}
