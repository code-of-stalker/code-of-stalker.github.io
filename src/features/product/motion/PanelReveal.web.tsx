import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { loadGraphics } from './rustEngine.web';

export function usePanelReveal(enabled: boolean, reducedMotion: boolean) {
  const ref = useRef<View>(null), [progress] = useState(() => new Animated.Value(1));
  const apply = useRef<((root: HTMLElement, progress: number, reduced: boolean) => void) | null>(null), latest = useRef({ value: 0, immediate: !enabled || reducedMotion });
  useEffect(() => { latest.current.immediate = !enabled || reducedMotion; if (ref.current) apply.current?.(ref.current as unknown as HTMLElement, latest.current.value, latest.current.immediate); }, [enabled, reducedMotion]);
  useEffect(() => { let disposed = false; void loadGraphics().then(module => { if (disposed) return; apply.current = module.panel_reveal;
    if (ref.current) apply.current(ref.current as unknown as HTMLElement, latest.current.value, latest.current.immediate);
  }).catch(problem => { console.error('Rust panel reveal:', problem);
    // Without the engine no scan can lift the starting mask: show the panel as it is.
    const element = ref.current as unknown as HTMLElement | null;
    if (!disposed && element) { element.style.maskImage = 'none'; element.style.webkitMaskImage = 'none'; }
  }); return () => { disposed = true; }; }, []);
  const report = useCallback((value: number) => { latest.current.value = value;
    if (ref.current) apply.current?.(ref.current as unknown as HTMLElement, value, latest.current.immediate);
  }, []);
  return { ref, report, progress, initialStyle: { maskImage: !enabled || reducedMotion ? 'none' : 'linear-gradient(transparent,transparent)' } as ViewStyle };
}
export function NativePanelReveal(_props: { progress: Animated.Value; height: number }) { return null; }
