import { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { PropsWithChildren, Ref } from 'react';
import { WebGLVideoEdgeGlassRenderer } from './laboratory/liquid-glass/WebGLVideoEdgeGlassRenderer';
import { normalizeLiquidGlassSettings } from './laboratory/liquid-glass/settings';
import { glassBufferLayout } from './glassBudget';
import { glassQuality } from './qualityRuntime';
import preset from '../../../assets/product/motion/laboratory-glass.json';
import orb from '../../../assets/product/overview-orb.svg?raw';
import type { GlassShape } from '../../../src/features/product/motion/glassShape';
import { fitCardArtwork } from './cardViewport';

export type GlassController = { pointer: (x: number, y: number, pressed: boolean, pulse?: boolean) => void; release: () => void };

/** Glass samples its backdrop; the live vector artwork stays sharp above it. */
export function GlassLayer({ children, shape, active, reducedMotion, controller, scanOnMount = true }: PropsWithChildren<{
  shape?: GlassShape; active: boolean; reducedMotion: boolean; controller?: Ref<GlassController>; scanOnMount?: boolean;
}>) {
  const material = useMemo(() => normalizeLiquidGlassSettings({ ...preset, scanEnabled: scanOnMount }), [scanOnMount]);
  const host = useRef<HTMLDivElement>(null), source = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<WebGLVideoEdgeGlassRenderer | null>(null);
  const latest = useRef({ shape, active, reducedMotion });
  const refresh = useRef<() => void>(() => {});
  const artwork = !!children;
  useImperativeHandle(controller, () => ({
    pointer(x, y, pressed, pulse = false) {
      if (!latest.current.active || latest.current.reducedMotion) return;
      renderer.current?.updatePointer(x, y, pressed);
      if (pulse) renderer.current?.triggerPulse(x, y);
    },
    release() { renderer.current?.releasePointer(); },
  }), []);
  useEffect(() => {
    latest.current = { shape, active, reducedMotion };
    renderer.current?.setReducedMotion(reducedMotion);
    refresh.current();
  }, [shape, active, reducedMotion]);

  useEffect(() => {
    const element = host.current, output = canvas.current, scene = source.current;
    if (!element || !output || !scene) return;
    const texture = document.createElement('canvas'), context = texture.getContext('2d');
    if (!context) return;
    const sphere = new Image();
    sphere.src = `data:image/svg+xml,${encodeURIComponent(orb)}`;
    let engine: WebGLVideoEdgeGlassRenderer | null = null, disposed = false;
    let sourceSignature = '', contourSignature = '', width = 0, height = 0, density = 1, lastProgress = -1;
    function publish(value: number) {
      if (value === lastProgress) return;
      lastProgress = value;
      element!.dataset.glassReveal = String(value);
      const message = { type: 'watcher-glass-reveal', progress: value };
      window.parent.postMessage(message, '*');
      window.ReactNativeWebView?.postMessage(JSON.stringify(message));
    }

    function backdrop() {
      context!.setTransform(density, 0, 0, density, 0, 0);
      context!.clearRect(0, 0, width, height);
      if (latest.current.shape?.background === 'orbs' && sphere.complete && sphere.naturalWidth) {
        for (const [x, y, size] of [[width-66,22,28],[width-35,height+2,28],[52,height*.38,15],[42,height-68,15]]) context!.drawImage(sphere, x, y, size, size);
      }
      engine?.invalidateSource();
    }
    function resize() {
      if (disposed) return;
      if (!latest.current.active || document.hidden) { engine?.setActive(false); return; }
      const bounds = element!.getBoundingClientRect();
      const css = getComputedStyle(element!);
      // A pull-back transform changes the visible rectangle, not its contour units.
      width = Math.max(1, parseFloat(css.width) || bounds.width); height = Math.max(1, parseFloat(css.height) || bounds.height);
      // The parent supplies the contour/backdrop after the embedded document loads.
      // Do not select permanent render options from an empty initial placeholder.
      const next = latest.current.shape;
      if (!next) return;
      const layout = glassBufferLayout(width, height, Math.min(material.pixelRatio, glassQuality.density()));
      const nextSource = `${width}|${height}|${layout.density}|${next.background}`;
      const nextContour = `${width}|${height}|${next.path}`;
      const sourceChanged = nextSource !== sourceSignature;
      const contourChanged = nextContour !== contourSignature;
      if (sourceChanged || contourChanged) {
        density = layout.density;
        if (sourceChanged) {
          sourceSignature = nextSource;
          texture.width = layout.width; texture.height = layout.height;
          backdrop();
        }
        scene!.querySelectorAll<SVGSVGElement>('svg.architecture-artwork,svg.diary-artwork').forEach(fitCardArtwork);
        try {
          if (!engine) {
            engine = new WebGLVideoEdgeGlassRenderer({ canvas: output!, source: texture, settings: material,
              pixelBudget: 384_000, densityCap: glassQuality.density(), idleWhenSettled: next.background !== 'orbs', sourceIsEmpty: next.background !== 'orbs', externalReveal: true, transparentCanvas: true,
              sourceNaturalSize: { width, height }, glassPanel: { x: .5, y: .5, width: 1, height: 1 },
              onRevealProgress: value => { if (engine) publish(value); },
              onPulseReveal: value => { element!.dataset.glassPulse = String(value.progress); },
              onActivity: running => glassQuality.glass(running),
            });
            renderer.current = engine; engine.start();
            element!.dataset.glassStatus = 'ready';
          }
          engine.updateSourceNaturalSize({ width, height });
          if (contourChanged) { engine.updateContour({ ...next, width, height }, true); contourSignature = nextContour; }
          engine.setDensityCap(glassQuality.density());
          engine.setReducedMotion(latest.current.reducedMotion);
          engine.refreshFrame();
          output!.style.clipPath = `path('${next.path}')`;
          output!.style.opacity = '1';
        } catch {
          element!.dataset.glassStatus = 'fallback'; output!.style.opacity = '0';
          publish(1);
        }
      }
      engine?.setActive(latest.current.active && !latest.current.reducedMotion && !document.hidden);
      if (latest.current.reducedMotion) engine?.refreshFrame();
    }
    refresh.current = resize;
    const observer = new ResizeObserver(resize); observer.observe(element);
    const unsubscribeQuality = glassQuality.subscribe(resize);
    const unregisterMetrics = glassQuality.register(() => engine?.diagnostics() ?? {});
    sphere.onload = () => {
      if (disposed) return;
      backdrop();
      if (latest.current.active && !document.hidden) engine?.refreshFrame();
    };
    document.addEventListener('visibilitychange', resize);
    resize();
    return () => {
      disposed = true; refresh.current = () => {}; observer.disconnect();
      unsubscribeQuality(); unregisterMetrics();
      document.removeEventListener('visibilitychange', resize); sphere.onload = null;
      engine?.dispose(); renderer.current = null;
    };
  }, [artwork, material]);
  return <div ref={host} className="product-glass" data-glass-status="starting">
    <canvas ref={canvas} className="product-glass-canvas" aria-hidden="true" />
    <div ref={source} className="product-glass-source">{children}</div>
  </div>;
}
