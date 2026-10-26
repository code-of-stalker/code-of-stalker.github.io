import { useMemo } from 'react';
import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Art } from './Art';
import type { ArtKind } from './types';
import { homeGlassShape } from './glassShape';
import { NativePanelReveal, usePanelReveal } from './PanelReveal';
import { useThemeColors } from '../ProductTheme';
import { GlassOutline } from './GlassOutline';
import type { HomeTitleGradient } from './homeTitleGradient';
import { ScanLight } from './ScanLight';
import { PanelArtwork } from './PanelArtwork';
import { usePanelSize } from './usePanelSize';

export function HomeCard({ children, artwork }: PropsWithChildren<{ artwork: { kind: ArtKind; onPress(): void; accessibilityLabel: string; reducedMotion?: boolean } }>) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const { ref, report, progress, initialStyle } = usePanelReveal(true, !!artwork.reducedMotion);
  const {size,onLayout}=usePanelSize({width:288,height:200},ref);
  const glass = useMemo(() => homeGlassShape(width, size.width, size.height), [width, size]);
  const fillClip = Platform.OS === 'web' ? { clipPath: `path('${glass.path}')` } as ViewStyle : undefined;
  const themedMask = useMemo(() => ({ uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}"><path fill="${colors.background}" fill-rule="evenodd" d="M0 0H${size.width}V${size.height}H0Z ${glass.path}"/></svg>`)}` }), [colors.background, size, glass.path]);
  return <View style={styles.card}><View ref={ref} style={[styles.card, initialStyle]} onLayout={onLayout}>
    {/* Clip every interior layer together; cut corners reveal the moving backdrop. */}
    <View testID="home-card-fill" style={[StyleSheet.absoluteFill, fillClip]}>
      <View style={StyleSheet.absoluteFill}><Art {...artwork} height={size.height} width={size.width} glass={glass} presentation="card" onRevealProgress={report} /></View>
      {children}
    </View>
    {Platform.OS !== 'web' && <PanelArtwork source={themedMask} style={styles.mask} />}
    {Platform.OS === 'web' ? <svg aria-hidden focusable="false" data-home-frame
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 4, pointerEvents: 'none' }}>
      {/* The border stays outside the fill clip, including on short desktop cards. */}
      <path d={glass.path} fill="none" stroke={colors.accent} strokeWidth={0.25} vectorEffect="non-scaling-stroke" />
    </svg> : <GlassOutline width={size.width} height={size.height} path={glass.path} />}
    <NativePanelReveal progress={progress} height={size.height} />
  </View><ScanLight path={glass.path}/></View>;
}

// The shade begins at the text block and runs flush to the bottom of the card.
// On the left it starts just inside the 0.25px stroke at full strength: the
// authored left fade (7% of the shade's width) is pushed outside the clip.
const shadeLeftFade = .07, strokeClear = 1;
export function HomeCardCopy({ children, inset, gradient, style }: PropsWithChildren<{
  inset: number; gradient: HomeTitleGradient; style?: StyleProp<ViewStyle>;
}>) {
  const { size, onLayout, ref } = usePanelSize({ width: 260, height: 110 });
  const fade = size.width * shadeLeftFade / (1 - shadeLeftFade);
  return <View ref={ref} onLayout={onLayout} pointerEvents="none" testID={`home-copy-${gradient}`} style={[styles.copy, { paddingBottom: inset, paddingLeft: inset - strokeClear, paddingRight: Math.max(0, inset - 5) }, style]}>
    <View pointerEvents="none" style={[styles.shade, { left: -fade }]}><Art kind="home-shade" width={size.width + fade} height={size.height} reducedMotion /></View>
    {children}
  </View>;
}
const styles = StyleSheet.create({
  card: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: 'transparent' },
  copy: { position: 'absolute', left: strokeClear, right: 28, bottom: 0, gap: 4, zIndex: 2 },
  shade: { position: 'absolute', top: 0, right: 0, bottom: 0, overflow: 'hidden' },
  mask: { ...StyleSheet.absoluteFill, zIndex: 3 },
});
