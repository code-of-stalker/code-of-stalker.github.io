import { useThemeColors, useThemeStyles } from './ProductTheme';
import type { ProductColors } from './theme';
import { Image } from 'expo-image';
import type { PropsWithChildren, ReactNode } from 'react';
import { createContext, useContext, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { StyleProp, TextProps, TextStyle, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts } from './theme';
import { productMaxWidth, useProductSpacing } from './layout';
import { GlassHost } from './motion/GlassHost';
import { cutPanelPath, productIconPath, productIconSize } from './motion/glassShape';
import { PanelArtwork } from './motion/PanelArtwork';
import { usePanelSize } from './motion/usePanelSize';
import { ProductScroll } from './motion/ProductScroll';
import { PanelBorder } from './PanelBorder';
import { Fade } from './motion/Fade';
import { iconSource, notebookPath } from './icon-source';
import { useFittedText } from './useFittedText';
export { ScreenTransition } from './motion/ScreenTransition';

const largeScreenFontSizes: Record<string, Readonly<Record<number, number>>> = {
  [fonts.title]: { 14: 16, 20: 24, 24: 32, 40: 64 },
  // Both original 10px labels and 12px body text previously displayed at 14px.
  [fonts.body]: { 8: 12, 10: 16, 12: 16, 14: 16 },
  [fonts.bodyBold]: { 8: 12, 10: 16, 12: 16, 14: 16 },
};

const TypographySection = createContext<'default' | 'settings'>('default');

export function ProductTypography({ section, children }: PropsWithChildren<{
  section: 'default' | 'settings';
}>) {
  return <TypographySection.Provider value={section}>{children}</TypographySection.Provider>;
}

export function ProductText({ variant = 'body', style, color, maxFontSize, fitToWidth = false, minFontSize = 12, ...props }: TextProps & {
  variant?: 'title' | 'body' | 'label'; color?: string; maxFontSize?: number; fitToWidth?: boolean; minFontSize?: number;
}) {
  const styles = useThemeStyles(createStyles);
  const { width } = useWindowDimensions();
  const section = useContext(TypographySection);
  const resolved = StyleSheet.flatten<TextStyle>([styles.text, typography[variant], color ? { color } : undefined, style]);
  const baseSize = resolved.fontSize!;
  // Resolve the family and original size once; 20 -> 24 must not become 32.
  const adaptiveSize = largeScreenFontSizes[resolved.fontFamily ?? '']?.[baseSize] ?? (baseSize === 12 ? 14 : baseSize);
  const responsiveSize = width >= 375
    ? (section === 'settings' && resolved.fontFamily === fonts.body && adaptiveSize === 12 ? 10 : adaptiveSize)
    : baseSize;
  const preferredSize = maxFontSize === undefined ? responsiveSize : Math.min(responsiveSize, maxFontSize);
  const fitted = useFittedText({ enabled: fitToWidth, text: String(props.children ?? ''), size: fitToWidth ? Math.max(minFontSize, preferredSize) : preferredSize, minimum: minFontSize, tracking: resolved.letterSpacing ?? 0 });
  const fontSize = fitted.fontSize;
  const titleFace = Platform.OS === 'web' && resolved.fontFamily === fonts.title
    ? ({ '500': 'TekturMedium', '600': 'TekturSemiBold' } as Record<string, string>)[String(resolved.fontWeight)]
    : undefined;
  return <Text {...props} {...(fitToWidth ? { ref: fitted.ref, numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: minFontSize / fontSize } : {})} style={[resolved, titleFace && { fontFamily: titleFace, fontWeight: '400' }, fontSize !== baseSize && {
    fontSize,
    lineHeight: resolved.lineHeight === undefined ? undefined : Math.ceil(resolved.lineHeight * fontSize / baseSize),
  }, fitted.letterSpacing !== undefined && { letterSpacing: fitted.letterSpacing }]} />;
}

// A measured SVG outline keeps the small corner cuts and hairlines crisp at any width.
export function Panel({ children, style, cutCorner = 12, filled = false }: PropsWithChildren<{
  style?: StyleProp<ViewStyle>; cutCorner?: number; filled?: boolean;
}>) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const { inset } = useProductSpacing();
  const {ref,size,onLayout}=usePanelSize({width:0,height:0});
  const outline = useMemo(() => {
    const { width: w, height: h } = size;
    const c = Math.min(cutCorner, w / 3, h / 3);
    if (!w || !h) return undefined;
    const light = colors.background === '#FAE18F';
    const border = light ? colors.accent : StyleSheet.flatten(style)?.borderColor ?? colors.border;
    return { uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="M${w-c} 0H${w}V${c}Z M0 ${h-c}V${h}H${c}Z" fill="${colors.background}"/><path d="${cutPanelPath(w,h,cutCorner)}" stroke="${String(border)}" stroke-width=".25" fill="none"/></svg>`)}` };
  }, [size, cutCorner, style, colors]);
  return <View ref={ref} onLayout={onLayout} style={[styles.panel, { padding: inset }, filled && { backgroundColor: colors.surface }, style]}>
    {children}
    {outline && <PanelArtwork source={outline} />}
  </View>;
}

export function ProductButton({ label, onPress, kind = 'primary', style, disabled = false }: {
  label: string; onPress: () => void; kind?: 'primary' | 'outline' | 'ghost';
  style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[styles.button, kind === 'primary' ? styles.primary : kind === 'outline' ? styles.outline : undefined,
      disabled && { opacity: .4 }, style]}>
    {kind === 'outline' && <PanelBorder />}
    <ProductText variant="label" style={[styles.buttonText, kind === 'primary' && { color: colors.onAccent }]}>{label}</ProductText>
  </Pressable>;
}

