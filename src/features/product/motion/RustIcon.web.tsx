import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { loadGraphics } from './rustEngine.web';
import type { IconMotion } from './rustEngine.web';
import { useSystemReducedMotion } from './useSystemReducedMotion.web';
import { useOptionalProduct } from '../state/ProductProvider';
import { iconStroke } from '../icon-source';
import type { RustIconProps } from './RustIcon';

const pressable = '[role="button"],button,a,[role="link"],[role="switch"],[role="radio"],[role="checkbox"]';

/** Bridge only: Rust builds the glyph and owns every frame of its tap scene
 * (Art 2026-11-11, direction «Характер»). JS forwards the tap of the nearest
 * pressable ancestor, glyph changes and animation frames. */
export function RustIcon({ name, width, height, color, filled = false, round = true, stroke = iconStroke, fallback }: RustIconProps) {
  const host = useRef<HTMLDivElement>(null), icon = useRef<IconMotion | null>(null), raf = useRef(0);
  const [ready, setReady] = useState(false);
  const product = useOptionalProduct(), systemReduced = useSystemReducedMotion();
  const reduced = systemReduced || !!product?.settings.reducedMotion;
  const latest = useRef({ name, filled, reduced });
  useLayoutEffect(() => { latest.current = { name, filled, reduced }; });
  const run = useCallback(() => {
    // Reschedule instead of trusting a pending frame: a hidden tab can hold one forever.
    cancelAnimationFrame(raf.current);
    const step = (at: number) => { raf.current = 0; if (icon.current?.frame(at)) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step);
  }, []);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    const trigger = element.parentElement?.closest(pressable);
    const onClick = () => {
      if (trigger?.getAttribute('aria-disabled') === 'true' || !icon.current) return;
      icon.current.play(); run();
    };
    trigger?.addEventListener('click', onClick);
    void loadGraphics().then(module => {
      if (disposed) return;
      const value = latest.current, node = module.IconMotion.create(element, value.name, value.filled, round, stroke, width);
      node.reduced(value.reduced); icon.current = node; setReady(true);
    }).catch(problem => { element.dataset.graphicsError = String(problem); });
    return () => {
      disposed = true; trigger?.removeEventListener('click', onClick);
      cancelAnimationFrame(raf.current); raf.current = 0;
      icon.current?.dispose(); icon.current = null;
    };
  }, [round, stroke, width, run]);
  useEffect(() => { if (icon.current) { icon.current.set_name(name); run(); } }, [name, run]);
  useEffect(() => { if (icon.current) { icon.current.set_filled(filled); run(); } }, [filled, run]);
  useEffect(() => { icon.current?.reduced(reduced); }, [reduced]);
  return <View pointerEvents="none" style={{ width, height, flexShrink: 0 }}>
    <div ref={host} data-rust-icon={name} style={{ position: 'absolute', inset: 0, color, display: ready ? 'block' : 'none', pointerEvents: 'none' }} />
    {!ready && fallback}
  </View>;
}
