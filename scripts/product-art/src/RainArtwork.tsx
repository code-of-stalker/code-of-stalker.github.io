import { useEffect, useRef } from 'react';
import { MatrixRainRenderer } from './laboratory/backgrounds/MatrixRainRenderer';
import { defaultMatrixRainSettings } from './laboratory/backgrounds/matrixRainSettings';

/** One atlas-backed Laboratory rain canvas; no glass context or per-glyph DOM. */
export function RainArtwork({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null), latest = useRef({ active, reducedMotion }), refresh = useRef(() => {});
  useEffect(() => { latest.current = { active, reducedMotion }; refresh.current(); }, [active, reducedMotion]);
  useEffect(() => {
    const output = canvas.current, context = output?.getContext('2d');
    if (!output || !context) return;
    const rain = new MatrixRainRenderer(defaultMatrixRainSettings);
    let frame = 0, last = -Infinity, disposed = false;
    function paint(time: number) {
      const bounds = output!.getBoundingClientRect(), w = Math.max(1, bounds.width), h = Math.max(1, bounds.height);
      const ratio = Math.min(1.5, window.devicePixelRatio || 1);
      const width = Math.ceil(w * ratio), height = Math.ceil(h * ratio);
      if (output!.width !== width || output!.height !== height) { output!.width = width; output!.height = height; }
      if (rain.draw(time / 1000, w, h, ratio, latest.current.reducedMotion)) {
        context!.clearRect(0, 0, width, height); context!.drawImage(rain.canvas, 0, 0, width, height);
        output!.dataset.rainStatus = 'ready';
      }
    }
    function tick(time: number) {
      frame = 0;
      if (disposed || !latest.current.active || latest.current.reducedMotion || document.hidden) return;
      if (time - last >= 1000 / 24) { paint(time); last = time; }
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame); frame = 0; last = -Infinity;
      paint(performance.now());
      if (latest.current.active && !latest.current.reducedMotion && !document.hidden) frame = requestAnimationFrame(tick);
    }
    refresh.current = sync;
    const resize = new ResizeObserver(sync); resize.observe(output);
    document.addEventListener('visibilitychange', sync); sync();
    return () => { disposed = true; refresh.current = () => {}; cancelAnimationFrame(frame); resize.disconnect(); document.removeEventListener('visibilitychange', sync); rain.dispose(); };
  }, []);
  return <canvas ref={canvas} aria-hidden="true" style={{ display: 'block', width: '100%', height: '100%' }} />;
}