const icons = {
  back: require('../../../assets/product/button-back-glyph.svg'),
  close: require('../../../assets/product/button-close-glyph.svg'),
  settings: require('../../../assets/product/settings-glyph.svg'),
  diary: require('../../../assets/product/diary-glyph.svg'),
  notes: require('../../../assets/product/levels/notes-glyph.svg'),
};
const iconLabels = { back: 'Назад', close: 'Закрыть', settings: 'Настройки', diary: 'Дневник', notes: 'Дневник' };
export function ProductIconButton({ icon, onPress }: { icon: keyof typeof icons; onPress: () => void }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const complete = icon === 'back' || icon === 'close';
  const note = useMemo(() => iconSource(notebookPath, colors.accent, 16), [colors.accent]);
  // expo-image retains its decoded image and web SVG tint filter while this
  // screen is hidden. Scope that presentation cache to the current palette,
  // including the return to an untinted source; leave the button and GPU face alive.
  const imageIdentity = icon + ':' + (colors.iconTint ?? 'source') + ':' + colors.accent;
  return <Pressable accessibilityRole="button" accessibilityLabel={iconLabels[icon]} onPress={onPress}
    style={styles.iconButton} hitSlop={2}>
    {icon === 'diary' ?
      <Image key={imageIdentity} source={icons.diary} tintColor={colors.iconTint} style={{ width: 42, height: 28 }} contentFit="contain" /> :
      <GlassHost style={[styles.iconPanel, { alignItems: 'center', justifyContent: 'center' }]} contour={productIconPath} scanOnMount={false} touchEnabled={false}>
        <Image key={imageIdentity} source={icon === 'notes' ? note : icons[icon]} tintColor={icon === 'notes' ? undefined : colors.iconTint} style={complete ? { width: productIconSize.width, height: productIconSize.height } : icon === 'notes' ? { width: 16, height: 16 } : { width: 24, height: 24 }} contentFit="contain" />
      </GlassHost>}
  </Pressable>;
}

export function ProductScreen({ children, scroll = true, style, contentStyle, background, header, headerStyle, headerFillOnScroll=false }: PropsWithChildren<{
  scroll?: boolean; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; background?: ReactNode;
  header?: ReactNode; headerStyle?: StyleProp<ViewStyle>;
  headerFillOnScroll?:boolean;
}>) {
  const styles = useThemeStyles(createStyles);
  const { gutter } = useProductSpacing();
  const [scrolled,setScrolled]=useState(false),pastTop=useRef(false);
  return <SafeAreaView testID="product-screen" edges={['top', 'left', 'right', 'bottom']} style={[styles.screen, style]}>
    {background && <View pointerEvents="none" style={StyleSheet.absoluteFill}><View style={styles.background}>{background}</View></View>}
    {header && <View style={[styles.fixedHeader, { paddingHorizontal: gutter, paddingTop: gutter },headerFillOnScroll&&{backgroundColor:'transparent'}, headerStyle]}>
      {headerFillOnScroll&&<Fade opacity={scrolled?1:0} style={StyleSheet.absoluteFill}><View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:styles.screen.backgroundColor}]} /></Fade>}{header}</View>}
    {scroll ? <ProductScroll fadeTop={!!header} style={styles.scroll} contentContainerStyle={[styles.content, { padding: gutter }, contentStyle]}
      onScroll={headerFillOnScroll?event=>{const next=event.nativeEvent.contentOffset.y>1;if(next!==pastTop.current){pastTop.current=next;setScrolled(next);}}:undefined}
      keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ProductScroll> :
      <View testID="product-workspace" style={[styles.content, { flex: 1, padding: gutter }, contentStyle]}>{children}</View>}
  </SafeAreaView>;
}

const typography: Record<'title' | 'body' | 'label', TextStyle> = {
  title: { fontFamily: fonts.title, fontSize: 20, lineHeight: 28, fontWeight: '600' },
  body: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  label: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, letterSpacing: .8 },
};
const createStyles = (colors: ProductColors) => StyleSheet.create({
  text: { color: colors.text, includeFontPadding: false },
  screen: { flex: 1, backgroundColor: colors.background },
  background: { flex: 1, width: '100%', maxWidth: productMaxWidth, alignSelf: 'center', overflow: 'hidden' },
  scroll: { flex: 1 },
  fixedHeader: { flexShrink: 0, width: '100%', maxWidth: productMaxWidth, alignSelf: 'center', backgroundColor: colors.background, zIndex: 50 },
  content: { flexGrow: 1, width: '100%', maxWidth: productMaxWidth, alignSelf: 'center' },
  panel: { padding: 12, backgroundColor: colors.background },
  button: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  primary: { backgroundColor: colors.accent },
  outline: { borderColor: colors.background === '#FAE18F' ? colors.accent : colors.border, borderWidth: 0 },
  buttonText: { textAlign: 'center', fontSize: 10, lineHeight: 14, letterSpacing: .7 },
  iconButton: { width: productIconSize.width, minHeight: productIconSize.buttonHeight, alignItems: 'center', justifyContent: 'center' },
  iconPanel: { width: productIconSize.width, height: productIconSize.height, padding: 0, justifyContent: 'center', alignItems: 'center' },
});
