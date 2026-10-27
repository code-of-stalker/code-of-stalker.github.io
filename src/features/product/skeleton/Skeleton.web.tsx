import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemeColors } from '../ProductTheme';
import { useEffectsController } from '../motion/EffectsQuality';
import { useSystemReducedMotion } from '../motion/useSystemReducedMotion.web';
import { skeletonCuts, skeletonTone, type SkeletonBlockProps, type SkeletonCorners, type SkeletonHostProps } from './skeleton.types';
import { skeletonDriver } from './skeletonField.web';

/** Lifecycle and accessibility only. The Rust field decides when the skeleton
 * appears, writes its scan every frame and dissolves it into the content. */
export function SkeletonHost({ ready, reducedMotion = false, label, style, testID, children }: SkeletonHostProps) {
  const host = useRef<View>(null), controller = useEffectsController(), system = useSystemReducedMotion();
  const [gone, setGone] = useState(ready);
  const latest = useRef({ ready, reduced: reducedMotion || system });
  const surface = useRef<{ settle(): void; reduced(value: boolean): void } | null>(null), still = useRef(false);
  useLayoutEffect(() => { latest.current = { ready, reduced: reducedMotion || system }; });
  useEffect(() => {
    const element = host.current as unknown as HTMLElement | null;
    if (!element) return;
    let live = true, release = () => {};
    void skeletonDriver().then(driver => {
      if (!live) return;
      driver.reduced(latest.current.reduced);
      const id = driver.attach(element, controller, () => { if (live) setGone(true); });
      release = () => driver.release(id);
      surface.current = { settle: () => driver.settle(id), reduced: value => driver.reduced(value) };
      if (latest.current.ready) driver.settle(id);
    }).catch(error => {
      if (!live) return;
      // Without its module the skeleton stays still until the content is ready.
      console.error('Rust skeleton:', error); still.current = true; element.style.opacity = '1';
      if (latest.current.ready) setGone(true);
    });
    return () => { live = false; release(); surface.current = null; };
  }, [controller]);
  useEffect(() => {
    if (!ready) return;
    surface.current?.settle();
    if (still.current) setGone(true);
  }, [ready]);
  useEffect(() => { surface.current?.reduced(reducedMotion || system); }, [reducedMotion, system]);
  if (gone) return null;
  return <View ref={host} testID={testID} pointerEvents="none" role={label ? 'progressbar' : undefined} aria-label={label} aria-busy={label ? true : undefined}
    aria-hidden={label ? undefined : true} style={[StyleSheet.absoluteFill, styles.host, style]}>{children}</View>;
}

const clip = (corners: SkeletonCorners) => {
  const { topRight: tr, bottomRight: br, bottomLeft: bl } = skeletonCuts[corners];
  return tr || br || bl ? `polygon(0 0,calc(100% - ${tr}px) 0,100% ${tr}px,100% calc(100% - ${br}px),calc(100% - ${br}px) 100%,${bl}px 100%,0 calc(100% - ${bl}px))` : undefined;
};

/** A shape of the coming content. Its band of light is three viewports wide
 * and fixed to the viewport, so one pass crosses every shape on the page. */
export function SkeletonBlock({ corners = 'none', style }: SkeletonBlockProps) {
  const tone = skeletonTone(useThemeColors());
  const paint: CSSProperties = {
    position: 'absolute', inset: 0, backgroundColor: tone.fill, clipPath: clip(corners),
    backgroundImage: `linear-gradient(100deg,transparent 42%,${tone.light} 50%,transparent 58%)`,
    backgroundSize: '300% 100%', backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed',
    backgroundPosition: 'calc(var(--skeleton-sweep, 1) * 100%) 0',
  };
  return <View style={style}><div data-skeleton-shape style={paint} /></View>;
}

const styles = StyleSheet.create({ host: { opacity: 0, overflow: 'hidden' } });
