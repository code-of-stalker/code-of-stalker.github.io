import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { ScrollViewProps, ViewStyle } from 'react-native';

/** Fade the stationary viewport edge, without rerendering content on scroll. */
export function ProductScroll({ fadeTop = false, style, ...props }: ScrollViewProps & { fadeTop?: boolean }) {
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    const element = (ref.current as unknown as { getScrollableNode(): HTMLElement } | null)?.getScrollableNode();
    if (!element || !fadeTop) return;
    const update = () => element.style.setProperty('--header-fade', `${Math.min(28, Math.max(0, element.scrollTop))}px`);
    update(); element.addEventListener('scroll', update, { passive: true });
    return () => element.removeEventListener('scroll', update);
  }, [fadeTop]);
  return <ScrollView ref={ref} {...props} style={[style, fadeTop && fade]} />;
}
const fade = StyleSheet.create({ edge: {
  maskImage: 'linear-gradient(to bottom, transparent, #000 var(--header-fade, 0px), #000)',
  WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 var(--header-fade, 0px), #000)',
  maskMode: 'alpha', maskSize: '100% 100%', maskRepeat: 'no-repeat',
} as ViewStyle }).edge;
