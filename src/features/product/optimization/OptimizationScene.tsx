import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Art } from '../motion/Art';
import type { ArtController } from '../motion/types';
import { cutPanelPath } from '../motion/glassShape';
import { usePanelSize } from '../motion/usePanelSize';
import { useEffectsController } from '../motion/EffectsQuality';
import { productMaxWidth, productSpacing } from '../layout';

/** Onscreen, fully sized and covered by opaque UI. Never hidden/display:none:
 * intersection/renderer lifecycle must keep doing real representative work. */
export function OptimizationScene({ active, onReady }: { active: boolean; onReady(): void }) {
  const controller = useEffectsController(), glassController = useRef<ArtController | null>(null);
  const { width: screenWidth, height } = useWindowDimensions(), width = Math.min(screenWidth, productMaxWidth);
  const gutter = productSpacing(width).gutter, artWidth = width - gutter * 2, mirrorHeight = artWidth * 206 / 288;
  const ready = useRef(new Set<string>());
  const mark = useCallback((kind: string) => { ready.current.add(kind); if (ready.current.size === 4) onReady(); }, [onReady]);
  const rainReady = useCallback(() => mark('rain'), [mark]), mirrorReady = useCallback(() => mark('mirror'), [mark]);
  const glassReady = useCallback(() => mark('glass'), [mark]), vectorReady = useCallback(() => mark('vector'), [mark]);
  const { ref, size, onLayout } = usePanelSize({ width: artWidth, height: Math.min(300, height * .42) });
  const glass = useMemo(() => ({ ...size, path: cutPanelPath(size.width, size.height), background: 'clear' as const }), [size]);
  useEffect(() => {
    if (!active) return;
    // Exercise actual optical/touch shading, rather than an already idle pane.
    return controller?.frameJob(at => glassController.current?.interact({ type: 'watcher-art-interaction', action: 'benchmark', at }));
  }, [active, controller]);
  return <View testID="device-optimization-scene" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={StyleSheet.absoluteFill}>
    <View style={{ width, height, alignSelf: 'center' }}>
      <Art kind="rain" width={width} height={height} active={active} scanOnMount={false} onReady={rainReady} />
      <View style={{ position: 'absolute', top: gutter, left: gutter }}>
        <Art kind="mirror" width={artWidth} height={mirrorHeight} active={active} scanOnMount={false} onReady={mirrorReady} />
      </View>
      <View ref={ref} onLayout={onLayout} style={{ position: 'absolute', top: Math.min(height * .35, mirrorHeight), left: gutter, width: artWidth, height: Math.min(300, height * .42) }}>
        <Art kind="glass" width={size.width} height={size.height} glass={glass} controllerRef={glassController} active={active} scanOnMount={false} onReady={glassReady} />
      </View>
      <View style={{ position: 'absolute', bottom: gutter, right: gutter }}>
        <Art kind="basic" width={artWidth * .7} height={artWidth * .7} active={active} scanOnMount={false} onReady={vectorReady} />
      </View>
    </View>
  </View>;
}
