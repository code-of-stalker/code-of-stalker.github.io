import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useThemeColors } from '../ProductTheme';
import { useEffectQualityLevel } from './EffectsQuality';
import { observeMotionVisibility } from './motion-visibility.web';
import type { ArtProps } from './types';

type Renderer = {
  accent(r: number, g: number, b: number): void; reduced(value: boolean): void;
  resize(width: number, height: number): void; frame(at: number): void;
  suspend(): void; dispose(): void; free(): void;
};
type Runtime = { mount(canvas: HTMLCanvasElement): Promise<Renderer> };
let runtime: Promise<Runtime> | undefined;
function loadRuntime() {
  return runtime ??= (Function('url', 'return import(url)') as (url: string) => Promise<Runtime>)('/graphics/cloud-drift/runtime.js')
    .catch(error => { runtime = undefined; throw error; });
}

/** Platform lifecycle only. Rust owns the scene, rain, wind, scan and all pixels. */
export function CloudDrift(props: ArtProps) {
  const colors = useThemeColors(), focused = useIsFocused(), quality = useEffectQualityLevel();
  const canvas = useRef<HTMLCanvasElement>(null), sync = useRef<() => void>(() => {});
  const latest = useRef({ props, colors, focused, quality });
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => { latest.current = { props, colors, focused, quality }; sync.current(); }, [props, colors, focused, quality]);
  useEffect(() => {
    const output = canvas.current;
    if (!output) return;
    let disposed = false, visible = false, loading = false, lost = false, raf = 0, lastPaint = 0;
    let renderer: Renderer | undefined;
    const stop = () => { cancelAnimationFrame(raf); raf = 0; lastPaint = 0; renderer?.suspend(); output.dataset.running = 'false'; };
    const running = () => !disposed && !lost && visible && !document.hidden && latest.current.focused && latest.current.props.active !== false && !latest.current.props.reducedMotion;
    const tick = (time: number) => {
      raf = 0;
      if (!running() || !renderer) { stop(); return; }
      const interval = latest.current.quality === 'economy' ? 1000 / 30 : 1000 / 60;
      if (!lastPaint || time - lastPaint >= interval - 1) { renderer.frame(time); lastPaint = time; }
      output.dataset.running = 'true';
      raf = requestAnimationFrame(tick);
    };
    const resize = () => {
      if (!renderer) return;
      const rect = output.getBoundingClientRect();
      const density = Math.min(devicePixelRatio || 1, latest.current.quality === 'economy' ? 1 : 1.5);
      renderer.resize(Math.round(rect.width * density), Math.round(rect.height * density));
    };
    const update = () => {
      stop();
      if (renderer) {
        const accent = latest.current.colors.accent;
        renderer.accent(...([1, 3, 5].map(start => Number.parseInt(accent.slice(start, start + 2), 16) / 255) as [number, number, number]));
        renderer.reduced(!!latest.current.props.reducedMotion);
        output.dataset.accent = accent;
        resize();
        if (running()) raf = requestAnimationFrame(tick);
      } else if (visible && !loading && !lost && !disposed) {
        loading = true;
        void loadRuntime().then(module => disposed ? undefined : module.mount(output)).then(value => {
          if (!value) return;
          if (disposed) { value.dispose(); value.free(); return; }
          renderer = value; update(); setReady(true); latest.current.props.onReady?.();
        }).catch(error => {
          if (!disposed) { output.dataset.graphicsError = String(error); latest.current.props.onReady?.(); console.error('Cloud scene:', error); }
        });
      }
    };
    sync.current = update;
    const observer = new ResizeObserver(resize); observer.observe(output);
    const unobserve = observeMotionVisibility(output, value => { visible = value; update(); });
    const contextLost = (event: Event) => { event.preventDefault(); lost = true; stop(); setReady(false); };
    output.addEventListener('webglcontextlost', contextLost);
    document.addEventListener('visibilitychange', update);
    return () => {
      disposed = true; stop(); observer.disconnect(); unobserve(); sync.current = () => {};
      document.removeEventListener('visibilitychange', update); output.removeEventListener('webglcontextlost', contextLost);
      renderer?.dispose(); renderer?.free();
    };
  }, []);
  return <View style={[{ width: props.width ?? '100%', height: props.height }, props.style]}>
    <div role="img" aria-label="Мужчина в костюме парит в облаках, стремясь к любви, просветлению, успеху и признанию"
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ width: '100%', maxWidth: props.height * 1.5, aspectRatio: '3 / 2', position: 'relative' }}>
        <img src="/graphics/cloud-drift/assets/original.png" alt="" aria-hidden loading="lazy" decoding="async"
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, display: ready ? 'none' : 'block' }} />
        <canvas ref={canvas} data-graphics="rust-cloud-drift" aria-hidden
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, visibility: ready ? 'visible' : 'hidden' }} />
      </div>
    </div>
  </View>;
}
