import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { productStepNames } from '../content';
import { ProductText } from '../ui';
import { Reveal } from './Reveal';
import { StepChevron } from './StepChevron';
import { GlassHost } from './GlassHost';
import { stepPanelPaths } from './glassShape';
import { PanelArtwork } from './PanelArtwork';
import { usePanelSize } from './usePanelSize';
import { readingMenuPath, type ReadingMenuCutout } from './reading-menu-geometry';
import { useProduct } from '../state/ProductProvider';

const lock = { uri: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="14" viewBox="0 0 12 14" fill="none"><path d="M3 6V4Q3 1 6 1T9 4V6M1.5 6.5H10.5V13H1.5ZM6 9V10.5" stroke="#B69D4B" stroke-width=".75" stroke-linecap="round" stroke-linejoin="round"/></svg>')}` };
const steps = [1, 2, 3, 4, 5, 6, 7] as const;

/** Replace the panel's body; the compact selector also uses a framed menu. */
export function StepDropdown({ step, availableAt, testUnlockAll = false, reducedMotion, onClose, onSelect, inset = 12, embedded = false, headerless = false, frameSize, onNaturalHeight, cutout }: {
  step: keyof typeof productStepNames; availableAt: number | null; testUnlockAll?: boolean; reducedMotion: boolean; inset?: number; embedded?: boolean; headerless?: boolean;
  onClose(): void; onSelect(step: number): void; frameSize?: { width: number; height: number }; onNaturalHeight?(height: number): void;
  cutout?: ReadingMenuCutout;
}) {
  const colors = useThemeColors();
  const { progress } = useProduct();
  const styles = useThemeStyles(createStyles);
  const {ref,size:measuredSize,onLayout}=usePanelSize({width:288,height:314});
  const {ref:headerRef,size:headerSize,onLayout:onHeaderLayout}=usePanelSize({width:288,height:25});
  const headerHeight=headerSize.height;
  const [contentHeight, setContentHeight] = useState(0);
  const topInset = headerless ? 8 : headerHeight + 33, bottomInset = headerless ? 8 : inset;
  useEffect(() => {
    if (contentHeight > 0) onNaturalHeight?.(embedded ? contentHeight : topInset + contentHeight + bottomInset);
  }, [contentHeight, topInset, bottomInset, embedded, onNaturalHeight]);
  const contour=useCallback((width:number,height:number)=>headerless ? readingMenuPath(width,height,cutout) : stepPanelPaths(width,height,headerHeight).path,[headerHeight,headerless,cutout]);
  const size = frameSize ?? measuredSize;
  // Preserve Figma's top notch and draw one bottom edge at the actual height.
  // A rotated fixed-size body left a second edge below shorter menus.
  const geometry = useMemo(() => {
    const w = size.width, h = size.height, paths = stepPanelPaths(w, h, headerHeight);
    const path = headerless ? readingMenuPath(w,h,cutout) : paths.path;
    const light = colors.background === '#FAE18F', border = light ? colors.accent : colors.border, stroke = '.25';
    const svg = (content: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${content}</svg>`)}`;
    return {
      path,
      backing: { uri: svg(`<path d="${path}" fill="${colors.background}"/>`) },
      frame: { uri: svg(headerless ? `<path d="${path}" fill="none" stroke="${border}" stroke-width="${stroke}"/>` : `<path d="${paths.top}" fill="${colors.accent}" fill-opacity=".1" stroke="${border}" stroke-width="${stroke}"/><path d="${paths.body}" fill="none" stroke="${border}" stroke-width="${stroke}"/>`) },
    };
  }, [size.width, size.height, headerHeight, headerless, cutout, colors]);
  const options = <ScrollView accessibilityLabel="Доступные и закрытые шаги" onContentSizeChange={(_, height) => setContentHeight(previous => previous === height ? previous : height)} style={embedded ? styles.embeddedList : [styles.list, { top: topInset, bottom: bottomInset }]}
    contentContainerStyle={[styles.options, embedded && { paddingTop: 18, paddingBottom: inset }]} showsVerticalScrollIndicator={false}>
    {steps.map(value => {
      const disabled = value > 3 || value === 3 && !progress.secondStepCompletedAt && !testUnlockAll || value === 2 && availableAt === null && !testUnlockAll;
      return <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === step, disabled }} disabled={disabled}
        onPress={() => onSelect(value)} style={[styles.option, { paddingHorizontal: inset }, value === step && (Platform.OS === 'web'
          ? { backgroundImage: `linear-gradient(90deg,${colors.subtle} 40%,${colors.background}19)` } as ViewStyle
          : { backgroundColor: colors.subtle })]}>
        <ProductText testID={`step-option-label-${value}`} fitToWidth variant="label" color={value === step ? colors.text : colors.muted} style={styles.optionText}>{`ШАГ ${value}. ${productStepNames[value]}`}</ProductText>
        {disabled && <Image pointerEvents="none" source={lock} tintColor={colors.iconTint} style={styles.lock} contentFit="contain" />}
      </Pressable>;
    })}
  </ScrollView>;
  const content = <View style={embedded ? styles.embedded : styles.overlay}>
    {embedded ? options : <>
      {/* Occlude only the menu's silhouette. Text above it stays mounted and visible. */}
      {Platform.OS === 'web'
        ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, clipPath: `path('${geometry.path}')` } as ViewStyle]} />
        : <PanelArtwork source={geometry.backing} />}
      <GlassHost style={[styles.fill, headerless && Platform.OS === 'web' && { clipPath: `path('${geometry.path}')` } as ViewStyle]} contour={contour} reducedMotion={reducedMotion} scanOnMount={false}>
      {!frameSize && <View ref={ref} pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout} />}
      <PanelArtwork source={geometry.frame} />
      {!headerless && <Pressable ref={headerRef} onLayout={onHeaderLayout} accessibilityRole="button" accessibilityLabel="Свернуть выбор шага" accessibilityState={{ expanded: true }} aria-expanded
        onPress={onClose} style={[styles.trigger, { paddingHorizontal: inset }]}>
        <ProductText fitToWidth variant="label" style={styles.title}>{`ШАГ ${step}. ${productStepNames[step]}`}</ProductText>
        <StepChevron expanded />
      </Pressable>}
      {options}
    </GlassHost></>}
  </View>;
  return embedded ? <Reveal reducedMotion={reducedMotion} style={styles.embedded}>{content}</Reveal> : content;
}
const createStyles = (colors: ProductColors) => StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 20 }, fill: { flex: 1 },
  embedded: { flex: 1, minHeight: 0 }, embeddedList: { flex: 1 },
  trigger: { minHeight: 25, flexShrink: 0, paddingVertical: 5.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, gap: 8 },
  title: { fontSize: 10, lineHeight: 14, letterSpacing: 2.2, flex: 1, minWidth: 0 },
  list: { position: 'absolute', left: 0, right: 0, top: 58, bottom: 14 },
  // Row padding contributes 16px between adjacent labels; the 4px gap caps
  // their visible separation at 20px, independently of screen height.
  options: { gap: 4 },
  option: { minHeight: 32, paddingHorizontal: 8, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  optionText: { fontSize: 10, lineHeight: 14, letterSpacing: 2.2, flex: 1, minWidth: 0 },
  lock: { width: 12, height: 14, flexShrink: 0 },
});
