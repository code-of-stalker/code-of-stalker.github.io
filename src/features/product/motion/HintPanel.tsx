import { useMemo, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { productMaxWidth, useProductSpacing } from '../layout';
import { ProductText } from '../ui';
import { GlassHost } from './GlassHost';
import { useThemeColors } from '../ProductTheme';
import { panelAsset } from '../panelAssets';
import { PanelArtwork } from './PanelArtwork';

// Figma 1130:42072: separate 25px header, 10px gap and 282px scroll viewport.
// The reference SVG is an edge gradient. Keep the same stops inline so a
// delayed/failed CSS image mask cannot hide all the copy on Android.
const edgeMask = 'linear-gradient(to left, transparent, #000 6.00913%, #000 97.6746%, transparent)';
const mask = Platform.OS === 'web' ? {
  maskImage: edgeMask,
  maskSize: '100% 100%', maskRepeat: 'no-repeat', maskMode: 'alpha',
  WebkitMaskImage: edgeMask,
  WebkitMaskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat',
} as ViewStyle : undefined;
const bottomMask = Platform.OS === 'web' ? {
  maskImage: 'linear-gradient(to bottom, #000, #000 calc(100% - var(--hint-fade-bottom, 0px)), transparent)',
  WebkitMaskImage: 'linear-gradient(to bottom, #000, #000 calc(100% - var(--hint-fade-bottom, 0px)), transparent)',
  maskSize: '100% 100%', maskRepeat: 'no-repeat', maskMode: 'alpha',
  WebkitMaskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat',
} as ViewStyle : undefined;

const contour = (width: number, height: number) => {
  const ratio = width / 288, top = 25 * ratio, start = 35 * ratio;
  return `M.125 .125H${width-.125}V${top-.125}H.125ZM.125 ${start}H${width-.125}V${height-.125}H.125Z`;
};
export function HintPanel({ text, reducedMotion = false }: { text: string; reducedMotion?: boolean }) {
  const colors = useThemeColors();
  const frames = useMemo(() => ({ header: panelAsset('hint-header', colors), body: panelAsset('hint-body', colors) }), [colors]);
  const fadeViewport = useRef<View>(null);
  const scrollGeometry = useRef({ offset: 0, height: 0, content: 0 });
  function updateBottomFade() {
    if (Platform.OS !== 'web') return;
    const { offset, height, content } = scrollGeometry.current;
    const remaining = content - height - offset;
    // Feather the scrollable copy only. The glass and its border stay intact;
    // reaching the end restores full opacity to the final line.
    const edge = remaining <= 1 ? 0 : Math.min(32, remaining);
    (fadeViewport.current as unknown as HTMLElement | null)?.style.setProperty('--hint-fade-bottom', `${edge}px`);
  }
  const { width: windowWidth, height } = useWindowDimensions();
  const { gutter, inset } = useProductSpacing();
  const ratio = (Math.min(windowWidth, productMaxWidth) - gutter * 2) / 288;
  return <GlassHost accessibilityLabel="Подсказка" contour={contour} reducedMotion={reducedMotion} scanOnMount={false} style={[styles.panel, {
    maxWidth: productMaxWidth - gutter * 2, height: Math.min(height * .58, 317 * ratio), gap: 10 * ratio,
  }]}>
    <View style={[styles.header, { height: 25 * ratio, paddingHorizontal: inset }]}>
      <PanelArtwork source={frames.header} />
      <ProductText variant="label" style={styles.title}>ПОДСКАЗКА</ProductText>
    </View>
    <View style={styles.body}>
      <PanelArtwork source={frames.body} />
      <View style={[styles.viewport, mask]}>
        <View ref={fadeViewport} style={[styles.viewport, bottomMask]}>
        <ScrollView accessibilityLabel="Текст подсказки" style={styles.viewport} contentContainerStyle={{ padding: inset }} showsVerticalScrollIndicator={false}
          onLayout={event => { scrollGeometry.current.height = event.nativeEvent.layout.height; updateBottomFade(); }}
          onContentSizeChange={(_, contentHeight) => { scrollGeometry.current.content = contentHeight; updateBottomFade(); }}
          scrollEventThrottle={16} onScroll={event => {
            scrollGeometry.current = { offset: event.nativeEvent.contentOffset.y, height: event.nativeEvent.layoutMeasurement.height, content: event.nativeEvent.contentSize.height };
            updateBottomFade();
          }}>
          <ProductText style={styles.copy}>{text}</ProductText>
        </ScrollView>
        </View>
      </View>
    </View>
  </GlassHost>;
}

const styles = StyleSheet.create({
  panel: { width: '100%', alignSelf: 'center' },
  header: { justifyContent: 'center', flexShrink: 0 },
  title: { fontSize: 10, lineHeight: 14, letterSpacing: 2.2 },
  body: { flex: 1, minHeight: 0 },
  viewport: { flex: 1, minHeight: 0, overflow: 'hidden' },
  copy: { fontSize: 12, lineHeight: 17, textTransform: 'uppercase', marginBottom: 16 },
});
